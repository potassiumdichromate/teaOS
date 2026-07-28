import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  JWT_SECRET: z.string().min(16, "JWT_SECRET must be set to a real secret before running the API"),
  JWT_EXPIRES_IN: z.string().default("12h"),

  QUESTION_BANK_MASTER_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "QUESTION_BANK_MASTER_KEY must be a 32-byte hex string"),

  // Salts the (applicationId, dob) -> on-chain lookup key for ResultRegistry
  // (see docs/SMART_CONTRACTS.md). Note the tradeoff this implies: a citizen
  // can only recompute their own key via our /verify endpoint, not fully
  // independently with just their own applicationId+DOB and a block
  // explorer, because the salt is server-held. Documented, not hidden.
  RESULT_KEY_SALT: z.string().min(16),

  ZG_NETWORK: z.enum(["testnet", "mainnet"]).default("testnet"),
  ZG_RPC_URL: z.string().url(),
  ZG_CHAIN_ID: z.coerce.number().int(),
  ZG_SERVICE_PRIVATE_KEY: z.string().optional(),

  QUESTION_REGISTRY_ADDRESS: z.string().optional(),
  PAPER_REGISTRY_ADDRESS: z.string().optional(),
  SUBMISSION_REGISTRY_ADDRESS: z.string().optional(),
  RESULT_REGISTRY_ADDRESS: z.string().optional(),
  AUDIT_LOG_REGISTRY_ADDRESS: z.string().optional(),

  ZG_STORAGE_INDEXER_URL: z.string().url(),

  ZG_COMPUTE_ROUTER_URL: z.string().url(),
  ZG_COMPUTE_API_KEY: z.string().optional(),
  ZG_COMPUTE_MODEL: z.string().default("glm-5.2"),
  ZG_COMPUTE_TRUST_MODE: z.enum(["standard", "verified", "private"]).default("private"),

  // Paper key-release timelock — real drand/tlock, see lib/timelock.ts and
  // knowledge_base.md §11o. Mainnet's "quicknet" beacon is the default
  // because that's what was actually proven live.
  TLOCK_NETWORK: z.enum(["mainnet", "testnet"]).default("mainnet"),

  // Miden bridge kept dormant (not deleted) for the submission-commitment
  // note path only — the paper-key timelock above no longer depends on it.
  MIDEN_NETWORK: z.literal("testnet").default("testnet"),
  MIDEN_BRIDGE_URL: z.string().url(),
  MIDEN_SERVICE_KEYSTORE_PATH: z.string().default("./contracts/miden/keys"),

  API_PORT: z.coerce.number().int().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail loudly and early — a misconfigured env var here (e.g. a missing
  // registry address) must never silently fall back to a mock/no-op.
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
