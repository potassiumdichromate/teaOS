# AUDIT_LOGS.md

What gets logged, why, who can read it, and how the log itself is protected from tampering.

## What gets written

`AuditLog` (`prisma/schema.prisma`) — one append-only row per state-changing action, written through `apps/api/src/repositories/auditLog.repository.ts`, the single choke-point every caller goes through (no service writes to the table directly). Current `AuditAction` values:

| Action | Written by | Metadata typically includes |
|---|---|---|
| `TEACHER_LOGIN` / `ADMIN_LOGIN` / `CENTER_AUTHENTICATION` / `STUDENT_LOGIN` / `OBSERVER_LOGIN` | `auth.service.ts` login() | email |
| `TEACHER_SUBMISSION` | Teacher question submission | questionId |
| `AI_VALIDATION` | 0G Compute validation step | duplicatePct, model, trustMode |
| `ENCRYPTION` / `STORAGE_UPLOAD` / `CHAIN_ANCHOR` | Question/paper pipeline steps | storageRoot, txHash |
| `BLUEPRINT_PUBLISHED` | Admin blueprint publish | blueprintId |
| `PAPER_GENERATION` | Paper generation pipeline | paperId, stage |
| `ANSWER_SUBMISSION` | Student exam submit | sessionId, chainTxHash |
| `EVALUATION` | Evaluation Engine | sessionId, rawScore, txHash |
| `RANKING_PUBLICATION` | Final ranking publish (was `AIR_PUBLICATION` through 2026-07-29) | paperId, resultListHash |
| `VERIFICATION_CHECK` | Every `/verify` call, including anonymous ones | applicationId, result (never the raw DOB) |

`OBSERVER_LOGIN` was added 2026-07-28 alongside the Observer role itself — see docs/API_REFERENCE.md.

## Why append-only, and why hash-anchored

`AuditLog` has no update/delete path exposed by any service in this codebase — it is write-once by construction, not by convention alone (there is simply no repository method for it). Batches of log rows get hash-anchored on 0G Chain (`AuditLogRegistry` — see docs/SMART_CONTRACTS.md), via `AuditLog.batchAnchorId` pointing at the `ChainAnchor` row for that batch. This means tampering with the audit trail itself — not just the underlying business data — would be detectable: a rewritten log row wouldn't match the hash that was anchored when the batch was originally sealed.

## Who can read it

| Reader | Endpoint | Scope |
|---|---|---|
| Admin | `GET /admin/audit-log` | full, paginated |
| Observer | `GET /observer/audit-log` | full, paginated — same data, read-only route, added 2026-07-28 |
| Admin | `GET /compute/audit-log` | filtered to `AI_VALIDATION` only, for the Confidential Compute Dashboard |
| Admin dashboard (live) | WS `admin:live-logs` | tail of new rows as they're written, pushed at the same repository choke-point |

There is no student-facing or teacher-facing audit log view today — a teacher can see their own question's status/history (`GET /teacher/questions/:id`), which is a narrower, purpose-built view, not a raw audit-log read.

## Related: `SecurityEvent`

A separate table for security-relevant events that aren't generic business-process steps: `AUTH_FAILURE` (login attempts, both "no such user" and "bad password," each distinguishable in the stored `detail` but not in the login endpoint's own response — see docs/THREAT_MODEL.md T6 for why that distinction matters for `/verify` but is fine to log internally for `SecurityEvent`). Severity is `INFO`/`WARNING`/`CRITICAL`. Read via `GET /admin/security-events` or `GET /observer/security-events`.

## Known gaps

- No automated alerting on `SecurityEvent` rows (e.g., a spike in `AUTH_FAILURE`) — today it's purely a dashboard a human has to look at. See docs/THREAT_MODEL.md T5.
- No log retention/archival policy defined yet — `AuditLog`/`SecurityEvent` grow unbounded in Postgres. Not a problem at current volume; worth revisiting before real production traffic (docs/PROJECT_ROADMAP.md).
