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
  maxDuplicatePct: 35,
  maxBiasFlags: 0,
  maxGrammarIssues: 3,
} as const;

export const REGISTRY_CONTRACT_NAMES = [
  "QuestionRegistry",
  "PaperRegistry",
  "SubmissionRegistry",
  "ResultRegistry",
  "AuditLogRegistry",
] as const;
