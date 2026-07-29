import { prisma } from "../lib/prisma.js";

// Deletion order matters (FK constraints) — children before parents.
export async function resetDb() {
  await prisma.$transaction([
    prisma.aIRRanking.deleteMany(),
    prisma.evaluationResult.deleteMany(),
    prisma.studentExamSession.deleteMany(),
    prisma.chainAnchor.deleteMany(),
    prisma.securityEvent.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.paperQuestion.deleteMany(),
    prisma.paper.deleteMany(),
    prisma.blueprintChapterAllocation.deleteMany(),
    prisma.blueprintSubjectAllocation.deleteMany(),
    prisma.blueprint.deleteMany(),
    prisma.aIValidationReport.deleteMany(),
    prisma.question.deleteMany(),
    prisma.examPC.deleteMany(),
    prisma.teacherProfile.deleteMany(),
    prisma.adminProfile.deleteMany(),
    prisma.centerProfile.deleteMany(),
    prisma.studentProfile.deleteMany(),
    prisma.observerProfile.deleteMany(),
    prisma.user.deleteMany(),
    prisma.chapter.deleteMany(),
    prisma.subject.deleteMany(),
  ]);
}
