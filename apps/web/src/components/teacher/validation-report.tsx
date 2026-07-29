import { AI_VALIDATION_THRESHOLDS } from "@nvei/shared";
import { CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge.js";
import { KeyValueList } from "@/components/ui/table.js";
import { Mono } from "@/components/ui/mono.js";
import { cn } from "@/lib/utils.js";

export interface AIValidationReport {
  id: string;
  questionId: string;
  duplicatePct: number;
  similarQuestionIds: string[];
  grammarIssues: { text: string; suggestion: string }[];
  biasFlags: { category: string; detail: string }[];
  difficultyPredicted: string;
  bloomLevelPredicted: string;
  topicClassified: string;
  estimatedSolvingSeconds: number;
  weightageSuggested: number;
  modelName: string;
  providerAddress: string;
  trustMode: string;
  attestationRef: string | null;
  passedThresholds: boolean;
  createdAt: string;
}

/** One threshold row: what the model measured vs. the real acceptance cutoff. */
function ThresholdRow({
  label,
  measured,
  limit,
  breached,
  detail,
}: {
  label: string;
  measured: string;
  limit: string;
  breached: boolean;
  detail?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-3 py-2",
        breached ? "border-danger/30 bg-danger/[0.06]" : "border-border",
      )}
    >
      {breached ? (
        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
      ) : (
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-foreground">{label}</span>
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {measured} <span className="text-muted-foreground/60">/ limit {limit}</span>
          </span>
        </div>
        {detail ? <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p> : null}
      </div>
    </div>
  );
}

/**
 * Full, real breakdown of an AIValidationReport — the actual reasons a
 * question was accepted or rejected, not just the pass/fail badge. Shared
 * between the just-submitted outcome view (SubmitQuestion.tsx) and the
 * per-item detail view (QuestionHistory.tsx) so the two never drift apart.
 */
export function ValidationReportDetail({ report }: { report: AIValidationReport }) {
  const duplicateBreached = report.duplicatePct > AI_VALIDATION_THRESHOLDS.maxDuplicatePct;
  const biasBreached = report.biasFlags.length > AI_VALIDATION_THRESHOLDS.maxBiasFlags;
  const grammarBreached = report.grammarIssues.length > AI_VALIDATION_THRESHOLDS.maxGrammarIssues;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <ThresholdRow
          label="Duplicate similarity"
          measured={`${report.duplicatePct}%`}
          limit={`${AI_VALIDATION_THRESHOLDS.maxDuplicatePct}%`}
          breached={duplicateBreached}
          detail={
            report.similarQuestionIds.length > 0
              ? `Closest match${report.similarQuestionIds.length === 1 ? "" : "es"}: ${report.similarQuestionIds.length} question(s) already in the bank.`
              : undefined
          }
        />
        <ThresholdRow
          label="Bias flags"
          measured={String(report.biasFlags.length)}
          limit={String(AI_VALIDATION_THRESHOLDS.maxBiasFlags)}
          breached={biasBreached}
        />
        <ThresholdRow
          label="Grammar issues"
          measured={String(report.grammarIssues.length)}
          limit={String(AI_VALIDATION_THRESHOLDS.maxGrammarIssues)}
          breached={grammarBreached}
        />
      </div>

      {report.biasFlags.length > 0 ? (
        <div>
          <p className="ui-label mb-1.5">Bias flags — what the model found</p>
          <ul className="space-y-1.5">
            {report.biasFlags.map((flag, i) => (
              <li key={i} className="rounded-md border border-border bg-background/40 px-3 py-2 text-xs">
                <span className="font-medium text-foreground">{flag.category}</span>
                <span className="text-muted-foreground"> — {flag.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.grammarIssues.length > 0 ? (
        <div>
          <p className="ui-label mb-1.5">Grammar issues — what the model found</p>
          <ul className="space-y-1.5">
            {report.grammarIssues.map((issue, i) => (
              <li key={i} className="rounded-md border border-border bg-background/40 px-3 py-2 text-xs">
                <span className="text-foreground">&ldquo;{issue.text}&rdquo;</span>
                <span className="text-muted-foreground"> → {issue.suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <KeyValueList
        className="border-t border-border pt-3"
        items={[
          { label: "Predicted difficulty", value: report.difficultyPredicted },
          { label: "Predicted Bloom level", value: report.bloomLevelPredicted },
          { label: "Topic classified", value: report.topicClassified },
          { label: "Estimated solving time", value: `${report.estimatedSolvingSeconds}s` },
          { label: "Suggested weightage", value: report.weightageSuggested },
          { label: "Model", value: <Mono>{report.modelName}</Mono> },
          {
            label: "Trust mode",
            value: (
              <Badge tone={report.trustMode === "private" ? "success" : report.trustMode === "verified" ? "primary" : "neutral"}>
                {report.trustMode}
              </Badge>
            ),
          },
          { label: "Attestation ref", value: report.attestationRef ? <Mono>{report.attestationRef}</Mono> : "—" },
        ]}
      />
    </div>
  );
}
