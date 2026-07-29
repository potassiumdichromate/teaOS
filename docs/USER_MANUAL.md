# teaOS — Tester & Evaluator Manual

This is a walkthrough of the actual product, written for someone testing or evaluating it for the first time — not a code doc. Everything described here is real and working end to end at the time of writing (2026-07-29); where something is still limited or in progress, that's said plainly rather than glossed over.

If you just want URLs and demo logins, skip to [Quick Start](#quick-start). If you want to understand what you're actually looking at first, read [What This Is](#what-this-is).

---

## What This Is

teaOS is infrastructure for running high-stakes digital assessments — exams, certifications, hiring tests, anything where the content has to stay secret until it's released, and where every step needs to be independently checkable afterward, not just "trust us."

Five things make that possible, and all five are real, working systems in this build, not mockups:

1. **Confidential AI validation** — every submitted question is screened for duplicates, bias, and grammar issues inside a hardware-secured environment (a TEE, or "trusted execution environment") via 0G Compute. The screening happens somewhere even the platform's own operators can't observe.
2. **Decentralized encrypted storage** — questions, papers, and answer sheets are encrypted and stored on 0G Storage, a real decentralized network, addressed by a cryptographic fingerprint (a Merkle root) rather than a normal file path.
3. **Time-locked key release** — the exam paper's decryption key is sealed using a scheme called drand/tlock. It becomes readable only at a specific future moment, determined by a public randomness network that no single party — including teaOS itself — controls. Nobody can peek early.
4. **On-chain anchoring** — every important fact (a question was validated, a paper was assembled, an answer was submitted, a result was scored) gets a hash written to 0G Chain, a public blockchain. Anyone can look that hash up later and confirm nothing was altered.
5. **Public, self-service verification** — a candidate can check their own result afterward, independently, using only their application ID and date of birth, no login required — and the checks it runs are the same math anyone else could run themselves.

The point of all this: at every stage, there's a real answer to "how do you know that's true?" — not "because we said so."

---

## Quick Start

**URL**: whatever your tester was given (local dev is `http://localhost:5173`; if this has been deployed, you'll have a real domain instead).

**Demo accounts** — every role, same password:

| Role | Email | Password |
|---|---|---|
| Teacher (question author) | `teacher@example.dev` | `dev-password-only` |
| Admin (control plane) | `admin@example.dev` | `dev-password-only` |
| Center (exam-hall operator) | `center@example.dev` | `dev-password-only` |
| Student (candidate) | `student@example.dev` | `dev-password-only` |
| Observer (independent auditor) | `observer@example.dev` | `dev-password-only` |

The login page has a one-click picker for all five — you don't need to type these in by hand. Whichever account you log in with, you're taken straight to that role's own portal; there's no shared "home page" for logged-in users, each role's world looks completely different.

**No account creation** — this build has no self-registration. These five accounts are the whole roster. If you want to test a specific scenario (e.g., a second student), that would need a new seeded account, not a signup form.

---

## The Big Picture: One Question's Journey

Before touring each portal, here's the full path a single question takes — this is the mental model everything else hangs off of:

```
Teacher writes a question
        │
        ▼
Confidential AI validation (real TEE, 0G Compute)
   ├── Accepted → encrypted, stored, hash anchored on-chain
   └── Rejected → teacher sees exactly why (duplicate %, bias flags, grammar issues)
        │
        ▼
Admin builds a Blueprint (subject mix, difficulty mix, marks, question count)
        │
        ▼
Admin generates a Paper from that Blueprint
   → selects accepted questions → assembles the paper → encrypts it fresh
   → seals its decryption key behind a time-lock (drand/tlock)
        │
        ▼
Center enrolls a Student for that paper, monitors machine/network readiness
        │
        ▼
At the scheduled time, the time-lock opens for real — Student starts the exam
   → the real paper is decrypted client-side, questions shown in a randomized order
        │
        ▼
Student answers, submits
   → answers encrypted, uploaded, hash anchored on-chain
   → a smart contract itself refuses to let this happen twice for the same session
        │
        ▼
Admin runs Evaluation
   → the same time-locked key is used to decrypt the official answer key
   → scores computed, result hash anchored on-chain
        │
        ▼
Admin publishes the Ranking
   → all scored candidates sorted, ranked, the whole ranked list hashed and anchored
        │
        ▼
Anyone — no login needed — can go to /verify and independently re-check
   every one of the hashes and hashes above, from scratch
```

Every arrow in that diagram is a real system boundary you can watch happen live in the product (each portal below shows you exactly that step).

---

## Portal: Teacher (question author)

**Log in as**: `teacher@example.dev`

- **Dashboard** — your assigned subjects/chapters and a summary of your submission activity.
- **Submit a question** — write the question, four options with one marked correct, an explanation, your suggested difficulty/Bloom level. Submitting hands it to the real validation pipeline — you'll watch it move through Draft → Submitted → Validating → Accepted/Rejected live, not a fake progress bar. Once it settles, you'll see a real notification and the form clears itself so you can't accidentally resubmit the same item.
- **If it's rejected**, you're shown exactly why: the real duplicate-similarity percentage against the real threshold, the real bias flags (if any), and the real grammar issues the model actually found, each with the specific text and the specific fix suggested. This isn't a generic "didn't pass" message.
- **Question history** — every item you've ever submitted. Click any row to see its full validation report again, any time — not just right after submitting.

## Portal: Admin (control plane)

**Log in as**: `admin@example.dev`

- **Overview** — live stats (questions by status/subject/difficulty, system health, security events, recent on-chain anchors), pulled from the running system, refreshed live over a WebSocket connection — watch a login attempt on another tab and you'll see it appear here within a couple of seconds.
- **Blueprints** — define the shape of a paper: which subjects, what % from each difficulty band, how many questions, total marks, negative marking rule. Publish it once you're happy.
- **Paper generation** — pick a published blueprint, set the exam's start/end time, generate. Watch the real pipeline: question selection → assembly → encryption → on-chain anchor → time-lock seal. A paper only reaches "Ready" once every one of those steps has genuinely succeeded — there's no "fake ready."
- **Evaluation & Ranking** — once candidates have submitted, run evaluation (this only works once the paper's time-lock has actually opened — see the Student section). Then publish the ranking: sorts everyone by score, breaks ties by earlier submission, hashes the whole ranked list, anchors it.
- **Confidential Compute Dashboard** — live queue depth for the AI validation pipeline, the real list of TEE-capable models currently available, and a way to pull up any question's full attestation report by ID.
- **0G Storage Explorer** — every encrypted object this system has ever written (questions, papers, answer sets), with a **Verify** button per row that performs an actual fresh Merkle-proof download from the storage network right there in your browser — not a cached "yes it's fine" flag.

## Portal: Center (exam-hall operator)

**Log in as**: `center@example.dev`

- **Machine health** — exam PCs check in with a heartbeat; this screen shows which are online.
- **Release authorization** — paste a paper's ID and it tells you, truthfully, whether that paper is actually inside its exam window and time-lock-unlocked right now. If it isn't, you're told exactly why (paper not ready yet, or outside the time window) — the same real gate the Student portal itself is subject to.
- **Candidate enrollment** — enroll a student for a specific paper. A given student can only ever be enrolled once per paper — the system won't let you do it twice, even if you try.

## Portal: Student (candidate)

**Log in as**: `student@example.dev`

- The exam client is a real, distraction-free timed test interface: countdown timer, a question palette showing answered/marked/unvisited state at a glance, save-and-next, mark-for-review, autosave running continuously in the background.
- **Starting the exam only works once the real time-lock has opened.** This isn't a toggle anyone can flip early — not the admin, not the center, not you. If you try before the scheduled time, you'll get an honest refusal, not a fake unlock.
- **Submitting** encrypts your answers, uploads them, and anchors the submission hash on-chain. The system is built so a second submission for the same session is rejected at the database and smart-contract level both — not just a UI restriction.
- Afterward, you can independently verify your own result at `/verify` (see below) — no login needed for that part, on purpose.

## Portal: Observer (independent auditor)

**Log in as**: `observer@example.dev`

This role exists specifically for someone whose job is to check on the system from the outside — a regulator, an auditor, a technical reviewer — and it is **strictly read-only**: there is no button anywhere in this portal that changes anything.

- **Anchoring coverage** — a real, live-computed figure: of everything this system has recorded (papers, questions, sessions, results), how much of it actually has a matching on-chain anchor. Not a claim — a count.
- **Recent chain anchors, security events, and the full audit log** — the same underlying data an Admin sees, presented for oversight rather than operation.

## Public: Verify a Result

**No login required** — reachable from the landing page or directly at `/verify`.

Enter an application ID and date of birth, and the system independently re-derives and re-checks six separate things: does the identity match, does the submission hash match, does the answer hash match the on-chain anchor, does the result hash match, does the on-chain commitment check out, and is the chain transaction itself real and confirmed. You get an itemized list — which checks passed, which didn't — never a single opaque "verified" badge with no explanation behind it.

---

## What's Genuinely Still Limited (told to you straight)

- **This is a prototype, not a hardened production deployment** — the landing page says exactly that, on purpose. Login is not rate-limited yet, and the demo accounts share one password that's openly documented (including in this manual) — fine for a controlled demo, not something to expose to the open internet without more access control first.
- **A rejected question can't be edited and resubmitted as the same item** — you write a fresh one. This is deliberate: nothing about a validated or rejected item can be quietly changed after the fact.
- **Evaluation and the Ranking publish step both require the exam's time-lock to have already opened** — there is no admin override for this, anywhere, by design. If you're testing this flow, make sure the paper's exam window has genuinely started before expecting evaluation to work.

---

## A Few Terms, Plainly

- **TEE (Trusted Execution Environment)**: a hardware-secured area of a computer where code runs in a way that even the machine's own operator can't inspect or tamper with. Used here so AI validation genuinely can't be peeked at or fudged.
- **drand/tlock**: a real, independently-operated public randomness network (drand) plus a technique (tlock) for encrypting something so it can only be decrypted once a specific future round of that randomness has actually happened. This is what makes "the paper can't be opened early" a mathematical fact, not a policy.
- **0G Chain / 0G Storage / 0G Compute**: the three real pieces of decentralized infrastructure this system is built on — a public blockchain for anchoring hashes, a decentralized storage network for encrypted content, and a decentralized AI-inference marketplace with hardware-attested execution.
- **Anchoring**: writing a hash of something (a question, a paper, a result) onto a public blockchain, so anyone can later confirm the original content hasn't changed, without needing to trust any particular party's word for it.
