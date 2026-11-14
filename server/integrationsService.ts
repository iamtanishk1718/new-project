import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  INTEGRATION_BY_ID,
  INTEGRATION_CATALOG,
  createDefaultAlertRoutingMatrix,
  createDefaultAutomationRules,
} from '../src/lib/integrationCatalog.ts';
import type {
  AlertRoutingMatrix,
  AutomationRuleRecord,
  IntegrationConnectionStatus,
  IntegrationDefinition,
  IntegrationId,
  IntegrationLogEntry,
  IntegrationRecord,
} from '../src/types/integrations.ts';
import { verifyOtpSessionToken } from './otpService.ts';
import {
  buildMaskedSecretSummary,
  checkAndMarkDuplicate,
  checkRateLimit,
  deleteEncryptedIntegrationSecrets,
  getActorState,
  getDecryptedIntegrationSecrets,
  sanitizeLogDetail,
  saveActorState,
  saveEncryptedIntegrationSecrets,
  validateExternalWebhookUrl,
} from './secretVault.ts';

export class IntegrationServiceError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'IntegrationServiceError';
    this.statusCode = statusCode;
  }
}

export interface AuthenticatedActor {
  actorId: string;
  displayName: string;
  email?: string;
  authSource: 'otp' | 'firebase';
}

interface StoredActorIntegrationsState {
  records: Record<string, IntegrationRecord>;
  routing: AlertRoutingMatrix;
  rules: AutomationRuleRecord[];
  logs: IntegrationLogEntry[];
}

const firebaseTokenCache = new Map<string, { uid: string; email?: string; displayName?: string; expMs: number }>();

function loadFirebaseApiKey(): string | null {
  try {
    const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as { apiKey?: string };
      return parsed.apiKey || null;
    }
  } catch {
    // Ignore read errors
  }
  return process.env.VITE_FIREBASE_API_KEY || null;
}

export async function resolveAuthenticatedActor(authHeader?: string): Promise<AuthenticatedActor> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    throw new IntegrationServiceError('Authentication required to access Integration Hub.', 401);
  }

  // 1. Check signed OTP session token first
  const otpUser = verifyOtpSessionToken(token);
  if (otpUser) {
    return {
      actorId: `otp_${otpUser.id}`,
      displayName: otpUser.displayName,
      email: otpUser.channel === 'email' ? otpUser.identifier : undefined,
      authSource: 'otp',
    };
  }

  // 2. Verify Firebase ID Token via Identity Toolkit accounts:lookup
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const cached = firebaseTokenCache.get(tokenHash);
  if (cached && cached.expMs > Date.now()) {
    return {
      actorId: `fb_${cached.uid}`,
      displayName: cached.displayName || cached.email || cached.uid,
      email: cached.email,
      authSource: 'firebase',
    };
  }

  const apiKey = loadFirebaseApiKey();
  if (!apiKey) {
    throw new IntegrationServiceError('Authentication verification is unavailable.', 401);
  }

  try {
    const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
      signal: AbortSignal.timeout(6000),
    });

    if (!resp.ok) {
      throw new IntegrationServiceError('Invalid or expired authentication session.', 401);
    }

    const data = (await resp.json()) as {
      users?: Array<{ localId?: string; email?: string; displayName?: string }>;
    };
    const fbUser = data.users?.[0];
    if (!fbUser?.localId) {
      throw new IntegrationServiceError('Unable to verify user identity.', 401);
    }

    firebaseTokenCache.set(tokenHash, {
      uid: fbUser.localId,
      email: fbUser.email,
      displayName: fbUser.displayName,
      expMs: Date.now() + 5 * 60 * 1000,
    });

    return {
      actorId: `fb_${fbUser.localId}`,
      displayName: fbUser.displayName || fbUser.email || fbUser.localId,
      email: fbUser.email,
      authSource: 'firebase',
    };
  } catch (err) {
    if (err instanceof IntegrationServiceError) throw err;
    throw new IntegrationServiceError('Session authentication failed.', 401);
  }
}

export function getStatusLabel(status: IntegrationConnectionStatus): IntegrationRecord['statusLabel'] {
  switch (status) {
    case 'connected':
      return 'Connected Successfully';
    case 'disconnected':
      return 'Disconnected';
    case 'auth_failed':
      return 'Authentication Failed';
    case 'error':
      return 'Connection Error';
    default:
      return 'Not Configured';
  }
}

function buildDefaultRecord(def: IntegrationDefinition): IntegrationRecord {
  return {
    integrationId: def.id,
    enabled: false,
    status: 'not_configured',
    statusLabel: 'Not Configured',
    publicConfig: {},
    hasSecrets: false,
    maskedSecretSummary: '',
    updatedAt: new Date().toISOString(),
  };
}

function loadActorIntegrationsState(actorId: string): StoredActorIntegrationsState {
  const existing = getActorState<StoredActorIntegrationsState>(actorId, 'integration_hub');
  const records: Record<string, IntegrationRecord> = {};

  for (const def of INTEGRATION_CATALOG) {
    const saved = existing?.records?.[def.id];
    if (saved) {
      // Ensure zero plaintext secrets ever linger in records
      records[def.id] = {
        ...buildDefaultRecord(def),
        ...saved,
        statusLabel: getStatusLabel(saved.status),
      };
    } else {
      records[def.id] = buildDefaultRecord(def);
    }
  }

  return {
    records,
    routing: existing?.routing || createDefaultAlertRoutingMatrix(),
    rules: existing?.rules && existing.rules.length > 0 ? existing.rules : createDefaultAutomationRules(),
    logs: Array.isArray(existing?.logs) ? existing.logs.slice(0, 120) : [],
  };
}

function persistActorIntegrationsState(actorId: string, state: StoredActorIntegrationsState): void {
  saveActorState(actorId, 'integration_hub', {
    ...state,
    logs: state.logs.slice(0, 120),
  });
}

function appendLog(
  state: StoredActorIntegrationsState,
  entry: Omit<IntegrationLogEntry, 'id' | 'timestamp'>
): IntegrationLogEntry {
  const logEntry: IntegrationLogEntry = {
    id: `ilog_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    timestamp: new Date().toISOString(),
    ...entry,
    detail: sanitizeLogDetail(entry.detail),
  };
  state.logs = [logEntry, ...state.logs].slice(0, 120);
  return logEntry;
}

function validateUrlFieldForIntegration(integrationId: IntegrationId, fieldKey: string, value: string): string | null {
  if (integrationId === 'discord' && fieldKey === 'webhookUrl') {
    return validateExternalWebhookUrl(value, {
      requiredHostSuffixes: ['discord.com', 'discordapp.com'],
      requiredPathPrefix: '/api/webhooks/',
    });
  }
  if (integrationId === 'slack' && fieldKey === 'webhookUrl') {
    return validateExternalWebhookUrl(value, {
      requiredHostSuffixes: ['hooks.slack.com', 'hooks.slack-gov.com'],
      requiredPathPrefix: '/services/',
    });
  }
  if ((integrationId === 'home_assistant' && fieldKey === 'baseUrl') || (integrationId === 'esp32_iot' && fieldKey === 'gatewayUrl')) {
    return validateExternalWebhookUrl(value, {
      allowHttpForLocalIot: true,
    });
  }
  return null;
}

export function getActorHubSnapshot(actorId: string) {
  const state = loadActorIntegrationsState(actorId);
  return {
    integrations: INTEGRATION_CATALOG.map((def) => state.records[def.id]),
    routing: state.routing,
    rules: state.rules,
    logs: state.logs,
  };
}

export async function saveAndConnectIntegration(params: {
  actorId: string;
  integrationId: string;
  publicConfig: Record<string, string | boolean>;
  secrets: Record<string, string>;
  googleAccessToken?: string;
  runTest?: boolean;
}) {
  if (!checkRateLimit(`connect:${params.actorId}`, 40, 60_000)) {
    throw new IntegrationServiceError('Rate limit exceeded for integration updates. Try again shortly.', 429);
  }

  const def = INTEGRATION_BY_ID[params.integrationId as IntegrationId];
  if (!def) {
    throw new IntegrationServiceError(`Unsupported integration "${params.integrationId}".`, 404);
  }

  const state = loadActorIntegrationsState(params.actorId);
  const existingRecord = state.records[def.id] || buildDefaultRecord(def);
  const existingSecrets = getDecryptedIntegrationSecrets(params.actorId, def.id);

  const sanitizedPublic: Record<string, string | boolean> = {};
  const mergedSecrets: Record<string, string> = { ...existingSecrets };

  for (const field of def.fields) {
    if (field.isSecret) {
      const incoming = typeof params.secrets?.[field.key] === 'string' ? params.secrets[field.key].trim() : '';
      if (incoming) {
        if (field.type === 'url') {
          const urlErr = validateUrlFieldForIntegration(def.id, field.key, incoming);
          if (urlErr) throw new IntegrationServiceError(urlErr, 400);
        }
        mergedSecrets[field.key] = incoming;
      }
      if (field.required && !mergedSecrets[field.key]) {
        throw new IntegrationServiceError(`${field.label} is required.`, 400);
      }
    } else {
      const rawVal = params.publicConfig?.[field.key];
      if (field.type === 'checkbox') {
        sanitizedPublic[field.key] = Boolean(rawVal);
      } else {
        const strVal = typeof rawVal === 'string' ? rawVal.trim().slice(0, 300) : '';
        if (strVal && field.type === 'url') {
          const urlErr = validateUrlFieldForIntegration(def.id, field.key, strVal);
          if (urlErr) throw new IntegrationServiceError(urlErr, 400);
        }
        if (field.required && !strVal) {
          throw new IntegrationServiceError(`${field.label} is required.`, 400);
        }
        if (strVal) {
          sanitizedPublic[field.key] = strVal;
        }
      }
    }
  }

  // Extra field validation for GitHub repo slug
  if (def.id === 'github') {
    const repo = String(sanitizedPublic.repository || '');
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
      throw new IntegrationServiceError('GitHub repository must be formatted as owner/repo.', 400);
    }
  }

  saveEncryptedIntegrationSecrets(params.actorId, def.id, mergedSecrets);
  const maskedSummary = buildMaskedSecretSummary(mergedSecrets);

  const now = new Date().toISOString();
  const nextRecord: IntegrationRecord = {
    ...existingRecord,
    integrationId: def.id,
    enabled: true,
    status: existingRecord.status === 'connected' ? 'connected' : 'not_configured',
    statusLabel: getStatusLabel(existingRecord.status === 'connected' ? 'connected' : 'not_configured'),
    publicConfig: sanitizedPublic,
    hasSecrets: Object.keys(mergedSecrets).length > 0,
    maskedSecretSummary: maskedSummary,
    lastError: undefined,
    updatedAt: now,
  };

  state.records[def.id] = nextRecord;
  appendLog(state, {
    integrationId: def.id,
    applicationName: def.name,
    eventType: 'config_update',
    status: 'delivered',
    severity: 'system',
    detail: `Saved configuration (${def.name}). Running verification next.`,
  });
  persistActorIntegrationsState(params.actorId, state);

  if (params.runTest !== false) {
    return await testIntegrationConnection({
      actorId: params.actorId,
      integrationId: def.id,
      googleAccessToken: params.googleAccessToken,
    });
  }

  return {
    status: nextRecord.status,
    statusLabel: nextRecord.statusLabel,
    message: 'Configuration saved securely in backend vault. Run Test Connection to verify.',
    testedAt: now,
    record: nextRecord,
    logs: state.logs,
  };
}


export async function testIntegrationConnection(params: {
  actorId: string;
  integrationId: string;
  googleAccessToken?: string;
}) {
  if (!checkRateLimit(`test:${params.actorId}`, 30, 60_000)) {
    throw new IntegrationServiceError('Too many connection tests. Please wait a minute.', 429);
  }

  const def = INTEGRATION_BY_ID[params.integrationId as IntegrationId];
  if (!def) {
    throw new IntegrationServiceError(`Unsupported integration "${params.integrationId}".`, 404);
  }

  const state = loadActorIntegrationsState(params.actorId);
  const record = state.records[def.id] || buildDefaultRecord(def);
  const secrets = getDecryptedIntegrationSecrets(params.actorId, def.id);
  const pub = record.publicConfig || {};
  const now = new Date().toISOString();

  // Check whether minimal configuration exists
  const missingRequiredPublic = def.fields.some(
    (f) => f.required && !f.isSecret && (!pub[f.key] || String(pub[f.key]).trim() === '')
  );
  const missingRequiredSecret = def.fields.some(
    (f) => f.required && f.isSecret && (!secrets[f.key] || secrets[f.key].trim() === '')
  );

  if (missingRequiredPublic || missingRequiredSecret) {
    record.status = 'not_configured';
    record.statusLabel = 'Not Configured';
    record.lastError = 'Required credentials or fields are not configured.';
    record.updatedAt = now;
    state.records[def.id] = record;
    const logEntry = appendLog(state, {
      integrationId: def.id,
      applicationName: def.name,
      eventType: 'test_connection',
      status: 'not_configured',
      severity: 'system',
      detail: 'Test skipped: Not Configured.',
    });
    persistActorIntegrationsState(params.actorId, state);
    return {
      status: 'not_configured' as const,
      statusLabel: 'Not Configured' as const,
      message: `${def.name} is Not Configured. Enter required configuration fields first.`,
      testedAt: now,
      record,
      logEntry,
      logs: state.logs,
    };
  }

  let verifiedStatus: IntegrationConnectionStatus = 'error';
  let detailMessage = '';

  try {
    switch (def.id) {
      case 'telegram': {
        const res = await fetch(`https://api.telegram.org/bot${secrets.botToken}/getMe`, {
          signal: AbortSignal.timeout(9000),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: { username?: string }; description?: string };
        if (res.ok && data.ok) {
          const chatId = String(pub.chatId || '').trim();
          const chatRes = await fetch(
            `https://api.telegram.org/bot${secrets.botToken}/getChat?chat_id=${encodeURIComponent(chatId)}`,
            { signal: AbortSignal.timeout(9000) }
          );
          const chatJson = (await chatRes.json().catch(() => ({}))) as { ok?: boolean; description?: string };
          if (chatRes.ok && chatJson.ok) {
            verifiedStatus = 'connected';
            detailMessage = `Verified Telegram Bot @${data.result?.username || 'bot'} & Chat ID ${chatId}.`;
          } else {
            verifiedStatus = 'auth_failed';
            detailMessage = `Bot token valid, but Chat ID check failed: ${chatJson.description || chatRes.status}.`;
          }
        } else {
          verifiedStatus = 'auth_failed';
          detailMessage = `Telegram rejected Bot Token (${data.description || res.status}).`;
        }
        break;
      }

      case 'discord': {
        const res = await fetch(secrets.webhookUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(9000),
        });
        if (res.ok) {
          const data = (await res.json().catch(() => ({}))) as { id?: string; name?: string };
          if (data.id) {
            verifiedStatus = 'connected';
            detailMessage = `Verified Discord Webhook "${data.name || data.id}".`;
          } else {
            verifiedStatus = 'auth_failed';
            detailMessage = 'Discord webhook URL did not return valid webhook metadata.';
          }
        } else if (res.status === 401 || res.status === 403 || res.status === 404) {
          verifiedStatus = 'auth_failed';
          detailMessage = `Discord webhook verification failed (HTTP ${res.status}).`;
        } else {
          verifiedStatus = 'error';
          detailMessage = `Discord returned HTTP ${res.status}.`;
        }
        break;
      }

      case 'slack': {
        const res = await fetch(secrets.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `[Flame in Firefall] Slack webhook handshake verified for ${String(pub.channelName || 'mission-ops')}.`,
          }),
          signal: AbortSignal.timeout(9000),
        });
        if (res.ok) {
          verifiedStatus = 'connected';
          detailMessage = 'Verified Slack Incoming Webhook delivery (HTTP 200 OK).';
        } else if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) {
          verifiedStatus = 'auth_failed';
          detailMessage = `Slack webhook rejected handshake (HTTP ${res.status}).`;
        } else {
          verifiedStatus = 'error';
          detailMessage = `Slack returned HTTP ${res.status}.`;
        }
        break;
      }

      case 'trello': {
        const meRes = await fetch(
          `https://api.trello.com/1/members/me?key=${encodeURIComponent(secrets.apiKey)}&token=${encodeURIComponent(
            secrets.apiToken
          )}`,
          { signal: AbortSignal.timeout(9000) }
        );
        if (!meRes.ok) {
          verifiedStatus = 'auth_failed';
          detailMessage = `Trello API key/token rejected (HTTP ${meRes.status}).`;
          break;
        }
        const listId = String(pub.listId || '').trim();
        const listRes = await fetch(
          `https://api.trello.com/1/lists/${encodeURIComponent(listId)}?key=${encodeURIComponent(
            secrets.apiKey
          )}&token=${encodeURIComponent(secrets.apiToken)}`,
          { signal: AbortSignal.timeout(9000) }
        );
        if (listRes.ok) {
          const listJson = (await listRes.json()) as { name?: string };
          verifiedStatus = 'connected';
          detailMessage = `Verified Trello authorization & target list "${listJson.name || listId}".`;
        } else {
          verifiedStatus = 'auth_failed';
          detailMessage = `Trello credentials valid, but List ID "${listId}" check returned HTTP ${listRes.status}.`;
        }
        break;
      }

      case 'home_assistant': {
        const base = String(pub.baseUrl || '').replace(/\/+$/, '');
        const res = await fetch(`${base}/api/`, {
          headers: { Authorization: `Bearer ${secrets.longLivedToken}` },
          signal: AbortSignal.timeout(9000),
        });
        if (res.ok) {
          verifiedStatus = 'connected';
          detailMessage = 'Verified Home Assistant API connection.';
        } else if (res.status === 401 || res.status === 403) {
          verifiedStatus = 'auth_failed';
          detailMessage = `Home Assistant token rejected (HTTP ${res.status}).`;
        } else {
          verifiedStatus = 'error';
          detailMessage = `Home Assistant returned HTTP ${res.status}.`;
        }
        break;
      }

      case 'esp32_iot': {
        const base = String(pub.gatewayUrl || '').replace(/\/+$/, '');
        const res = await fetch(`${base}/health`, {
          headers: { 'X-API-Key': secrets.deviceKey },
          signal: AbortSignal.timeout(9000),
        });
        if (res.ok) {
          verifiedStatus = 'connected';
          detailMessage = `Verified ESP32 / IoT Gateway health endpoint (${String(pub.deviceId || 'node')}).`;
        } else if (res.status === 401 || res.status === 403) {
          verifiedStatus = 'auth_failed';
          detailMessage = `ESP32 Gateway rejected Device API Key (HTTP ${res.status}).`;
        } else {
          verifiedStatus = 'error';
          detailMessage = `ESP32 Gateway returned HTTP ${res.status}.`;
        }
        break;
      }

      case 'github': {
        const repo = String(pub.repository || '').trim();
        const res = await fetch(`https://api.github.com/repos/${repo}`, {
          headers: {
            Authorization: `Bearer ${secrets.personalAccessToken}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'Flame-in-Firefall-MissionControl',
          },
          signal: AbortSignal.timeout(9000),
        });
        if (res.ok) {
          const data = (await res.json()) as { full_name?: string; permissions?: { push?: boolean } };
          verifiedStatus = 'connected';
          detailMessage = `Verified GitHub access to ${data.full_name || repo}.`;
        } else if (res.status === 401 || res.status === 403 || res.status === 404) {
          verifiedStatus = 'auth_failed';
          detailMessage =
            res.status === 404
              ? `GitHub repository "${repo}" not found or inaccessible by token.`
              : `GitHub PAT authentication failed (HTTP ${res.status}).`;
        } else {
          verifiedStatus = 'error';
          detailMessage = `GitHub API returned HTTP ${res.status}.`;
        }
        break;
      }
    }
  } catch (err) {
    if (err instanceof IntegrationServiceError) {
      verifiedStatus = err.statusCode === 401 ? 'auth_failed' : 'error';
      detailMessage = err.message;
    } else {
      verifiedStatus = 'error';
      detailMessage = err instanceof Error ? `Network / endpoint unreachable: ${err.message}` : 'Connection failed.';
    }
  }

  record.status = verifiedStatus;
  record.statusLabel = getStatusLabel(verifiedStatus);
  record.enabled = verifiedStatus === 'connected';
  record.updatedAt = now;
  if (verifiedStatus === 'connected') {
    record.lastSyncAt = now;
    record.lastError = undefined;
  } else {
    record.lastError = sanitizeLogDetail(detailMessage);
  }
  state.records[def.id] = record;

  const logEntry = appendLog(state, {
    integrationId: def.id,
    applicationName: def.name,
    eventType: 'test_connection',
    status: verifiedStatus === 'connected' ? 'connected' : verifiedStatus === 'auth_failed' ? 'auth_failed' : 'failed',
    severity: 'system',
    detail: detailMessage,
  });
  persistActorIntegrationsState(params.actorId, state);

  return {
    status: verifiedStatus,
    statusLabel: record.statusLabel,
    message: sanitizeLogDetail(detailMessage),
    testedAt: now,
    record,
    logEntry,
    logs: state.logs,
  };
}

export function disconnectActorIntegration(actorId: string, integrationId: string, purgeSecrets = false) {
  const def = INTEGRATION_BY_ID[integrationId as IntegrationId];
  if (!def) {
    throw new IntegrationServiceError(`Unsupported integration "${integrationId}".`, 404);
  }
  const state = loadActorIntegrationsState(actorId);
  const record = state.records[def.id] || buildDefaultRecord(def);
  const now = new Date().toISOString();

  if (purgeSecrets) {
    deleteEncryptedIntegrationSecrets(actorId, def.id);
    record.hasSecrets = false;
    record.maskedSecretSummary = '';
    record.status = 'not_configured';
    record.statusLabel = 'Not Configured';
  } else {
    record.status = 'disconnected';
    record.statusLabel = 'Disconnected';
  }
  record.enabled = false;
  record.updatedAt = now;
  state.records[def.id] = record;

  appendLog(state, {
    integrationId: def.id,
    applicationName: def.name,
    eventType: 'config_update',
    status: purgeSecrets ? 'not_configured' : 'delivered',
    severity: 'system',
    detail: purgeSecrets ? 'Disconnected and purged encrypted secrets.' : 'Integration disconnected by operator.',
  });
  persistActorIntegrationsState(actorId, state);

  return { record, logs: state.logs };
}

export async function dispatchToIntegration(params: {
  actorId: string;
  integrationId: string;
  eventType: IntegrationLogEntry['eventType'];
  severity: 'normal' | 'warning' | 'critical';
  title: string;
  message: string;
  dedupeKey?: string;
  telemetrySummary?: Record<string, unknown>;
}) {
  if (!checkRateLimit(`dispatch:${params.actorId}`, 60, 60_000)) {
    throw new IntegrationServiceError('Dispatch rate limit exceeded.', 429);
  }

  const def = INTEGRATION_BY_ID[params.integrationId as IntegrationId];
  if (!def) {
    throw new IntegrationServiceError(`Unsupported integration "${params.integrationId}".`, 404);
  }

  const state = loadActorIntegrationsState(params.actorId);
  const record = state.records[def.id] || buildDefaultRecord(def);
  const secrets = getDecryptedIntegrationSecrets(params.actorId, def.id);
  const pub = record.publicConfig || {};
  const now = new Date().toISOString();

  if (params.dedupeKey && checkAndMarkDuplicate(`${params.actorId}:${def.id}:${params.dedupeKey}`, 60_000)) {
    const logEntry = appendLog(state, {
      integrationId: def.id,
      applicationName: def.name,
      eventType: params.eventType,
      status: 'deduplicated',
      severity: params.severity,
      detail: `Skipped duplicate alert within 60s window (${params.title}).`,
    });
    persistActorIntegrationsState(params.actorId, state);
    return { delivered: false, deduplicated: true, logEntry, logs: state.logs };
  }

  if (record.status !== 'connected' && record.status !== 'error') {
    const logEntry = appendLog(state, {
      integrationId: def.id,
      applicationName: def.name,
      eventType: params.eventType,
      status: 'not_configured',
      severity: params.severity,
      detail: `${def.name} skipped: integration is ${record.statusLabel}.`,
    });
    persistActorIntegrationsState(params.actorId, state);
    return { delivered: false, status: 'not_configured', logEntry, logs: state.logs };
  }

  try {
    let ok = false;
    let detail = '';

    switch (def.id) {
      case 'telegram': {
        const res = await fetch(`https://api.telegram.org/bot${secrets.botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: pub.chatId,
            text: `🚨 ${params.title}\nSeverity: ${params.severity.toUpperCase()}\n${params.message}`,
          }),
          signal: AbortSignal.timeout(9000),
        });
        ok = res.ok;
        detail = ok ? `Sent Telegram alert to chat ${pub.chatId}.` : `Telegram send failed (HTTP ${res.status}).`;
        break;
      }

      case 'discord': {
        const color = params.severity === 'critical' ? 0xf43f5e : params.severity === 'warning' ? 0xf59e0b : 0x10b981;
        const res = await fetch(secrets.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [
              {
                title: params.title,
                description: params.message,
                color,
                timestamp: now,
                footer: { text: 'Flame in Firefall · Team Tejasvi' },
              },
            ],
          }),
          signal: AbortSignal.timeout(9000),
        });
        ok = res.ok;
        detail = ok ? 'Posted embed to Discord webhook.' : `Discord webhook returned HTTP ${res.status}.`;
        break;
      }

      case 'slack': {
        const res = await fetch(secrets.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `*[${params.severity.toUpperCase()}] ${params.title}*\n${params.message}`,
          }),
          signal: AbortSignal.timeout(9000),
        });
        ok = res.ok;
        detail = ok ? `Delivered alert to ${def.name}.` : `${def.name} returned HTTP ${res.status}.`;
        break;
      }

      case 'trello': {
        const cardRes = await fetch(
          `https://api.trello.com/1/cards?key=${encodeURIComponent(secrets.apiKey)}&token=${encodeURIComponent(
            secrets.apiToken
          )}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              idList: String(pub.listId),
              name: `[${params.severity.toUpperCase()}] ${params.title}`,
              desc: `${params.message}\n\nTimestamp: ${now}`,
            }),
            signal: AbortSignal.timeout(9000),
          }
        );
        ok = cardRes.ok;
        detail = ok ? `Created Trello maintenance card on list ${pub.listId}.` : `Trello returned HTTP ${cardRes.status}.`;
        break;
      }

      case 'home_assistant': {
        const base = String(pub.baseUrl).replace(/\/+$/, '');
        const servicePath = String(pub.entityId || 'notify/persistent_notification').replace(/^\//, '');
        const res = await fetch(`${base}/api/services/${servicePath}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${secrets.longLivedToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: params.title,
            message: params.message,
          }),
          signal: AbortSignal.timeout(9000),
        });
        ok = res.ok;
        detail = ok ? `Triggered Home Assistant service ${servicePath}.` : `Home Assistant returned ${res.status}.`;
        break;
      }

      case 'esp32_iot': {
        const base = String(pub.gatewayUrl).replace(/\/+$/, '');
        const res = await fetch(`${base}/alert`, {
          method: 'POST',
          headers: {
            'X-API-Key': secrets.deviceKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            deviceId: pub.deviceId || 'esp32-node',
            severity: params.severity,
            title: params.title,
            message: params.message,
            timestamp: now,
          }),
          signal: AbortSignal.timeout(9000),
        });
        ok = res.ok;
        detail = ok ? 'Triggered ESP32 / IoT Gateway alarm relay.' : `ESP32 gateway returned ${res.status}.`;
        break;
      }

      case 'github': {
        const repo = String(pub.repository);
        const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${secrets.personalAccessToken}`,
            Accept: 'application/vnd.github+json',
            'User-Agent': 'Flame-in-Firefall-MissionControl',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: `[${params.severity.toUpperCase()}] ${params.title}`,
            body: `${params.message}\n\nLogged automatically by **Flame in Firefall** (${now}).`,
            labels: ['mission-telemetry', params.severity],
          }),
          signal: AbortSignal.timeout(9000),
        });
        ok = res.ok;
        detail = ok ? `Opened GitHub issue in ${repo}.` : `GitHub issue API returned HTTP ${res.status}.`;
        break;
      }

      default:
        detail = 'Channel not supported.';
        ok = false;
        break;
    }

    if (ok) {
      record.lastSyncAt = now;
      record.lastError = undefined;
    } else {
      record.lastError = sanitizeLogDetail(detail);
    }
    state.records[def.id] = record;

    const logEntry = appendLog(state, {
      integrationId: def.id,
      applicationName: def.name,
      eventType: params.eventType,
      status: ok ? 'delivered' : 'failed',
      severity: params.severity,
      detail,
    });
    persistActorIntegrationsState(params.actorId, state);
    return { delivered: ok, logEntry, logs: state.logs };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown dispatch failure.';
    const logEntry = appendLog(state, {
      integrationId: def.id,
      applicationName: def.name,
      eventType: params.eventType,
      status: 'failed',
      severity: params.severity,
      detail: errMsg,
    });
    persistActorIntegrationsState(params.actorId, state);
    return { delivered: false, logEntry, logs: state.logs };
  }
}

export function updateActorAlertRouting(actorId: string, routing: AlertRoutingMatrix) {
  const state = loadActorIntegrationsState(actorId);
  state.routing = routing;
  appendLog(state, {
    integrationId: 'routing',
    applicationName: 'Alert Routing Engine',
    eventType: 'config_update',
    status: 'delivered',
    severity: 'system',
    detail: 'Updated Smart Alert Routing preferences.',
  });
  persistActorIntegrationsState(actorId, state);
  return { routing: state.routing, logs: state.logs };
}

export function upsertActorAutomationRule(actorId: string, rule: AutomationRuleRecord) {
  const state = loadActorIntegrationsState(actorId);
  const now = new Date().toISOString();
  const sanitizedRule: AutomationRuleRecord = {
    ...rule,
    id: rule.id?.trim() || `rule_${Date.now()}`,
    name: rule.name.trim().slice(0, 120),
    description: (rule.description || '').trim().slice(0, 360),
    updatedAt: now,
  };
  const idx = state.rules.findIndex((r) => r.id === sanitizedRule.id);
  if (idx >= 0) {
    state.rules[idx] = sanitizedRule;
  } else {
    state.rules = [sanitizedRule, ...state.rules];
  }
  appendLog(state, {
    integrationId: 'automation',
    applicationName: 'Automation Engine',
    eventType: 'config_update',
    status: 'delivered',
    severity: 'system',
    detail: `Saved automation rule "${sanitizedRule.name}".`,
  });
  persistActorIntegrationsState(actorId, state);
  return { rules: state.rules, logs: state.logs };
}

export function deleteActorAutomationRule(actorId: string, ruleId: string) {
  const state = loadActorIntegrationsState(actorId);
  const target = state.rules.find((r) => r.id === ruleId);
  state.rules = state.rules.filter((r) => r.id !== ruleId);
  appendLog(state, {
    integrationId: 'automation',
    applicationName: 'Automation Engine',
    eventType: 'config_update',
    status: 'delivered',
    severity: 'system',
    detail: `Deleted automation rule "${target?.name || ruleId}".`,
  });
  persistActorIntegrationsState(actorId, state);
  return { rules: state.rules, logs: state.logs };
}

export async function testActorAutomationRule(actorId: string, ruleId: string) {
  const state = loadActorIntegrationsState(actorId);
  const rule = state.rules.find((r) => r.id === ruleId);
  if (!rule) {
    throw new IntegrationServiceError('Automation rule not found.', 404);
  }
  const now = new Date().toISOString();
  rule.lastTriggeredAt = now;
  rule.executionCount = (rule.executionCount || 0) + 1;
  rule.updatedAt = now;

  const actionSummaries: string[] = [];
  for (const action of rule.actions) {
    if (action.integrationId === 'mission_history' || action.integrationId === 'maintenance_team') {
      appendLog(state, {
        integrationId: action.integrationId,
        applicationName: action.integrationId === 'mission_history' ? 'Mission History' : 'Maintenance Dispatch',
        eventType: 'automation_rule',
        status: 'delivered',
        severity: 'warning',
        detail: `Rule "${rule.name}" test executed: ${action.label}.`,
      });
      actionSummaries.push(`${action.label}: Recorded`);
      continue;
    }

    const res = await dispatchToIntegration({
      actorId,
      integrationId: action.integrationId,
      eventType: 'automation_rule',
      severity: 'critical',
      title: `Automation Rule Triggered: ${rule.name}`,
      message: rule.description || `Executed test workflow for ${rule.name}.`,
    });
    actionSummaries.push(
      `${action.label}: ${res.delivered ? 'Delivered' : 'Skipped (' + (res.status || 'not configured') + ')'}`
    );
  }

  // Reload state in case dispatch updated logs
  const refreshed = loadActorIntegrationsState(actorId);
  const rIdx = refreshed.rules.findIndex((r) => r.id === rule.id);
  if (rIdx >= 0) {
    refreshed.rules[rIdx] = rule;
  }
  persistActorIntegrationsState(actorId, refreshed);

  return {
    rule,
    actionSummaries,
    rules: refreshed.rules,
    logs: refreshed.logs,
  };
}

export function recordClientWorkspaceLog(
  actorId: string,
  entry: Omit<IntegrationLogEntry, 'id' | 'timestamp'>
) {
  const state = loadActorIntegrationsState(actorId);
  const logEntry = appendLog(state, entry);
  if (entry.status === 'connected' || entry.status === 'delivered') {
    const rec = state.records[entry.integrationId];
    if (rec) {
      rec.status = 'connected';
      rec.statusLabel = 'Connected Successfully';
      rec.enabled = true;
      rec.lastSyncAt = logEntry.timestamp;
      rec.lastError = undefined;
      rec.updatedAt = logEntry.timestamp;
    }
  }
  persistActorIntegrationsState(actorId, state);
  return { logEntry, logs: state.logs, integrations: INTEGRATION_CATALOG.map((d) => state.records[d.id]) };
}
