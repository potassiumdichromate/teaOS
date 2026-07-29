import { useEffect, useState } from "react";
import { AI_VALIDATION_THRESHOLDS, Difficulty, BloomLevel } from "@nvei/shared";
import { api, ApiError } from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.js";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input.js";
import { ErrorState } from "@/components/ui/empty-state.js";
import { PageHeader } from "@/components/ui/page-header.js";
import { StatusBadge } from "@/components/ui/badge.js";
import { Stepper, type Step, type StepState } from "@/components/ui/stepper.js";
import { Toast, type ToastData } from "@/components/ui/toast.js";
import { ValidationReportDetail, type AIValidationReport } from "@/components/teacher/validation-report.js";
import { cn } from "@/lib/utils.js";

interface Chapter {
  id: string;
  name: string;
}
interface Subject {
  id: string;
  name: string;
  chapters: Chapter[];
}
interface Question {
  id: string;
  status: string;
}

type Stage = "idle" | "creating" | "submitting" | "pipeline" | "done" | "error";

function rejectionSummary(report: AIValidationReport): string {
  const reasons: string[] = [];
  if (report.duplicatePct > AI_VALIDATION_THRESHOLDS.maxDuplicatePct) {
    reasons.push(`${report.duplicatePct}% duplicate (limit ${AI_VALIDATION_THRESHOLDS.maxDuplicatePct}%)`);
  }
  if (report.biasFlags.length > AI_VALIDATION_THRESHOLDS.maxBiasFlags) {
    reasons.push(`${report.biasFlags.length} bias flag${report.biasFlags.length === 1 ? "" : "s"}`);
  }
  if (report.grammarIssues.length > AI_VALIDATION_THRESHOLDS.maxGrammarIssues) {
    reasons.push(
      `${report.grammarIssues.length} grammar issues (limit ${AI_VALIDATION_THRESHOLDS.maxGrammarIssues})`,
    );
  }
  return reasons.length > 0 ? reasons.join(", ") : "a validation threshold was breached";
}

export default function SubmitQuestion() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [text, setText] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [difficulty, setDifficulty] = useState<(typeof Difficulty)[number]>("MEDIUM");
  const [bloom, setBloom] = useState<(typeof BloomLevel)[number]>("UNDERSTAND");
  const [stage, setStage] = useState<Stage>("idle");
  const [status, setStatus] = useState<string | null>(null);
  const [report, setReport] = useState<AIValidationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

  useEffect(() => {
    api<Subject[]>("/teacher/subjects")
      .then(setSubjects)
      .catch((e) => setError(String(e)));
  }, []);

  const selectedSubject = subjects.find((s) => s.id === subjectId);

  // Wipes the form once a submission actually reaches a final state — the
  // pipeline panel on the right still shows that final ACCEPTED/REJECTED
  // outcome (stage/status are left as "done", not reset), but the fields on
  // the left go back to blank so the same item can't be re-submitted by
  // accident, and the teacher is dropped straight into authoring the next one.
  function resetForm() {
    setSubjectId("");
    setChapterId("");
    setText("");
    setOptions(["", "", "", ""]);
    setCorrectIndex(0);
    setExplanation("");
    setDifficulty("MEDIUM");
    setBloom("UNDERSTAND");
  }

  async function pollStatus(questionId: string) {
    setStage("pipeline");
    const started = Date.now();
    while (Date.now() - started < 120_000) {
      const res = await api<{ status: string; aiReport: AIValidationReport | null }>(
        `/teacher/questions/${questionId}/status`,
      );
      setStatus(res.status);
      if (res.status === "ACCEPTED" || res.status === "REJECTED") {
        setStage("done");
        setReport(res.aiReport);
        if (res.status === "ACCEPTED") {
          setToast({
            tone: "success",
            title: "Submitted successfully",
            description: "Accepted, encrypted, and anchored on 0G Chain. Ready for the next item.",
          });
        } else {
          setToast({
            tone: "warning",
            title: "Validation didn't pass",
            description: res.aiReport
              ? `Rejected — ${rejectionSummary(res.aiReport)}. Full breakdown below.`
              : "See the report below for exactly which threshold was breached.",
          });
        }
        resetForm();
        return;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  async function onSubmit() {
    setError(null);
    setReport(null);
    try {
      setStage("creating");
      const question = await api<Question>("/teacher/questions", {
        method: "POST",
        body: JSON.stringify({
          subjectId,
          chapterId,
          text,
          options: options.map((o, i) => ({ text: o, isCorrect: i === correctIndex })),
          explanation,
          difficultySuggested: difficulty,
          bloomLevelSuggested: bloom,
          images: [],
        }),
      });
      setStage("submitting");
      await api(`/teacher/questions/${question.id}/submit`, { method: "POST" });
      await pollStatus(question.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
      setStage("error");
    }
  }

  const busy = stage === "creating" || stage === "submitting" || stage === "pipeline";

  // Step states are derived from the same `stage`/`status` the original
  // implementation tracked — no new state, just a clearer rendering of it.
  const steps: Step[] = [
    {
      key: "DRAFT",
      label: "Draft created",
      detail: "Written to the question bank, not yet visible to anyone else.",
      state: (stage === "idle" || stage === "error"
        ? stage === "error"
          ? "failed"
          : "pending"
        : "done") as StepState,
    },
    {
      key: "SUBMITTED",
      label: "Submitted for validation",
      detail: "Queued onto the confidential-compute pipeline.",
      state:
        stage === "submitting"
          ? "active"
          : stage === "pipeline" || stage === "done"
            ? "done"
            : "pending",
    },
    {
      key: "VALIDATING",
      label: "Validating",
      detail:
        "Hardware-attested AI validation (0G Compute, private trust mode): duplicate similarity, bias, grammar, topic and difficulty.",
      state:
        stage === "pipeline" ? "active" : stage === "done" ? "done" : ("pending" as StepState),
    },
    {
      key: "OUTCOME",
      label: status === "REJECTED" ? "Rejected" : "Accepted, encrypted and anchored",
      detail:
        status === "REJECTED"
          ? report
            ? `Rejected — ${rejectionSummary(report)}. Full breakdown below.`
            : "A validation threshold was breached."
          : "Encrypted into 0G Storage, hash anchored to QuestionRegistry on 0G Chain.",
      state:
        stage === "done"
          ? status === "REJECTED"
            ? "failed"
            : "done"
          : ("pending" as StepState),
    },
  ];

  return (
    <>
      <PageHeader
        title="Submit a question"
        description="Submitting hands the item to the confidential validation pipeline. You can't edit it afterwards — the point is that nobody can, including us."
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Item</CardTitle>
            <CardDescription>
              Four options, exactly one correct. Difficulty and Bloom level here are your
              suggestions — the accepted values are the AI-predicted ones.
            </CardDescription>
          </CardHeader>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Subject">
                <Select
                  value={subjectId}
                  onChange={(e) => {
                    setSubjectId(e.target.value);
                    setChapterId("");
                  }}
                >
                  <option value="">Select subject</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Chapter">
                <Select
                  value={chapterId}
                  onChange={(e) => setChapterId(e.target.value)}
                  disabled={!selectedSubject}
                >
                  <option value="">Select chapter</option>
                  {selectedSubject?.chapters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Question text">
              <Textarea
                placeholder="State the question exactly as a candidate will see it…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
              />
            </Field>

            <div className="space-y-2">
              <Label>Options — select the correct one</Label>
              {options.map((opt, i) => (
                <label
                  key={i}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors",
                    correctIndex === i
                      ? "border-success/50 bg-success/[0.07]"
                      : "border-border hover:border-border-strong",
                  )}
                >
                  <input
                    type="radio"
                    name="correct"
                    checked={correctIndex === i}
                    onChange={() => setCorrectIndex(i)}
                  />
                  <span className="w-4 shrink-0 font-mono text-2xs text-muted-foreground">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <input
                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                    value={opt}
                    onChange={(e) =>
                      setOptions(options.map((o, j) => (j === i ? e.target.value : o)))
                    }
                    className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                  />
                </label>
              ))}
            </div>

            <Field label="Explanation">
              <Textarea
                placeholder="Why the correct option is correct."
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                rows={2}
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Suggested difficulty">
                <Select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
                >
                  {Difficulty.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Suggested Bloom level">
                <Select value={bloom} onChange={(e) => setBloom(e.target.value as typeof bloom)}>
                  {BloomLevel.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {error ? <ErrorState title="Submission failed" description={error} /> : null}

            <Button
              onClick={onSubmit}
              disabled={busy || !subjectId || !chapterId || !text}
              className="w-full"
            >
              {busy ? "Working…" : "Submit for validation"}
            </Button>
          </div>
        </Card>

        <Card className="h-fit lg:sticky lg:top-6">
          <CardHeader
            action={status ? <StatusBadge status={status} /> : undefined}
          >
            <CardTitle>Validation pipeline</CardTitle>
            <CardDescription>Live, polled from the API — no simulated progress.</CardDescription>
          </CardHeader>
          <Stepper steps={steps} />
          {stage === "done" && report ? (
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                Final status <span className="text-foreground">{status}</span> — full breakdown from
                the confidential-compute validation pass, not just the badge.
              </p>
              <ValidationReportDetail report={report} />
            </div>
          ) : stage === "done" ? (
            <p className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
              Final status <span className="text-foreground">{status}</span>.
            </p>
          ) : null}
        </Card>
      </div>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
