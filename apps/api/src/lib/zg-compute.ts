// Real 0G Compute Router client per docs/0G_INTEGRATION.md. This is the ONLY
// module in the codebase allowed to talk to 0G Compute, so the trust-mode
// enforcement rule (never silently downgrade from "private") lives in one place.
import OpenAI from "openai";
import { aiValidationReportSchema, type AiValidationReport } from "@nvei/shared";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

const client = new OpenAI({
  baseURL: env.ZG_COMPUTE_ROUTER_URL,
  apiKey: env.ZG_COMPUTE_API_KEY ?? "unset",
});

export interface ValidationCallResult {
  report: AiValidationReport;
  modelName: string;
  providerAddress: string | null;
  trustMode: string;
}

// Real finding from live testing (2026-07-26): describing the required fields
// in prose (as this prompt originally did) reliably gets a real reasoning
// model to invent its own reasonable-but-different JSON — e.g.
// "duplicate_percentage" instead of "duplicatePct", "bias_flags" as a plain
// string instead of an array of {category, detail}. response_format:
// json_object only guarantees valid JSON syntax, not any particular shape.
// The fix is an explicit example with the exact key names and types, not a
// looser schema on our side — the schema is the real contract this system
// anchors on-chain, so the model conforms to it, not the other way around.
const VALIDATION_SYSTEM_PROMPT = `You are the AI Validation Service for a national examination question bank.
Given a question's text, options, correct answer, explanation, and the teacher's suggested
difficulty/Bloom level, return ONLY a JSON object matching EXACTLY this shape (same keys,
same types — no renaming, no extra top-level keys, no markdown fences):

{
  "duplicatePct": 0,
  "similarQuestionIds": [],
  "grammarIssues": [{ "text": "the problematic text", "suggestion": "how to fix it" }],
  "biasFlags": [{ "category": "e.g. cultural, gender, regional", "detail": "why it's flagged" }],
  "difficultyPredicted": "EASY | MEDIUM | HARD",
  "bloomLevelPredicted": "REMEMBER | UNDERSTAND | APPLY | ANALYZE | EVALUATE | CREATE",
  "topicClassified": "short topic label",
  "estimatedSolvingSeconds": 60,
  "weightageSuggested": 0.5
}

Field notes: duplicatePct is 0-100 (no similar questions on hand here, so estimate against
common textbook patterns). similarQuestionIds is an empty array unless you're told about
specific existing questions. grammarIssues and biasFlags are empty arrays "[]" when there
are none — never a string like "None". weightageSuggested is 0-1. Be conservative: flag
anything ambiguous (including a question whose options don't actually answer what's asked)
rather than silently passing it.`;

export async function validateQuestion(payload: {
  text: string;
  options: { text: string; isCorrect: boolean }[];
  explanation: string;
  difficultySuggested: string;
  bloomLevelSuggested: string;
}): Promise<ValidationCallResult> {
  if (!env.ZG_COMPUTE_API_KEY) {
    throw new Error(
      "ZG_COMPUTE_API_KEY is not configured — create one at pc.0g.ai (Dashboard → API Keys) " +
        "with an 'inference' permission before calling validateQuestion().",
    );
  }

  // Trust mode is NEVER downgraded here — a 503 (no TeeML provider available)
  // propagates to the caller as a retryable failure, per knowledge_base.md §5 rule 1.
  const completion = await client.chat.completions.create(
    {
      model: env.ZG_COMPUTE_MODEL,
      messages: [
        { role: "system", content: VALIDATION_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(payload) },
      ],
      response_format: { type: "json_object" },
    },
    { headers: { "X-0G-Trust-Mode": env.ZG_COMPUTE_TRUST_MODE } },
  );

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("0G Compute returned an empty validation response");
  logger.info({ raw }, "0G Compute raw validation response (debug)");

  const report = aiValidationReportSchema.parse(JSON.parse(raw));
  const providerAddress =
    (completion as unknown as { provider?: { address?: string } }).provider?.address ?? null;

  logger.info(
    { model: env.ZG_COMPUTE_MODEL, trustMode: env.ZG_COMPUTE_TRUST_MODE, providerAddress },
    "0G Compute validation call complete",
  );

  return { report, modelName: env.ZG_COMPUTE_MODEL, providerAddress, trustMode: env.ZG_COMPUTE_TRUST_MODE };
}

/** GET /v1/models — used to confirm a model actually has a TeeML provider before relying on it. */
export async function listPrivacyCapableModels(): Promise<string[]> {
  const res = await fetch(`${env.ZG_COMPUTE_ROUTER_URL}/models`);
  if (!res.ok) throw new Error(`0G Compute /models failed: ${res.status}`);
  const body = (await res.json()) as { data: { name: string; verifiability?: string }[] };
  return body.data.filter((m) => m.verifiability === "TeeML").map((m) => m.name);
}
