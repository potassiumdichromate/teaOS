// 0G Chain registry bindings per docs/SMART_CONTRACTS.md. Addresses come from
// env (populated after `npm run contracts:deploy:testnet|mainnet`) — never
// hardcoded, per SMART_CONTRACTS.md's own rule.
import { ethers } from "ethers";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

const provider = new ethers.JsonRpcProvider(env.ZG_RPC_URL);
const signer = env.ZG_SERVICE_PRIVATE_KEY
  ? new ethers.Wallet(env.ZG_SERVICE_PRIVATE_KEY, provider)
  : undefined;

const ANCHOR_ABIS = {
  QuestionRegistry: [
    "function anchorQuestion(bytes32 questionId, bytes32 contentHash, bytes32 validationHash) external",
    "event QuestionAnchored(bytes32 indexed questionId, bytes32 contentHash, bytes32 validationHash)",
  ],
  PaperRegistry: [
    "function anchorPaper(bytes32 paperId, bytes32 masterPaperHash, bytes32 blueprintHash) external",
    "event PaperAnchored(bytes32 indexed paperId, bytes32 masterPaperHash, bytes32 blueprintHash)",
  ],
  SubmissionRegistry: [
    "function anchorSubmission(bytes32 sessionId, bytes32 submissionHash, bytes32 paperId) external",
    "event SubmissionAnchored(bytes32 indexed sessionId, bytes32 submissionHash, bytes32 paperId)",
    // Auto-generated getter for the public `anchors` mapping — the read side
    // of the same guarantee `anchorSubmission`'s `require(blockTimestamp==0)`
    // enforces on write. This is the real, already-deployed, protocol-level
    // double-submission guard (a student's session can only ever be
    // anchored once, forever, enforced by the contract itself) — see
    // getSubmissionAnchor below and knowledge_base.md §11q.
    "function anchors(bytes32) view returns (bytes32 submissionHash, bytes32 paperId, uint64 blockTimestamp)",
  ],
  ResultRegistry: [
    "function anchorResult(bytes32 applicationKey, bytes32 resultHash, bytes32 sessionId) external",
    "event ResultAnchored(bytes32 indexed applicationKey, bytes32 resultHash, bytes32 sessionId)",
  ],
  AuditLogRegistry: [
    "function anchorBatch(bytes32 merkleRoot) external returns (uint256 batchId)",
    "event BatchAnchored(uint256 indexed batchId, bytes32 merkleRoot, uint64 blockTimestamp)",
  ],
} as const;

type RegistryName = keyof typeof ANCHOR_ABIS;

const ADDRESSES: Record<RegistryName, string | undefined> = {
  QuestionRegistry: env.QUESTION_REGISTRY_ADDRESS,
  PaperRegistry: env.PAPER_REGISTRY_ADDRESS,
  SubmissionRegistry: env.SUBMISSION_REGISTRY_ADDRESS,
  ResultRegistry: env.RESULT_REGISTRY_ADDRESS,
  AuditLogRegistry: env.AUDIT_LOG_REGISTRY_ADDRESS,
};

function contractFor(name: RegistryName): ethers.Contract {
  const address = ADDRESSES[name];
  if (!address) {
    throw new Error(
      `${name.toUpperCase()}_ADDRESS is not configured — deploy contracts/evm ` +
        `(npm run contracts:deploy:testnet) and set the address in .env.`,
    );
  }
  if (!signer) {
    throw new Error("ZG_SERVICE_PRIVATE_KEY is not configured — chain anchoring requires a signer.");
  }
  return new ethers.Contract(address, ANCHOR_ABIS[name], signer);
}

// Read-only calls (view functions) never need a signer — this deliberately
// stays independent of ZG_SERVICE_PRIVATE_KEY so a public, unauthenticated
// check (like /verify) works against the chain's own RPC and nothing else.
function readOnlyContractFor(name: RegistryName): ethers.Contract {
  const address = ADDRESSES[name];
  if (!address) {
    throw new Error(`${name.toUpperCase()}_ADDRESS is not configured.`);
  }
  return new ethers.Contract(address, ANCHOR_ABIS[name], provider);
}

export interface AnchorResult {
  txHash: string;
  blockNumber: number;
}

async function submitAnchor(
  name: RegistryName,
  method: string,
  args: unknown[],
): Promise<AnchorResult> {
  const contract = contractFor(name);
  const tx = await (contract[method] as (...a: unknown[]) => Promise<ethers.ContractTransactionResponse>)(
    ...args,
  );
  const receipt = await tx.wait();
  if (!receipt) throw new Error(`${name}.${method} transaction was dropped`);
  logger.info({ name, method, txHash: receipt.hash, block: receipt.blockNumber }, "0G Chain anchor confirmed");
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
}

export const zgChain = {
  anchorQuestion: (questionId: string, contentHash: string, validationHash: string) =>
    submitAnchor("QuestionRegistry", "anchorQuestion", [questionId, contentHash, validationHash]),
  anchorPaper: (paperId: string, masterPaperHash: string, blueprintHash: string) =>
    submitAnchor("PaperRegistry", "anchorPaper", [paperId, masterPaperHash, blueprintHash]),
  anchorSubmission: (sessionId: string, submissionHash: string, paperId: string) =>
    submitAnchor("SubmissionRegistry", "anchorSubmission", [sessionId, submissionHash, paperId]),
  anchorResult: (applicationKey: string, resultHash: string, sessionId: string) =>
    submitAnchor("ResultRegistry", "anchorResult", [applicationKey, resultHash, sessionId]),
  anchorAuditBatch: (merkleRoot: string) => submitAnchor("AuditLogRegistry", "anchorBatch", [merkleRoot]),
};

/** keccak256(cuid) — deterministic bytes32 key for any Prisma entity id, used across all registries. */
export function toBytes32Id(id: string): string {
  return ethers.id(id);
}

/**
 * ResultRegistry lookup key: keccak256(applicationId, saltedDob) per
 * docs/SMART_CONTRACTS.md — never the raw applicationId/DOB on-chain.
 */
export function computeApplicationKey(applicationId: string, dobIso: string): string {
  return ethers.solidityPackedKeccak256(
    ["string", "string"],
    [applicationId, `${dobIso}:${env.RESULT_KEY_SALT}`],
  );
}

/** Live RPC reachability check for the System Health panel. */
export async function getChainBlockNumber(): Promise<number> {
  return provider.getBlockNumber();
}

/** Re-fetches a transaction receipt directly from the chain — the actual
 * source of truth, not our own ChainAnchor mirror table — and confirms it
 * both exists and succeeded. This is what backs the Student Verification
 * "chain tx valid" check. */
export async function verifyTransaction(txHash: string): Promise<boolean> {
  const receipt = await provider.getTransactionReceipt(txHash);
  return receipt !== null && receipt.status === 1;
}

/**
 * Reads a session's submission commitment directly from the deployed
 * SubmissionRegistry contract — not our Postgres mirror, not a bridge.
 * `blockTimestamp === 0` means nothing was ever anchored for this
 * sessionId; any non-zero value is proof-by-construction that
 * `anchorSubmission`'s `require(anchors[sessionId].blockTimestamp == 0)`
 * guard let exactly one write through and would revert a second one — the
 * real, protocol-level double-submission guarantee, independently
 * confirmable by anyone with the sessionId and an RPC endpoint. See
 * knowledge_base.md §11q for why this replaced the Miden submission-note
 * check (which could never actually succeed — that bridge was never wired).
 */
export async function getSubmissionAnchor(
  sessionId: string,
): Promise<{ submissionHash: string; paperId: string; blockTimestamp: number } | null> {
  const contract = readOnlyContractFor("SubmissionRegistry");
  const [submissionHash, paperId, blockTimestamp] = (await contract.anchors(toBytes32Id(sessionId))) as [
    string,
    string,
    bigint,
  ];
  if (blockTimestamp === 0n) return null;
  return { submissionHash, paperId, blockTimestamp: Number(blockTimestamp) };
}
