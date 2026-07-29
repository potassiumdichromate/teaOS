import { useState } from "react";
import { Trophy } from "lucide-react";
import { api, ApiError } from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.js";
import { Field, Input } from "@/components/ui/input.js";
import { PageHeader } from "@/components/ui/page-header.js";
import { HashValue } from "@/components/ui/mono.js";
import { DataTable, type Column } from "@/components/ui/table.js";

interface AIRRow {
  rank: number;
  percentile: number;
  resultListHash: string;
  result: {
    rawScore: number;
    correctCount: number;
    incorrectCount: number;
    unattemptedCount: number;
    student: { applicationId: string; fullName: string };
  };
}

const COLUMNS: Column<AIRRow>[] = [
  {
    key: "rank",
    header: "Rank",
    cell: (r) => <span className="font-mono tabular-nums text-foreground">#{r.rank}</span>,
    width: "w-20",
  },
  {
    key: "candidate",
    header: "Candidate",
    cell: (r) => (
      <span>
        <span className="block text-foreground">{r.result.student.fullName}</span>
        <span className="block font-mono text-2xs text-muted-foreground">
          {r.result.student.applicationId}
        </span>
      </span>
    ),
  },
  {
    key: "breakdown",
    header: "Correct / incorrect / skipped",
    align: "right",
    cell: (r) => (
      <span className="whitespace-nowrap font-mono text-xs tabular-nums">
        <span className="text-success">{r.result.correctCount}</span>
        <span className="text-muted-foreground"> / </span>
        <span className="text-danger">{r.result.incorrectCount}</span>
        <span className="text-muted-foreground"> / {r.result.unattemptedCount}</span>
      </span>
    ),
    hideOnMobile: true,
  },
  {
    key: "score",
    header: "Marks",
    align: "right",
    cell: (r) => (
      <span className="font-mono tabular-nums text-foreground">{r.result.rawScore}</span>
    ),
    width: "w-24",
  },
  {
    key: "percentile",
    header: "Percentile",
    align: "right",
    cell: (r) => (
      <span className="font-mono tabular-nums text-muted-foreground">
        {r.percentile.toFixed(1)}
      </span>
    ),
    width: "w-28",
  },
];

export default function EvaluationAIR() {
  const [paperId, setPaperId] = useState("");
  const [tieBreakRule, setTieBreakRule] = useState("earlier submission wins");
  const [status, setStatus] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"info" | "danger">("info");
  const [rows, setRows] = useState<AIRRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  function report(message: string, tone: "info" | "danger" = "info") {
    setStatus(message);
    setStatusTone(tone);
  }

  async function onRunEvaluation() {
    setStatus(null);
    setBusy(true);
    try {
      const { jobId } = await api<{ jobId: string }>("/admin/evaluation/run", {
        method: "POST",
        body: JSON.stringify({ paperId }),
      });
      report(
        `Evaluation queued (job ${jobId}). If the paper isn't READY — its drand/tlock timelock not yet unsealable — the job fails rather than scoring against a key it cannot legitimately hold. Check the worker logs.`,
      );
    } catch (err) {
      report(err instanceof ApiError ? err.message : String(err), "danger");
    } finally {
      setBusy(false);
    }
  }

  async function onPublishAIR() {
    setStatus(null);
    setBusy(true);
    try {
      const result = await api<{ count: number; resultListHash: string }>("/admin/air/publish", {
        method: "POST",
        body: JSON.stringify({ paperId, tieBreakRule }),
      });
      report(`Published the All India Rank list for ${result.count} candidates.`);
      await onLoadAIR();
    } catch (err) {
      report(err instanceof ApiError ? err.message : String(err), "danger");
    } finally {
      setBusy(false);
    }
  }

  async function onLoadAIR() {
    try {
      setRows(await api<AIRRow[]>(`/admin/air/${paperId}`));
    } catch (err) {
      report(err instanceof ApiError ? err.message : String(err), "danger");
    }
  }

  const resultListHash = rows?.[0]?.resultListHash ?? null;

  return (
    <>
      <PageHeader
        title="Evaluation & AIR"
        description="Encrypted answer sets → the official key, released only once the timelock allows → scoring → ranking → an anchored result list a candidate can verify for themselves."
      />

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Run</CardTitle>
            <CardDescription>Operates on one paper at a time.</CardDescription>
          </CardHeader>
          <div className="space-y-4">
            <Field label="Paper ID">
              <Input
                placeholder="Paste a paper ID"
                value={paperId}
                onChange={(e) => setPaperId(e.target.value)}
                className="font-mono text-xs"
              />
            </Field>
            <Button className="w-full" disabled={!paperId || busy} onClick={onRunEvaluation}>
              Run evaluation
            </Button>

            <div className="border-t border-border pt-4">
              <Field label="Tie-break rule">
                <Input value={tieBreakRule} onChange={(e) => setTieBreakRule(e.target.value)} />
              </Field>
              <div className="mt-3 space-y-2">
                <Button
                  className="w-full"
                  variant="secondary"
                  disabled={!paperId || busy}
                  onClick={onPublishAIR}
                >
                  Publish AIR
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  disabled={!paperId || busy}
                  onClick={onLoadAIR}
                >
                  Load AIR table
                </Button>
              </div>
            </div>

            {status ? (
              <p
                className={
                  statusTone === "danger"
                    ? "rounded-md border border-danger/30 bg-danger/[0.07] px-3 py-2 text-xs leading-relaxed text-danger"
                    : "rounded-md border border-border bg-background/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground"
                }
              >
                {status}
              </p>
            ) : null}
          </div>
        </Card>

        <Card flush>
          <CardHeader
            className="mb-0 px-5 pt-5"
            action={
              resultListHash ? (
                <span className="text-right">
                  <span className="ui-label block">Result list hash</span>
                  <HashValue value={resultListHash} />
                </span>
              ) : undefined
            }
          >
            <CardTitle>All India Rank</CardTitle>
            <CardDescription>Rank, percentile and the marks breakdown behind it.</CardDescription>
          </CardHeader>
          <div className="mt-4">
            {rows === null ? (
              <div className="px-5 pb-6">
                <p className="text-sm text-muted-foreground">
                  Enter a paper ID and load its rank list.
                </p>
              </div>
            ) : (
              <DataTable
                columns={COLUMNS}
                rows={rows}
                rowKey={(r) => String(r.rank)}
                emptyIcon={<Trophy className="h-4 w-4" />}
                emptyTitle="No AIR published for this paper yet"
                emptyDescription="Run the evaluation first, then publish the rank list."
              />
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
