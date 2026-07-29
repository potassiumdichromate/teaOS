# Future-Scale Implementation Plan

Companion to [knowledge_base.md](../knowledge_base.md) and [PROJECT_ROADMAP.md](PROJECT_ROADMAP.md). This doc is specifically for capabilities that are **deliberately stubbed today** with an honest, demo-grade placeholder, where the real version is a materially larger build (ML, hardware, or ops investment) than the rest of this codebase. Nothing here should be read as "todo, five minutes" — these are scoped as real future project phases.

## 1. Candidate identity verification (face/biometric)

### Today (2026-07-30)

Self-enrollment (`apps/web/src/pages/student/StudentExamClient.tsx`, `POST /student/exam/enroll`) captures a photo via the browser's camera (`getUserMedia`) at enrollment time. It is:

- Uploaded encrypted to 0G Storage (same `uploadEncrypted`/`downloadVerified` pattern as every other content type in this app — see `apps/api/src/lib/zg-storage.ts`), keyed by a photo-specific derived key (`deriveStudentPhotoKey`, `apps/api/src/lib/crypto.ts`).
- Attached to the candidate's `StudentProfile.photoStorageRoot` — one photo per applicationId, not per session.
- Shown back on the public `/verify` page alongside a verified result (`apps/api/src/services/verify.service.ts`'s `fetchCandidatePhoto`).

**There is no face-matching, liveness check, or any ML in this path today.** Any photo is accepted — a candidate could submit a photo of anything and enrollment succeeds. This is intentional scope-limiting for now, not an oversight: it gets the plumbing (capture → encrypt → store → retrieve → display) real and working end to end, which is the harder infrastructure problem to get right once. The verification *logic* is the part that's deferred.

### Real version (planned)

A real deployment needs, at minimum:

1. **Enrollment-time face capture with liveness detection** — reject a printed photo or a video replay held up to the camera (passive liveness via texture/depth cues, or active liveness via a challenge like "blink" / "turn your head").
2. **Face embedding + matching at every exam start** — not just at enrollment. `startExam()` (`apps/api/src/services/exam.service.ts`) would gain a step: capture a fresh photo at start time, compute its embedding, compare against the enrollment embedding (cosine similarity above a calibrated threshold), and refuse to start on a mismatch — mirroring the same "no backend override" philosophy this app already applies to the drand/tlock timelock (nobody, including an admin, should be able to force a start past a failed face check).
3. **Anti-spoofing hardening** — deepfake/print/replay attack resistance is an active research area; a real build should use an established vendor SDK (e.g., a liveness-certified provider) rather than a homegrown model, given the security stakes of an exam-integrity product.
4. **Where the model runs** — given this platform's existing "confidential AI validation" precedent (0G Compute's private/TEE trust mode for question validation, see `apps/api/src/lib/zg-compute.ts`), the natural fit is running face-match inference through the same confidential-compute path, so a candidate's biometric data is never processed anywhere it could be logged or inspected in the clear — consistent with the rest of this platform's "verifiable, not just asserted" design principle.
5. **Consent, retention, and deletion** — biometric data is regulated more strictly than most content in most jurisdictions (e.g., GDPR Art. 9, BIPA in Illinois). A real launch needs an explicit consent flow at enrollment, a defined retention window, and a real deletion path — none of which exist today because there's no real biometric data being processed yet.
6. **Re-enrollment / photo update flow** — a real candidate's appearance changes over time (haircuts, glasses, aging across multi-year exam cycles). Needs a documented re-verification path, not a one-time capture assumed to be valid forever.

None of the above is implemented. Treat the current photo capture purely as the storage/display plumbing proof-of-concept it is.

## 2. Multi-center self-enrollment

Self-enrollment (`StudentExamSession.centerId` is now nullable, migration `20260729193007_self_enrollment_duplication_photo`) doesn't ask a student which physical center they're at — there's exactly one seeded demo center, so this was never exercised as a real constraint. A real multi-center deployment needs a real answer to "how does the system know which physical location a self-enrolled candidate is sitting at" — options include a per-center enrollment code, geofencing, or requiring the exam PC itself (not the candidate) to confirm the machine's assigned center before the session can start. Not designed yet.

## 3. Duplication-level selection at blueprint time

Also new this round: `AI_VALIDATION_THRESHOLDS.maxDuplicatePct` was raised from 35 to 80 (`packages/shared/src/constants.ts`), and every accepted question keeps its measured `duplicatePct` tagged into a `LOW`/`MEDIUM`/`HIGH` band (`duplicationLevelFor`, same file) that a blueprint's chapter allocation can cap via `maxDuplicationLevel` (`prisma/schema.prisma`'s `BlueprintChapterAllocation`, `apps/api/src/services/questionSelection.service.ts`). This part is real and working today — it's not on this future-scale list. It's noted here only for cross-reference, since it shipped in the same batch of changes as items 1–2 above.
