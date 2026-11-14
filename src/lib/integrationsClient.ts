import {
  auth,
  deleteAutomationRuleFromFirestore,
  saveAlertRoutingToFirestore,
  saveAutomationRuleToFirestore,
  saveIntegrationConfigToFirestore,
  saveIntegrationLogToFirestore,
} from './firebase';
import { getStoredOtpSession } from './otpAuth';
import type {
  AlertRoutingMatrix,
  AutomationRuleRecord,
  IntegrationId,
  IntegrationLogEntry,
  IntegrationRecord,
} from '../types/integrations';

export interface IntegrationHubSnapshot {
  integrations: IntegrationRecord[];
  routing: AlertRoutingMatrix;
  rules: AutomationRuleRecord[];
  logs: IntegrationLogEntry[];
}

export interface ConnectionActionResponse {
  status: IntegrationRecord['status'];
  statusLabel: IntegrationRecord['statusLabel'];
  message: string;
  testedAt: string;
  record: IntegrationRecord;
  logEntry?: IntegrationLogEntry;
  logs: IntegrationLogEntry[];
}

const DIRECT_SESSION_KEY = 'firefall_direct_operator_session_v1';
let inflightSessionPromise: Promise<string | null> | null = null;

async function getOrIssueOperatorToken(): Promise<string | null> {
  const otpSession = getStoredOtpSession();
  if (otpSession?.token) {
    return otpSession.token;
  }

  try {
    const raw = localStorage.getItem(DIRECT_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { token?: string; expiresAt?: string };
      if (parsed.token && parsed.expiresAt && new Date(parsed.expiresAt).getTime() > Date.now() + 60_000) {
        return parsed.token;
      }
    }
  } catch {
    // Ignore storage read errors
  }

  if (!inflightSessionPromise) {
    inflightSessionPromise = (async () => {
      try {
        let operatorId = '';
        try {
          operatorId = localStorage.getItem('firefall_operator_id_v1') || '';
          if (!operatorId) {
            operatorId = `cmd_${Math.random().toString(36).slice(2, 10)}`;
            localStorage.setItem('firefall_operator_id_v1', operatorId);
          }
        } catch {
          operatorId = 'cmd_browser';
        }

        const res = await fetch('/api/auth/operator-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operatorId }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { token?: string; expiresAt?: string };
        if (!data.token) return null;
        try {
          localStorage.setItem(
            DIRECT_SESSION_KEY,
            JSON.stringify({ token: data.token, expiresAt: data.expiresAt })
          );
        } catch {
          // Ignore storage write errors
        }
        return data.token;
      } catch {
        return null;
      } finally {
        inflightSessionPromise = null;
      }
    })();
  }

  return inflightSessionPromise;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (auth.currentUser) {
    const idToken = await auth.currentUser.getIdToken();
    headers.Authorization = `Bearer ${idToken}`;
  } else {
    const opToken = await getOrIssueOperatorToken();
    if (opToken) {
      headers.Authorization = `Bearer ${opToken}`;
    }
  }

  return headers;
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Integration API error (${res.status}).`);
  }
  return data;
}

export async function fetchIntegrationHubState(): Promise<IntegrationHubSnapshot> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/integrations/state', { headers });
  return parseJsonOrThrow<IntegrationHubSnapshot>(res);
}

export async function connectIntegration(
  integrationId: IntegrationId,
  payload: {
    publicConfig: Record<string, string | boolean>;
    secrets: Record<string, string>;
    runTest?: boolean;
  }
): Promise<ConnectionActionResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/integrations/${encodeURIComponent(integrationId)}/connect`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await parseJsonOrThrow<ConnectionActionResponse>(res);
  if (auth.currentUser) {
    await saveIntegrationConfigToFirestore(data.record).catch(() => undefined);
    if (data.logEntry) {
      await saveIntegrationLogToFirestore(data.logEntry).catch(() => undefined);
    }
  }
  return data;
}

export async function testIntegration(integrationId: IntegrationId): Promise<ConnectionActionResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/integrations/${encodeURIComponent(integrationId)}/test`, {
    method: 'POST',
    headers,
  });
  const data = await parseJsonOrThrow<ConnectionActionResponse>(res);
  if (auth.currentUser) {
    await saveIntegrationConfigToFirestore(data.record).catch(() => undefined);
    if (data.logEntry) {
      await saveIntegrationLogToFirestore(data.logEntry).catch(() => undefined);
    }
  }
  return data;
}

export async function reconnectIntegration(integrationId: IntegrationId): Promise<ConnectionActionResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/integrations/${encodeURIComponent(integrationId)}/reconnect`, {
    method: 'POST',
    headers,
  });
  const data = await parseJsonOrThrow<ConnectionActionResponse>(res);
  if (auth.currentUser) {
    await saveIntegrationConfigToFirestore(data.record).catch(() => undefined);
  }
  return data;
}

export async function disconnectIntegration(
  integrationId: IntegrationId,
  purgeSecrets = false
): Promise<{ record: IntegrationRecord; logs: IntegrationLogEntry[] }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/integrations/${encodeURIComponent(integrationId)}/disconnect`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ purgeSecrets }),
  });
  const data = await parseJsonOrThrow<{ record: IntegrationRecord; logs: IntegrationLogEntry[] }>(res);
  if (auth.currentUser) {
    await saveIntegrationConfigToFirestore(data.record).catch(() => undefined);
  }
  return data;
}

export async function dispatchIntegrationEvent(
  integrationId: IntegrationId,
  payload: {
    eventType: IntegrationLogEntry['eventType'];
    severity: 'normal' | 'warning' | 'critical';
    title: string;
    message: string;
    dedupeKey?: string;
    telemetrySummary?: Record<string, unknown>;
  }
): Promise<{ delivered: boolean; deduplicated?: boolean; logEntry?: IntegrationLogEntry; logs: IntegrationLogEntry[] }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/integrations/${encodeURIComponent(integrationId)}/dispatch`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const data = await parseJsonOrThrow<{
    delivered: boolean;
    deduplicated?: boolean;
    logEntry?: IntegrationLogEntry;
    logs: IntegrationLogEntry[];
  }>(res);
  if (auth.currentUser && data.logEntry) {
    await saveIntegrationLogToFirestore(data.logEntry).catch(() => undefined);
  }
  return data;
}

export async function saveAlertRouting(
  routing: AlertRoutingMatrix
): Promise<{ routing: AlertRoutingMatrix; logs: IntegrationLogEntry[] }> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/integrations/routing', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ routing }),
  });
  const data = await parseJsonOrThrow<{ routing: AlertRoutingMatrix; logs: IntegrationLogEntry[] }>(res);
  if (auth.currentUser) {
    await saveAlertRoutingToFirestore(data.routing).catch(() => undefined);
  }
  return data;
}

export async function saveAutomationRule(
  rule: AutomationRuleRecord
): Promise<{ rules: AutomationRuleRecord[]; logs: IntegrationLogEntry[] }> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/integrations/rules', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ rule }),
  });
  const data = await parseJsonOrThrow<{ rules: AutomationRuleRecord[]; logs: IntegrationLogEntry[] }>(res);
  if (auth.currentUser) {
    await saveAutomationRuleToFirestore(rule).catch(() => undefined);
  }
  return data;
}

export async function removeAutomationRule(
  ruleId: string
): Promise<{ rules: AutomationRuleRecord[]; logs: IntegrationLogEntry[] }> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/integrations/rules/${encodeURIComponent(ruleId)}`, {
    method: 'DELETE',
    headers,
  });
  const data = await parseJsonOrThrow<{ rules: AutomationRuleRecord[]; logs: IntegrationLogEntry[] }>(res);
  if (auth.currentUser) {
    await deleteAutomationRuleFromFirestore(ruleId).catch(() => undefined);
  }
  return data;
}

export async function testAutomationRule(ruleId: string): Promise<{
  rule: AutomationRuleRecord;
  actionSummaries: string[];
  rules: AutomationRuleRecord[];
  logs: IntegrationLogEntry[];
}> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/api/integrations/rules/${encodeURIComponent(ruleId)}/test`, {
    method: 'POST',
    headers,
  });
  const data = await parseJsonOrThrow<{
    rule: AutomationRuleRecord;
    actionSummaries: string[];
    rules: AutomationRuleRecord[];
    logs: IntegrationLogEntry[];
  }>(res);
  if (auth.currentUser) {
    await saveAutomationRuleToFirestore(data.rule).catch(() => undefined);
  }
  return data;
}

export async function logClientWorkspaceEvent(
  entry: Omit<IntegrationLogEntry, 'id' | 'timestamp'>
): Promise<{ logEntry: IntegrationLogEntry; logs: IntegrationLogEntry[]; integrations: IntegrationRecord[] }> {
  const headers = await getAuthHeaders();
  const res = await fetch('/api/integrations/logs', {
    method: 'POST',
    headers,
    body: JSON.stringify({ entry }),
  });
  const data = await parseJsonOrThrow<{
    logEntry: IntegrationLogEntry;
    logs: IntegrationLogEntry[];
    integrations: IntegrationRecord[];
  }>(res);
  if (auth.currentUser && data.logEntry) {
    await saveIntegrationLogToFirestore(data.logEntry).catch(() => undefined);
  }
  return data;
}
