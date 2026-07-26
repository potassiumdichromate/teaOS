# NVEI — Knowledge Base

**National Verifiable Examination Infrastructure.** Central memory for this project. Update this file after every completed module — never let it go stale.

Last updated: 2026-07-26 (Phase 1 — architecture)

---

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

## 12. Pending Tasks

As of 2026-07-26, every module in the user's requested priority order is done: Miden diagnosis, Blueprint Generator + Paper Generation, Examination Center + Student Exam Client, Evaluation Engine + AIR Ranking, Student Verification, NTA Admin Overview, explainer site. `apps/api` has been run live against real Postgres/Redis (§11j) and is confirmed correct up to the point where real 0G credentials are required. What's left:

### Credentials needed from the user — nothing guessed, nothing mocked in their place

1. **0G Compute API key** (`ZG_COMPUTE_API_KEY` in `apps/api/.env`) — create at [pc.0g.ai](https://pc.0g.ai) → Dashboard → API Keys, with `inference` permission. Unblocks: Teacher question AI validation (the very next step after everything already verified live in §11j).
2. **0G Chain deployer/service private key** (`ZG_SERVICE_PRIVATE_KEY`) — an EVM private key for a wallet funded with testnet 0G (Galileo, chain ID 16602) or mainnet 0G (Aristotle, chain ID 16661) depending on which network to target. Needed to: (a) deploy the 5 registry contracts (`npm run contracts:deploy:testnet`, see `docs/SMART_CONTRACTS.md`), and (b) sign the resulting `QuestionRegistry`/`PaperRegistry`/etc. anchor transactions and 0G Storage uploads at runtime (the same key covers both, per `docs/0G_INTEGRATION.md`).
3. **The 5 deployed contract addresses**, which fall out of step 2 once the deployer key is supplied and the deploy script is run — go into `QUESTION_REGISTRY_ADDRESS` etc. in `apps/api/.env`.
4. **Testnet or mainnet?** — testnet (Galileo) costs nothing and is the natural default for iterating; mainnet (Aristotle) is real and live but costs real 0G for gas. Whichever is chosen, `ZG_NETWORK`/`ZG_RPC_URL`/`ZG_CHAIN_ID`/indexer/router URLs in `apps/api/.env` need to match (testnet values are already the current default).
5. **Miden testnet funding** (separate from the above, for `contracts/miden/bridge`) — resolving the asset requirement (item below) needs either a self-issued faucet or funding the bridge's service account from Miden's own public testnet faucet; not blocking API credentials, but needed to unblock the Miden side.

Nothing above has a workaround or a mock standing in for it — every one of these is a real credential/action only the user can provide, exactly as they asked.

- [x] Miden asset gap: self-issued faucet, actor-thread Send fix, genesis bootstrap, and account persistence across restarts — all real, all implemented, see §11n. `create_paper_key_timelock` now actually submits a real transaction instead of only constructing the `Note` locally.
- [ ] **Blocked on Miden's own infrastructure, not on us** (see §11n item 4): the live public Miden RPC (`rpc.testnet.miden.io`, and intermittently `rpc.devnet.miden.io` too) is currently rejecting `miden-client` 0.16.0-alpha.1 — the newest version that exists — on the very first call. Needs a decision: (a) wait and retry periodically (this could resolve itself once Miden finishes rolling out node upgrades — devnet DID succeed once, suggesting the rollout is in progress); (b) ask in Miden's Discord/GitHub whether testnet is expected to support 0.16.0-alpha.1 yet; (c) something else the user prefers. Not fixable by writing more of our own code — confirmed via direct, repeated live testing against both networks.
- [ ] Once network access is unblocked: re-run Paper Generation to reach a real `READY` state with a real `midenNoteId`, then re-run Student Exam Client / Evaluation Engine / Student Verification against that real paper end-to-end.
- [ ] Look into the two `ERROR`-severity `UntrustedMastForest` log lines that appear (non-fatal) during every account provisioning — not yet investigated, low priority.
- [ ] Two modules from the original 12 were never given dedicated screens (their underlying data is real and already exposed via API, just not built out as standalone UI/routes the way the brief specified): **Confidential Compute Dashboard** (`GET /compute/queue`, `/compute/attestations/:reportId`, `/compute/audit-log` still stub; `GET /compute/privacy-models` is real) and **0G Storage Explorer** (`GET /storage/objects`, `/storage/objects/:root/proof` still stub, though the underlying data — `Question.storageRoot`, Merkle-verified downloads — is real and already used elsewhere).
- [ ] **Schema cleanup**: `Center` and `ExamSchedule` Prisma models (from the original Phase 1 design) are never populated by any service — `CenterProfile` and `Paper.examStartAt/examWindowCloseAt` turned out sufficient for everything actually built. Either wire them in for a real purpose or remove them.
- [ ] Remaining documentation set: `docs/SECURITY.md`, `docs/THREAT_MODEL.md`, `docs/DEPLOYMENT.md`, `docs/MAINNET_DEPLOYMENT.md`, `docs/AUDIT_LOGS.md`, `docs/PROJECT_ROADMAP.md`, root `README.md`.
- [ ] Frontend bundle isn't code-split (~925kB on the landing route, ~772kB on admin) — real follow-up, not a blocker for a prototype.

## 13. Daily Progress Log

- **2026-07-26**: Phase 1 (architecture) and Phase 2 (scaffolding) both completed and reviewed. Docs read, mainnet/TEE reality-check resolved with user. Phase 1 deliverables: knowledge base, system architecture, DB schema, API contracts, smart contract design, Miden/0G integration docs. Phase 2: full monorepo scaffold across web/api/shared/evm-contracts/miden-bridge, with the Auth + Teacher Portal + Question pipeline module built for real (not stubbed) end-to-end, and every dependency/build verified (npm install, prisma generate, tsc typecheck ×3, vite build, hardhat compile, cargo check all green). Next: Phase 4 continues module-by-module; Miden client wiring is the next concrete piece of real integration work.
