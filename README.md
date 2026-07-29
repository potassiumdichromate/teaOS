# teaOS

**Trusted Evaluation Architecture.** The infrastructure layer for verifiable, tamper-resistant digital assessments — built by HorizonX Labs, prepared as a YC submission. The codebase started as a government-facing prototype (National Verifiable Examination Infrastructure, NVEI — the technical origin of this repo, still visible in package names and some docs) and has since been reframed for a broader B2B audience: governments, universities, enterprises, certification providers, and hiring platforms.

Read [`knowledge_base.md`](knowledge_base.md) first. It is the single source of truth for what's actually built, what's real vs. engineered-on-top, and what's still open — updated after every completed module, not left to drift from the code.

## What this is

Every stage of an assessment's lifecycle — question authoring, paper assembly, delivery, evaluation, ranking, result publication — is cryptographically verifiable and tamper-evident, while question content stays confidential until exam time. This is a working system built on real, currently-available infrastructure (0G mainnet, drand mainnet), not a slide deck: real questions have been validated by a real hardware-attested AI model, encrypted and stored on real decentralized storage, time-locked behind a real cryptographic beacon, decrypted and scored for a real exam session, and independently re-verified end to end. Transaction hashes for all of this are in `knowledge_base.md` and independently checkable on `chainscan.0g.ai`.

## What's real vs. engineered

See `knowledge_base.md` §3 for the full table. In short:

| Piece | Backing |
|---|---|
| Question/paper/answer confidentiality | AES-256-GCM, application layer, before anything reaches storage |
| Decentralized storage | 0G Storage (mainnet), Merkle-proof-verified on every download |
| AI validation (duplicate/grammar/bias/difficulty/Bloom) | 0G Compute, `private` trust mode — real TEE (Intel TDX) attestation |
| Paper-key timelock ("nobody can read this before exam start") | Real drand/tlock against drand mainnet's quicknet beacon |
| Double-submission prevention | `SubmissionRegistry`'s own on-chain `require(blockTimestamp==0)` write-once guard, plus a Postgres unique constraint |
| Public, independently re-derivable verification | `POST /verify` — recomputes every hash from source and re-checks it against 0G Chain directly, never trusts its own DB mirror |
| Every important hash (question bank root, paper, answer key, result) | Anchored on 0G Chain mainnet, publicly checkable |

Miden was the original choice for the timelock and submission-commitment primitives; it's retired from the live path (knowledge_base.md §11o-§11q) because its testnet RPC never became reliably compatible with any published client during this project's window. The Rust bridge (`contracts/miden/bridge/`) stays in the repo, dormant, as real completed work — not deleted.

## Repo layout

```
nta/
├── knowledge_base.md    ← read this first
├── docs/                ← architecture, database, API, security, deployment, contracts
├── prisma/schema.prisma ← single schema source of truth
├── apps/
│   ├── web/              React/Vite — public explainer site + Teacher/Admin/Center/Student/Observer portals
│   └── api/               Express/TS — REST API, BullMQ workers, 0G Storage/Compute/Chain + drand/tlock clients
├── contracts/
│   ├── evm/               Solidity registries (Hardhat), deployed to 0G Chain
│   └── miden/              Dormant Miden bridge (kept, not deleted — see above)
├── packages/shared/       Shared TS types/zod schemas used by web + api
└── pitch/                 The investor one-pager (its own build step, see docs/DEPLOYMENT.md)
```

## Getting started (local development)

Requirements: Node 22+, Docker (for local Postgres/Redis), a funded 0G Chain wallet if you want to exercise anything past the demo credentials.

```bash
npm install
docker compose -f docker-compose.dev.yml up -d
npm run prisma:migrate
npx prisma db seed
npm run dev:api    # apps/api on :4000
npm run dev:web    # apps/web on :5173
```

Copy `apps/api/.env.example` to `apps/api/.env` and fill in real credentials — this project has a standing no-mocks rule (see `knowledge_base.md` §12): a missing credential produces an honest, fail-fast error, never a fake success. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full credential list and [`docs/MAINNET_DEPLOYMENT.md`](docs/MAINNET_DEPLOYMENT.md) for going live.

Demo accounts (seeded, `dev-password-only`): `teacher@example.dev`, `admin@example.dev`, `center@example.dev`, `student@example.dev`, `observer@example.dev`.

## Testing

```bash
npm test   # apps/api — real Postgres (a separate nvei_test database), external networks (0G/drand) mocked by default
```

See [`docs/SECURITY.md`](docs/SECURITY.md) for what's covered and what isn't, and `apps/api/scripts/load-test.mjs` for the concurrency check.

## Docs index

- [`docs/SYSTEM_ARCHITECTURE.md`](docs/SYSTEM_ARCHITECTURE.md) — component map, sequence diagrams
- [`docs/DATABASE.md`](docs/DATABASE.md) — schema design rationale
- [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md) — full endpoint contract
- [`docs/SMART_CONTRACTS.md`](docs/SMART_CONTRACTS.md) — the five 0G Chain registries
- [`docs/0G_INTEGRATION.md`](docs/0G_INTEGRATION.md) / [`docs/MIDEN_INTEGRATION.md`](docs/MIDEN_INTEGRATION.md) — per-technology detail
- [`docs/SECURITY.md`](docs/SECURITY.md) / [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md) — security posture and threat model
- [`docs/AUDIT_LOGS.md`](docs/AUDIT_LOGS.md) — what gets logged and why
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) / [`docs/MAINNET_DEPLOYMENT.md`](docs/MAINNET_DEPLOYMENT.md) — running this for real
- [`docs/PROJECT_ROADMAP.md`](docs/PROJECT_ROADMAP.md) — what's done, what's next
