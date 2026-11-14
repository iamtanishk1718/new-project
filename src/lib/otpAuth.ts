export type OtpChannel = 'email' | 'phone';

export interface OtpSessionUser {
  id: string;
  identifier: string;
  channel: OtpChannel;
  displayName: string;
  team: 'Tejasvi';
  verifiedAt: string;
}

export interface StoredOtpSession {
  token: string;
  expiresAt: string;
  user: OtpSessionUser;
}

export interface OtpChallengeResponse {
  maskedTarget: string;
  channel: OtpChannel;
  expiresInSeconds: number;
  cooldownSeconds: number;
  deliveryMode: 'webhook' | 'telemetry-dispatch';
  challengeToken: string;
  dispatchPreviewCode?: string;
}

const STORAGE_KEY = 'firefall_tejasvi_otp_session_v1';

export function getStoredOtpSession(): StoredOtpSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredOtpSession;
    if (!parsed?.token || !parsed?.user?.identifier) return null;
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() <= Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveStoredOtpSession(session: StoredOtpSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearStoredOtpSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export async function requestOtpCode(
  identifier: string,
  channel: OtpChannel,
  operatorName?: string
): Promise<OtpChallengeResponse> {
  const response = await fetch('/api/auth/otp/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, channel, operatorName }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'Failed to dispatch OTP code.');
  }
  return data as OtpChallengeResponse;
}

export async function verifyOtpCode(
  identifier: string,
  channel: OtpChannel,
  code: string,
  challengeToken?: string
): Promise<StoredOtpSession> {
  const response = await fetch('/api/auth/otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, channel, code, challengeToken }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || 'OTP verification failed.');
  }

  const session = data as StoredOtpSession;
  saveStoredOtpSession(session);
  return session;
}

export async function validateStoredOtpSession(): Promise<OtpSessionUser | null> {
  const stored = getStoredOtpSession();
  if (!stored) return null;

  try {
    const response = await fetch('/api/auth/session', {
      headers: {
        Authorization: `Bearer ${stored.token}`,
      },
    });
    if (!response.ok) {
      clearStoredOtpSession();
      return null;
    }
    const data = await response.json();
    if (data?.authenticated && data?.user) {
      return data.user as OtpSessionUser;
    }
    clearStoredOtpSession();
    return null;
  } catch {
    // Keep verified local session if server check encounters transient network failure
    return stored.user;
  }
}

export async function logoutOtpSession(): Promise<void> {
  const stored = getStoredOtpSession();
  clearStoredOtpSession();
  if (!stored?.token) return;
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stored.token}`,
      },
    });
  } catch {
    // Ignore network logout error after local session removal
  }
}
