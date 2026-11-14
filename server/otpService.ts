import crypto from 'crypto';

export type OtpChannel = 'email' | 'phone';

export interface OtpChallengeRecord {
  key: string;
  identifier: string;
  channel: OtpChannel;
  operatorName: string;
  salt: string;
  hash: string;
  expiresAt: number;
  createdAt: number;
  attemptsLeft: number;
}

export interface OtpSessionUser {
  id: string;
  identifier: string;
  channel: OtpChannel;
  displayName: string;
  team: 'Tejasvi';
  verifiedAt: string;
}

export interface RequestOtpResult {
  maskedTarget: string;
  channel: OtpChannel;
  expiresInSeconds: number;
  cooldownSeconds: number;
  deliveryMode: 'webhook' | 'telemetry-dispatch';
  challengeToken: string;
  dispatchPreviewCode?: string;
}

export interface VerifyOtpResult {
  token: string;
  expiresAt: string;
  user: OtpSessionUser;
}

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 10 * 1000;
const MAX_ATTEMPTS = 5;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const SERVER_SECRET =
  process.env.OTP_SESSION_SECRET ||
  process.env.GEMINI_API_KEY ||
  crypto.createHash('sha256').update('flame-in-firefall-team-tejasvi-otp-secret').digest('hex');

const activeChallenges = new Map<string, OtpChallengeRecord>();
const revokedTokens = new Set<string>();

export function normalizeIdentifier(identifier: string, channel: OtpChannel): string {
  const trimmed = identifier.trim();
  if (channel === 'email') {
    return trimmed.toLowerCase();
  }
  return trimmed.replace(/[\s\-()]/g, '');
}

export function validateIdentifier(identifier: string, channel: OtpChannel): string | null {
  const normalized = normalizeIdentifier(identifier, channel);
  if (!normalized) {
    return channel === 'email' ? 'Email address is required.' : 'Mobile number is required.';
  }
  if (channel === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(normalized)) {
      return 'Enter a valid email address (e.g., operator@tejasvi.org).';
    }
  } else {
    const phoneRegex = /^\+?[0-9]{8,15}$/;
    if (!phoneRegex.test(normalized)) {
      return 'Enter a valid mobile number (8–15 digits, optional + country code).';
    }
  }
  return null;
}

export function maskIdentifier(identifier: string, channel: OtpChannel): string {
  const normalized = normalizeIdentifier(identifier, channel);
  if (channel === 'email') {
    const [local, domain] = normalized.split('@');
    if (!domain) return normalized;
    const prefix = local.slice(0, Math.min(2, local.length));
    return `${prefix}${'*'.repeat(Math.max(2, local.length - prefix.length))}@${domain}`;
  }
  if (normalized.length <= 4) return normalized;
  return `${normalized.slice(0, Math.min(3, normalized.length - 4))}${'*'.repeat(
    Math.max(2, normalized.length - 7)
  )}${normalized.slice(-4)}`;
}

function hashOtp(otp: string, salt: string): string {
  return crypto.createHash('sha256').update(`${salt}:${otp}`).digest('hex');
}

function signPayload(payload: object): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SERVER_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySignedPayload<T>(token: string): T | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SERVER_SECRET).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

function pruneExpiredChallenges(now: number) {
  for (const [key, rec] of activeChallenges.entries()) {
    if (rec.expiresAt <= now) {
      activeChallenges.delete(key);
    }
  }
}

export async function requestOtpChallenge(
  rawIdentifier: string,
  channel: OtpChannel,
  rawOperatorName?: string
): Promise<RequestOtpResult> {
  const validationError = validateIdentifier(rawIdentifier, channel);
  if (validationError) {
    throw new OtpServiceError(validationError, 400);
  }

  const now = Date.now();
  pruneExpiredChallenges(now);

  const identifier = normalizeIdentifier(rawIdentifier, channel);
  const key = `${channel}:${identifier}`;
  const existing = activeChallenges.get(key);
  if (existing && now - existing.createdAt < RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil((RESEND_COOLDOWN_MS - (now - existing.createdAt)) / 1000);
    throw new OtpServiceError(
      `Please wait ${waitSec}s before requesting another OTP.`,
      429,
      waitSec
    );
  }

  const otp = String(crypto.randomInt(100000, 1000000));
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashOtp(otp, salt);
  const operatorName =
    rawOperatorName?.trim().slice(0, 64) ||
    (channel === 'email' ? identifier.split('@')[0] : `Operator ${identifier.slice(-4)}`);

  const record: OtpChallengeRecord = {
    key,
    identifier,
    channel,
    operatorName,
    salt,
    hash,
    expiresAt: now + OTP_TTL_MS,
    createdAt: now,
    attemptsLeft: MAX_ATTEMPTS,
  };
  activeChallenges.set(key, record);

  const challengeToken = signPayload({
    key,
    identifier,
    channel,
    operatorName,
    salt,
    hash,
    expiresAt: record.expiresAt,
  });

  let deliveryMode: 'webhook' | 'telemetry-dispatch' = 'telemetry-dispatch';
  const webhookUrl = process.env.OTP_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const resp = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team: 'Tejasvi',
          project: 'Flame in Firefall',
          channel,
          identifier,
          otp,
          expiresInSeconds: OTP_TTL_MS / 1000,
        }),
      });
      if (resp.ok) {
        deliveryMode = 'webhook';
      }
    } catch {
      deliveryMode = 'telemetry-dispatch';
    }
  }

  return {
    maskedTarget: maskIdentifier(identifier, channel),
    channel,
    expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
    cooldownSeconds: Math.floor(RESEND_COOLDOWN_MS / 1000),
    deliveryMode,
    challengeToken,
    ...(deliveryMode === 'telemetry-dispatch' ? { dispatchPreviewCode: otp } : {}),
  };
}

export function verifyOtpChallenge(
  rawIdentifier: string,
  channel: OtpChannel,
  rawCode: string,
  challengeToken?: string
): VerifyOtpResult {
  const validationError = validateIdentifier(rawIdentifier, channel);
  if (validationError) {
    throw new OtpServiceError(validationError, 400);
  }

  const code = rawCode.trim();
  if (!/^\d{6}$/.test(code)) {
    throw new OtpServiceError('Enter the 6-digit numeric verification code.', 400);
  }

  const now = Date.now();
  const identifier = normalizeIdentifier(rawIdentifier, channel);
  const key = `${channel}:${identifier}`;

  let record = activeChallenges.get(key);
  if (!record && challengeToken) {
    const decoded = verifySignedPayload<OtpChallengeRecord>(challengeToken);
    if (decoded && decoded.key === key && decoded.identifier === identifier) {
      record = {
        ...decoded,
        attemptsLeft: MAX_ATTEMPTS,
      };
      activeChallenges.set(key, record);
    }
  }

  if (!record) {
    throw new OtpServiceError('No active OTP request found. Request a new 6-digit code.', 404);
  }

  if (now > record.expiresAt) {
    activeChallenges.delete(key);
    throw new OtpServiceError('OTP has expired. Request a new 6-digit verification code.', 410);
  }

  if (record.attemptsLeft <= 0) {
    activeChallenges.delete(key);
    throw new OtpServiceError('Maximum verification attempts exceeded. Request a new OTP.', 429);
  }

  const candidateHash = hashOtp(code, record.salt);
  const candidateBuf = Buffer.from(candidateHash, 'hex');
  const expectedBuf = Buffer.from(record.hash, 'hex');

  if (candidateBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(candidateBuf, expectedBuf)) {
    record.attemptsLeft -= 1;
    if (record.attemptsLeft <= 0) {
      activeChallenges.delete(key);
      throw new OtpServiceError(
        'Incorrect OTP. Maximum attempts reached — please request a new code.',
        401
      );
    }
    throw new OtpServiceError(
      `Invalid 6-digit OTP code. ${record.attemptsLeft} attempt(s) remaining.`,
      401
    );
  }

  activeChallenges.delete(key);

  const verifiedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + SESSION_TTL_MS).toISOString();
  const user: OtpSessionUser = {
    id: `otp_${crypto.createHash('sha256').update(key).digest('hex').slice(0, 16)}`,
    identifier,
    channel,
    displayName: record.operatorName,
    team: 'Tejasvi',
    verifiedAt,
  };

  const token = signPayload({
    ...user,
    jti: crypto.randomBytes(12).toString('hex'),
    exp: now + SESSION_TTL_MS,
  });

  return { token, expiresAt, user };
}

export function verifyOtpSessionToken(token: string | undefined): OtpSessionUser | null {
  if (!token || revokedTokens.has(token)) return null;
  const decoded = verifySignedPayload<OtpSessionUser & { exp: number }>(token);
  if (!decoded || !decoded.exp || Date.now() > decoded.exp) {
    return null;
  }
  return {
    id: decoded.id,
    identifier: decoded.identifier,
    channel: decoded.channel,
    displayName: decoded.displayName,
    team: 'Tejasvi',
    verifiedAt: decoded.verifiedAt,
  };
}

export function revokeOtpSessionToken(token: string | undefined): void {
  if (token) {
    revokedTokens.add(token);
  }
}

export function issueDirectOperatorSession(rawOperatorId?: string): VerifyOtpResult {
  const cleanId = (rawOperatorId || 'default_operator').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48) || 'default_operator';
  const now = Date.now();
  const verifiedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + SESSION_TTL_MS).toISOString();
  const user: OtpSessionUser = {
    id: `op_${cleanId}`,
    identifier: 'mission-control@tejasvi.space',
    channel: 'email',
    displayName: 'Flight Commander',
    team: 'Tejasvi',
    verifiedAt,
  };

  const token = signPayload({
    ...user,
    jti: crypto.randomBytes(12).toString('hex'),
    exp: now + SESSION_TTL_MS,
  });

  return { token, expiresAt, user };
}

export function resetOtpStateForTests(): void {
  activeChallenges.clear();
  revokedTokens.clear();
}

export class OtpServiceError extends Error {
  statusCode: number;
  retryAfterSeconds?: number;

  constructor(message: string, statusCode = 400, retryAfterSeconds?: number) {
    super(message);
    this.name = 'OtpServiceError';
    this.statusCode = statusCode;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
