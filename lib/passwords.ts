import bcrypt from "bcryptjs";

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$/;
const BCRYPT_ROUNDS = 12;

/** Hashes a plaintext password for storage (bcrypt, cost 12). */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS);
}

/** True when a stored credential is a bcrypt hash (not legacy plaintext). */
export function isBcryptHash(stored: string | null | undefined): boolean {
  return !!stored && BCRYPT_HASH_PATTERN.test(stored);
}

/**
 * Verifies a submitted password against a stored bcrypt hash. Legacy plaintext
 * rows are rejected outright (never compared) and must be migrated with
 * `npm run db:hash-passwords`.
 */
export async function verifyStoredPassword(
  submitted: string,
  stored: string,
): Promise<boolean> {
  if (!isBcryptHash(stored)) return false;
  try {
    return await bcrypt.compare(submitted, stored);
  } catch {
    return false;
  }
}
