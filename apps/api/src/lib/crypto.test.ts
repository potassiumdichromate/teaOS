import { describe, expect, it } from "vitest";
import {
  decrypt,
  deriveQuestionKey,
  deriveSessionKey,
  encrypt,
  generateContentKey,
  packEncryptedPayload,
  sha256Hex,
  unpackEncryptedPayload,
} from "./crypto.js";

describe("encrypt/decrypt round-trip", () => {
  it("recovers the exact plaintext", () => {
    const key = generateContentKey();
    const plaintext = Buffer.from("a real physics question, not a mock", "utf8");
    const payload = encrypt(plaintext, key);
    expect(decrypt(payload, key)).toEqual(plaintext);
  });

  it("survives a pack/unpack round-trip through the exact wire format uploaded to 0G Storage", () => {
    const key = generateContentKey();
    const plaintext = Buffer.from("packed payload", "utf8");
    const packed = packEncryptedPayload(encrypt(plaintext, key));
    const unpacked = unpackEncryptedPayload(packed);
    expect(decrypt(unpacked, key)).toEqual(plaintext);
  });

  it("fails to decrypt with the wrong key (AES-GCM auth tag rejects it)", () => {
    const plaintext = Buffer.from("secret", "utf8");
    const payload = encrypt(plaintext, generateContentKey());
    expect(() => decrypt(payload, generateContentKey())).toThrow();
  });

  it("fails to decrypt if the ciphertext was tampered with after encryption", () => {
    const key = generateContentKey();
    const payload = encrypt(Buffer.from("secret", "utf8"), key);
    payload.ciphertext[0] ^= 0xff;
    expect(() => decrypt(payload, key)).toThrow();
  });

  it("produces a different IV (and ciphertext) on every call, even for identical input", () => {
    const key = generateContentKey();
    const plaintext = Buffer.from("same plaintext", "utf8");
    const a = encrypt(plaintext, key);
    const b = encrypt(plaintext, key);
    expect(a.iv.equals(b.iv)).toBe(false);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
  });
});

describe("sha256Hex", () => {
  it("matches a known test vector", () => {
    // sha256("") — a standard, independently-checkable vector, not asserting against our own output
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("is deterministic for the same input", () => {
    expect(sha256Hex("hello")).toBe(sha256Hex("hello"));
  });

  it("differs for different input", () => {
    expect(sha256Hex("hello")).not.toBe(sha256Hex("hello!"));
  });
});

describe("deriveQuestionKey / deriveSessionKey", () => {
  it("is deterministic — the same id always derives the same key (derive-don't-store)", () => {
    expect(deriveQuestionKey("q1").equals(deriveQuestionKey("q1"))).toBe(true);
    expect(deriveSessionKey("s1").equals(deriveSessionKey("s1"))).toBe(true);
  });

  it("produces different keys for different ids", () => {
    expect(deriveQuestionKey("q1").equals(deriveQuestionKey("q2"))).toBe(false);
  });

  it("namespaces question keys and session keys separately, even for the same id string", () => {
    expect(deriveQuestionKey("same-id").equals(deriveSessionKey("same-id"))).toBe(false);
  });

  it("derives a 32-byte (256-bit) key", () => {
    expect(deriveQuestionKey("q1")).toHaveLength(32);
    expect(deriveSessionKey("s1")).toHaveLength(32);
  });
});
