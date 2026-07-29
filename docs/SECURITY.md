# SECURITY.md

Companion to [knowledge_base.md](../knowledge_base.md) §9 (Security Decisions) and §3 (What's Real vs. Engineered) — this doc goes one level deeper into *how* each guarantee is implemented and what its actual limits are. Nothing here overstates a guarantee beyond what §3 documents; see docs/SYSTEM_ARCHITECTURE.md's UI Copy Rules for why that matters to this project specifically.

## 1. Confidentiality at rest

- Question, master-paper, and answer content is AES-256-GCM encrypted at the application layer (`apps/api/src/lib/crypto.ts`) **before** anything reaches 0G Storage. Postgres never holds plaintext once a `Question` is `ACCEPTED` or a `Paper` is `READY` (docs/DATABASE.md design principle 1).
- Keys are never stored. Question/session keys are derived on demand via HKDF-SHA256 from `QUESTION_BANK_MASTER_KEY` (`deriveQuestionKey`/`deriveSessionKey`) — there is no per-question key-escrow table to leak. A Paper's content key is the one exception: it's a fresh, non-derived random key, because it must be genuinely unobtainable (not just "not stored") before exam start — see §2.
- AES-GCM's auth tag means tampering with ciphertext after encryption is detected on decrypt, not silently accepted (covered by `src/lib/crypto.test.ts`).

## 2. The paper-key timelock

"Nobody — not even us — can read the paper before exam start" is enforced by **real drand/tlock**, not an `if (now > examStart)` check (though the app also enforces that as defense-in-depth). The content key is timelock-encrypted (`lib/timelock.ts`) to a future drand mainnet quicknet round; it only becomes decryptable once that round's real threshold-BLS signature is published by drand's independent multi-operator network (Cloudflare, Protocol Labs, EPFL, UCL, and others) — no single party, and no threshold-minus-one collusion, can produce it early. Proven live end-to-end 2026-07-28 (knowledge_base.md §11p): a real Paper reached `READY`, a real exam session unsealed the key and started, submitted, and was evaluated against it.

This replaced an original Miden P2IDE-note design (§11o) — same guarantee, different backend, after Miden's testnet RPC never became reliably usable during this project's window.

## 3. Double-submission prevention

Two independent layers, neither of them a Miden note (that plan was retired, see §11q — no replacement was needed because the guarantee already existed elsewhere):

1. **On-chain**: `SubmissionRegistry.anchorSubmission` reverts with `require(anchors[sessionId].blockTimestamp == 0, "already anchored")` — a protocol-level, deployed-on-mainnet, write-once guard.
2. **Application/DB**: `@@unique([studentId, paperId])` on `StudentExamSession` means a student can't even open a second session against the same paper to attempt a resubmission.

Verified under real concurrent load in `apps/api/scripts/load-test.mjs` — N concurrent enrollment requests against the same (student, paper) pair, at most one ever succeeds.

## 4. AI validation integrity

Question validation (duplicate %, grammar, bias, difficulty, Bloom level) runs inside a real hardware TEE via 0G Compute's `private` trust mode (TeeML-only routing, Intel TDX attestation) — not a plain API call to an LLM. The model's structured output is treated as **advisory input to deterministic acceptance rules**, never as an unchecked oracle (knowledge_base.md §10) — a schema mismatch or a model returning an unexpected shape fails the pipeline visibly rather than silently accepting garbage (a real instance of this, and its fix, is recorded in §11k).

## 5. Auditability and tamper-evidence of the log itself

Every state-changing action (submission, validation, encryption, paper generation, evaluation, anchor) writes an immutable `AuditLog` row (append-only — no update/delete path is exposed by any service). Batches of it are hash-anchored on 0G Chain (`AuditLogRegistry`), so tampering with the audit trail itself would be detectable, not just tampering with the underlying data.

## 6. Public, independent verification

`POST /verify` (no auth) never trusts this project's own database as a source of truth for any of its six checks — it re-derives each one from the actual encrypted blob, the actual chain anchor, or the actual contract read:

| Check | Re-derived from |
|---|---|
| `identityMatch` | `applicationId` + DOB against `StudentProfile`, without distinguishing "no such id" from "DOB wrong" (anti-enumeration) |
| `storageProofValid` | A real Merkle-proof-verified download from 0G Storage |
| `submissionHashMatch` / `answerHashMatch` | Recomputed sha256 of the decrypted answers vs. the DB row and vs. the on-chain anchor's `dataHash` |
| `resultHashMatch` | Recomputed from the same score-component formula the Evaluation Engine used |
| `onChainCommitmentValid` | A live read of `SubmissionRegistry.anchors(sessionId)` — no signer needed, public by design |
| `chainTxValid` | `provider.getTransactionReceipt` against 0G Chain directly, not the local `ChainAnchor` mirror table |

`overallVerified` is the AND of all six. It stayed honestly `false` for this project's entire history until 2026-07-28 (knowledge_base.md §11q) — the system reporting less than it could prove, rather than more.

## 7. Access control

JWT-based sessions, role-gated at the router level (`requireAuth`/`requireRole`, `apps/api/src/middleware/auth.middleware.ts`). Five roles: `TEACHER`, `ADMIN`, `CENTER`, `STUDENT`, `OBSERVER`. `OBSERVER` (added 2026-07-28) is deliberately routed through its own file (`routes/observer.routes.ts`) rather than folded into Admin's routes, specifically so a third-party auditor account can never be one line away from a mutating endpoint — every handler registered there is a GET, and `auth.middleware.test.ts` covers the 403 boundary directly.

## 8. Known gaps (disclosed, not hidden)

- `RESULT_KEY_SALT` is server-held — a citizen can recompute their result-hash lookup key only via this project's own `/verify` endpoint, not fully independently with just their applicationId+DOB and a block explorer (documented tradeoff, `apps/api/src/config/env.ts`).
- No rate limiting is implemented yet on `/auth/login` or the public `/verify` endpoint — see docs/THREAT_MODEL.md.
- bcryptjs (pure-JS, not the native `bcrypt` binding) blocks Node's single event loop thread during hashing/comparison; the concurrency load test (`scripts/load-test.mjs`) measured a ~19x login-latency increase under 20 concurrent logins as a direct, real consequence — see docs/THREAT_MODEL.md.
- No automated dependency/vulnerability scanning is wired into CI yet (there is no CI pipeline defined in this repo at all — see docs/DEPLOYMENT.md).
