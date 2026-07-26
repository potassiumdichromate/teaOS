import { useState } from "react";
import { api, ApiError } from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.js";

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

const inputCls = "w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm";

export default function EvaluationAIR() {
  const [paperId, setPaperId] = useState("");
  const [tieBreakRule, setTieBreakRule] = useState("earlier submission wins");
  const [status, setStatus] = useState<string | null>(null);
  const [rows, setRows] = useState<AIRRow[] | null>(null);

  async function onRunEvaluation() {
    setStatus(null);
    try {
      const { jobId } = await api<{ jobId: string }>("/admin/evaluation/run", { method: "POST", body: JSON.stringify({ paperId }) });
      setStatus(`Evaluation queued (job ${jobId}). If the paper isn't READY yet, it will fail — check the worker logs; this is the correct, honest behavior until Miden is wired.`);
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : String(err));
    }
  }

  async function onPublishAIR() {
    setStatus(null);
    try {
      const result = await api<{ count: number; resultListHash: string }>("/admin/air/publish", {
        method: "POST",
        body: JSON.stringify({ paperId, tieBreakRule }),
      });
      setStatus(`Published AIR for ${result.count} students.`);
      onLoadAIR();
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : String(err));
    }
  }

  async function onLoadAIR() {
    setRows(await api<AIRRow[]>(`/admin/air/${paperId}`));
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Evaluation & AIR</CardTitle>
          <CardDescription>Encrypted answers → official key → score → rank → anchor</CardDescription>
        </CardHeader>
        <div className="space-y-3">
          <input placeholder="Paper ID" value={paperId} onChange={(e) => setPaperId(e.target.value)} className={inputCls} />
          <Button className="w-full" disabled={!paperId} onClick={onRunEvaluation}>Run evaluation</Button>
          <input placeholder="Tie-break rule" value={tieBreakRule} onChange={(e) => setTieBreakRule(e.target.value)} className={inputCls} />
          <Button className="w-full" variant="accent" disabled={!paperId} onClick={onPublishAIR}>Publish AIR</Button>
          <Button className="w-full" variant="outline" disabled={!paperId} onClick={onLoadAIR}>Load AIR table</Button>
          {status && <p className="text-sm text-muted-foreground">{status}</p>}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AIR table</CardTitle>
          <CardDescription>Rank, percentile, marks breakdown</CardDescription>
        </CardHeader>
        {!rows && <p className="text-sm text-muted-foreground">Nothing loaded yet.</p>}
        {rows && rows.length === 0 && <p className="text-sm text-muted-foreground">No AIR published for this paper yet.</p>}
        {rows && rows.length > 0 && (
          <div className="space-y-1 text-sm">
            {rows.map((r) => (
              <div key={r.rank} className="flex justify-between border-b border-border py-1.5">
                <span>#{r.rank} {r.result.student.fullName} ({r.result.student.applicationId})</span>
                <span className="text-muted-foreground">
                  {r.result.rawScore} marks · {r.percentile.toFixed(1)}%ile
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
