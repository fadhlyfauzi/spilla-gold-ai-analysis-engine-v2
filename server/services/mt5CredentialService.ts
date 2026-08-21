import crypto from 'crypto';

/**
 * Service for AES-256-GCM encryption and decryption of MT5 Trading Passwords.
 * Used exclusively by SPILLA GOLD to securely store and reveal trading credentials
 * for manual provisioning on the central MT5 terminal laptop.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128-bit IV for AES-GCM

/**
 * Retrieves and validates the 256-bit encryption key buffer from environment.
 * If MT5_CREDENTIAL_ENCRYPTION_KEY is missing, throws an explicit configuration error.
 */
function getEncryptionKeyBuffer(): Buffer {
  const rawKey = process.env.MT5_CREDENTIAL_ENCRYPTION_KEY;
  if (!rawKey || !rawKey.trim()) {
    throw new Error(
      'SERVER_CONFIG_ERROR: MT5_CREDENTIAL_ENCRYPTION_KEY environment variable is not configured. Plaintext password storage is strictly forbidden.'
    );
  }

  const trimmed = rawKey.trim();

  // If 64 hex chars (32 bytes), parse directly
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }

  // Otherwise, derive a deterministic 256-bit key using SHA-256
  return crypto.createHash('sha256').update(trimmed, 'utf8').digest();
}

/**
 * Encrypts MT5 Trading Password using AES-256-GCM.
 * Returns { encryptedPassword, iv, authTag } (all hex encoded).
 */
export function encryptMt5Password(plaintext: string): {
  encryptedPassword: string;
  iv: string;
  authTag: string;
} {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('Password to encrypt must be a non-empty string.');
  }

  const key = getEncryptionKeyBuffer();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return {
    encryptedPassword: encrypted,
    iv: iv.toString('hex'),
    authTag,
  };
}

/**
 * Decrypts MT5 Trading Password using AES-256-GCM.
 * Only callable by authorized Admin provisioning endpoints.
 */
export function decryptMt5Password(encryptedPassword: string, iv: string, authTag: string): string {
  if (!encryptedPassword || !iv || !authTag) {
    throw new Error('Invalid encrypted credential payload: encryptedPassword, iv, and authTag are required.');
  }

  const key = getEncryptionKeyBuffer();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));

  let decrypted = decipher.update(encryptedPassword, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
