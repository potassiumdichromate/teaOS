# API_REFERENCE.md

Base URL: `/api`. Auth: `Authorization: Bearer <JWT>` unless marked public. All bodies/responses are JSON; request bodies are validated with `zod` schemas shared from `packages/shared`.

## Auth

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/auth/login` | public | `{email, password}` → `{token, role}` |
| POST | `/auth/wallet-link` | any | Links `evmAddress` (0G Chain) or `midenAccountId` to the current user |

## Teacher Portal

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/teacher/dashboard` | TEACHER | assigned subjects/chapters, submission stats |
| GET | `/teacher/subjects` | TEACHER | assigned subjects with nested chapters, for the submission form |
| GET | `/teacher/questions` | TEACHER | history, filterable by status |
| GET | `/teacher/questions/:id` | TEACHER | full detail incl. `aiReport`, metadata, timeline |
| POST | `/teacher/questions` | TEACHER | create draft `{subjectId, chapterId, text, options[], correctOptionIndex, explanation, difficultySuggested, bloomLevelSuggested, images[]}` |
| POST | `/teacher/questions/:id/submit` | TEACHER | enqueues the validation → encryption → storage → anchor pipeline job; returns `{jobId}` |
| GET | `/teacher/questions/:id/status` | TEACHER | poll job/pipeline stage (also pushed over WS `question:{id}:status`) |

## AI Validation Service (internal, invoked by the pipeline worker, also readable by Admin)

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/validation/reports/:questionId` | TEACHER (own) / ADMIN | returns stored `AIValidationReport` |
| POST | `/validation/reevaluate/:questionId` | ADMIN | force re-run (e.g. after model catalog changes) |

## Confidential Compute Dashboard (read-only, Admin + Observer)

Real since 2026-07-28 (previously honest 501 stubs — see knowledge_base.md §12).

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/compute/queue` | ADMIN, OBSERVER | live BullMQ validation-queue job counts + the actual `Question` rows currently `VALIDATING` |
| GET | `/compute/attestations/:reportId` | ADMIN, OBSERVER | fetch the stored `AIValidationReport` (model, provider address, trust mode, attestation ref) — 404 if unknown |
| GET | `/compute/audit-log` | ADMIN, OBSERVER | `AuditLog` rows filtered to `action = AI_VALIDATION` |

## 0G Storage Explorer

Real since 2026-07-28 (previously honest 501 stubs — see knowledge_base.md §12).

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/storage/objects` | ADMIN, OBSERVER | real storage roots across `Question`/`Paper`/`StudentExamSession`, newest first, never plaintext |
| GET | `/storage/objects/:root/proof` | ADMIN, OBSERVER | performs an actual Merkle-proof-verified download against the live 0G Storage indexer (`downloadVerified`) — `proofValid: true/false` reflects a real cryptographic check, not a DB flag |

## NTA Admin Dashboard

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/admin/overview` | ADMIN | aggregate stats for charts (submitted/accepted/rejected, by subject/difficulty, teacher activity) |
| GET | `/admin/centers` | ADMIN | center list + health |
| GET | `/admin/schedule` | ADMIN | exam schedule list |
| GET | `/admin/security-events` | ADMIN | paginated `SecurityEvent` |
| GET | `/admin/system-health` | ADMIN | queue depth, DB/Redis/0G RPC connectivity checks |
| GET | `/admin/blockchain-events` | ADMIN | paginated `ChainAnchor` (the `MidenNote` mirror table was dropped 2026-07-28 — never written by any live code path once Miden was retired from the timelock/submission-commitment flows, see knowledge_base.md §11o-§11q) |
| GET | `/admin/audit-log` | ADMIN | paginated `AuditLog`, newest first (added during Admin Overview build — feeds the dashboard's live-log panel alongside the WS stream) |

## Independent Oversight (Observer)

Added 2026-07-28 as a real, strictly read-only third-party auditor/reviewer surface — the government-reviewer/technical-auditor/policymaker audience named in knowledge_base.md §1, given their own account type instead of being folded into Admin. Every route below is a GET, enforced at the router level (`routes/observer.routes.ts`); `ADMIN` can also read these for convenience, but no Observer token can reach any mutating endpoint anywhere in the API (verified: `requireRole` rejects with 403).

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/observer/overview` | ADMIN, OBSERVER | same aggregate as `/admin/overview` |
| GET | `/observer/system-health` | ADMIN, OBSERVER | same live health checks as `/admin/system-health` |
| GET | `/observer/integrity-summary` | ADMIN, OBSERVER | real fleet-wide aggregate: how many Papers/Questions/Sessions/Results actually have an on-chain anchor vs. how many exist in Postgres |
| GET | `/observer/chain-anchors` | ADMIN, OBSERVER | paginated `ChainAnchor` |
| GET | `/observer/security-events` | ADMIN, OBSERVER | paginated `SecurityEvent` |
| GET | `/observer/audit-log` | ADMIN, OBSERVER | paginated `AuditLog` |

## Blueprint Generator

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/admin/subjects` | ADMIN | full subject/chapter catalog, for authoring a blueprint |
| GET | `/admin/blueprints` | ADMIN | list, newest first |
| POST | `/admin/blueprints` | ADMIN | draft `{title, totalMarks, totalQuestions, negativeMarking, subjectAllocations[], chapterAllocations[]}` |
| POST | `/admin/blueprints/:id/publish` | ADMIN | freezes allocations, sets `publishedAt` |
| GET | `/admin/blueprints/:id` | ADMIN | detail |

## Paper Generation

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/admin/papers/generate` | ADMIN | `{blueprintId, examStartAt, examWindowCloseAt}` → enqueues assembly job |
| GET | `/admin/papers/:id/pipeline` | ADMIN | live stage: blueprint → TEE-validated pool → AI selection → master paper → hash → encryption → drand/tlock timelock seal → ready (Miden P2IDE was replaced by drand/tlock 2026-07-28, see knowledge_base.md §11o-§11p) |
| GET | `/admin/papers/:id` | ADMIN | detail (never returns plaintext or the content key) |

## Examination Center

Center authentication is the shared `/auth/login` (a Center is a `User` with role `CENTER`, no separate credential mechanism).

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/center/dashboard` | CENTER | gateway/network status, exam PC health, connected student count |
| POST | `/center/pcs/:id/heartbeat` | CENTER | exam PC health ping; `:id` is the PC's own machine code, self-registers on first call |
| GET | `/center/authorization/:paperId` | CENTER | whether the paper is `READY` and inside its exam window (i.e. exam may start) |
| POST | `/center/sessions` | CENTER | `{applicationId, paperId}` — enrolls a student for a paper, creating their `StudentExamSession` |

## Student Exam Client

Student authentication is the shared `/auth/login` (a Student is a `User` with role `STUDENT`, no separate applicationId-based mechanism — `applicationId` is profile metadata, used by Center enrollment and the public `/verify` endpoint).

| Method | Path | Role | Notes |
|---|---|---|---|
| GET | `/student/exam/session` | STUDENT | current `StudentExamSession` status + whether the paper is decryptable yet (`paperReady`) |
| GET | `/student/exam/questions?sessionId=` | STUDENT | resume: re-derives the redacted question list for an already-IN_PROGRESS session from server-side cache, without re-unsealing the tlock key |
| POST | `/student/exam/start` | STUDENT | `{sessionId}` — unseals the drand/tlock-sealed content key (real, waits on a real drand beacon round), decrypts the paper, returns the per-student randomized, answer-redacted question list. Genuinely refuses (409) until `Paper.status === READY` — there is no backend override key. |
| PUT | `/student/exam/answers` | STUDENT | `{sessionId, questionId, selectedOptionIndex | null, markedForReview}` — encrypted before being cached in Redis for the duration of the exam |
| POST | `/student/exam/submit` | STUDENT | `{sessionId}` — aggregates cached answers, uploads the encrypted blob to 0G Storage, anchors on 0G Chain's `SubmissionRegistry`. Double-submission is prevented by the contract's own `require(blockTimestamp==0)` write-once guard plus `@@unique([studentId, paperId])` in Postgres — not a Miden note (see knowledge_base.md §11q; that plan was retired, no replacement needed). |

## Evaluation Engine

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/admin/evaluation/run` | ADMIN | `{paperId}` → enqueues evaluation job across all `SUBMITTED` sessions for that paper. Genuinely requires `Paper.status === READY` — same drand/tlock timelock gate as starting an exam. |
| GET | `/admin/evaluation/:sessionId/pipeline` | ADMIN | settled `EvaluationResult` if scored; live stages come over WS `evaluation:{sessionId}:status` |

## AIR Ranking

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/admin/air/publish` | ADMIN | `{paperId, tieBreakRule}` → sorts, ranks, hashes, anchors |
| GET | `/admin/air/:paperId` | ADMIN | ranking table |

## Student Verification (public)

| Method | Path | Role | Notes |
|---|---|---|---|
| POST | `/verify` | public | `{applicationId, dob}` → itemized verification result (identity match, answer hash, submission hash, official result hash, on-chain commitment via `SubmissionRegistry.anchors()`, 0G Storage proof, 0G Chain tx) per knowledge_base.md §4 sequence 5. `overallVerified: true` achieved for the first time in this project's history 2026-07-28, see §11q. |

## WebSocket channels

- `question:{id}:status` — pipeline stage updates for a submitted question
- `paper:{id}:status` — pipeline stage updates for paper generation
- `evaluation:{sessionId}:status` — evaluation pipeline updates
- `admin:live-logs` — tail of new `AuditLog`/`SecurityEvent` rows, Admin-only
