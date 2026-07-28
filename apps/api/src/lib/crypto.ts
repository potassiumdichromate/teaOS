import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import { env } from "../config/env.js";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;

export interface EncryptedPayload {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

/** Generates a fresh 256-bit content-encryption key (used for a Question's or Paper's blob). */
export function generateContentKey(): Buffer {
  return randomBytes(32);
}

export function encrypt(plaintext: Buffer, key: Buffer): EncryptedPayload {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

export function decrypt(payload: EncryptedPayload, key: Buffer): Buffer {
  const decipher = createDecipheriv(ALGO, key, payload.iv);
  decipher.setAuthTag(payload.authTag);
  return Buffer.concat([decipher.update(payload.ciphertext), decipher.final()]);
}

/** Serializes {iv, authTag, ciphertext} into one blob for 0G Storage upload. */
export function packEncryptedPayload(payload: EncryptedPayload): Buffer {
  return Buffer.concat([payload.iv, payload.authTag, payload.ciphertext]);
}

export function unpackEncryptedPayload(blob: Buffer): EncryptedPayload {
  const iv = blob.subarray(0, IV_LENGTH);
  const authTag = blob.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = blob.subarray(IV_LENGTH + 16);
  return { iv, authTag, ciphertext };
}

/** sha256 content hash used for on-chain anchoring and duplicate-detection cross-checks. */
export function sha256Hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Question-bank content keys are derived (HKDF-SHA256) from QUESTION_BANK_MASTER_KEY
 * rather than stored per-question, so the access-controlled Paper Generation service
 * can decrypt any accepted question without a separate key-escrow table. This is
 * distinct from a Paper's key, which is NOT derivable like this — it's a fresh random
 * key sealed behind a real drand/tlock timelock (see lib/timelock.ts), precisely because
 * that one must be unobtainable before exam start even to this service.
 */
export function deriveQuestionKey(questionId: string): Buffer {
  const masterKey = Buffer.from(env.QUESTION_BANK_MASTER_KEY, "hex");
  const derived = hkdfSync("sha256", masterKey, Buffer.alloc(0), Buffer.from(`question:${questionId}`), 32);
  return Buffer.from(derived);
}

/**
 * Same derive-don't-store pattern as deriveQuestionKey, but namespaced
 * separately (different HKDF info string) so a session key can never
 * collide with or be confused for a question key even though they share a
 * root secret. Used for two things during the exam-taking window: (1)
 * encrypting each autosaved answer at rest in Redis, and (2) encrypting the
 * final aggregated answers blob uploaded to 0G Storage — the Evaluation
 * Engine re-derives the same key from sessionId rather than needing one
 * escrowed anywhere.
 */
export function deriveSessionKey(sessionId: string): Buffer {
  const masterKey = Buffer.from(env.QUESTION_BANK_MASTER_KEY, "hex");
  const derived = hkdfSync("sha256", masterKey, Buffer.alloc(0), Buffer.from(`session:${sessionId}`), 32);
  return Buffer.from(derived);
}
