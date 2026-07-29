# THREAT_MODEL.md

Companion to [SECURITY.md](SECURITY.md). Structured as: actor → what they might try → what actually stops them (or doesn't). Consistent with this project's standing rule of never overstating a guarantee — several rows below end in "not yet mitigated," on purpose.

## Actors

- **A malicious or compromised admin/operator** — has legitimate access to the backend, database, and (potentially) 0G service keys.
- **A center operator or invigilator** — legitimate access to the exam-hall flow only.
- **A student** — legitimate access to their own exam session only.
- **A network attacker** — no legitimate access, sits between clients and the API, or between the API and 0G/drand.
- **An external auditor (Observer)** — legitimate, but deliberately read-only, access.
- **A future attacker with a compromised database dump** but no live service access.

## Threats and mitigations

### T1 — An admin reads the exam paper before it's supposed to be released
**Mitigation**: the paper's content key is drand/tlock-sealed to a future round; it is cryptographically unobtainable — not merely access-controlled — until that round's real threshold signature is published by drand's independent multi-operator network (SECURITY.md §2). No admin action, however privileged, can shortcut this; there is no backend override key (confirmed live, knowledge_base.md §11m/§11p).
**Residual risk**: an admin with legitimate DB access can see `Question.draftPayload` for a question still in `DRAFT`/`SUBMITTED` status, before it's `ACCEPTED` and moved to encrypted storage. This is a real, disclosed window — see docs/DATABASE.md design principle 1.

### T2 — A student submits an answer sheet twice, or after tampering with a prior submission
**Mitigation**: `SubmissionRegistry.anchorSubmission`'s own `require(blockTimestamp==0)` (protocol-level, deployed on-chain) plus `@@unique([studentId, paperId])` (application-level). Verified under real concurrent load (SECURITY.md §3).
**Residual risk**: none identified for this specific threat; both layers are independent of each other and of any single admin action.

### T3 — Someone alters a published result after the fact
**Mitigation**: `ResultRegistry` anchors the result hash on 0G Chain at evaluation time; `/verify` recomputes the result hash from the same DB fields and cross-checks it against the chain anchor. Altering the DB row alone would make `resultHashMatch` fail publicly and immediately for anyone who checks.
**Residual risk**: if an attacker could alter *both* the DB row and somehow re-anchor a matching hash on-chain, this would defeat the check — but that requires an actual funded key with `ANCHOR_ROLE` and a second, distinguishable transaction, which is itself independently checkable (chain history is public and permanent; a "correction" transaction is visible forever, not hidden).

### T4 — A network attacker intercepts traffic between the client and the API
**Mitigation**: standard TLS in production (terminated at the hosting platform — see docs/DEPLOYMENT.md); JWTs are bearer tokens over HTTPS, `helmet()` sets standard security headers.
**Not yet mitigated**: no token refresh/rotation scheme; a leaked JWT is valid until `JWT_EXPIRES_IN` (default 12h) elapses. No CSRF protection is needed (no cookie-based session), but no token-binding to a device/IP exists either.

### T5 — Credential stuffing / brute-force login against `/auth/login`
**Not yet mitigated**: no rate limiting is implemented on `/auth/login` today. Every failed attempt does write a real `SecurityEvent` row (`AUTH_FAILURE`, `WARNING`) that Admin/Observer dashboards surface live, so an attack is *visible*, but nothing currently blocks it automatically. Real, disclosed gap — see docs/PROJECT_ROADMAP.md.

### T6 — Enumerating valid `applicationId`s via the public `/verify` endpoint
**Mitigation**: the endpoint deliberately returns the identical response shape for "no such applicationId" and "DOB mismatch" (verify.service.ts, covered by `verify.service.test.ts`) — an attacker learns nothing from the response about whether an ID exists.
**Residual risk**: response timing could theoretically differ between the two paths (a DB lookup miss vs. a DOB comparison) — not measured or mitigated; a plausible but unconfirmed side channel.

### T7 — A compromised 0G Compute provider returns a manipulated validation verdict
**Mitigation**: `private`/`verified` trust mode routes only to TeeML (and, for `verified`, TeeTLS) providers with real Intel TDX attestation — the response is provably tied to the claimed model running in a real enclave, not an arbitrary server. The model's structured output is additionally treated as advisory input to deterministic acceptance rules, not trusted blindly (SECURITY.md §4).
**Residual risk**: this defends against a compromised *host*, not a jailbroken/adversarially-prompted model producing a wrong-but-well-formed verdict. That's a model-quality risk, not a confidentiality/integrity break, and is out of scope for cryptographic threat modeling.

### T8 — An Observer (or a compromised Observer credential) attempts a mutating action
**Mitigation**: `routes/observer.routes.ts` registers only GET handlers; `requireRole` rejects any other role or any attempt to reach an admin mutation route with 403 (verified live and in `auth.middleware.test.ts`).
**Residual risk**: none identified — this is enforced at the router level, not by convention.

### T9 — Denial of service via login-flood exploiting bcrypt's CPU cost
**Not yet mitigated, and confirmed real**: `apps/api/scripts/load-test.mjs` measured a ~19x increase in login p50 latency (245ms → 4.7s) under 20 concurrent logins, because `bcryptjs` (pure JS, not the native `bcrypt` binding) blocks Node's single event-loop thread while hashing. A moderate concurrent login flood would degrade every other request on the same process, not just logins. See docs/PROJECT_ROADMAP.md for the fix (native `bcrypt`, or moving password hashing off the request thread).

### T10 — A database dump leaks (backup theft, misconfigured access)
**Mitigation**: no plaintext question/paper/answer content is ever in Postgres once accepted/ready (docs/DATABASE.md principle 1); content keys are derived, not stored, except the Paper key, which is drand/tlock-sealed, not plaintext, in the dump either.
**Residual risk**: `draftPayload` for in-flight `DRAFT`/`SUBMITTED` questions is plaintext in the DB (see T1's residual risk) — a dump taken at the wrong moment would expose those specific questions.
