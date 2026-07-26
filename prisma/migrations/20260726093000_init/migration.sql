-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TEACHER', 'ADMIN', 'CENTER', 'STUDENT');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "BloomLevel" AS ENUM ('REMEMBER', 'UNDERSTAND', 'APPLY', 'ANALYZE', 'EVALUATE', 'CREATE');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'VALIDATING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaperStatus" AS ENUM ('PENDING', 'ASSEMBLING', 'READY', 'LOCKED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'EVALUATED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('TEACHER_LOGIN', 'ADMIN_LOGIN', 'TEACHER_SUBMISSION', 'AI_VALIDATION', 'ENCRYPTION', 'STORAGE_UPLOAD', 'CHAIN_ANCHOR', 'BLUEPRINT_PUBLISHED', 'PAPER_GENERATION', 'CENTER_AUTHENTICATION', 'STUDENT_LOGIN', 'ANSWER_SUBMISSION', 'EVALUATION', 'AIR_PUBLICATION', 'VERIFICATION_CHECK');

-- CreateEnum
CREATE TYPE "SecurityEventSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ChainNetwork" AS ENUM ('ZG_MAINNET', 'ZG_TESTNET');

-- CreateEnum
CREATE TYPE "MidenNotePurpose" AS ENUM ('PAPER_KEY_TIMELOCK', 'SUBMISSION_COMMITMENT');

-- CreateEnum
CREATE TYPE "MidenNoteStatus" AS ENUM ('PENDING', 'COMMITTED', 'CONSUMED', 'RECLAIMED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "evmAddress" TEXT,
    "midenAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,

    CONSTRAINT "TeacherProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "designation" TEXT,

    CONSTRAINT "AdminProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CenterProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "centerCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,

    CONSTRAINT "CenterProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "dob" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "difficultySuggested" "Difficulty" NOT NULL,
    "bloomLevelSuggested" "BloomLevel" NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'DRAFT',
    "draftPayload" JSONB,
    "storageRoot" TEXT,
    "contentHash" TEXT,
    "chainTxHash" TEXT,
    "chainBlockNumber" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIValidationReport" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "duplicatePct" DOUBLE PRECISION NOT NULL,
    "similarQuestionIds" TEXT[],
    "grammarIssues" JSONB NOT NULL,
    "biasFlags" JSONB NOT NULL,
    "difficultyPredicted" "Difficulty" NOT NULL,
    "bloomLevelPredicted" "BloomLevel" NOT NULL,
    "topicClassified" TEXT NOT NULL,
    "estimatedSolvingSeconds" INTEGER NOT NULL,
    "weightageSuggested" DOUBLE PRECISION NOT NULL,
    "modelName" TEXT NOT NULL,
    "providerAddress" TEXT NOT NULL,
    "trustMode" TEXT NOT NULL,
    "attestationRef" TEXT,
    "passedThresholds" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIValidationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Blueprint" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "totalMarks" INTEGER NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "negativeMarking" DOUBLE PRECISION NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Blueprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlueprintSubjectAllocation" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "marksEach" INTEGER NOT NULL,

    CONSTRAINT "BlueprintSubjectAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlueprintChapterAllocation" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "difficultyPct" JSONB NOT NULL,
    "questionCount" INTEGER NOT NULL,

    CONSTRAINT "BlueprintChapterAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paper" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "status" "PaperStatus" NOT NULL DEFAULT 'PENDING',
    "storageRoot" TEXT,
    "masterPaperHash" TEXT,
    "chainTxHash" TEXT,
    "midenNoteId" TEXT,
    "examStartAt" TIMESTAMP(3) NOT NULL,
    "examWindowCloseAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Paper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperQuestion" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "marks" INTEGER NOT NULL,

    CONSTRAINT "PaperQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamSchedule" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Center" (
    "id" TEXT NOT NULL,
    "centerCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scheduleId" TEXT,

    CONSTRAINT "Center_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamPC" (
    "id" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "machineCode" TEXT NOT NULL,
    "healthStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "lastHeartbeatAt" TIMESTAMP(3),

    CONSTRAINT "ExamPC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentExamSession" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "randomizationSeed" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "answerStorageRoot" TEXT,
    "submissionHash" TEXT,
    "chainTxHash" TEXT,
    "midenNoteId" TEXT,

    CONSTRAINT "StudentExamSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationResult" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "rawScore" DOUBLE PRECISION NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "incorrectCount" INTEGER NOT NULL,
    "unattemptedCount" INTEGER NOT NULL,
    "resultHash" TEXT NOT NULL,
    "chainTxHash" TEXT,
    "midenProofRef" TEXT,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIRRanking" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "tieBreakRule" TEXT,
    "percentile" DOUBLE PRECISION NOT NULL,
    "resultListHash" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIRRanking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "userId" TEXT,
    "questionId" TEXT,
    "metadata" JSONB NOT NULL,
    "batchAnchorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL,
    "severity" "SecurityEventSeverity" NOT NULL,
    "category" TEXT NOT NULL,
    "userId" TEXT,
    "detail" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChainAnchor" (
    "id" TEXT NOT NULL,
    "network" "ChainNetwork" NOT NULL,
    "contractName" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "dataHash" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChainAnchor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MidenNote" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "purpose" "MidenNotePurpose" NOT NULL,
    "status" "MidenNoteStatus" NOT NULL DEFAULT 'PENDING',
    "timelockHeight" BIGINT,
    "reclaimHeight" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MidenNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_TeacherSubjects" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_TeacherChapters" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherProfile_userId_key" ON "TeacherProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminProfile_userId_key" ON "AdminProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CenterProfile_userId_key" ON "CenterProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CenterProfile_centerCode_key" ON "CenterProfile"("centerCode");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_applicationId_key" ON "StudentProfile"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_name_key" ON "Subject"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_subjectId_name_key" ON "Chapter"("subjectId", "name");

-- CreateIndex
CREATE INDEX "Question_status_idx" ON "Question"("status");

-- CreateIndex
CREATE INDEX "Question_subjectId_chapterId_idx" ON "Question"("subjectId", "chapterId");

-- CreateIndex
CREATE INDEX "Question_contentHash_idx" ON "Question"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "AIValidationReport_questionId_key" ON "AIValidationReport"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "BlueprintSubjectAllocation_blueprintId_subjectId_key" ON "BlueprintSubjectAllocation"("blueprintId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "BlueprintChapterAllocation_blueprintId_chapterId_key" ON "BlueprintChapterAllocation"("blueprintId", "chapterId");

-- CreateIndex
CREATE UNIQUE INDEX "PaperQuestion_paperId_questionId_key" ON "PaperQuestion"("paperId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSchedule_paperId_key" ON "ExamSchedule"("paperId");

-- CreateIndex
CREATE UNIQUE INDEX "Center_centerCode_key" ON "Center"("centerCode");

-- CreateIndex
CREATE UNIQUE INDEX "ExamPC_centerId_machineCode_key" ON "ExamPC"("centerId", "machineCode");

-- CreateIndex
CREATE UNIQUE INDEX "StudentExamSession_studentId_paperId_key" ON "StudentExamSession"("studentId", "paperId");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationResult_sessionId_key" ON "EvaluationResult"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "AIRRanking_resultId_key" ON "AIRRanking"("resultId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_severity_idx" ON "SecurityEvent"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "ChainAnchor_txHash_key" ON "ChainAnchor"("txHash");

-- CreateIndex
CREATE INDEX "ChainAnchor_entityType_entityId_idx" ON "ChainAnchor"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "MidenNote_noteId_key" ON "MidenNote"("noteId");

-- CreateIndex
CREATE UNIQUE INDEX "_TeacherSubjects_AB_unique" ON "_TeacherSubjects"("A", "B");

-- CreateIndex
CREATE INDEX "_TeacherSubjects_B_index" ON "_TeacherSubjects"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_TeacherChapters_AB_unique" ON "_TeacherChapters"("A", "B");

-- CreateIndex
CREATE INDEX "_TeacherChapters_B_index" ON "_TeacherChapters"("B");

-- AddForeignKey
ALTER TABLE "TeacherProfile" ADD CONSTRAINT "TeacherProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CenterProfile" ADD CONSTRAINT "CenterProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIValidationReport" ADD CONSTRAINT "AIValidationReport_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlueprintSubjectAllocation" ADD CONSTRAINT "BlueprintSubjectAllocation_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "Blueprint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlueprintSubjectAllocation" ADD CONSTRAINT "BlueprintSubjectAllocation_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlueprintChapterAllocation" ADD CONSTRAINT "BlueprintChapterAllocation_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "Blueprint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlueprintChapterAllocation" ADD CONSTRAINT "BlueprintChapterAllocation_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paper" ADD CONSTRAINT "Paper_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "Blueprint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperQuestion" ADD CONSTRAINT "PaperQuestion_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaperQuestion" ADD CONSTRAINT "PaperQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSchedule" ADD CONSTRAINT "ExamSchedule_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Center" ADD CONSTRAINT "Center_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ExamSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamPC" ADD CONSTRAINT "ExamPC_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "CenterProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentExamSession" ADD CONSTRAINT "StudentExamSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentExamSession" ADD CONSTRAINT "StudentExamSession_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentExamSession" ADD CONSTRAINT "StudentExamSession_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "CenterProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationResult" ADD CONSTRAINT "EvaluationResult_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudentExamSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationResult" ADD CONSTRAINT "EvaluationResult_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRRanking" ADD CONSTRAINT "AIRRanking_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "EvaluationResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TeacherSubjects" ADD CONSTRAINT "_TeacherSubjects_A_fkey" FOREIGN KEY ("A") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TeacherSubjects" ADD CONSTRAINT "_TeacherSubjects_B_fkey" FOREIGN KEY ("B") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TeacherChapters" ADD CONSTRAINT "_TeacherChapters_A_fkey" FOREIGN KEY ("A") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TeacherChapters" ADD CONSTRAINT "_TeacherChapters_B_fkey" FOREIGN KEY ("B") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
