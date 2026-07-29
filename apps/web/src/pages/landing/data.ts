// Content grounded in knowledge_base.md — nothing here overstates what's
// documented as real vs. engineered (see knowledge_base.md §3, §5 UI copy
// rules). This file is the single place to edit landing-page copy.

export const CURRENT_PROBLEMS = [
  { title: "Paper leaks", detail: "Printed papers and PDFs pass through many hands — printers, couriers, delivery centers — each one a leak point." },
  { title: "Insider attacks", detail: "Anyone with standing access to the question bank or the paper before release day can exfiltrate it." },
  { title: "Question manipulation", detail: "No cryptographic record ties a published question back to what was actually authored and validated." },
  { title: "Result manipulation", detail: "Marking and ranking happen inside opaque systems a student has no way to independently check." },
  { title: "Lack of transparency", detail: "The public has to trust the process happened correctly — there's nothing to verify against." },
  { title: "Lack of auditability", detail: "When something does go wrong, reconstructing what happened relies on internal logs no one outside can see." },
];

export const PIPELINE = [
  { title: "Teacher submits question", detail: "Draft with answer & options", real: true },
  { title: "AI validation", detail: "0G Compute, private TEE mode", real: true },
  { title: "Encrypt & anchor hash", detail: "0G Storage blob, 0G Chain tx", real: true },
  { title: "Master paper generation", detail: "Blueprint-driven selection, app layer", real: true },
  { title: "Paper release & candidate submission", detail: "drand/tlock key release, on-chain commitment", real: true },
  { title: "Evaluation, AIR & verification", detail: "Results hashed, anchored on-chain", real: true },
];

export const TECH = [
  { name: "0G Chain", role: "Public, citizen-verifiable anchor for every hash — question, paper, submission, result.", status: "Mainnet live (Aristotle, chain ID 16661)" },
  { name: "0G Storage", role: "Encrypted question/paper/answer blobs, Merkle-proof verified downloads.", status: "Mainnet + testnet" },
  { name: "0G Compute", role: "AI validation genuinely runs inside a hardware TEE — private trust mode, Intel TDX.", status: "Verified live against pc.0g.ai" },
  { name: "drand", role: "Decentralized randomness beacon; tlock timelock-encrypts the paper's decryption key to a future round, released only once that round's real threshold signature is published.", status: "Live (mainnet quicknet)" },
];

export const FLOWS: Record<string, { title: string; steps: string[] }> = {
  Teacher: {
    title: "Teacher flow",
    steps: [
      "Log in, see assigned subjects and chapters",
      "Submit a question: text, options, correct answer, explanation, difficulty, Bloom level",
      "Watch it enter the validation pipeline in real time",
      "See AI feedback and final accept/reject status",
    ],
  },
  Admin: {
    title: "Program admin flow",
    steps: [
      "Define a blueprint: subject %, chapter %, difficulty %, marks, question count, negative marking",
      "Publish the blueprint (not a paper)",
      "Trigger paper generation — selection, assembly, encryption, on-chain anchor, drand/tlock timelock seal",
      "Monitor centers, schedule, security events, and blockchain anchors from one dashboard",
    ],
  },
  Student: {
    title: "Student flow",
    steps: [
      "Log in at the examination center at the scheduled time",
      "Start the assessment once the drand/tlock timelock genuinely unlocks — same questions, personally randomized order",
      "Answer, mark for review, navigate freely, autosave runs continuously",
      "Submit — answers are encrypted and anchored on-chain; the registry contract's own write-once guard makes a second submission impossible",
      "Later, verify your own result independently at /verify",
    ],
  },
  Center: {
    title: "Examination center flow",
    steps: [
      "Center staff log in and verify gateway/network status",
      "Monitor exam PC health and connected students",
      "Enroll students for the scheduled paper",
      "Authorization to start is gated on the real drand/tlock timelock state — not a toggle the center controls",
    ],
  },
  AI: {
    title: "AI validation flow",
    steps: [
      "Question text, options, and metadata sent to 0G Compute with trust-mode: private",
      "Model runs inside an Intel TDX enclave — the prompt never leaves it, host and 0G itself see only encrypted traffic",
      "Returns duplicate %, grammar issues, bias flags, difficulty/Bloom prediction, topic, estimated time",
      "Treated as advisory input to deterministic acceptance thresholds, not as unchecked ground truth",
    ],
  },
  Blockchain: {
    title: "Blockchain flow",
    steps: [
      "Every accepted question's content hash + validation hash → 0G Chain QuestionRegistry",
      "Every master paper's hash → PaperRegistry, sealed behind a real drand/tlock timelock",
      "Every submission → SubmissionRegistry, whose own write-once guard makes a second submission for the same session structurally impossible",
      "Every result → ResultRegistry, keyed so only the student who knows their own ID+DOB can look themselves up",
    ],
  },
};

export const GOVERNMENT_BENEFITS = [
  "A tamper-evident public record for every stage — not a claim, a re-checkable one",
  "Insider risk reduced structurally: no standing key exists to decrypt the paper before release time, for anyone, including administrators",
  "Every access attempt is logged, and the log itself is hash-anchored so tampering with the log is detectable",
];

export const COURT_BENEFITS = [
  "Disputes over result manipulation become independently re-checkable: the hash, the proof, and the chain transaction are all public",
  "A challenged result doesn't require trusting the assessment body's internal logs — an outside party can recompute the same checks this system runs",
  "Chain of custody for a question, from submission to paper inclusion, is cryptographically continuous",
];

export const CITIZEN_BENEFITS = [
  "Verify your own result yourself, with just your Application ID and date of birth, no login required",
  "See exactly which checks passed and which didn't — never a single opaque \"trust us\" badge",
  "Confidence that your answers, once submitted, cannot be silently altered before evaluation",
];

export const FAQ = [
  {
    q: "Is the question paper actually encrypted, or is that just a claim?",
    a: "Actually encrypted — AES-256-GCM before the content ever reaches 0G Storage. This is implemented and running in the prototype, not aspirational.",
  },
  {
    q: "Does a hardware TEE really validate every question?",
    a: "Yes, for the AI validation step specifically — 0G Compute's \"private\" trust mode routes only to TeeML providers (Intel TDX), verified live against pc.0g.ai. The paper-assembly step is a different, disclosed mechanism — see the next question.",
  },
  {
    q: "So does a TEE assemble the master paper too?",
    a: "No, and we don't claim it does. No generic \"TEE for arbitrary business logic\" product is currently documented by 0G. Paper assembly runs as access-controlled, fully audit-logged application code; the paper's decryption key is what's genuinely cryptographically unavailable early, via a real drand/tlock timelock — not the assembly logic itself.",
  },
  {
    q: "Is the timelock actually decentralized, or could you unlock it early yourselves?",
    a: "It's real drand mainnet — the League of Entropy's public randomness beacon, run by independent operators (Cloudflare, Protocol Labs, EPFL, UCL, and others). The paper's key is encrypted to a future round; it only becomes decryptable once that round's real threshold signature is published, which no single operator (and no threshold-minus-one collusion) can produce early. Proven live end to end against real drand and 0G mainnet — every anchor is independently checkable on chain.",
  },
  {
    q: "What happens if a student never gets a chance to verify their result?",
    a: "The verification data doesn't disappear — every hash and transaction is on public infrastructure (0G Chain, 0G Storage) indefinitely re-checkable, not a one-time receipt.",
  },
];
