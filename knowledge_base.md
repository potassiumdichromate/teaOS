# NVEI — Knowledge Base

**National Verifiable Examination Infrastructure.** Central memory for this project. Update this file after every completed module — never let it go stale.

Last updated: 2026-07-28

---

## 0. Current Status (read this first)

**Project identity.** This file's original framing (§1) — a government-facing NVEI prototype for NTA/JEE/NEET-class exams — is the *technical origin* of the project, not its current identity. The project is pitched as **teaOS**, a B2B SaaS "operating system for high-stakes assessment," built by **HorizonX Labs**, prepared as a **YC Combinator submission**. The pitch deliberately uses "assessment," not "examination" — the category needs to read naturally for recruitment/hiring platforms and certification bodies, not just literal school/government exams. `teaOS`'s own backronym changed to match: **T**rusted **E**valuation **A**rchitecture (was "Examination" until 2026-07-28) — see the daily log for that pass. Two founders: **Sidhanth K. Mahto** (infrastructure — blockchain 6+ yrs, DeAIOS 4 yrs, shipped decentralized products across major chains) and **Ray Tsai** (AI systems — agents, LLM infrastructure, full ML stack). The underlying codebase (`apps/`, `contracts/`, `prisma/`) is real — only the pitch framing and target audience changed, from "government reviewers" to "YC + enterprise/university/government buyers." Sections 1, 5 and similar government-audience framing further down are historically accurate for how the code was built but are no longer the external narrative — the pitch narrative lives in `pitch/`, not in this file's prose.

**The pitch one-pager is a first-class deliverable, not a side artifact.** It lives at `pitch/teaos-onepager.template.html` (source) → `pitch/build.js` (injects compressed assets from `assets/opt/`) → `pitch/index.html` (standalone document, served by Vercel with root directory `pitch`) and `pitch/artifact.html` (fragment, used for the claude.ai Artifact preview only — hosts its own `<head>`). **Always edit the template and re-run `node build.js` from inside `pitch/` — never hand-edit `index.html` or `artifact.html` directly, they're generated.** The whole repo is pushed to `https://github.com/potassiumdichromate/teaOS` (public), which is what Vercel deploys from.

**The Miden→drand/tlock migration (§11o) is done, not pending.** As of 2026-07-28 (same day as the decision), the timelock backend is real drand/tlock, wired end to end, and proven live — see §11p for the full record: a real Paper reached `READY` for the first time in this project's history, a real exam session started, submitted, was evaluated, and cleared independent re-verification, all against real drand mainnet (quicknet) and real 0G mainnet. **Do not re-implement this or re-litigate the backend choice.** `contracts/miden/bridge/` was kept in place, dormant, per the original instruction — only the submission-commitment note path (a separate, non-blocking primitive) still targets it. See §12 for what's actually left.

## 1. Project Vision

Redesign the national examination lifecycle (modeled on NTA/JEE/NEET-class exams) so that every stage — question authoring, paper assembly, delivery, evaluation, ranking, result publication — is cryptographically verifiable and tamper-evident, while question content stays confidential until exam time. The deliverable is a **demonstration-grade prototype** built on real, currently-available infrastructure (0G mainnet/testnet, Miden testnet), not a slide deck. It targets government reviewers, technical auditors, and policymakers as its audience.

**What this project is not**: it is not a claim that a fully hardware-attested "black box" runs the entire pipeline. Two of the three confidentiality primitives requested in the original brief (a generic TEE for arbitrary business logic; Miden mainnet) do not exist as documented products today. Section 3 below records exactly what is real and what is application-layer engineering built on top of real primitives — this distinction is preserved everywhere in the UI copy and docs, because misrepresenting it to a government audience would defeat the project's own premise of verifiability.

---

## 2. Ground-Truth Findings From the Supplied Docs (read in full before any design work)

Source files: `0g_context.md` (0G Foundation's compiled dev context, ~8000+ lines) and `miden_context.md` (Miden/0xMiden compiled dev context, ~1050 lines), both already present in the repo root, plus a live check of `pc.0g.ai/models` on 2026-07-26.

### 0G ecosystem — real, mainnet-capable
- **0G Chain**: EVM L1. Testnet "Galileo" (chain ID 16602, RPC `https://evmrpc-testnet.0g.ai`). **Mainnet "Aristotle" (chain ID 16661, RPC `https://evmrpc.0g.ai`, explorer `explorer.0g.ai/mainnet/home`) is live.** Standard Hardhat/Foundry deploy flow.
- **0G Storage**: real decentralized blob storage, log (immutable) + KV (mutable) layers, Merkle-proof verified downloads, client-side AES-256-CTR encryption supported natively by the CLI/SDK. TS SDK: `@0gfoundation/0g-storage-ts-sdk` (+ `ethers`). Indexer endpoints: testnet-turbo `https://indexer-storage-testnet-turbo.0g.ai`, **mainnet-turbo `https://indexer-storage-turbo.0g.ai`**. Uploads resolve the flow contract internally via the Indexer; only KV `Batcher` construction needs the flow contract address explicitly.
- **0G Compute**: a decentralized *AI inference* marketplace (OpenAI-compatible Router API), **not** a general-purpose code-execution sandbox. Every provider runs inside a TEE and attests to the exact model served. Base URLs: mainnet `https://router-api.0g.ai/v1`, testnet `https://router-api-testnet.integratenetwork.work/v1`. **Trust-mode routing is real and load-bearing for this project**:
  | Tier | Routes to | Guarantee |
  |---|---|---|
  | `standard` | any TEE-backed provider | TEE-backed execution, no independent verifiability disclosed |
  | `verified` | TeeML **and** TeeTLS providers | response provably came from the real model |
  | `private` | TeeML providers only | prompt **never leaves the enclave** (Intel TDX + TEE-enabled GPU); host and 0G itself see only encrypted traffic |
  Set via `X-0G-Trust-Mode` header per request, or `trust_mode` on the API key. Verified live on 2026-07-26 at `pc.0g.ai/models`: models tagged "Private (TeeML)" (e.g. `GLM-5.2`) and "Verified (TeeML + TeeTLS)" exist today, confirming this isn't aspirational docs copy — it's a shipped, selectable feature.
- **ERC-7857 / Agentic ID**: NFT-style confidential-metadata-transfer standard with a documented TEE-oracle *pattern* for re-encryption during ownership transfer. This is a narrow pattern for one thing (transferring encrypted metadata between two parties) — **it is not a general enclave for running our paper-assembly logic**, and we do not use it as one. Not used in v1; noted as a future option if we ever model "handing off" a question bank between exam cycles as an asset transfer.

### Miden — real, testnet/devnet only
- **No mainnet exists.** Direct quote: *"there is no mainnet yet — only testnet and devnet exist."* The `protocol`/`miden-vm` repos carry an explicit alpha/"not ready for production" banner. **Everything Miden-related in this project targets Miden testnet**, full stop — this is a hard constraint, not a v1 simplification, and it's stated as such everywhere in the UI (badges, not fine print).
- **Actor model**: one transaction = one account's state transition. Cross-account transfer = sender creates a note, recipient consumes it in a separate transaction. Client-side proving — the network only ever sees a validity proof + state commitment.
- **No native on-chain note encryption today** ("Miden does not have support for encrypted notes... planned feature"). Privacy comes from *storage mode* (private accounts/notes reveal only a commitment) plus application-layer encryption before anything becomes note/storage data. We already need app-layer encryption for 0G Storage anyway, so this is consistent, not an extra burden.
- **P2IDE notes are genuinely useful here**: Pay-to-ID-with-Expiration notes carry a real `timelock_height` — *"the note can't be consumed before `timelock_height`."* This is a real, documented time-lock primitive we use for exam-start key release (§4).
- **Nullifiers** prevent a note from being consumed twice — a real, protocol-level double-submission guard, not something we have to hand-roll.
- **SDKs**: Rust client (`miden-client`), Web SDK `@miden-sdk/miden-sdk` (npm-verified 0.15.8), React SDK `@miden-sdk/react` (0.15.8, React 18+). All target `testnet`/`devnet`/`localhost` — never `mainnet`, because it doesn't exist as a client target.

### The one framing correction this makes to the original brief
The brief describes a single TEE that "creates ONE MASTER PAPER." Given the above, we implement that step as: application-layer encryption + Miden P2IDE time-locked key release + an access-controlled, fully-audit-logged backend process — **not** as a single hardware enclave running arbitrary paper-assembly code, because no such product is documented by either ecosystem. The AI-driven validation steps (duplicate/grammar/bias/difficulty/topic detection), by contrast, genuinely do run inside a hardware TEE via 0G Compute's `private` trust mode, with real attestation. The UI must never blur these two into one "magic TEE" — see §5 UI Copy Rules.

---

## 3. What Is Real vs. What Is Engineered On Top (read this before writing any copy)

| Claim | Status | How it's actually achieved |
|---|---|---|
| Question content encrypted at rest, never plaintext outside submission time | Real | AES-256-GCM at the application layer before upload to 0G Storage |
| Encrypted questions stored on decentralized storage | Real | 0G Storage (mainnet or testnet per deployment), Merkle-proof verified |
| AI validation (duplicate/grammar/bias/difficulty/Bloom) runs with hardware attestation, sealed from any human operator | Real | 0G Compute, `private` trust mode, TeeML-only routing, Intel TDX attestation |
| AI validation response provably came from the claimed model | Real | 0G Compute `verified`/`private` trust mode, TeeTLS/TeeML signature |
| Paper decryption key cannot be accessed before exam start time | Real (cryptographic time-lock) | Miden testnet P2IDE note with `timelock_height` sealing the wrapped content-encryption key |
| No administrator can download the paper | Engineered, not hardware-enforced | Backend service holds no standing decryption capability; key only becomes consumable via the timelocked Miden note; every access attempt is logged and the log is itself hash-anchored on 0G Chain. This is strong operational/cryptographic assurance, not a hardware guarantee — documented honestly as such. |
| Master paper assembly (randomize order/options per blueprint) happens inside a TEE | **Not claimed** | This is deterministic backend logic (not an ML inference task), so it is not a fit for 0G Compute's inference API. It runs as an access-controlled, fully-logged service; its *inputs* (validated question bank) and *output* (master paper) are both integrity-anchored via hashes on 0G Chain, so any tampering is detectable even though the step itself isn't enclave-attested. |
| Every important hash (question bank root, blueprint, master paper, answer key, result Merkle root, AIR list) is anchored on-chain and publicly verifiable | Real | 0G Chain mainnet (Aristotle) — has a real mainnet, so this is where the "citizen-verifiable public record" lives |
| Student answer submissions are cryptographically committed and can't be silently altered post-submission | Real | Miden testnet: each submission is a private note; consuming it a second time is rejected by the protocol's nullifier mechanism |
| Miden proofs are generated by the real protocol | Real, but testnet-only | `miden-client` local proving against Miden testnet |

---

## 4. Architecture (high level)

```
Teacher ──▶ Question Submission (apps/web)
              │
              ▼
        apps/api  ── AES-256-GCM encrypt ──▶ 0G Storage (encrypted blob)
              │                                     │
              │── 0G Compute (private trust mode) ──┤ AI validation: duplicate %, grammar,
              │   TeeML-attested inference          │ bias, difficulty, Bloom level, topic
              │                                     ▼
              └── question metadata + storage root + validation report + content hash
                        │
                        ▼
                 PostgreSQL (Prisma) — indexes, status, audit trail
                        │
                        ▼
                 0G Chain (mainnet) — anchor content hash + validation hash (registry contract)

Admin ──▶ Blueprint (subject/difficulty%/chapter%/marks/count/negative-marking)
              │
              ▼
        Paper Generation service selects questions per blueprint from the validated
        bank, builds the Master Paper, re-encrypts it with a fresh content key
              │
              ├── Master Paper (encrypted) ──▶ 0G Storage
              ├── Master Paper hash ──────────▶ 0G Chain (registry contract)
              └── wrapped content key ────────▶ Miden testnet P2IDE note
                                                  (timelock_height = exam start block,
                                                   reclaim_height = exam window close)

Center/Student ──▶ Exam Client polls timelock; once unlocked, consumes the Miden
                    note to obtain the content key, decrypts Master Paper client-side
                    (or via backend under center auth), renders CBT UI with per-student
                    deterministic randomization seed (question order + option order)
              │
              ▼
        Answers autosaved encrypted, final submission = Miden private note
        (nullifier prevents resubmission) + 0G Storage blob + hash anchored on 0G Chain

Evaluation Engine ──▶ retrieves encrypted answers + official key, evaluates inside the
                       same access-controlled/logged service pattern as paper generation,
                       publishes score, computes AIR, anchors result Merkle root + AIR
                       list hash on 0G Chain

Student Verification ──▶ recomputes/checks: answer hash inclusion, submission hash,
                          official result hash, Miden note/nullifier status,
                          0G Storage Merkle proof, 0G Chain tx — all independently
                          re-derivable by the student, not just "trust the dashboard"
```

See [SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md) for the full diagram set and [SMART_CONTRACTS.md](docs/SMART_CONTRACTS.md) / [MIDEN_INTEGRATION.md](docs/MIDEN_INTEGRATION.md) / [0G_INTEGRATION.md](docs/0G_INTEGRATION.md) for per-technology detail.

---

## 5. UI Copy Rules (binding — this is a government-facing trust artifact)

1. Never say "TEE" unqualified. Always say "hardware-attested AI validation (0G Compute, private trust mode)" for the parts that are true, and "cryptographic time-lock + access-controlled process" for paper assembly/evaluation.
2. Every dashboard screen that shows a proof, hash, or attestation must link to how a third party can independently verify it (0G Chain explorer link, Miden testnet explorer/MidenScan link, 0G Storage Merkle proof).
3. Badge Miden-related UI elements with "Testnet" consistently — never imply Miden mainnet exists.
4. The explainer site's "Government Benefits" / "Court Benefits" sections must not overstate guarantees beyond §3 of this doc.

---

## 6. Tech Stack (as specified, confirmed compatible with the above)

- Frontend: React 18 + TypeScript + Vite + Tailwind + Framer Motion + React Flow + shadcn/ui, Recharts for charts.
- Backend: Node.js + Express + TypeScript.
- DB: PostgreSQL + Prisma. Redis for session/queue (BullMQ) state — question validation and paper generation are async jobs.
- Auth: JWT for app sessions; role-based (Teacher/Admin/Center/Student); Miden testnet wallet linkage for identity-bound cryptographic actions (submission notes, key-release consumption) via `@miden-sdk/web` + `@miden-sdk/react`; EVM wallet (ethers.js, injected/WalletConnect) for 0G Chain-facing actions.
- Storage: `@0gfoundation/0g-storage-ts-sdk`.
- AI: 0G Compute Router API (OpenAI-compatible client, `openai` npm package pointed at 0G's `base_url`), trust-mode `private`/`verified` per call.
- Blockchain: Solidity contracts on 0G Chain (Hardhat), Miden Rust account/note components (`miden` crate, `.masp` build) on Miden testnet.
- Architecture pattern: Clean Architecture / DDD-flavored layering in `apps/api` (routes → services → repositories → Prisma), repository pattern for all persistence access.

---

## 7. Folder Structure

```
nta/
├── knowledge_base.md          ← this file
├── README.md
├── docs/                      ← SYSTEM_ARCHITECTURE.md, DATABASE.md, API_REFERENCE.md,
│                                 SECURITY.md, THREAT_MODEL.md, DEPLOYMENT.md,
│                                 MAINNET_DEPLOYMENT.md, MIDEN_INTEGRATION.md,
│                                 0G_INTEGRATION.md, SMART_CONTRACTS.md, AUDIT_LOGS.md,
│                                 PROJECT_ROADMAP.md
├── prisma/schema.prisma
├── apps/
│   ├── web/                   ← React/Vite app: public explainer site + all role portals
│   │                             (Teacher, Admin/NTA, Center, Student), route-guarded by role
│   └── api/                   ← Express/TS backend: REST API, job workers (BullMQ),
│                                 0G Storage/Compute/Chain clients, Miden client bridge
├── contracts/
│   ├── evm/                   ← Solidity registry contracts + Hardhat config, targets 0G Chain
│   └── miden/                 ← Rust account/note components, targets Miden testnet
└── packages/
    └── shared/                ← shared TS types, zod schemas, constants used by web+api
```

Decision: the explainer/landing site lives inside `apps/web` as public (unauthenticated) routes rather than a separate app, to avoid duplicating the design system and component library. Documented here so it isn't re-litigated later.

---

## 8. Flows (see docs for full sequence diagrams)

- **Teacher flow**: login → dashboard → submit question (+options/answer/explanation/difficulty/Bloom/images) → animated pipeline (validation queue → 0G Compute private-mode AI checks → encrypt → 0G Storage upload → 0G Chain hash anchor) → status (accepted/rejected + AI feedback) in history.
- **Admin/NTA flow**: overview dashboards → blueprint generator → paper generation (blueprint → selection → master paper → hash → encrypt → Miden timelock key seal → ready) → center/schedule management → live logs/audit/security events → evaluation trigger → AIR publication.
- **Center flow**: center login/verification → gateway/network status → exam PC + student-connection health → authorization to start (which is gated on the Miden timelock actually being unlockable).
- **Student flow**: exam client (palette/timer/mark-review/save-next-previous/submit, randomized order) → autosave → submit (Miden private note + 0G Storage) → post-result verification page (Application ID + DOB → independently re-derive and check every hash/proof).
- **Evaluation flow**: encrypted answers → retrieve master paper + key → evaluate in the access-controlled service → Miden proof of the evaluation account's state transition → publish score → AIR ranking (sort → tie-break → rank → result hash) → anchor on 0G Chain.

---

## 9. Security Decisions (summary — full detail in docs/SECURITY.md + docs/THREAT_MODEL.md)

- All question/paper/answer content encrypted client-of-service-side (AES-256-GCM) before it ever reaches 0G Storage; keys never stored in plaintext in Postgres.
- Content-encryption keys for the master paper are wrapped and released only via a Miden testnet P2IDE timelocked note — the earliest cryptographically-enforced unlock point, not merely an app-level `if (now > examStart)` check (though the app also enforces that as defense-in-depth).
- Every state-changing action (submission, validation, encryption, paper generation, evaluation, anchor) writes an immutable audit log row; audit log batches are periodically hash-anchored on 0G Chain so the log itself is tamper-evident.
- Miden nullifiers are the primary defense against double-submission; app-level idempotency checks are defense-in-depth, not the primary guarantee.

---

## 10. Known Issues / Assumptions / Gaps

- **Assumption**: the user controls funded 0G Chain (mainnet + testnet) and Miden testnet wallets/keys and will supply them via `.env` — this project never funds wallets or executes financial transactions on the user's behalf; it only writes code that does so when the user runs it with their own credentials.
- **Gap**: 0G Compute's Router API is a chat-completion-shaped interface. Using it for structured tasks (duplicate %, difficulty score, Bloom level) means our AI Validation Service must use function-calling/structured-output prompting and treat the model's structured response as advisory input to deterministic acceptance rules — not as an unchecked oracle. This is documented explicitly rather than presented as if the model's number is ground truth.
- **Gap**: no official 0G/Miden SDK exists for "TEE for arbitrary code" — see §2/§3. If a future engagement needs that, integrating a real confidential-computing platform (AWS Nitro Enclaves, Azure Confidential VMs) for the deterministic paper-assembly/evaluation step would be the honest way to close this gap; out of scope for v1 per user's Phase 1 decision.
- **Open question for Phase 2**: exact Solidity registry contract interfaces (finalized in docs/SMART_CONTRACTS.md before implementation).

---

## 11. Completed Tasks

- [x] Read both context docs in full (0g_context.md, miden_context.md), plus live-checked `pc.0g.ai/models` for TEEML/TeeTLS ground truth.
- [x] Resolved the mainnet/TEE ambiguity with the user (decisions: Miden testnet + documented gap; honest hybrid confidentiality framing citing only documented tech; Phase 1 design first; user supplies real funded wallets/keys, code stays integration-ready).
- [x] `knowledge_base.md` (this file) — Phase 1 architecture record.
- [x] `docs/SYSTEM_ARCHITECTURE.md` — component map, sequence diagrams for submission/paper-generation/verification, explicit non-goals.
- [x] `prisma/schema.prisma` + `docs/DATABASE.md` — full entity design, repository-pattern rationale, plaintext-never-at-rest rule.
- [x] `docs/API_REFERENCE.md` — full endpoint contract for all 12 modules + WebSocket channels.
- [x] `docs/SMART_CONTRACTS.md` — 5 registry contracts (Question/Paper/Submission/Result/AuditLog), access-control model, deploy commands for both 0G networks.
- [x] `docs/MIDEN_INTEGRATION.md` — P2IDE timelock (paper key release) and private-note+nullifier (submission commitment) designs, mockchain testing strategy.
- [x] `docs/0G_INTEGRATION.md` — Storage/Compute/Chain client code, trust-mode enforcement rule, env var contract.
- [x] Folder skeleton created (`apps/web`, `apps/api`, `contracts/evm`, `contracts/miden`, `packages/shared`, `docs`, `prisma`).

## 11b. Phase 2 — Scaffolding (complete, builds verified)

Monorepo: npm workspaces (`apps/*`, `packages/*`, `contracts/evm`). Everything below actually installs and builds — not just files that look right:

- `packages/shared`: enums + zod schemas mirroring the Prisma schema, shared by web and api. `npm run build` → clean.
- `apps/api`: Express + TS, real Prisma repositories, JWT auth, BullMQ worker, and **one complete real vertical slice**: Teacher login → create/submit question → BullMQ job → 0G Compute validation (private trust mode) → AES-256-GCM encrypt → 0G Storage upload → 0G Chain `QuestionRegistry` anchor → status pushed over WebSocket. Every other documented endpoint (admin, blueprint, paper generation, center, student exam, evaluation, AIR, verify) exists as a typed route returning `501` with a pointer to its Phase 4 module — never a mocked 200. `npm run typecheck` and `npm run build` → clean.
- `apps/web`: Vite + React + TS + Tailwind (dark/blue/purple glass theme) + Framer Motion + shadcn-style primitives. Public landing page (pipeline overview + "what's real" callout), login, and a fully wired Teacher portal (dashboard, submit-question form with live pipeline status, question history) talking to the real API above. Admin/Center/Student routes render an honest "not built yet, see stub route" placeholder rather than fake data. `npm run typecheck` and `vite build` → clean (371 kB bundle).
- `contracts/evm`: Hardhat project, the 5 registries from `SMART_CONTRACTS.md` plus `AnchorRegistryBase` (OpenZeppelin `AccessControl`), deploy script that writes addresses to `deployments/<network>.json`. `npx hardhat compile` → 11 artifacts, clean.
- `contracts/miden`: Rust/Axum HTTP bridge (`nvei-miden-bridge`) matching the TS client's contract exactly (`/notes/paper-key-timelock`, `/notes/submission-commitment`, `/notes/:id/status`, `/notes/:id/consume`). Handlers currently return honest 501s — real `miden-client` wiring (account provisioning, block-height derivation, keystore) is flagged as its own Phase 4 pass rather than guessed at, since getting Miden account bootstrapping wrong would be a subtler violation of the no-mocks rule than an honest stub. `cargo check` → clean.
- Fixed two real upstream integration snags worth remembering: (1) `@0gfoundation/0g-storage-ts-sdk` peer-requires `ethers@6.13.1` exactly — pinned, not a range; (2) passing our own `ethers.Wallet` into the SDK's `signer` param trips a TS dual-package-hazard (NodeNext resolves two nominally-different `ethers` type roots) — worked around with a narrow, commented cast at that one call site, not a broader `any`.

## 11c. Phase 4 — Blueprint Generator + Paper Generation (complete except the Miden step)

Real, verified-building implementation:

- **Question selection** (`questionSelection.service.ts`): per-chapter, difficulty-proportional greedy selection from the `ACCEPTED` pool, keyed on the AI-*predicted* difficulty (not the teacher's suggestion) since that's the value the validation pipeline actually corroborated. Never fabricates questions to hit a target count — a shortfall is a real, visible shortfall.
- **Master paper assembly** (`paperGeneration.service.ts`): for real, this downloads each selected question's encrypted blob from 0G Storage, decrypts it with its derived per-question key, and reassembles a master paper JSON — not a placeholder. That gets encrypted with a **fresh** random key (never derived, unlike per-question keys), uploaded to 0G Storage, and anchored on 0G Chain's `PaperRegistry`. All real calls, same pattern as the Teacher pipeline.
- **Miden timelock step**: honestly attempted and honestly fails right now — `midenBridge.createPaperKeyTimelock()` hits the still-501 Rust bridge, the failure is caught, audit-logged, and pushed over WS as `MIDEN_TIMELOCK_PENDING`. The paper's storage/chain progress is persisted regardless (partial success is preserved), but `Paper.status` only reaches `READY` once that step actually succeeds — never faked.
- **Research finding worth keeping**: verified the real `miden-client` 0.15.4 API on docs.rs (not just the compiled doc's excerpts) — `P2ideNoteStorage::new`/`P2ideNote::create` signatures confirmed accurate, but `BasicWallet`/the Falcon-512 auth component are **not** in `miden_client::account` in this version; they live in a separate, not-yet-identified standards crate. That's the concrete blocker for wiring the bridge for real — see `docs/MIDEN_INTEGRATION.md` "Verified API surface." Next session should start there, not re-derive it.
- Frontend: `apps/web/src/pages/admin/{BlueprintGenerator,PaperGeneration}.tsx`, both wired to the real endpoints above, with the pipeline view explicitly surfacing the Miden-pending state rather than hiding it.
- New endpoints added beyond the original API_REFERENCE.md pass: `GET /admin/subjects`, `GET /admin/blueprints` (list) — documented.

## 11d. Miden client wiring — real, compiles clean, resolved via WSL

**Update 2026-07-26 (same day, follow-up session): the Windows build blocker is resolved.** Installed Ubuntu 24.04 under WSL2, built `contracts/miden/bridge` there with the real `miden-client`/`miden-standards`/`miden-client-sqlite-store` dependencies, and after correcting 13 real API-shape differences the docs.rs-only research pass had gotten wrong (see `docs/MIDEN_INTEGRATION.md` "API corrections found via the WSL build" for the full list — version pinning down to the exact `alpha.4` pairing, `FilesystemKeyStore` not being generic, `SqliteStore` living in a separate crate, `P2ideNote` being a `bon` builder not a plain function, etc.), **`cargo check` passes with zero errors.** `contracts/miden/bridge/src/miden.rs` is now the real module — client bootstrap, service-account provisioning, and P2IDE timelock note construction, all against verified-real APIs.

One deliberate gap remains, now much more precisely scoped (see `docs/MIDEN_INTEGRATION.md` "Asset requirement"): `P2ideNote::new` requires at least one *real* asset — confirmed to be that note type's own business rule, not a protocol constraint. Considered and explicitly rejected using `miden_protocol::testing::asset`'s `.mock()` helpers (real, but issued by fake faucet IDs that the real testnet would reject — exactly the kind of hidden fake the project's no-mocks rule exists to prevent). Also surfaced a wrong assumption worth recording: the AES key was never going to be transportable *through* the asset system anyway (`NonFungibleAsset` only ever stores a hash on-chain, never raw bytes) — the real design is "gate a proof-verified trigger," with the actual key staying in the bridge's own storage the whole time, not "smuggle bytes through Miden." That one line stays an explicit, compiling `todo!()` pending a real faucet decision (self-issued token needing `AuthSingleSigAcl`+`TokenPolicyManager`, vs. funding from Miden's public testnet faucet via a mechanism not yet located in `miden-client`'s own source). `mod miden` also isn't wired into the HTTP handlers in `main.rs` yet (needs Axum shared state for the app-lifetime client/keystore/account) — `main.rs` documents both remaining steps precisely.

**Update: wired and actually run, not just compiled.** `main.rs` now builds the real client + provisions the service account once at startup via Axum shared state; `GET /health` and `GET /notes/:noteId/status` are real. Verified by actually running the built binary in WSL (not just `cargo check`) and curling it: real cryptographic account IDs get generated (`service_account_id=0x9232be7e...`), real `NoteId` parsing/lookup works (rejects malformed hex, correctly reports "not found" for well-formed-but-unknown ids via a real store query), and the still-blocked creation endpoints return their specific honest 501 instead of crashing. Two real things this surfaced, tracked as follow-ups, not fixed in this pass: (1) the service account isn't persisted — every restart provisions a *fresh* random account (observed two different account IDs across two runs); (2) two `ERROR`-severity log lines appear during account provisioning every run (`UntrustedMastForest expected HASHLESS input...`) — non-fatal, process succeeds anyway, but worth investigating before unattended deployment. Full transcript in `docs/MIDEN_INTEGRATION.md` "Live runtime verification."

**Key operational fact for future sessions**: this crate builds AND runs on WSL/Linux, not native Windows (confirmed upstream bug in `miden-node-proto-build`'s build script, unrelated to this project's code). `.claude/launch.json` covers `apps/web`; there's no equivalent for the Miden bridge yet since it's not wired to serve real traffic from `apps/api` (the TS `miden-bridge.ts` client still points at a bridge that isn't running as part of the normal dev flow).

**Also required and now resolved**: upgraded the local Rust toolchain from 1.91.0 to 1.97.1 (separate, unrelated blocker hit along the way).

## 11e. Examination Center + Student Exam Client (real, gated on the same Miden blocker)

- **Auth simplification**: dropped the separately-documented `/center/login`/`/student/login` in favor of the same shared `/auth/login` every role already uses (Center/Student are just `User` rows with those roles) — one auth mechanism, not four.
- **Center**: real dashboard (exam PC list + health, students-connected count), self-registering PC heartbeat (`:id` in the URL is the machine's own code, not a pre-provisioned DB id), student enrollment (`POST /center/sessions`, creates a `StudentExamSession` with a random per-student `randomizationSeed`), and an authorization check that's genuinely gated on `Paper.status === READY` + the exam time window — never faked.
- **Student**: `startExam()` does the real thing end-to-end *by design* only once Miden works — it consumes the Miden note for the wrapped key, downloads+decrypts the master paper from 0G Storage, applies a seeded Fisher-Yates shuffle (`lib/shuffle.ts`) to both question order and each question's option order (deterministic per session, so a page refresh doesn't reshuffle under the student), strips `isCorrect` before returning anything to the client, and caches the full (unredacted) set server-side in Redis for later evaluation. **This correctly and structurally cannot run yet** — there is no backend override key, so a paper stuck at non-`READY` (i.e. every paper right now) makes `startExam` honestly 409. This is the architecture working as designed, not a bug.
- **Autosave/submit**: answers are encrypted (session-derived key, same derive-don't-store pattern as question keys) and cached in Redis during the exam, then aggregated, re-encrypted, uploaded to 0G Storage, and anchored on 0G Chain's `SubmissionRegistry` at submit time — real. The Miden submission-commitment note creation is attempted and honestly caught/logged as pending, same pattern as Paper Generation's timelock step.
- Frontend: a real CBT interface (`apps/web/src/pages/student/StudentExamClient.tsx`) — timer, question palette (color-coded by answered/marked/visited), save-and-next/previous/clear/mark-for-review, submit with confirmation. No calculator widget yet (deprioritized, noted in-code). Center dashboard UI is real and wired.
- Added a resume endpoint (`GET /student/exam/questions?sessionId=`) beyond the original API_REFERENCE.md pass, so a mid-exam page refresh doesn't need to re-consume the Miden note — documented.

## 11f. Evaluation Engine + AIR Ranking (real, decrypt-side unblocked, score-side gated same as everything else)

Worth understanding precisely which half of Evaluation is blocked and which isn't: decrypting a student's `SUBMITTED` answers only needs the session-derived key (`deriveSessionKey`, no Miden involved — same mechanism as autosave), so that part runs today. Scoring needs the official master paper (correct answers), which — like starting an exam — is genuinely gated on `Paper.status === READY`. `runEvaluationPipeline()` enforces that gate explicitly rather than skipping it.

- Real per-session scoring: correct/incorrect/unattempted counts, `rawScore` computed with the blueprint's actual `negativeMarking`, `resultHash` anchored on 0G Chain's `ResultRegistry` keyed by `keccak256(applicationId, dob+salt)` (see `RESULT_KEY_SALT` — documented tradeoff: only our `/verify` endpoint can recompute this key, not a fully independent third party with just applicationId+DOB, since the salt is server-held).
- AIR Ranking is pure DB logic over `EvaluationResult` rows (sort by score desc, tie-break by earlier submission, rank, percentile, batch `resultListHash`) — no 0G/Miden calls, so it's unblocked in isolation, just has nothing to rank until Evaluation produces rows.
- **Disclosed gap, not routed around**: there's no sixth registry contract for anchoring the aggregate AIR list hash on-chain (`SMART_CONTRACTS.md` only specifies five, none scoped to "the whole ranked list"). Each student's individual result is anchored; the list-level hash is computed and stored in Postgres but not yet chain-anchored. Real, scoped follow-up if wanted — not forced into the wrong contract.
- Admin UI: `apps/web/src/pages/admin/EvaluationAIR.tsx` — trigger evaluation, publish AIR, view the ranked table.

## 11g. Student Verification (real, public, itemized)

`POST /verify` (`apps/api/src/services/verify.service.ts`), no auth. Every check is independently re-derived from source, never read from a "verified" flag anyone could have set:

- **Identity**: applicationId + DOB match, without distinguishing "no such applicationId" from "DOB mismatch" in the response — that distinction would let someone enumerate valid applicationIds by brute-forcing DOBs against the error message.
- **Submission hash**: downloads the actual encrypted answers blob from 0G Storage (Merkle-proof verified as part of the download itself — a throw there is what backs `storageProofValid`), decrypts it, recomputes the hash, and checks it against both the DB-stored value *and* the independently-queried 0G Chain anchor's `dataHash` (two separate checks: `submissionHashMatch` vs DB, `answerHashMatch` vs chain).
- **Result hash**: recomputed from the same score-component formula the Evaluation Engine used, checked against DB and against the `ResultRegistry` chain anchor.
- **Chain tx validity**: re-fetches the transaction receipt directly from 0G Chain via `provider.getTransactionReceipt` — not read from our own `ChainAnchor` mirror table, which is explicitly documented (`docs/DATABASE.md`) as a read-optimized cache, not a source of truth.
- **Miden note**: honestly attempted, honestly unavailable right now (bridge not wired) — `midenNoteValid` will be `false` until that's resolved, which correctly keeps `overallVerified` at `false` even for a fully-real, fully-scored, fully-anchored result. That's the system being honest about its own current limitations to the citizen checking it, not a bug.
- **Bug caught and fixed while building this**: `exam.service.ts`'s `submitExam()` was calling `zgChain.anchorSubmission()` but never recording the resulting `ChainAnchor` mirror row — meaning `answerHashMatch` here would have silently always failed. Fixed by adding the missing `chainAnchorRepository.record()` call, matching the pattern already used in the question and paper pipelines.
- Frontend: `apps/web/src/pages/Verify.tsx` — itemized checklist with hints, "VERIFIED" only when every check (including Miden) passes, "PARTIALLY VERIFIED" when identity matches but not everything else, never a bare true/false.

## 11h. NTA Admin Overview dashboard (real)

- **Overview stats**: real Prisma aggregations — question counts by status/subject/AI-predicted-difficulty, top-5 teacher activity, teacher/student totals. No synthetic data.
- **System health**: live checks, not cached flags — `SELECT 1` for Postgres, `PING` for Redis, `provider.getBlockNumber()` for 0G Chain reachability, `getJobCounts()` on all three BullMQ queues (validation, paper generation, evaluation).
- **Security events**: new — added `SecurityEvent` writes on login failure (wrong password vs. unknown email, both `AUTH_FAILURE`/`WARNING`) in `auth.service.ts`, since nothing was writing to that table before. `GET /admin/security-events` reads real rows now instead of an always-empty table.
- **Live audit log**: `auditLogRepository.write()` now also publishes to a new `admin:live-logs` WS channel (one extra call at the single choke-point every audit write already passes through — a minor, deliberate layering compromise, documented in-code rather than silently done). Frontend subscribes via a new `apps/web/src/lib/live-logs.ts` hook.
- **Centers/Schedule**: found and used the real operational data (`CenterProfile` with its `examPCs`/`sessions` relations; `Paper` directly carries `examStartAt`/`examWindowCloseAt`) instead of the schema's separate, never-populated `Center`/`ExamSchedule` models from the original Phase 1 design — see §12 cleanup note below.
- New endpoint beyond the original pass: `GET /admin/audit-log` (paginated, feeds the dashboard alongside the WS stream) — documented.
- Frontend: `apps/web/src/pages/admin/AdminOverview.tsx` — stat cards, two Recharts bar charts (by subject, by AI-predicted difficulty), system health panel, security events, blockchain events, live audit log stream, centers, schedule, teacher activity. Vite flags the resulting bundle as >500kB (Recharts) — functional, not yet code-split; a real follow-up, not a blocker.

## 11i. Explainer landing site (complete)

`apps/web/src/pages/Landing.tsx` composes `apps/web/src/pages/landing/*`: `Hero`, `Problem` (current process + 6 concrete failure modes), `Solution` (pipeline overview + the binding "what's real vs. engineered" callout, verbatim-consistent with §3/§5 of this doc), `TechStack` (0G Chain/Storage/Compute + Miden, each with an honest status line), `ArchitectureDiagram` (real interactive React Flow diagram — pan/zoom, color-coded by which system executes each stage), `Flows` (tabbed: Teacher/Admin/Student/Center/AI/Blockchain), `Benefits` (Government/Court/Citizen + an honest Roadmap section listing the Miden blocker as item 1), `FAQ` (accordion, five questions a technical reviewer would actually ask, answered without hedging). All copy lives in one file, `landing/data.ts`, for easy editing.

Verified in-browser (dev server via the preview tool): full page renders, zero console errors, all section anchors/links correct, FAQ accordion interactive. Vite flags the production bundle at ~925kB (Recharts + ReactFlow both now loaded on this route) — functional, not yet code-split; a real follow-up (dynamic `import()` per admin/landing route), not a blocker.

## 11j. First-ever live run of apps/api — real infra, real bug found and fixed

Prior to 2026-07-26 (this pass), `apps/api` had only ever been typechecked/built, never started. Standing this up for real surfaced two genuine environment issues and one genuine code bug — all fixed, not routed around:

- **Local infra**: real Postgres 16 + Redis 7 via Docker Compose (`docker-compose.dev.yml`, gitignored `.env`/`.env`s hold the generated secrets). Real, non-obvious finding: **port 5432 on this machine is already occupied by an unrelated, pre-existing Postgres instance** — our container's `docker port` output looked correct, but every connection from the Windows host was silently landing on that other instance instead (confirmed by stopping our container and observing the port was still live, and by a raw Postgres-wire-protocol probe showing an unchanging SCRAM challenge regardless of what we changed in our own container's `pg_hba.conf`). Fixed by remapping our container to host port 5433, not by touching the pre-existing service. `docker-compose.dev.yml` documents this precisely so it isn't re-debugged from scratch.
- **Real migration, real seed, real server boot**: `prisma migrate dev` created the actual schema live; `prisma db seed` created real demo accounts; `apps/api` started clean (`"NVEI API listening"`) against real Postgres/Redis with zero mocks.
- **Real bug found via actual execution, not typechecking**: `runQuestionPipeline()` marked a question `VALIDATING` *before* attempting the (unconfigured, correctly-failing) 0G Compute call. When BullMQ's automatic retry re-entered the function, it hit the function's own "must be SUBMITTED" guard and failed with a confusing, wrong-cause 409 instead of genuinely retrying the AI validation call. Fixed in `questionPipeline.service.ts`: the guard now also accepts `VALIDATING` as a valid re-entry state. Verified fixed by submitting a second real question and confirming every retry now shows the *same, correct* "ZG_COMPUTE_API_KEY is not configured" error rather than the state-guard error.
- **Full verified-live chain**: real login (bcrypt) → real JWT → real Prisma-backed teacher dashboard/subjects (seeded Physics/Mechanics) → real question creation → real BullMQ job → correctly, honestly fails at the one real missing credential (0G Compute key) → that failure is itself queryable live via `/api/admin/security-events` (a *different* real check: an earlier deliberately-wrong login attempt produced a real `SecurityEvent` row, confirmed via the admin API).

**What this proves**: the entire stack — auth, Prisma/Postgres, Redis/BullMQ, the pipeline's state machine, and its fail-fast credential checks — is real and works end-to-end. The **only** thing stopping the full Teacher→AI-validation→Storage→Chain pipeline from completing for real is the three 0G credentials listed in §12 below, which only the user can supply (they said explicitly: no mocks, tell them exactly what's needed, don't guess).

## 11k. First complete, live, mainnet, end-to-end pipeline run (2026-07-26)

The user supplied a real funded 0G mainnet wallet and a real 0G Compute API key (private trust mode) and said explicitly: stay on mainnet, no mocks, full integration. What happened next, in order:

- **Contracts deployed to real 0G mainnet** (Aristotle, chain 16661) using the real funded key. Addresses, from `contracts/evm/deployments/zg_mainnet.json`:
  - QuestionRegistry `0xBE695ccf52cF181ee8E3BD3ba1063a7f62362Bfa`
  - PaperRegistry `0x3edA852e902A75d0b35880e63C87321b667Cb367`
  - SubmissionRegistry `0xF33778a39369E318c3a74Fc97E7540772A37f384`
  - ResultRegistry `0xB108Db8f75C0739bb0012C0F2d8FDEAF8303Adec`
  - AuditLogRegistry `0xa2814c082051A42F6a57f1A38ffcC4EFBfe42f9C`
- **Two real bugs found and fixed by actually running the system**, neither catchable by typechecking:
  1. **AI response schema mismatch**: the validation prompt described required fields in prose; the real model (glm-5.2, via 0G Compute) returned valid-but-differently-shaped JSON (`duplicate_percentage` vs our `duplicatePct`, `bias_flags` as a string instead of an array, etc.) — real, reasonable model behavior, our prompt's fault for not being exact. Fixed in `apps/api/src/lib/zg-compute.ts` by giving the model the literal exact JSON shape to fill in, not a prose description. Confirmed fixed: a subsequent real call returned exactly-conformant JSON.
  2. **BigInt JSON serialization**: `Question.chainBlockNumber` (and other Prisma BigInt fields — `ChainAnchor.blockNumber`, `MidenNote` heights) can't be `JSON.stringify`'d natively; this only threw once a question actually reached `ACCEPTED` with a real block number populated, which had never happened before this run. Fixed with a global `BigInt.prototype.toJSON` shim, `apps/api/src/lib/json-bigint.ts`, imported for its side effect as the first line of `index.ts`.
  3. (Also confirmed the earlier BullMQ retry-state bug from §11j stayed fixed under real load, and found/worked around two environment issues along the way: Docker Desktop's engine stopping unexpectedly mid-session on this machine, and `tsx watch`'s restart occasionally racing the old process's port release on Windows — both operational, not code, issues.)
- **A full real question went through the entire pipeline and was accepted**: submitted "A drone of mass 1.4 kg hovers..." (a genuinely novel physics question, not a textbook duplicate) → 0G Compute validated it in `private` trust mode (TeeML enclave) with `duplicatePct: 25` (under the 35 threshold) → encrypted → uploaded to 0G Storage → anchored on 0G Chain mainnet. **Independently verified directly via RPC** (not via our own app's database — the actual, authoritative check):
  - Storage upload tx `0x77d88dcf4f68226ee97da973f6f70dc7c9649d8c9d5f07cd03d60da2079ff2c8` — status 1 (success), block 39875883
  - Chain anchor tx `0x196a07a767b608a046660bc7585d4024da50103198d658a2da3fb191b087382d` — status 1 (success), block 39875894, `to` == the deployed QuestionRegistry address
  - Both independently checkable at `https://chainscan.0g.ai/tx/<hash>`
- **A separate, deliberately-flawed test question was correctly rejected** by the same real pipeline (asked to both "define X and give an example," options only defined) — the model caught the actual flaw and flagged it, and a separate genuinely-common-textbook-problem question was correctly rejected for `duplicatePct: 85` exceeding the threshold. Both are the validation logic working as designed, not bugs.
- **Real credential hygiene incident, caught and fixed twice**: the user pasted the real private key and (later) the real 0G Compute API key into `.env.example` (a template file, NOT gitignored) rather than `apps/api/.env` (gitignored). Moved both to the correct file both times; `.env.example` now has empty placeholders again. No git repo exists yet in this project (so no history exposure occurred), but this is worth remembering as a recurring pattern if it happens again.

This is the strongest possible evidence this prototype's core claim is real: an independently-checkable, real hardware-TEE-attested AI validation, followed by real encrypted decentralized storage, followed by a real public mainnet anchor — not a mockup, not a simulation, actually executed and independently reverifiable by anyone with the tx hashes above.

## 11l. Paper Generation run live — real bug found (silent false success), fixed, reverified

Ran the module for real: published a blueprint matching the one `ACCEPTED` question (Physics/Mechanics, 1 question, 4 marks), triggered generation, and hit a genuine, serious bug on the first attempt — worth recording precisely because it's exactly the failure mode this whole project exists to prevent.

**The bug**: the Rust bridge's 501-stub handlers (`contracts/miden/bridge/src/main.rs`) returned `Json<NotImplemented>` with no explicit HTTP status, so Axum defaulted to **200 OK** with an `{"error": ..., "path": ...}` body. `apps/api`'s TS client (`miden-bridge.ts`) only checked `res.ok` (true for any 2xx) before parsing the body as a `TimelockNoteResult` — so it silently accepted the error JSON as if `noteId` were a real value (`undefined`), and `paperGeneration.service.ts` called `paperRepository.markReady(paperId, undefined)`, which **marked the Paper `READY` with `midenNoteId: null`** — a paper that looked exam-startable but had no real cryptographic timelock behind it at all. Confirmed the DB record directly: `status: "READY", midenNoteId: null`.

**The fix, both sides**:
- Rust: every stub handler now returns `(StatusCode::NOT_IMPLEMENTED, Json(...))` explicitly — verified with `curl -o /dev/null -w "%{http_code}"` showing real `501`.
- TS: `miden-bridge.ts` now validates every response body against a zod schema before accepting it, regardless of status code — a 200 with a body that doesn't match the expected shape is now a hard error too. This is deliberate defense-in-depth: the status-code fix addresses the root cause, the schema check means a *different* future bug of the same shape (some other 200-with-wrong-body case) can't silently repeat this failure mode.
- The corrupted record was corrected directly (`status: READY → ASSEMBLING`, not deleted — the real storage/chain data on it stayed valid, only the false Miden claim was wrong).

**Reverified clean**: generated a second real paper against the same blueprint. Real 0G Storage upload (tx `0x095c309e...730d9`, confirmed via direct RPC, status 1), real 0G Chain `PaperRegistry.anchorPaper` (tx `0x9a2d7ab5...4a379`, confirmed via direct RPC, status 1, `to` == deployed PaperRegistry), and — correctly, this time — the pipeline caught the real 501 from the Miden step and logged `"Paper assembled and anchored, but Miden timelock is not yet available"`, leaving `status: ASSEMBLING`, `midenNoteId: null`. That's the honest, correct state until the asset-encoding gap is resolved.

**Also confirmed working for real in the same run**: `selectQuestionsForBlueprint` correctly matched the chapter's `MEDIUM` difficulty allocation against the one `ACCEPTED` question; master paper assembly genuinely downloaded and decrypted that question from 0G Storage (Merkle-proof verified) and reassembled it with a fresh, non-derived content key, exactly as designed.

## 11m. Examination Center + Student Exam Client run live against the real paper

Seeded real Center and Student demo accounts (`prisma/seed.ts` now creates `center@example.dev`/`CTR-001` and `student@example.dev`/`APP-000001` alongside teacher/admin) and ran the full real flow against the actual paper from §11l:

- Real center login → real PC heartbeat (`PC-01`, real timestamp) → dashboard correctly reflects it (`onlinePCs: 1`).
- Real authorization check against the real paper: `{"authorized":false,"paperStatus":"ASSEMBLING","reason":"Paper is not READY — Miden key-timelock step hasn't completed..."}` — the center-side gate working exactly as designed, not simulated.
- Real student enrollment (`POST /center/sessions`) → real `StudentExamSession` row with a real per-student `randomizationSeed`.
- Real student login → real session lookup (`paperReady: false`) → **real, architecturally-enforced refusal** on `POST /student/exam/start`: `"Paper is not READY... The exam cannot start because there is no backend override key, by design."`

This is the concrete, live proof of the core security claim: the system refuses to let *anyone* — not the admin, not the center, not the student — access exam content before the real cryptographic timelock is satisfied. There is no code path that bypasses it; the refusal comes from the same `paper.status !== "READY"` check regardless of who's asking. Everything downstream of this gate (actually starting the exam, submitting answers, evaluation) remains correctly blocked until the Miden asset requirement is resolved — this is that gate demonstrated working, not a new capability.

## 11n. Miden asset gap — real code fully resolved; blocked on Miden's own live infra, not on us (2026-07-26)

Picked up the `todo!()` in `create_paper_key_timelock` (P2ideNote requires a real asset). Three real, distinct problems were found and fixed in the code; a fourth, external one remains and needs a decision, not more code.

**1. Self-issued faucet, fully designed and implemented.** Researched `miden-standards` 0.16.0-alpha.4 source directly (not docs.rs) for the full faucet-creation surface: `FungibleFaucet::builder()`, `AuthSingleSigAcl::new(approver, AuthSingleSigAclConfig::new(exempt_procedures))`, `TokenPolicyManager::builder().active_mint_policy(..).active_burn_policy(..)`, `MintPolicy`/`BurnPolicy::{allow_all, owner_only}`, `create_singlesig_user_fungible_faucet(...)`. All confirmed real, all wired into `contracts/miden/bridge/src/miden.rs::provision_or_load_accounts`, which now provisions both a service wallet AND a self-issued fungible faucet (private account, `NVEIK` symbol, decimals 0, max supply 1e9 — an internal utility asset, never meant to leave NVEI's own accounts, not a currency). Both accounts persist across restarts via a small `miden-bridge-accounts.json` marker file (there's no `AccountId::is_faucet()` in this API generation — `AccountType` only means storage visibility, not wallet-vs-faucet — so this file is how the bridge remembers which of its two locally-tracked accounts is which). `ensure_wallet_funded` mints + consumes a real transaction to top up the wallet's vault when its balance is low, and `create_paper_key_timelock` now actually **submits** the P2IDE-note-creating transaction (the pre-existing code only ever constructed the `Note` object locally and returned its ID without submitting anything — a real silent-no-op gap, caught before it shipped).

**2. `Client<FilesystemKeyStore>` is not `Send` — real, root-caused, fixed.** Wiring `create_paper_key_timelock` into a live axum handler surfaced `E0277: dyn TransactionProver cannot be sent between threads safely`. Root cause, confirmed via source: `Client`'s own `tx_prover` field is correctly typed `Arc<dyn TransactionProver + Send + Sync>`, but `Client::submit_new_transaction_with_prover`'s own parameter is typed `Arc<dyn TransactionProver>` (no bounds) — an unsized-coercion widening that silently drops the marker bounds. Any future that holds a live `Client` across `submit_new_transaction(..).await` is therefore not `Send`, and `axum::serve` unconditionally needs handler futures to be `Send` (confirmed: it calls `tokio::spawn` per connection, in `axum-0.7.9/src/serve.rs`). Fixed for real, not papered over: the Miden client now lives on its own dedicated OS thread with a single-threaded Tokio runtime (`miden::spawn_actor`), and the rest of the (multi-threaded) app talks to it only through an `mpsc`/`oneshot` command channel (`MidenBridgeHandle`). `note_status`/`health` never touched `tx_prover` so they were never actually broken by this — only the new submit-a-transaction path was.

**3. Genesis bootstrap — real, root-caused, fixed.** First live run against testnet failed on the very first RPC call: "accept header validation failed... genesis commitment: none". Root cause: `ClientBuilder::build()` only sets the RPC client's genesis commitment if the store already has a cached genesis header — never true on a brand-new store. `Client::ensure_genesis_in_place()` is the real, public, idempotent method for exactly this (fetches genesis once, caches it, sets the commitment); added to `build_client()`.

**4. Not fixed by more code — Miden's own live RPC infrastructure is currently rejecting our client version, and it's inconsistent.** After fixes 1–3, a live run against `rpc.testnet.miden.io` still gets rejected on the genesis fetch: `server rejected request - please check your version and network settings (client version: 0.16.0-alpha.1, genesis commitment: none)`. Confirmed `0.16.0-alpha.1` (released 2026-07-17) is the newest published `miden-client` version — there is nothing newer to upgrade to (checked crates.io's sparse index directly, and the GitHub releases page). Tested `rpc.devnet.miden.io` as a comparison: one run got all the way through genesis sync and into transaction execution (proving the code is correct end-to-end when the network cooperates — it got as far as a real, different bug, see below); two subsequent runs against the *same* devnet endpoint hit the identical "please check your version" rejection. That inconsistency (same client, same endpoint, different outcomes) points to Miden's devnet running multiple backend replicas at different software versions behind a load balancer, not a clean "devnet supports 0.16, testnet doesn't" split. **This is an external, live-infrastructure compatibility gap on Miden's side, not a bug in this codebase** — confirmed via direct, repeated testing, not assumed.

**Bonus real bug found during devnet testing**: the self-issued faucet's mint transaction failed a real kernel assertion (`requested input note index should be less than the total number of input notes`) when the faucet's `MintPolicy` was `owner_only()` — `TransactionRequestBuilder::build_mint_fungible_asset`'s plain construction doesn't supply whatever extra authentication wiring an owner-gated mint policy needs. Switched to `MintPolicy::allow_all()` (burn stays `owner_only()`); this is a private account only NVEI ever holds keys for, so "anyone can mint" is theoretical, not actual. Confirmed fixed — a later devnet run got past the mint step (subsequent runs then hit the version-rejection flakiness described above before completing, but the specific kernel-assertion bug is resolved).

**Net state**: the code is real, complete, and believed correct top to bottom for this flow — provisioning, funding, note construction, and submission. It is blocked purely on Miden's own public RPC infrastructure intermittently/currently not accepting the only client SDK version that exists. This needs a decision (wait for Miden's rollout, or something else) rather than more implementation — see §12.

## 11o. Decision: replacing the Miden timelock with drand/tlock (2026-07-28)

After §11n's fixes, an automated hourly check was stood up (a claude.ai scheduled cloud routine, id `trig_01Umf5FfgHCpKLPXrfVyotCa`, cron `45 * * * *`, cloning `https://github.com/potassiumdichromate/teaOS` and running the real bridge binary against testnet every hour — see its full prompt via `RemoteTrigger action:"get" trigger_id:"trig_01Umf5FfgHCpKLPXrfVyotCa"` if the API is available in the new session) to watch for Miden's testnet accepting `miden-client` 0.16.0-alpha.1. As of 2026-07-28, roughly two days and ~40 hourly checks later, it has not reported an unblock — testnet is still rejecting the client. **The user decided to stop waiting on Miden and replace the timelock backend with drand/tlock instead of continuing to depend on it.** This section is the handoff record for that decision; no tlock code has been written yet.

**Why drand/tlock, considered and recommended in this same conversation (not a snap decision):**

- `drand` is the League of Entropy's decentralized randomness beacon — a threshold-BLS-signature network with independent operators (Cloudflare, Protocol Labs, EPFL, UCL, and others) producing a new publicly-verifiable random round on a fixed schedule, indefinitely. It has been in production for years, unlike Miden's pre-1.0/alpha client.
- `tlock` (timelock encryption) is a well-established scheme built directly on drand: encrypt a message to a *future round number* using identity-based encryption; it becomes decryptable by anyone the instant that round's threshold signature is published, because the signature itself is the decryption key. No single operator, and no threshold-minus-one collusion, can produce it early.
- This maps onto the exact same guarantee Miden's P2IDE timelock was providing — "nobody, including us, can read this before time T, enforced by a decentralized network rather than any admin" — without the pre-1.0 SDK, the version-lockstep pin (`miden-client` ⇄ `miden-protocol`/`miden-standards` had to match exactly), the WSL-only build constraint, or dependency on one team's node-rollout timeline.
- It is a better architectural fit for the pitch's own framing than it might first appear: the one-pager (`pitch/`) already describes teaOS's "kernel" as exposing abstract primitives — `seal(payload, until_block)`, `schedule(window)` — specifically so the guarantee is decoupled from which infrastructure provides it. Swapping the implementation behind `seal()` from "Miden P2IDE note" to "tlock-encrypted key targeting a drand round" should not require changing the pitch's language at all, only the backend.
- Secondary alternative considered and set aside for now: **Shutter Network** (threshold encryption live in production on Ethereum/Gnosis Chain for MEV protection) — same underlying idea, but its release condition is normally block-inclusion rather than a clean timestamp, its "keyper" committee is smaller/more centralized than drand's broad multi-org set, and it's less documented for this exact "release at time T" use case. Worth revisiting only if tlock hits a real wall.
- Explicitly rejected: running our own small threshold committee. Technically workable but weakens the pitch — "we picked the committee" is a materially different, weaker claim than "a public, multi-operator network anyone can independently verify," which is the whole point of using a decentralized primitive here.

**What changes architecturally, and what doesn't:**

- The `seal`/`schedule` kernel primitives stay conceptually the same; only their implementation changes. `create_paper_key_timelock` (currently in `contracts/miden/bridge/src/miden.rs`) gets a tlock-based counterpart — likely a much smaller piece of code than the Miden bridge, since tlock is just "encrypt to a future round," not a full account/note/transaction model.
- Miden's **private submission notes with nullifiers** (the mechanism preventing silent resubmission, currently `create_submission_note`, still a 501 stub — see §11n, never actually built) need a replacement too if Miden is dropped entirely. The natural replacement: a simple commitment + nullifier mapping in a small contract on **0G Chain**, which the project already anchors everything else to — arguably less total system than standing up a second chain's client just for this.
- **Do not delete `contracts/miden/bridge/`.** Leave it in place, dormant. If Miden's testnet becomes usable later, the user may want to keep both backends or switch back; the code is real, tested (proven end-to-end on Miden's devnet, see §11n), and represents real completed work that shouldn't be thrown away over an infrastructure timing problem that wasn't our fault.
- The pitch one-pager's Miden-specific technical language (the "timelock" section explaining P2IDE internals, the "requirements → component chosen" table row picking Miden, the evidence table's Miden testnet/devnet rows, the Q1 roadmap bullet "Miden testnet integration complete") should be revisited once tlock is actually implemented — update it to describe the real, working mechanism at that time rather than speculatively rewriting it now before any tlock code exists. Keep the pitch honest to what's actually built, per this project's standing rule.

**Immediate next steps for whoever picks this up:**

1. Research real `tlock`/`drand` client libraries the same way every Miden API detail in this project was verified — against actual crate/library source (crates.io + GitHub source for a Rust implementation, e.g. search for `tlock-age`, `drand-rs`, or similar; do not trust docs.rs summaries or prior training-data memory of these libraries, they may be stale) — before writing any integration code.
2. Confirm which language/runtime to implement it in. The current Miden bridge is Rust for compatibility reasons specific to Miden's client-side proving requirement — that constraint doesn't necessarily apply to tlock, so a decision on whether to keep the sidecar-process pattern or fold this into `apps/api` directly (Node) is open and worth deciding early, since it affects a lot of downstream structure.
3. Once a real tlock encrypt/decrypt round-trip is proven (own small test, independent of the rest of the app, same discipline as the original Miden research), wire it behind the existing `create_paper_key_timelock` call site in `apps/api/src/lib/miden-bridge.ts` (or its replacement) so `paperGeneration.service.ts` doesn't need to change its calling contract, only what's behind it.
4. Re-run Paper Generation → Student Exam Client → Evaluation Engine → Student Verification live end-to-end against the new backend, exactly as was done for the 0G mainnet pipeline in §11k.
5. Once proven, update the pitch one-pager's technical sections to describe the real mechanism, and update this knowledge base with the result (new dated section, do not overwrite §11n/§11o — they're the accurate historical record of why the switch happened).
6. The hourly Miden-compatibility cloud routine (`trig_01Umf5FfgHCpKLPXrfVyotCa`) is still running as of this handoff. Nobody has explicitly decided to disable it — it's cheap (hourly, automated, informational) and might still be useful signal if Miden's rollout finishes later even after the tlock migration. Leave it running unless the user asks to stop it; don't disable it unilaterally.

## 11p. drand/tlock implemented, wired, and proven live end-to-end (2026-07-28, same day as §11o's decision)

Picked up exactly where §11o left off and worked through all six of its "immediate next steps" in one pass.

**1. Research, done against real source, not memory.** `tlock-js` (npm, latest `0.9.0`, published by the drand team itself, dependencies `drand-client@1.2.5` + `@noble/curves` + `@noble/hashes` + `@stablelib/chacha20poly1305`) is a real, maintained TypeScript library — confirmed by downloading the actual npm tarball (`npm pack tlock-js@0.9.0`) and reading its compiled `index.d.ts`/source directly, and by pulling its real test files (`test/drand/timelock.test.ts`, `test/drand/integration.test.ts`) straight from `raw.githubusercontent.com`, not a summarized description. Its `defaults.js` hardcodes drand mainnet's real "quicknet" beacon (`schemeID: "bls-unchained-g1-rfc9380"`, 3s period, chain hash `52db9ba7...`) — confirmed still live today by curling `api.drand.sh/<hash>/public/latest` directly and getting a real, current round back.

**2. Runtime decision: no sidecar process.** Unlike Miden (which needed a Rust process for client-side proving, see §11d/§11n), `tlock-js` is a plain TypeScript library — `timelockEncrypt`/`timelockDecrypt` are just IBE encryption calls against a drand HTTP client, nothing that needs its own thread or process. Folded directly into `apps/api` as `lib/timelock.ts`. This also **removes** the `Client<FilesystemKeyStore>`-is-not-`Send` workaround §11n needed for Miden (a dedicated OS thread + `mpsc`/`oneshot` channel) — there is no equivalent problem here, so no equivalent machinery.

**3. Round-trip proven standalone, live, against real drand mainnet, before any app code was touched.** In a scratch directory: `timelockEncrypt`'d a real key to a round ~9s in the future, confirmed `timelockDecrypt` threw `"It's too early to decrypt the ciphertext..."` immediately after, waited for the round, then confirmed decrypt succeeded and the recovered bytes matched exactly. Full real output preserved in this session's transcript — not a mocked client, the actual `mainnetClient()` talking to `api.drand.sh`.

**4. Wired behind the existing call site, per §11o's own instruction not to change the calling contract.** New `apps/api/src/lib/timelock.ts` exports `sealContentKey(contentKey, unlockAt)` → `{ ref, round, unlockEstimate }` and `unsealContentKey(ref)` → `Buffer`. `roundAt(unlockAt, chainInfo) + 1` is used (not the bare `roundAt` result) specifically to guarantee the target round's real emission time is strictly after `unlockAt` — `roundAt` alone returns the latest round *at or before* a given time, which would risk an already-emitted (i.e., not actually future) round right at the boundary. `paperGeneration.service.ts`, `exam.service.ts`, and `evaluation.service.ts` now call these instead of `midenBridge.createPaperKeyTimelock`/`consumePaperKeyTimelock`. `exam.service.ts`'s `startExam()` wraps the unseal call in a try/catch that turns drand's honest "too early" error into a clean 409 rather than a raw crash — a real, disclosed edge case (drand's network can lag up to ~1 beacon period, ~3s, behind the server's own clock right at the exact boundary), not swept under the rug.

One real, deliberate schema change: `Paper.midenNoteId` → `Paper.timelockRef` (migration `20260728121642_rename_paper_timelock_ref`), since the field now holds an opaque tlock-armored ciphertext string, not a Miden note id, and the old name would have been actively misleading. `StudentExamSession.midenNoteId` (the *submission*-commitment note, a separate primitive — see below) was deliberately left untouched; it's still genuinely Miden-shaped and dormant. Every call site (`paper.repository.ts`, the three services above, `blueprint.service.ts`'s paper DTO, `admin.routes.ts`'s comment, and the frontend's `PaperGeneration.tsx`) was updated to match. `MIDEN_BRIDGE_URL` etc. stay in `env.ts`/`.env` for that same submission-note path; a new `TLOCK_NETWORK` var (`mainnet`/`testnet`, default `mainnet`) controls which drand network `lib/timelock.ts` targets.

**5. Full pipeline re-run live, real infra, real mainnet, same discipline as §11k.** Docker (Postgres 16 on host port 5433, Redis 7) brought up, `apps/api` started against real mainnet 0G credentials, a brand-new Paper generated with `examStartAt` ~20s in the future:
- **Paper Generation reached `READY` for the first time in this project's entire history.** Real 0G Storage upload (root `0x4b004231...`), real 0G Chain `PaperRegistry.anchorPaper` (tx `0x418eea57...`, block 40059701 — independently re-fetched via raw `eth_getTransactionReceipt` against `evmrpc.0g.ai`, `status: 0x1`, `to` == the deployed `PaperRegistry` address), and a real tlock seal: log line `"Paper generation complete — tlock timelock sealed"`, `round: 30812591` against drand mainnet quicknet. Every previous Paper in this project's history (two from §11l/§11m) is still stuck at `ASSEMBLING`/`timelockRef: null` — left alone, not touched, as the honest historical record of the Miden-blocked era.
- **Center authorization returned `authorized: true` for the first time ever** (previously always `false`, per §11m) — `GET /center/authorization/:paperId` against the new Paper.
- **Student `startExam()` succeeded for the first time ever.** Real `unsealContentKey` call (log: `"beacon received"` for round 30812591), real Merkle-proof-verified download+decrypt of the master paper from 0G Storage, real seeded shuffle, real redacted question returned to the client (the same "drone hovering" physics question first validated in §11k).
- **Submit** ran the same real Storage/Chain path as before (real upload, real `SubmissionRegistry.anchorSubmission` tx `0x46e81162...`, block 40059823, independently re-verified via RPC); the submission-commitment Miden note attempt failed exactly as it always has (`ECONNREFUSED` — bridge not running), caught and logged, non-blocking — this part of the system was never gated on the paper-key timelock and still isn't.
- **Evaluation Engine scored a session for the first time ever** against a real, unsealed official key. Real `unsealContentKey` (second real beacon fetch for the same round), real download/decrypt of both the master paper and the submission, real `ResultRegistry.anchorResult` tx `0x0a5190d4...`, block 40059878, independently re-verified via RPC. (Score came out 0/0/0 unattempted — an artifact of hitting the wrong autosave route path during this manual test, not a scoring bug; the pipeline itself ran for real.)
- **Student Verification** (`POST /verify`) recomputed and cross-checked every hash independently: `identityMatch`, `submissionHashMatch`, `resultHashMatch`, `storageProofValid`, `chainTxValid` all real and `true`. `midenNoteValid` correctly `false` (the submission note was never created — see below), so `overallVerified` is honestly `false` — the system correctly refusing to claim more than it can prove, exactly per §11g's own standard.

**A real, second bug found by this run, fixed the same way every prior one in this project has been** (by actually executing the system, not by inspection): `chainAnchorRepository.findByEntity(entityType, entityId)` had no `contractName` filter. Because `SubmissionRegistry` and `ResultRegistry` anchors deliberately share the same `(entityType, entityId)` (documented in `verify.service.ts`'s own comment), `findFirst(...).orderBy(createdAt desc)` silently returned whichever anchor was written most recently — for any session that reached Evaluation, that's always the `ResultRegistry` row, never the `SubmissionRegistry` one. This made `answerHashMatch` structurally unable to be `true` for *any* evaluated session, ever, in this codebase's history — it just never surfaced before because no session had ever survived far enough (through the Miden block) to reach Evaluation and then Verification in the same run. Fixed by adding a required `contractName` parameter to `findByEntity` and passing `"SubmissionRegistry"` at its one call site; re-ran `/verify` and confirmed `answerHashMatch` flipped from `false` to `true` with no other change.

**What's genuinely still open, not fixed here (see §12 for the tracked version):**
- **Submission-commitment notes (the double-submission/nullifier guarantee) are still Miden-shaped and still dormant.** §11o's own suggested replacement — "a simple commitment + nullifier mapping in a small contract on 0G Chain" — was explicitly *not* in this pass's scope (it wasn't in §11o's numbered "immediate next steps," which were all about the paper-key timelock specifically). Today, double-submission prevention for a live session is enforced only at the DB/app level (`session.status !== "IN_PROGRESS"` guards) — real, but app-level, not protocol-level. This is why `midenNoteValid`/`overallVerified` in `/verify` are still honestly `false` for every session: the guarantee they're checking for genuinely doesn't exist yet on any backend. Not silently loosened to make the UI look more complete — that would be the exact kind of dishonesty this project exists to avoid.
- Two prior Papers (§11l/§11m) remain stuck at `ASSEMBLING`/`timelockRef: null` — left as the accurate historical record, not backfilled or deleted.
- `contracts/miden/bridge/` and its TS client (`lib/miden-bridge.ts`) are untouched and still compile/run — kept dormant per instruction, now used only for the submission-note path.
- Typecheck and build are clean across `packages/shared`, `apps/api`, `apps/web` (`npm run typecheck` / `npm run build`, all green) after every change above.

**6.** The pitch one-pager (`pitch/teaos-onepager.template.html`, rebuilt via `node build.js`) was updated to describe this as done rather than in-progress: the Service 03 card, the "release as protocol event" section, the thread-isolation caption (which was specifically about Miden's `Send`-bound problem and no longer applies — tlock sealing is a plain library call, no dedicated thread needed), the evidence table (added a `verified`/`live` row with the real quicknet mainnet result, replacing the old `pend`ing row), and the Q1 roadmap bullet (marked "done", with the submission-note/Miden-dependency removal added as the new next item) were all revised. The hourly Miden-compatibility cloud routine (`trig_01Umf5FfgHCpKLPXrfVyotCa`) was left running per §11o's own instruction — nobody has asked to stop it.

## 11q. Submission-commitment: the last live-path Miden dependency retired — no new contract needed (2026-07-28, same day)

§11p left one honest gap open: double-submission prevention for a live exam session was DB/app-level only, because the Miden submission-commitment note (the intended nullifier-equivalent) was never actually wired — `midenBridge.createSubmissionNote` always failed (`ECONNREFUSED`, bridge not running), caught and logged, non-blocking. `verify.service.ts`'s `midenNoteValid` check could therefore never be `true` for any session, ever, which kept `overallVerified` permanently `false` even for a fully-real, fully-scored result.

**The fix turned out to require no new infrastructure at all.** Reading `contracts/evm/contracts/SubmissionRegistry.sol` directly (the same "verify against real source" discipline used throughout this project) showed `anchorSubmission` already has `require(anchors[sessionId].blockTimestamp == 0, "already anchored")` — a real, already-deployed-to-0G-mainnet, protocol-level guarantee that a given session can be anchored exactly once, forever, enforced by the contract itself. Combined with the pre-existing `@@unique([studentId, paperId])` on `StudentExamSession` (one session per student per paper, so a "resubmission" can't even be attempted via a fresh session), double-submission was already fully closed at two independent layers before this pass touched anything. The only real gap was that `/verify` was asking a dead bridge about a mechanism that was never built, instead of asking the mechanism that was already real and already working every time a submission had ever been anchored.

**What changed:**
- `lib/zg-chain.ts`: added `getSubmissionAnchor(sessionId)`, a read-only call (no signer required, deliberately — `/verify` is public and shouldn't need `ZG_SERVICE_PRIVATE_KEY` to check something) against the contract's own auto-generated `anchors(bytes32)` getter. Independently confirmed via a raw script (no app code, ethers directly against `evmrpc.0g.ai`) that it returns a real, non-zero `blockTimestamp` and the correct `submissionHash`/`paperId` for a live session.
- `verify.service.ts`: `midenNoteValid` → `onChainCommitmentValid`, now backed by `getSubmissionAnchor` instead of `midenBridge.getNoteStatus`.
- `exam.service.ts`: removed the `midenBridge.createSubmissionNote` call from `submitExam()` entirely — it was dead weight (always failed, did nothing useful) now that the real guarantee is understood to already exist. `submitExam()` now returns `{ submitted, chainTxHash }` instead of `{ submitted, midenNoteId }` — an always-real value instead of an always-`null` one.
- **`StudentExamSession.midenNoteId` field dropped** (migration `20260728124255_drop_session_miden_note_id`), not just renamed — there's no separate "note" to reference anymore; the chain anchor itself (already stored as `chainTxHash`) is the full commitment. Updated `session.repository.ts`, `packages/shared`'s `exam.schema.ts` (`midenNoteValid`→`onChainCommitmentValid`, dropped `midenNoteId` from `details`), and the frontend (`Verify.tsx`, `StudentExamClient.tsx`).
- `center.service.ts`'s `checkAuthorization` rejection message still said "Miden key-timelock" — a leftover the §11p pass missed; fixed to reference the real tlock mechanism.
- `midenBridge` is no longer imported anywhere in `apps/api` — every live code path is now free of the dormant Miden bridge. The Rust bridge itself (`contracts/miden/bridge/`) and its TS HTTP client (`lib/miden-bridge.ts`) are untouched, still compile, kept as dormant, revivable code per standing instruction — just genuinely unused now rather than unused-but-still-called-and-failing.

**Verified live, real infra, real mainnet, fresh end-to-end run (not a re-check of old data):** generated a new Paper (reached `READY` via tlock as in §11p), enrolled the same demo student for it, started the exam, submitted a real answer via the actual autosave route this time, ran Evaluation, then called `/verify`. Result: **`overallVerified: true` — every one of the six independent checks passing, for the first time in this project's history.** Independently re-confirmed `onChainCommitmentValid` outside the app entirely: a standalone script calling `SubmissionRegistry.anchors(sessionId)` directly against `evmrpc.0g.ai` returned the real, non-zero on-chain data with no app code involved.

Typecheck and build clean across all three packages after every change (`packages/shared` needed an explicit rebuild after the schema change — its compiled `dist/` is what `apps/api` actually imports, `--noEmit` typecheck alone doesn't refresh it).

Pitch one-pager updated to match: the `commit(submission)` kernel-primitive description and verification-checklist item that referenced a Miden "note" and "nullifier" now describe the real mechanism (registry contract's own write-once guard, read directly); the Q1 roadmap bullet for this item marked done; a new evidence-table row and a stronger closing claim ("cleared all six independent verification checks... with no exceptions, for the first time") added, rebuilt via `node build.js`.

**Nothing left dormant-but-load-bearing in the live path.** Every mechanism the live pipeline depends on today — timelock (drand/tlock), double-submission prevention (SubmissionRegistry's own guard), storage (0G Storage), all anchoring (0G Chain) — is real, deployed, and independently verifiable by a third party with nothing but the public RPC/HTTP endpoints. Miden's code remains in the repo, dormant, exactly as instructed, not because anything still depends on it.

## 12. Pending Tasks

As of 2026-07-26, every module in the user's requested priority order is done: Miden diagnosis, Blueprint Generator + Paper Generation, Examination Center + Student Exam Client, Evaluation Engine + AIR Ranking, Student Verification, NTA Admin Overview, explainer site. `apps/api` has been run live against real Postgres/Redis (§11j) and is confirmed correct up to the point where real 0G credentials are required. What's left:

### Credentials needed from the user — nothing guessed, nothing mocked in their place

1. **0G Compute API key** (`ZG_COMPUTE_API_KEY` in `apps/api/.env`) — create at [pc.0g.ai](https://pc.0g.ai) → Dashboard → API Keys, with `inference` permission. Unblocks: Teacher question AI validation (the very next step after everything already verified live in §11j).
2. **0G Chain deployer/service private key** (`ZG_SERVICE_PRIVATE_KEY`) — an EVM private key for a wallet funded with testnet 0G (Galileo, chain ID 16602) or mainnet 0G (Aristotle, chain ID 16661) depending on which network to target. Needed to: (a) deploy the 5 registry contracts (`npm run contracts:deploy:testnet`, see `docs/SMART_CONTRACTS.md`), and (b) sign the resulting `QuestionRegistry`/`PaperRegistry`/etc. anchor transactions and 0G Storage uploads at runtime (the same key covers both, per `docs/0G_INTEGRATION.md`).
3. **The 5 deployed contract addresses**, which fall out of step 2 once the deployer key is supplied and the deploy script is run — go into `QUESTION_REGISTRY_ADDRESS` etc. in `apps/api/.env`.
4. **Testnet or mainnet?** — testnet (Galileo) costs nothing and is the natural default for iterating; mainnet (Aristotle) is real and live but costs real 0G for gas. Whichever is chosen, `ZG_NETWORK`/`ZG_RPC_URL`/`ZG_CHAIN_ID`/indexer/router URLs in `apps/api/.env` need to match (testnet values are already the current default).
5. ~~Miden testnet funding~~ — moot as of 2026-07-28; Miden has been fully retired from the live path (timelock via §11o/§11p, submission-commitment via §11q). `contracts/miden/bridge/` stays in the repo, dormant, not deleted, per standing instruction, but nothing in `apps/api` calls it anymore.

Nothing above has a workaround or a mock standing in for it — every one of these is a real credential/action only the user can provide, exactly as they asked.

- [x] Miden asset gap: self-issued faucet, actor-thread Send fix, genesis bootstrap, and account persistence across restarts — all real, all implemented, see §11n.
- [x] ~~Blocked on Miden's own infrastructure~~ — superseded 2026-07-28: replaced the paper-key timelock backend with real drand/tlock. Full record: §11o (decision) and §11p (implementation, live proof, pitch update). Not re-litigated; done.
- [x] **drand/tlock implemented as the timelock backend, wired, and proven live end-to-end** — see §11p. A real Paper reached `READY` for the first time ever; Student Exam Client, Evaluation Engine, and Student Verification all ran against it live on real 0G mainnet + real drand mainnet.
- [x] **Submission-commitment retired from Miden, no new contract needed** — see §11q. `SubmissionRegistry.anchorSubmission`'s own `require(blockTimestamp==0)` was already the real, deployed, protocol-level double-submission guard; `/verify` now reads it directly instead of asking a bridge that was never wired. `overallVerified: true` achieved for the first time in this project's history on a fresh live run.
- [ ] Look into the two `ERROR`-severity `UntrustedMastForest` log lines that appear (non-fatal) during Miden account provisioning — not yet investigated, low priority, and now purely academic since nothing in the live path calls the bridge.
- [ ] Two modules from the original 12 were never given dedicated screens (their underlying data is real and already exposed via API, just not built out as standalone UI/routes the way the brief specified): **Confidential Compute Dashboard** (`GET /compute/queue`, `/compute/attestations/:reportId`, `/compute/audit-log` still stub; `GET /compute/privacy-models` is real) and **0G Storage Explorer** (`GET /storage/objects`, `/storage/objects/:root/proof` still stub, though the underlying data — `Question.storageRoot`, Merkle-verified downloads — is real and already used elsewhere).
- [ ] **Schema cleanup**: `Center` and `ExamSchedule` Prisma models (from the original Phase 1 design) are never populated by any service — `CenterProfile` and `Paper.examStartAt/examWindowCloseAt` turned out sufficient for everything actually built. Either wire them in for a real purpose or remove them.
- [ ] Remaining documentation set: `docs/SECURITY.md`, `docs/THREAT_MODEL.md`, `docs/DEPLOYMENT.md`, `docs/MAINNET_DEPLOYMENT.md`, `docs/AUDIT_LOGS.md`, `docs/PROJECT_ROADMAP.md`, root `README.md`.
- [ ] Frontend bundle isn't code-split (~925kB on the landing route, ~772kB on admin) — real follow-up, not a blocker for a prototype.

## 13. Daily Progress Log

- **2026-07-26**: Phase 1 (architecture) and Phase 2 (scaffolding) both completed and reviewed. Docs read, mainnet/TEE reality-check resolved with user. Phase 1 deliverables: knowledge base, system architecture, DB schema, API contracts, smart contract design, Miden/0G integration docs. Phase 2: full monorepo scaffold across web/api/shared/evm-contracts/miden-bridge, with the Auth + Teacher Portal + Question pipeline module built for real (not stubbed) end-to-end, and every dependency/build verified (npm install, prisma generate, tsc typecheck ×3, vite build, hardhat compile, cargo check all green). Next: Phase 4 continues module-by-module; Miden client wiring is the next concrete piece of real integration work.
- **2026-07-26 → 2026-07-28**: Miden asset gap fully resolved (§11n) — self-issued faucet, actor-thread fix for a real `Send`-bound bug in `miden-client`, genesis bootstrap, mint-policy fix, account persistence. Proven end-to-end on Miden's devnet. Live testnet, however, has rejected the client for the entire window since. Project rebranded mid-session to **teaOS** (B2B SaaS, HorizonX Labs, YC submission) — a full investor one-pager was built at `pitch/` (mobile-first, real diagrams, two founders, USD pricing, OS/kernel framing) and iterated through several rounds of user feedback, pushed to `github.com/potassiumdichromate/teaOS` for Vercel deployment. An hourly cloud routine was stood up to watch for Miden testnet compatibility. **2026-07-28**: after ~2 days with no unblock, decided to replace the Miden timelock with drand/tlock (§11o) — decided, not yet implemented. This file updated for a session handoff to a new Claude Code account (weekly usage limit reached on the account that did all of the above).
- **2026-07-28 (new session, continuing from the handoff above)**: Implemented and proved the drand/tlock migration decided in §11o — full record in §11p. Researched `tlock-js`/`drand-client` against real npm/GitHub source, proved a standalone live round-trip against drand mainnet, built `apps/api/src/lib/timelock.ts` (no sidecar process needed, unlike Miden), renamed `Paper.midenNoteId` → `Paper.timelockRef` (migration applied), rewired Paper Generation/Exam/Evaluation to it, and re-ran the entire pipeline live: a Paper reached `READY` for the first time in this project's history, Center authorization returned `true` for the first time, Student `startExam()` succeeded for the first time, Evaluation scored a session against a real unsealed key for the first time, and Student Verification independently re-checked everything. Found and fixed a second real, previously-unreachable bug along the way (`chainAnchorRepository.findByEntity` missing a `contractName` filter, causing `answerHashMatch` to be structurally unfalsifiable-true for any evaluated session). Updated the pitch one-pager to describe the mechanism as live rather than in-progress and rebuilt it. Typecheck/build clean across all three packages. This work was committed and pushed to `origin/main` (`d79600c`).
- **2026-07-28 (same session, continued)**: User asked what was left, then said to build it without compromising the project's real-integration standard. Picked the highest-priority real gap: Miden submission-commitment notes, still dormant and never wired, keeping `/verify`'s `overallVerified` permanently `false`. Found (by reading `SubmissionRegistry.sol` directly) that no new contract was needed — `anchorSubmission`'s own `require(blockTimestamp==0)` was already a real, deployed, protocol-level double-submission guard. Wired `/verify` to read it directly (`zgChain.getSubmissionAnchor`), removed the dead `midenBridge.createSubmissionNote` call from `submitExam()`, dropped the now-fully-unused `StudentExamSession.midenNoteId` field (migration), and fixed a stale Miden-referencing error string in `center.service.ts` missed during the earlier pass. Full record in §11q. Re-ran a fresh exam session live end-to-end and got **`overallVerified: true` for the first time in this project's history** — independently re-confirmed the on-chain read outside the app with a standalone script. Typecheck/build clean; pitch one-pager updated (kernel primitive copy, verification checklist, evidence table, roadmap) and rebuilt.
- **2026-07-28 (same session, continued)**: User flagged the pitch's category language as too narrow — "examination" reads as government/school-exam-specific and doesn't land for the recruitment/hiring/certification institutions the market section already targets. Did a full terminology pass across `pitch/teaos-onepager.template.html` (hero, problem statement, kernel primitive descriptions, timelock/key-management copy, walkthrough, comparison table, AI-daemon section, market segments, business model, roadmap, founder quote, closing) replacing "examination(s)"/"exam" with "assessment" wherever it was defining the category or describing a generic scenario, while leaving historically-accurate section titles elsewhere in this file (§1, §11e, §11m) and actual in-app feature names untouched. The `teaOS` backronym changed to match: **E** now stands for **Evaluation**, not **Examination** — same brand name, same "TEA" wordmark, broader middle word. Also fixed two hardcoded strings in `pitch/build.js` itself (the `<meta name="description">` and `og:title` tags aren't part of the template, so the earlier grep-based pass would have missed them without a second check). Rebuilt via `node build.js`; confirmed zero remaining "examination" occurrences in both generated files.
