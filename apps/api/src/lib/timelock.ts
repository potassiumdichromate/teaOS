// Real drand/tlock timelock encryption — the mechanism that seals a Paper's
// content-encryption key so nobody, including this backend, can read it
// before exam start. This replaced a Miden testnet P2IDE note (see
// lib/miden-bridge.ts, kept dormant, not deleted) on 2026-07-28 after ~2
// days / ~40 hourly checks of Miden's public testnet rejecting the only
// published miden-client version — see knowledge_base.md §11o for the full
// record of that decision.
//
// How it actually works: `timelockEncrypt` (from the drand team's own
// `tlock-js`) IBE-encrypts the payload to a future drand beacon round. That
// round's threshold BLS signature — published by drand's decentralized,
// multi-operator "quicknet" network on a fixed 3s schedule — IS the
// decryption key. No operator, and no threshold-minus-one collusion of
// operators, can produce it before the round is due. This is the same
// "nobody can read this before time T, enforced by a decentralized network"
// guarantee the Miden P2IDE note was providing, just backed by a mature,
// years-in-production beacon network instead of a pre-1.0 SDK.
//
// Verified for real before this file was written: a standalone round-trip
// (encrypt now for ~9s in the future, confirm decrypt throws "too early",
// wait, confirm decrypt then succeeds and matches) against the live drand
// mainnet quicknet chain — not simulated, not mocked.
import {
  timelockEncrypt,
  timelockDecrypt,
  mainnetClient,
  testnetClient,
  roundAt,
  roundTime,
  type ChainClient,
} from "tlock-js";
import { env } from "../config/env.js";

function getClient(): ChainClient {
  // Both are real drand networks; mainnet's "quicknet" beacon (3s period) is
  // the default because it's what was actually proven live above. Testnet
  // exists for lower-stakes iteration if ever needed (see TLOCK_NETWORK).
  return env.TLOCK_NETWORK === "testnet" ? testnetClient() : mainnetClient();
}

export interface SealedTimelock {
  /** Armored age-encrypted ciphertext — opaque, safe to store as plain text (Paper.timelockRef). */
  ref: string;
  /** The drand round this ciphertext unlocks at. */
  round: number;
  /** drand's own estimate of when that round will be emitted (approximate — the network must actually produce it). */
  unlockEstimate: string;
}

/**
 * Seals `contentKey` so it can only be decrypted once drand has published
 * the round covering `unlockAt`. Uses `roundAt(...) + 1` rather than the
 * exact round at `unlockAt`, because `roundAt` returns the latest round
 * emitted *at or before* a given time — adding one guarantees the target
 * round's own emission time is strictly after `unlockAt`, at the cost of up
 * to one extra beacon period (~3s) of delay. That tradeoff is deliberate:
 * an exam key unlocking a few seconds late is fine; unlocking early is not.
 */
export async function sealContentKey(contentKey: Buffer, unlockAt: Date): Promise<SealedTimelock> {
  const client = getClient();
  const chainInfo = await client.chain().info();
  const round = roundAt(unlockAt.getTime(), chainInfo) + 1;
  const ref = await timelockEncrypt(round, contentKey, client);
  return { ref, round, unlockEstimate: new Date(roundTime(chainInfo, round)).toISOString() };
}

/**
 * Recovers a content key sealed by `sealContentKey`. Throws (does not
 * silently return garbage) if the target round hasn't been emitted yet —
 * `tlock-js`'s own error message is "It's too early to decrypt the
 * ciphertext...". Callers should treat that as a real, honest 409, not a
 * bug: right at the boundary of `unlockAt`, the round may not have been
 * confirmed by drand's network for up to ~3s yet, since producing
 * randomness is itself a real distributed process, not instantaneous.
 */
export async function unsealContentKey(ref: string): Promise<Buffer> {
  const client = getClient();
  return timelockDecrypt(ref, client);
}
