import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const VAULT_DIR = path.resolve(process.cwd(), '.vault');
const VAULT_FILE = path.join(VAULT_DIR, 'integrations-vault.enc.json');
const STATE_FILE = path.join(VAULT_DIR, 'integrations-state.json');

const MASTER_SEED =
  process.env.INTEGRATION_VAULT_SECRET ||
  process.env.OTP_SESSION_SECRET ||
  process.env.GEMINI_API_KEY ||
  'flame-in-firefall-team-tejasvi-vault-fallback-seed';

const AES_KEY = crypto.createHash('sha256').update(MASTER_SEED).digest();

interface EncryptedEnvelope {
  iv: string;
  tag: string;
  ciphertext: string;
}

type VaultFileMap = Record<string, EncryptedEnvelope>;

function ensureVaultDir() {
  try {
    if (!fs.existsSync(VAULT_DIR)) {
      fs.mkdirSync(VAULT_DIR, { recursive: true, mode: 0o700 });
    }
  } catch {
    // Fallback to in-memory vault when filesystem is read-only
  }
}

const memoryVault = new Map<string, EncryptedEnvelope>();
const memoryState = new Map<string, unknown>();

function readVaultMap(): VaultFileMap {
  ensureVaultDir();
  try {
    if (fs.existsSync(VAULT_FILE)) {
      const raw = fs.readFileSync(VAULT_FILE, 'utf8');
      return JSON.parse(raw) as VaultFileMap;
    }
  } catch {
    // Ignore corrupt or unavailable vault file
  }
  const obj: VaultFileMap = {};
  for (const [k, v] of memoryVault.entries()) {
    obj[k] = v;
  }
  return obj;
}

function writeVaultMap(map: VaultFileMap): void {
  for (const [k, v] of Object.entries(map)) {
    memoryVault.set(k, v);
  }
  ensureVaultDir();
  try {
    fs.writeFileSync(VAULT_FILE, JSON.stringify(map, null, 2), { mode: 0o600 });
  } catch {
    // In-memory store stays active on read-only containers
  }
}

function encryptSecrets(secrets: Record<string, string>): EncryptedEnvelope {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', AES_KEY, iv);
  const plaintext = JSON.stringify(secrets);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
  };
}

function decryptSecrets(env: EncryptedEnvelope): Record<string, string> {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    AES_KEY,
    Buffer.from(env.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(env.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(env.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8')) as Record<string, string>;
}

export function saveEncryptedIntegrationSecrets(
  actorId: string,
  integrationId: string,
  secrets: Record<string, string>
): void {
  const key = `${actorId}::${integrationId}`;
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(secrets)) {
    if (typeof v === 'string' && v.trim()) {
      cleaned[k] = v.trim();
    }
  }

  const map = readVaultMap();
  if (Object.keys(cleaned).length === 0) {
    delete map[key];
    memoryVault.delete(key);
  } else {
    const env = encryptSecrets(cleaned);
    map[key] = env;
    memoryVault.set(key, env);
  }
  writeVaultMap(map);
}

export function getDecryptedIntegrationSecrets(
  actorId: string,
  integrationId: string
): Record<string, string> {
  const key = `${actorId}::${integrationId}`;
  const mem = memoryVault.get(key);
  if (mem) {
    try {
      return decryptSecrets(mem);
    } catch {
      return {};
    }
  }
  const map = readVaultMap();
  const env = map[key];
  if (!env) return {};
  try {
    memoryVault.set(key, env);
    return decryptSecrets(env);
  } catch {
    return {};
  }
}

export function deleteEncryptedIntegrationSecrets(
  actorId: string,
  integrationId: string
): void {
  const key = `${actorId}::${integrationId}`;
  memoryVault.delete(key);
  const map = readVaultMap();
  delete map[key];
  writeVaultMap(map);
}

export function maskSecretValue(val: string): string {
  const trimmed = val.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const u = new URL(trimmed);
      return `${u.protocol}//${u.host}/••••${trimmed.slice(-4)}`;
    } catch {
      return `••••${trimmed.slice(-4)}`;
    }
  }
  if (trimmed.length <= 6) return '••••••';
  return `${trimmed.slice(0, 2)}••••${trimmed.slice(-4)}`;
}

export function buildMaskedSecretSummary(secrets: Record<string, string>): string {
  const entries = Object.entries(secrets).filter(([, v]) => Boolean(v && v.trim()));
  if (entries.length === 0) return '';
  return entries
    .map(([k, v]) => `${k}: ${maskSecretValue(v)}`)
    .join(' · ')
    .slice(0, 155);
}

export function saveActorState<T>(actorId: string, namespace: string, data: T): void {
  const key = `${actorId}::${namespace}`;
  memoryState.set(key, data);
  ensureVaultDir();
  try {
    let existing: Record<string, unknown> = {};
    if (fs.existsSync(STATE_FILE)) {
      existing = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as Record<string, unknown>;
    }
    existing[key] = data;
    fs.writeFileSync(STATE_FILE, JSON.stringify(existing, null, 2), { mode: 0o600 });
  } catch {
    // Fallback to memoryState
  }
}

export function getActorState<T>(actorId: string, namespace: string): T | null {
  const key = `${actorId}::${namespace}`;
  if (memoryState.has(key)) {
    return memoryState.get(key) as T;
  }
  try {
    if (fs.existsSync(STATE_FILE)) {
      const existing = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as Record<string, unknown>;
      if (key in existing) {
        memoryState.set(key, existing[key]);
        return existing[key] as T;
      }
    }
  } catch {
    // Ignore read error
  }
  return null;
}

// URL & SSRF validation
const BLOCKED_METADATA_HOSTS = new Set([
  '169.254.169.254',
  'metadata.google.internal',
  'metadata.goog',
  '0.0.0.0',
]);

export function validateExternalWebhookUrl(
  rawUrl: string,
  options: {
    allowHttpForLocalIot?: boolean;
    requiredHostSuffixes?: string[];
    requiredPathPrefix?: string;
  } = {}
): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return 'Webhook or endpoint URL is required.';
  if (trimmed.length > 1024) return 'URL exceeds maximum allowed length (1024 characters).';

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return 'Enter a valid absolute URL starting with https://.';
  }

  const isHttps = parsed.protocol === 'https:';
  const isHttp = parsed.protocol === 'http:';
  if (!isHttps && !(options.allowHttpForLocalIot && isHttp)) {
    return 'Only HTTPS URLs are permitted for cloud webhooks.';
  }

  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_METADATA_HOSTS.has(host)) {
    return 'Blocked internal cloud metadata hostname.';
  }

  if (!options.allowHttpForLocalIot && (host === 'localhost' || host === '127.0.0.1' || host === '::1')) {
    return 'Loopback URLs are not permitted for cloud webhook integrations.';
  }

  if (options.requiredHostSuffixes && options.requiredHostSuffixes.length > 0) {
    const ok = options.requiredHostSuffixes.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`)
    );
    if (!ok) {
      return `Webhook hostname must match ${options.requiredHostSuffixes.join(' or ')}.`;
    }
  }

  if (options.requiredPathPrefix && !parsed.pathname.startsWith(options.requiredPathPrefix)) {
    return `Webhook path must start with ${options.requiredPathPrefix}.`;
  }

  return null;
}

// Sliding-window Rate Limiter & Duplicate Notification Prevention
const rateBuckets = new Map<string, number[]>();
const dedupeBuckets = new Map<string, number>();

export function checkRateLimit(bucketKey: string, maxRequests = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  const timestamps = (rateBuckets.get(bucketKey) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    rateBuckets.set(bucketKey, timestamps);
    return false;
  }
  timestamps.push(now);
  rateBuckets.set(bucketKey, timestamps);
  return true;
}

export function checkAndMarkDuplicate(dedupeKey: string, windowMs = 60_000): boolean {
  const now = Date.now();
  const lastAt = dedupeBuckets.get(dedupeKey);
  if (lastAt && now - lastAt < windowMs) {
    return true; // Duplicate within cooldown window
  }
  dedupeBuckets.set(dedupeKey, now);
  if (dedupeBuckets.size > 1000) {
    for (const [k, ts] of dedupeBuckets.entries()) {
      if (now - ts > windowMs * 2) dedupeBuckets.delete(k);
    }
  }
  return false;
}

export function sanitizeLogDetail(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/bot\d+:[A-Za-z0-9_-]+/g, 'bot[REDACTED]')
    .replace(/(ghp|github_pat)_[A-Za-z0-9_]+/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/(EAAG|ATTA)[A-Za-z0-9_-]+/g, '[REDACTED_TOKEN]')
    .slice(0, 480);
}

export function resetVaultAndLimitersForTests(): void {
  memoryVault.clear();
  memoryState.clear();
  rateBuckets.clear();
  dedupeBuckets.clear();
}
