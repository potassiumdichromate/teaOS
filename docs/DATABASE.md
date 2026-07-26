# DATABASE.md

Schema source of truth: [`prisma/schema.prisma`](../prisma/schema.prisma). This doc explains the *why*, not the *what* — read the schema file for exact fields.

## Design principles

1. **Postgres never holds plaintext exam content once a `Question` is `ACCEPTED` or a `Paper` is `READY`.** `draftPayload` on `Question` is the only place plaintext content ever sits in the relational DB, and it's cleared on the transition out of `SUBMITTED`. Everything downstream references a 0G Storage `storageRoot` + a `contentHash`/`masterPaperHash` for integrity checking, never the bytes themselves.
2. **Every cryptographic action produces a queryable row**, not just a log line: `ChainAnchor` (generic, one row per on-chain anchor tx across every registry contract) and `MidenNote` (one row per Miden testnet note, whatever its purpose) exist specifically so the "Confidential Compute Dashboard," "0G Storage Explorer," and "NTA Admin → Blockchain Events" screens can be built as simple queries against Postgres rather than live RPC fan-out on every page load. Postgres here is a **read-optimized mirror of on-chain/on-Storage/on-Miden state**, not the source of truth for those facts — the source of truth is always the chain/storage/note itself, which is exactly what the Student Verification flow re-derives independently instead of trusting this mirror.
3. **`AuditLog` is append-only** (no update/delete path exposed by any service) and batches of it get hash-anchored via `ChainAnchor` (`contractName = "AuditLogRegistry"`), so tampering with the audit trail itself is detectable.
4. **Per-student question/option order is a seed, not O(students × questions) rows.** `StudentExamSession.randomizationSeed` deterministically derives both orders client-side (documented PRNG, seeded per session) — this keeps `PaperQuestion` fixed-size (one row per question in the master paper, shared by all students) instead of exploding per student.
5. **Repository pattern**: every model above is accessed through a `apps/api/src/repositories/*.repository.ts` file — services never call `prisma.*` directly. This is what "Clean Architecture / Repository Pattern" in the brief's tech stack means concretely here.

## Entity groups

- **Identity**: `User` (+ role-specific profile tables `TeacherProfile`/`AdminProfile`/`CenterProfile`/`StudentProfile`) — one `User` row per login identity, optionally linked to an `evmAddress` and/or `midenAccountId` for the flows that need a wallet-bound identity (submission notes, key-release consumption).
- **Question bank**: `Subject` → `Chapter` → `Question` (1:1 `AIValidationReport`).
- **Blueprint/paper**: `Blueprint` (+ `BlueprintSubjectAllocation`/`BlueprintChapterAllocation` for the %-based composition rules) → `Paper` (+ `PaperQuestion` join, `ExamSchedule`, `Center`/`ExamPC`).
- **Exam/eval**: `StudentExamSession` → `EvaluationResult` → `AIRRanking`.
- **Cross-cutting**: `AuditLog`, `SecurityEvent`, `ChainAnchor`, `MidenNote`.

## Migrations

Standard Prisma flow: `npx prisma migrate dev --name init` locally, `npx prisma migrate deploy` in CI/CD. Seed script (`prisma/seed.ts`, added in Phase 2 scaffolding) populates Subjects/Chapters and demo accounts for local development only — never seeds fake on-chain anchors or fake Miden notes, since those must come from real testnet/mainnet calls per the project's no-mocks rule.
