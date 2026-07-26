// Content grounded in knowledge_base.md — nothing here overstates what's
// documented as real vs. engineered (see knowledge_base.md §3, §5 UI copy
// rules). This file is the single place to edit landing-page copy.

export const CURRENT_PROBLEMS = [
  { title: "Paper leaks", detail: "Printed papers and PDFs pass through many hands — printers, couriers, exam centers — each one a leak point." },
  { title: "Insider attacks", detail: "Anyone with standing access to the question bank or the paper before exam day can exfiltrate it." },
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
  { title: "Paper release & exam submission", detail: "Miden timelock note + nullifier", real: false },
  { title: "Evaluation, AIR & verification", detail: "Results hashed, anchored on-chain", real: true },
];

export const TECH = [
  { name: "0G Chain", role: "Public, citizen-verifiable anchor for every hash — question, paper, submission, result.", status: "Mainnet live (Aristotle, chain ID 16661)" },
  { name: "0G Storage", role: "Encrypted question/paper/answer blobs, Merkle-proof verified downloads.", status: "Mainnet + testnet" },
  { name: "0G Compute", role: "AI validation genuinely runs inside a hardware TEE — private trust mode, Intel TDX.", status: "Verified live against pc.0g.ai" },
  { name: "Miden", role: "Cryptographic timelock for the paper's decryption key; private, nullifier-protected submission commitments.", status: "Testnet only — no Miden mainnet exists yet" },
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
    title: "Admin (NTA) flow",
    steps: [
      "Define a blueprint: subject %, chapter %, difficulty %, marks, question count, negative marking",
      "Publish the blueprint (not a paper)",
      "Trigger paper generation — selection, assembly, encryption, on-chain anchor, Miden timelock seal",
      "Monitor centers, schedule, security events, and blockchain anchors from one dashboard",
    ],
  },
  Student: {
    title: "Student flow",
    steps: [
      "Log in at the exam center at the scheduled time",
      "Start the exam once the Miden timelock genuinely unlocks — same questions, personally randomized order",
      "Answer, mark for review, navigate freely, autosave runs continuously",
      "Submit — answers are encrypted, committed via a private Miden note, and anchored on-chain",
      "Later, verify your own result independently at /verify",
    ],
  },
  Center: {
    title: "Examination center flow",
    steps: [
      "Center staff log in and verify gateway/network status",
      "Monitor exam PC health and connected students",
      "Enroll students for the scheduled paper",
      "Authorization to start is gated on the real Miden timelock state — not a toggle the center controls",
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
      "Every master paper's hash → PaperRegistry, sealed behind a Miden testnet timelock note",
      "Every submission → SubmissionRegistry, with a private Miden commitment note (nullifier-protected)",
      "Every result → ResultRegistry, keyed so only the student who knows their own ID+DOB can look themselves up",
    ],
  },
};

export const GOVERNMENT_BENEFITS = [
  "A tamper-evident public record for every stage — not a claim, a re-checkable one",
  "Insider risk reduced structurally: no standing key exists to decrypt the paper before exam time, for anyone, including administrators",
  "Every access attempt is logged, and the log itself is hash-anchored so tampering with the log is detectable",
];

export const COURT_BENEFITS = [
  "Disputes over result manipulation become independently re-checkable: the hash, the proof, and the chain transaction are all public",
  "A challenged result doesn't require trusting the examination body's internal logs — an outside party can recompute the same checks this system runs",
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
    a: "No, and we don't claim it does. No generic \"TEE for arbitrary business logic\" product is currently documented by either 0G or Miden. Paper assembly runs as access-controlled, fully audit-logged application code; the paper's decryption key is what's genuinely hardware/protocol-enforced unavailable early, via a Miden timelock — not the assembly logic itself.",
  },
  {
    q: "Is Miden live on mainnet?",
    a: "No — Miden currently has testnet and devnet only, confirmed directly from Miden's own protocol documentation, which itself carries an alpha-stage warning. Every Miden-facing feature here targets testnet and is badged as such.",
  },
  {
    q: "What happens if a student never gets a chance to verify their result?",
    a: "The verification data doesn't disappear — every hash and transaction is on public infrastructure (0G Chain, 0G Storage) indefinitely re-checkable, not a one-time receipt.",
  },
];
