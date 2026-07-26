import { createHash } from "node:crypto";

// Deterministic seeded Fisher-Yates: same seed always produces the same
// order, so a student who refreshes mid-exam sees a stable palette instead
// of the questions reshuffling under them, while two different students'
// seeds (StudentExamSession.randomizationSeed, one per session) diverge.
// mulberry32 — small, fast, good-enough distribution for UI randomization
// (not cryptographic; the seed itself is a random UUID-strength value, not a
// secret that needs protecting from prediction).
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedToInt(seed: string): number {
  const hash = createHash("sha256").update(seed).digest();
  return hash.readUInt32BE(0);
}

export function seededShuffle<T>(items: T[], seed: string, salt: string): T[] {
  const rng = mulberry32(seedToInt(`${seed}:${salt}`));
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
