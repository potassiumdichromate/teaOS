// Real 0G Storage client per docs/0G_INTEGRATION.md — TS SDK, indexer resolves
// the flow contract internally on upload. Never called with plaintext: callers
// must encrypt (see lib/crypto.ts) before invoking uploadEncrypted.
import { ZgFile, Indexer } from "@0gfoundation/0g-storage-ts-sdk";
import { ethers } from "ethers";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

const provider = new ethers.JsonRpcProvider(env.ZG_RPC_URL);
const signer = env.ZG_SERVICE_PRIVATE_KEY
  ? new ethers.Wallet(env.ZG_SERVICE_PRIVATE_KEY, provider)
  : undefined;
const indexer = new Indexer(env.ZG_STORAGE_INDEXER_URL);

export interface StorageUploadResult {
  rootHash: string;
  txHash: string;
}

export async function uploadEncrypted(blob: Buffer): Promise<StorageUploadResult> {
  if (!signer) {
    throw new Error(
      "ZG_SERVICE_PRIVATE_KEY is not configured — 0G Storage uploads require a funded " +
        "service wallet. Set it in .env before calling uploadEncrypted().",
    );
  }
  const dir = await mkdtemp(join(tmpdir(), "nvei-upload-"));
  const path = join(dir, "blob.bin");
  try {
    await writeFile(path, blob);
    const file = await ZgFile.fromFilePath(path);
    try {
      const [tree, treeErr] = await file.merkleTree();
      if (treeErr || !tree) throw treeErr ?? new Error("merkle tree computation failed");
      const rootHash = tree.rootHash();
      if (!rootHash) throw new Error("merkle tree produced no root hash");

      // The SDK's `signer` param type resolves against a separate copy of
      // ethers' type declarations than our own `import { ethers } from
      // "ethers"` under TS's NodeNext dual ESM/CJS resolution — a known
      // upstream dual-package hazard, not a real runtime mismatch (it's the
      // same ethers.Wallet instance either way). Cast at this one boundary.
      const [tx, uploadErr] = await indexer.upload(file, env.ZG_RPC_URL, signer as never);
      if (uploadErr) throw uploadErr;
      // upload() is typed for both single- and multi-file results; ZgFile is
      // always a single file here, so it's always the non-batch branch.
      if (!("txHash" in tx)) throw new Error("unexpected batch upload result for a single file");

      logger.info({ rootHash, txHash: tx.txHash }, "0G Storage upload complete");
      return { rootHash, txHash: tx.txHash };
    } finally {
      await file.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Merkle-verified download — this is what backs the Student Verification storage proof check. */
export async function downloadVerified(rootHash: string): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "nvei-download-"));
  const path = join(dir, "blob.bin");
  try {
    const err = await indexer.download(rootHash, path, true /* withProof */);
    if (err) throw err;
    const { readFile } = await import("node:fs/promises");
    return await readFile(path);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
