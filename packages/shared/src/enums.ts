// Mirrors prisma/schema.prisma enums exactly — keep in sync by hand,
// there is deliberately no codegen step from Prisma into this package
// because apps/web must not depend on @prisma/client.

export const Role = ["TEACHER", "ADMIN", "CENTER", "STUDENT"] as const;
export type Role = (typeof Role)[number];

export const Difficulty = ["EASY", "MEDIUM", "HARD"] as const;
export type Difficulty = (typeof Difficulty)[number];

export const BloomLevel = [
  "REMEMBER",
  "UNDERSTAND",
  "APPLY",
  "ANALYZE",
  "EVALUATE",
  "CREATE",
] as const;
export type BloomLevel = (typeof BloomLevel)[number];

export const QuestionStatus = [
  "DRAFT",
  "SUBMITTED",
  "VALIDATING",
  "ACCEPTED",
  "REJECTED",
] as const;
export type QuestionStatus = (typeof QuestionStatus)[number];

export const PaperStatus = ["PENDING", "ASSEMBLING", "READY", "LOCKED"] as const;
export type PaperStatus = (typeof PaperStatus)[number];

export const SessionStatus = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "SUBMITTED",
  "EVALUATED",
] as const;
export type SessionStatus = (typeof SessionStatus)[number];

export const AuditAction = [
  "TEACHER_LOGIN",
  "ADMIN_LOGIN",
  "TEACHER_SUBMISSION",
  "AI_VALIDATION",
  "ENCRYPTION",
  "STORAGE_UPLOAD",
  "CHAIN_ANCHOR",
  "BLUEPRINT_PUBLISHED",
  "PAPER_GENERATION",
  "CENTER_AUTHENTICATION",
  "STUDENT_LOGIN",
  "ANSWER_SUBMISSION",
  "EVALUATION",
  "AIR_PUBLICATION",
  "VERIFICATION_CHECK",
] as const;
export type AuditAction = (typeof AuditAction)[number];

export const ChainNetwork = ["ZG_MAINNET", "ZG_TESTNET"] as const;
export type ChainNetwork = (typeof ChainNetwork)[number];

export const ZgTrustMode = ["standard", "verified", "private"] as const;
export type ZgTrustMode = (typeof ZgTrustMode)[number];

export const MidenNotePurpose = ["PAPER_KEY_TIMELOCK", "SUBMISSION_COMMITMENT"] as const;
export type MidenNotePurpose = (typeof MidenNotePurpose)[number];

export const MidenNoteStatus = ["PENDING", "COMMITTED", "CONSUMED", "RECLAIMED"] as const;
export type MidenNoteStatus = (typeof MidenNoteStatus)[number];
