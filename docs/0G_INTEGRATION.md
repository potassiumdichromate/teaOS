# 0G_INTEGRATION.md

Networks: mainnet **Aristotle** (chain ID `16661`) and testnet **Galileo** (chain ID `16602`). Deployment target is configurable per environment (`ZG_NETWORK=mainnet|testnet`); local/dev defaults to testnet, production defaults to mainnet — see `docs/MAINNET_DEPLOYMENT.md`.

## 0G Storage

Package: `@0gfoundation/0g-storage-ts-sdk` + `ethers`. Indexer endpoints:

| Network | RPC | Indexer (turbo) |
|---|---|---|
| Mainnet | `https://evmrpc.0g.ai` | `https://indexer-storage-turbo.0g.ai` |
| Testnet | `https://evmrpc-testnet.0g.ai` | `https://indexer-storage-testnet-turbo.0g.ai` |

Every blob (question payload, master paper, answer submission) is encrypted **before** it reaches this layer — 0G Storage never sees plaintext. Encryption is AES-256-GCM at the application layer (`apps/api/src/crypto`), not the CLI's `--encryption-key` AES-256-CTR flag (that's for the CLI tool's own file-upload convenience; our SDK-driven uploads encrypt in-process so the key never touches disk unencrypted).

```typescript
import { ZgFile, Indexer } from "@0gfoundation/0g-storage-ts-sdk";
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider(process.env.ZG_RPC_URL);
const signer = new ethers.Wallet(process.env.ZG_SERVICE_PRIVATE_KEY!, provider);
const indexer = new Indexer(process.env.ZG_STORAGE_INDEXER_URL!);

export async function uploadEncrypted(ciphertext: Buffer): Promise<{ rootHash: string; txHash: string }> {
  const tmpPath = await writeTemp(ciphertext);
  const file = await ZgFile.fromFilePath(tmpPath);
  const [tree] = await file.merkleTree();
  const [tx, err] = await indexer.upload(file, process.env.ZG_RPC_URL!, signer);
  if (err) throw err;
  await file.close();
  return { rootHash: tree!.rootHash(), txHash: tx.txHash };
}
```

Downloads always pass `--proof`-equivalent (`indexer.download(root, path, withProof: true)`) so every read is Merkle-verified — this is what backs the "0G Storage Verification" step in Student Verification.

## 0G Compute (AI Validation)

Router API, OpenAI-compatible. Base URLs:

| Network | Base URL |
|---|---|
| Mainnet | `https://router-api.0g.ai/v1` |
| Testnet | `https://router-api-testnet.integratenetwork.work/v1` |

**Trust mode is the whole point of using this instead of a generic LLM API.** Set per-request via the `X-0G-Trust-Mode` header (or `trust_mode` on the API key for a blanket policy):

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: process.env.ZG_COMPUTE_ROUTER_URL,
  apiKey: process.env.ZG_COMPUTE_API_KEY, // sk-... created at pc.0g.ai (or testnet equivalent)
});

const completion = await client.chat.completions.create(
  {
    model: "glm-5.2", // must be a model with verifiability: "TeeML" for private mode — checked via GET /v1/models
    messages: [
      { role: "system", content: VALIDATION_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(questionPayload) },
    ],
    response_format: { type: "json_schema", json_schema: AI_VALIDATION_REPORT_SCHEMA },
  },
  { headers: { "X-0G-Trust-Mode": "private" } } // sealed: prompt never leaves the TEE
);
```

If no TeeML provider is available for the requested model, the call fails with `503` — the worker retries/backs off, it **never silently downgrades to `standard`**, because that would quietly break the confidentiality claim we make in the UI (knowledge_base.md §5, rule 1).

`AIValidationReport.trustMode`/`providerAddress`/`attestationRef` are populated from the response headers/metadata so the Confidential Compute Dashboard can show, per question, exactly which provider and trust tier handled it, and link to independent verification via `dstack-verifier` (per `0g_context.md`'s own pointer) rather than asking the government reviewer to just believe our dashboard.

**What the model is and isn't trusted for**: the model's structured output (duplicate %, grammar issues, bias flags, difficulty/Bloom prediction, topic) is *advisory input* to a deterministic acceptance-threshold function in `apps/api`, not itself the final authority — see knowledge_base.md §10 gap. Duplicate-% in particular is corroborated against a direct embedding-similarity check against existing `Question.contentHash`-indexed text, not taken purely from the model's self-report.

## 0G Chain (registries)

See `docs/SMART_CONTRACTS.md` for the contracts themselves. Client-side: `ethers.js`, one signer per environment (`ZG_SERVICE_PRIVATE_KEY`, the same "ANCHOR_ROLE" account across all five registries, rotated independently of any Miden key).

## Environment variables (added to `.env.example` in Phase 2 scaffolding)

```
ZG_NETWORK=testnet
ZG_RPC_URL=https://evmrpc-testnet.0g.ai
ZG_STORAGE_INDEXER_URL=https://indexer-storage-testnet-turbo.0g.ai
ZG_COMPUTE_ROUTER_URL=https://router-api-testnet.integratenetwork.work/v1
ZG_COMPUTE_API_KEY=
ZG_SERVICE_PRIVATE_KEY=
QUESTION_REGISTRY_ADDRESS=
PAPER_REGISTRY_ADDRESS=
SUBMISSION_REGISTRY_ADDRESS=
RESULT_REGISTRY_ADDRESS=
AUDIT_LOG_REGISTRY_ADDRESS=
```
