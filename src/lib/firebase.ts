/**
 * Firebase Client Configuration & Authentication
 * Flame in Firefall - NASA Space Apps Challenge
 */

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  setDoc,
  deleteDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type {
  AlertRoutingMatrix,
  AutomationRuleRecord,
  IntegrationLogEntry,
  IntegrationRecord,
} from '../types/integrations';

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

const firestoreDatabaseId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId;
export const db = firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// In-memory cache ONLY for Google OAuth access token (never persist to localStorage/sessionStorage)
let cachedGmailAccessToken: string | null = null;

onAuthStateChanged(auth, (currentUser) => {
  if (!currentUser) {
    cachedGmailAccessToken = null;
  }
});

export function getGmailAccessToken(): string | null {
  return cachedGmailAccessToken;
}

export function getWorkspaceAccessToken(): string | null {
  return cachedGmailAccessToken;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test initial connection to Firestore on boot
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    return true;
  }
}

// Sign in with Google Popup (also caches Gmail send access token in memory)
export async function loginWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedGmailAccessToken = credential.accessToken;
    }
    return result.user;
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return null;
    }
    if (code === 'auth/popup-blocked') {
      throw new Error(
        'Google sign-in pop-up was blocked by the browser. Allow pop-ups or sign in with 6-digit OTP.'
      );
    }
    if (code === 'auth/unauthorized-domain') {
      throw new Error(
        'This domain is not authorized for Firebase Google Sign-In. Please sign in with 6-digit OTP instead.'
      );
    }
    throw error instanceof Error ? error : new Error('Google Sign-In failed.');
  }
}

export async function authorizeGmailAlerts(): Promise<{ user: User; accessToken: string } | null> {
  return authorizeWorkspaceIntegrations();
}

export async function authorizeWorkspaceIntegrations(): Promise<{ user: User; accessToken: string } | null> {
  try {
    googleProvider.setCustomParameters({ prompt: 'consent' });
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google authorization succeeded, but Workspace OAuth token was not issued.');
    }
    cachedGmailAccessToken = credential.accessToken;
    return { user: result.user, accessToken: credential.accessToken };
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return null;
    }
    if (code === 'auth/popup-blocked') {
      throw new Error('Pop-up was blocked by the browser. Allow pop-ups to authorize Google Workspace.');
    }
    throw error instanceof Error ? error : new Error('Google Workspace authorization failed.');
  }
}

function encodeBase64UrlUtf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sendGmailEmergencyAlert(params: {
  accessToken: string;
  toEmail: string;
  subject: string;
  body: string;
}): Promise<{ id: string; threadId?: string }> {
  const cleanTo = params.toEmail.trim().replace(/[\r\n]/g, '');
  const cleanSubject = params.subject.trim().replace(/[\r\n]/g, ' ');
  const encodedSubject = `=?UTF-8?B?${encodeBase64UrlUtf8(cleanSubject).replace(/-/g, '+').replace(/_/g, '/')}?=`;

  const rawMime = [
    `To: ${cleanTo}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    params.body,
  ].join('\r\n');

  const raw = encodeBase64UrlUtf8(rawMime);
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    if (res.status === 401) {
      cachedGmailAccessToken = null;
      throw new Error('Gmail access token expired. Please re-authorize Google Workspace.');
    }
    const errText = await res.text().catch(() => '');
    throw new Error(`Gmail API send failed (${res.status}): ${errText || res.statusText}`);
  }

  return (await res.json()) as { id: string; threadId?: string };
}

export async function appendGoogleSheetTelemetryRow(params: {
  accessToken: string;
  spreadsheetId?: string;
  sheetRange?: string;
  values: (string | number)[];
}): Promise<{ spreadsheetId: string; createdNew: boolean }> {
  let targetId = (params.spreadsheetId || '').trim();
  let createdNew = false;

  if (!targetId) {
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: { title: `Flame in Firefall - Telemetry & Incident Log` },
        sheets: [{ properties: { title: params.sheetRange?.trim() || 'TelemetryLogs' } }],
      }),
    });
    if (!createRes.ok) {
      if (createRes.status === 401) cachedGmailAccessToken = null;
      throw new Error(`Google Sheets creation failed (${createRes.status}).`);
    }
    const created = (await createRes.json()) as { spreadsheetId: string };
    targetId = created.spreadsheetId;
    createdNew = true;

    // Seed header row
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(targetId)}/values/${encodeURIComponent(
        `${params.sheetRange?.trim() || 'TelemetryLogs'}!A1`
      )}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [['Timestamp', 'Habitat', 'Severity', 'Risk Score', 'Summary / Telemetry']],
        }),
      }
    );
  }

  const tab = (params.sheetRange || 'Sheet1').trim();
  const appendRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(targetId)}/values/${encodeURIComponent(
      `${tab}!A1`
    )}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [params.values] }),
    }
  );

  if (!appendRes.ok) {
    if (appendRes.status === 401) cachedGmailAccessToken = null;
    const errText = await appendRes.text().catch(() => '');
    throw new Error(`Google Sheets append failed (${appendRes.status}): ${errText.slice(0, 140)}`);
  }

  return { spreadsheetId: targetId, createdNew };
}

export async function uploadIncidentReportToDrive(params: {
  accessToken: string;
  folderId?: string;
  fileName: string;
  content: string;
}): Promise<{ id: string; name: string }> {
  const metadata: Record<string, unknown> = {
    name: params.fileName,
    mimeType: 'text/plain',
  };
  if (params.folderId?.trim()) {
    metadata.parents = [params.folderId.trim()];
  }

  const boundary = `tejasvi_boundary_${Date.now()}`;
  const multipartBody = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    params.content,
    `--${boundary}--`,
  ].join('\r\n');

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!res.ok) {
    if (res.status === 401) cachedGmailAccessToken = null;
    const errText = await res.text().catch(() => '');
    throw new Error(`Google Drive upload failed (${res.status}): ${errText.slice(0, 140)}`);
  }

  return (await res.json()) as { id: string; name: string };
}

export async function createGoogleCalendarIncidentEvent(params: {
  accessToken: string;
  calendarId?: string;
  summary: string;
  description: string;
  durationMinutes?: number;
}): Promise<{ id: string; htmlLink?: string }> {
  const calId = (params.calendarId || 'primary').trim() || 'primary';
  const start = new Date();
  const end = new Date(start.getTime() + (params.durationMinutes || 45) * 60_000);

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: params.summary,
        description: params.description,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      }),
    }
  );

  if (!res.ok) {
    if (res.status === 401) cachedGmailAccessToken = null;
    const errText = await res.text().catch(() => '');
    throw new Error(`Google Calendar event creation failed (${res.status}): ${errText.slice(0, 140)}`);
  }

  return (await res.json()) as { id: string; htmlLink?: string };
}

// Sign out
export async function logoutUser(): Promise<void> {
  try {
    cachedGmailAccessToken = null;
    await signOut(auth);
  } catch (error) {
    console.error('Sign-Out failed:', error);
    throw error;
  }
}

// Save telemetry snapshot to Firestore
export async function saveReadingToFirestore(reading: any): Promise<string> {
  const path = 'readings';
  try {
    const nowIso = new Date().toISOString();
    const docRef = await addDoc(collection(db, path), {
      ...reading,
      id: typeof reading.id === 'string' && reading.id ? reading.id.slice(0, 64) : `read_${Date.now()}`,
      timestamp: reading.timestamp || nowIso,
      temperatureC:
        typeof reading.temperatureC === 'number'
          ? reading.temperatureC
          : Number(reading.internalTemperatureC ?? 22),
      savedAt: nowIso,
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// Save mission log to Firestore
export async function saveMissionLogToFirestore(log: any): Promise<string> {
  const path = 'logs';
  try {
    const nowIso = new Date().toISOString();
    const docRef = await addDoc(collection(db, path), {
      ...log,
      id: typeof log.id === 'string' && log.id ? log.id.slice(0, 64) : `log_${Date.now()}`,
      timestamp: log.timestamp || nowIso,
      savedAt: nowIso,
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// Fetch historical readings from Firestore
export async function fetchHistoricalReadings(count = 25): Promise<any[]> {
  const path = 'readings';
  try {
    const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(count));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ ...d.data(), docId: d.id }));
  } catch (error) {
    // If permission or offline, handle gracefully
    console.warn('Historical fetch warning:', error);
    return [];
  }
}

// Fetch mission flight director logs from Firestore
export async function fetchMissionLogsFromFirestore(count = 25): Promise<any[]> {
  const path = 'logs';
  try {
    const q = query(collection(db, path), orderBy('savedAt', 'desc'), limit(count));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ ...d.data(), docId: d.id }));
  } catch (error) {
    console.warn('Mission log fetch warning:', error);
    return [];
  }
}

// Save custom 5-tier environmental risk threshold config for a habitat
export async function saveThresholdConfigToFirestore(
  habitatType: string,
  habitatName: string,
  thresholds: Record<string, unknown>
): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('Authentication required to save threshold configurations to Firestore.');
  }
  const safeId = `${uid.slice(0, 24)}_${habitatType}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const path = `thresholdConfigs/${safeId}`;
  try {
    await setDoc(doc(db, 'thresholdConfigs', safeId), {
      id: safeId,
      habitatType: habitatType.slice(0, 32),
      habitatName: habitatName.slice(0, 120),
      ownerId: uid,
      updatedAt: new Date().toISOString(),
      thresholds,
    });
    return safeId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Fetch user-saved 5-tier threshold configs from Firestore
export async function fetchThresholdConfigsFromFirestore(): Promise<
  Array<{ id: string; habitatType: string; habitatName: string; updatedAt: string; thresholds: any }>
> {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  const path = 'thresholdConfigs';
  try {
    const q = query(collection(db, path), where('ownerId', '==', uid));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as any);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// ============================================================
// Integration Hub Firestore Persistence (Strictly Owner-Scoped, Zero Secrets)
// ============================================================
function sanitizeDocId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

export async function saveIntegrationConfigToFirestore(record: IntegrationRecord): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const docId = sanitizeDocId(`${uid.slice(0, 28)}_${record.integrationId}`);
  const payload: Record<string, unknown> = {
    id: docId,
    integrationId: record.integrationId,
    ownerId: uid,
    enabled: Boolean(record.enabled),
    status: record.status,
    publicConfig: record.publicConfig || {},
    hasSecrets: Boolean(record.hasSecrets),
    maskedSecretSummary: (record.maskedSecretSummary || '').slice(0, 160),
    updatedAt: record.updatedAt || new Date().toISOString(),
  };
  if (record.lastSyncAt) payload.lastSyncAt = record.lastSyncAt;
  if (record.lastError) payload.lastError = record.lastError.slice(0, 390);
  await setDoc(doc(db, 'integrationConfigs', docId), payload);
}

export async function saveAlertRoutingToFirestore(routing: AlertRoutingMatrix): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const routingId = sanitizeDocId(`${uid.slice(0, 28)}_routing`);
  await setDoc(doc(db, 'alertRoutingConfigs', routingId), {
    id: routingId,
    ownerId: uid,
    routes: routing,
    updatedAt: new Date().toISOString(),
  });
}

export async function saveAutomationRuleToFirestore(rule: AutomationRuleRecord): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const ruleId = sanitizeDocId(`${uid.slice(0, 20)}_${rule.id}`);
  const payload: Record<string, unknown> = {
    id: ruleId,
    ownerId: uid,
    name: rule.name.slice(0, 140),
    description: (rule.description || '').slice(0, 400),
    enabled: Boolean(rule.enabled),
    condition: rule.condition,
    actions: rule.actions.slice(0, 8),
    cooldownSeconds: rule.cooldownSeconds ?? 120,
    executionCount: rule.executionCount ?? 0,
    updatedAt: rule.updatedAt || new Date().toISOString(),
  };
  if (rule.lastTriggeredAt) payload.lastTriggeredAt = rule.lastTriggeredAt;
  await setDoc(doc(db, 'automationRules', ruleId), payload);
}

export async function deleteAutomationRuleFromFirestore(ruleId: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const docId = sanitizeDocId(`${uid.slice(0, 20)}_${ruleId}`);
  await deleteDoc(doc(db, 'automationRules', docId)).catch(() => undefined);
}

export async function saveIntegrationLogToFirestore(entry: IntegrationLogEntry): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const logId = sanitizeDocId(entry.id || `ilog_${Date.now()}`);
  await setDoc(doc(db, 'integrationLogs', logId), {
    id: logId,
    ownerId: uid,
    integrationId: entry.integrationId.slice(0, 48),
    applicationName: entry.applicationName.slice(0, 80),
    eventType: entry.eventType,
    timestamp: entry.timestamp,
    status: entry.status,
    severity: entry.severity,
    detail: (entry.detail || '').slice(0, 490),
  });
}

function statusLabelFromStatus(status: IntegrationRecord['status']): IntegrationRecord['statusLabel'] {
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

export async function fetchIntegrationHubFromFirestore(): Promise<{
  integrations?: IntegrationRecord[];
  routing?: AlertRoutingMatrix;
  rules?: AutomationRuleRecord[];
  logs?: IntegrationLogEntry[];
}> {
  const uid = auth.currentUser?.uid;
  if (!uid) return {};
  try {
    const [configsSnap, routingSnap, rulesSnap, logsSnap] = await Promise.all([
      getDocs(query(collection(db, 'integrationConfigs'), where('ownerId', '==', uid))),
      getDocs(query(collection(db, 'alertRoutingConfigs'), where('ownerId', '==', uid))),
      getDocs(query(collection(db, 'automationRules'), where('ownerId', '==', uid))),
      getDocs(query(collection(db, 'integrationLogs'), where('ownerId', '==', uid))),
    ]);

    const integrations: IntegrationRecord[] = configsSnap.docs.map((d) => {
      const raw = d.data() as Partial<IntegrationRecord> & { integrationId: IntegrationRecord['integrationId'] };
      const status = raw.status || 'not_configured';
      return {
        integrationId: raw.integrationId,
        enabled: Boolean(raw.enabled),
        status,
        statusLabel: statusLabelFromStatus(status),
        publicConfig: raw.publicConfig || {},
        hasSecrets: Boolean(raw.hasSecrets),
        maskedSecretSummary: raw.maskedSecretSummary || '',
        lastSyncAt: raw.lastSyncAt,
        lastError: raw.lastError,
        updatedAt: raw.updatedAt || new Date().toISOString(),
      };
    });

    const routingDoc = routingSnap.docs[0]?.data() as { routes?: AlertRoutingMatrix } | undefined;
    const rules = rulesSnap.docs.map((d) => d.data() as AutomationRuleRecord);
    const logs = logsSnap.docs
      .map((d) => d.data() as IntegrationLogEntry)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 80);

    return {
      integrations: integrations.length > 0 ? integrations : undefined,
      routing: routingDoc?.routes,
      rules: rules.length > 0 ? rules : undefined,
      logs: logs.length > 0 ? logs : undefined,
    };
  } catch {
    return {};
  }
}
