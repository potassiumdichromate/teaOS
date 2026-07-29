import type { CreateBlueprintInput, GeneratePaperInput } from "@nvei/shared";
import { blueprintRepository } from "../repositories/blueprint.repository.js";
import { paperRepository } from "../repositories/paper.repository.js";
import { auditLogRepository } from "../repositories/auditLog.repository.js";
import { paperGenerationQueue } from "../workers/queues.js";
import { HttpError } from "../middleware/error.middleware.js";

export async function createBlueprint(input: CreateBlueprintInput) {
  return blueprintRepository.create(input);
}

export async function publishBlueprint(userId: string, id: string) {
  const blueprint = await blueprintRepository.findById(id);
  if (!blueprint) throw new HttpError(404, "Blueprint not found");
  if (blueprint.publishedAt) throw new HttpError(409, "Blueprint already published");
  const published = await blueprintRepository.publish(id);
  await auditLogRepository.write("BLUEPRINT_PUBLISHED", { userId, metadata: { blueprintId: id } });
  return published;
}

export async function listBlueprints() {
  return blueprintRepository.listAll();
}

export async function getBlueprint(id: string) {
  const blueprint = await blueprintRepository.findById(id);
  if (!blueprint) throw new HttpError(404, "Blueprint not found");
  return blueprint;
}

export async function generatePaper(input: GeneratePaperInput): Promise<{ paperId: string; jobId: string }> {
  const blueprint = await blueprintRepository.findById(input.blueprintId);
  if (!blueprint) throw new HttpError(404, "Blueprint not found");
  if (!blueprint.publishedAt) throw new HttpError(409, "Blueprint must be published before paper generation");

  const paper = await paperRepository.create({
    blueprintId: input.blueprintId,
    examStartAt: new Date(input.examStartAt),
    examWindowCloseAt: new Date(input.examWindowCloseAt),
  });
  const job = await paperGenerationQueue.add("generate", { paperId: paper.id });
  return { paperId: paper.id, jobId: job.id ?? paper.id };
}

export async function getPaper(id: string) {
  const paper = await paperRepository.findById(id);
  if (!paper) throw new HttpError(404, "Paper not found");
  // Never return plaintext question content or the content key from this
  // endpoint — it exposes DB metadata only, matching docs/API_REFERENCE.md.
  return {
    id: paper.id,
    status: paper.status,
    blueprintId: paper.blueprintId,
    storageRoot: paper.storageRoot,
    masterPaperHash: paper.masterPaperHash,
    chainTxHash: paper.chainTxHash,
    timelockRef: paper.timelockRef,
    failureReason: paper.failureReason,
    examStartAt: paper.examStartAt,
    examWindowCloseAt: paper.examWindowCloseAt,
    questionCount: paper.paperQuestions.length,
  };
}
