export const ZG_NETWORKS = {
  mainnet: {
    chainId: 16661,
    rpcUrl: "https://evmrpc.0g.ai",
    storageIndexerUrl: "https://indexer-storage-turbo.0g.ai",
    computeRouterUrl: "https://router-api.0g.ai/v1",
    explorerUrl: "https://explorer.0g.ai/mainnet/home",
  },
  testnet: {
    chainId: 16602,
    rpcUrl: "https://evmrpc-testnet.0g.ai",
    storageIndexerUrl: "https://indexer-storage-testnet-turbo.0g.ai",
    computeRouterUrl: "https://router-api-testnet.integratenetwork.work/v1",
    explorerUrl: "https://chainscan-galileo.0g.ai",
  },
} as const;

// Miden has no mainnet — see knowledge_base.md §2. Every Miden-facing
// surface in this app must badge "testnet" and must never offer "mainnet".
export const MIDEN_NETWORK = "testnet" as const;

export const AI_VALIDATION_THRESHOLDS = {
  // Raised from 35 to 80 (2026-07-30) — 35 was rejecting far too much
  // legitimate content (common textbook-style questions naturally overlap
  // with what's already in the bank). Duplication is no longer purely a
  // gate: an accepted question keeps its measured duplicatePct, tagged into
  // a DUPLICATION_LEVEL band below, so a blueprint's chapter allocation can
  // still choose to draw only from LOW-duplication questions when it wants
  // a stricter pool, without blocking everything above 35% at intake time.
  maxDuplicatePct: 80,
  maxBiasFlags: 0,
  maxGrammarIssues: 3,
} as const;

/** Upper bound (inclusive) of measured duplicatePct for each duplication tag. */
export const DUPLICATION_LEVEL_MAX_PCT = {
  LOW: 30,
  MEDIUM: 60,
  HIGH: 80,
} as const;

export function duplicationLevelFor(duplicatePct: number): "LOW" | "MEDIUM" | "HIGH" {
  if (duplicatePct <= DUPLICATION_LEVEL_MAX_PCT.LOW) return "LOW";
  if (duplicatePct <= DUPLICATION_LEVEL_MAX_PCT.MEDIUM) return "MEDIUM";
  return "HIGH";
}

export const REGISTRY_CONTRACT_NAMES = [
  "QuestionRegistry",
  "PaperRegistry",
  "SubmissionRegistry",
  "ResultRegistry",
  "AuditLogRegistry",
] as const;
