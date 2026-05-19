import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { loadEnv } from './env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const SCRYPT_SALT = 'boffin-intel-salt';

export const TOKEN_ENCRYPTION_VERSION = 1;

function deriveKey(secret: string): Buffer {
  if (!secret) throw new Error('ENCRYPTION_KEY is required for OAuth token encryption');
  // Prefer raw base64-encoded 32-byte key. Fall back to scrypt of passphrase
  // for parity with the old project.
  try {
    const b = Buffer.from(secret, 'base64');
    if (b.length === 32) return b;
  } catch {
    /* fall through */
  }
  return scryptSync(secret, SCRYPT_SALT, 32);
}

function getSecret(): string {
  const env = loadEnv();
  if (!env.ENCRYPTION_KEY) {
    throw new Error(
      'ENCRYPTION_KEY missing. Set ENCRYPTION_KEY in .env before storing or reading OAuth tokens.',
    );
  }
  return env.ENCRYPTION_KEY;
}

export function encryptString(plaintext: string): string {
  const key = deriveKey(getSecret());
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptString(ciphertext: string): string {
  const key = deriveKey(getSecret());
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const enc = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString('utf8');
}

export type TokenPayload = {
  refreshToken?: string;
  accessToken?: string;
  accessTokenExpiresAt?: string;
  scope?: string;
  googleAccountEmail?: string;
};

export function encryptTokens(tokens: TokenPayload): string {
  return encryptString(JSON.stringify(tokens));
}

export function decryptTokens(ciphertext: string): TokenPayload {
  return JSON.parse(decryptString(ciphertext)) as TokenPayload;
}
