import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.js";

interface BlueprintRow { id: string; title: string; publishedAt: string | null }
interface PaperDetail {
  id: string;
  status: string;
  storageRoot: string | null;
  masterPaperHash: string | null;
  chainTxHash: string | null;
  timelockRef: string | null;
  questionCount: number;
}

const inputCls = "w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm";

export default function PaperGeneration() {
  const [blueprints, setBlueprints] = useState<BlueprintRow[]>([]);
  const [blueprintId, setBlueprintId] = useState("");
  const [examStartAt, setExamStartAt] = useState("");
  const [examWindowCloseAt, setExamWindowCloseAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [paper, setPaper] = useState<PaperDetail | null>(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    api<BlueprintRow[]>("/admin/blueprints").then((rows) => setBlueprints(rows.filter((b) => b.publishedAt)));
  }, []);

  async function onGenerate() {
    setError(null);
    try {
      const { paperId } = await api<{ paperId: string }>("/admin/papers/generate", {
        method: "POST",
        body: JSON.stringify({
          blueprintId,
          examStartAt: new Date(examStartAt).toISOString(),
          examWindowCloseAt: new Date(examWindowCloseAt).toISOString(),
        }),
      });
      setPolling(true);
      const started = Date.now();
      while (Date.now() - started < 180_000) {
        const detail = await api<PaperDetail>(`/admin/papers/${paperId}/pipeline`);
        setPaper(detail);
        if (detail.status === "READY") break;
        await new Promise((r) => setTimeout(r, 3000));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setPolling(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Generate master paper</CardTitle>
          <CardDescription>Blueprint → TEE-validated pool → selection → encrypt → anchor → drand/tlock timelock</CardDescription>
        </CardHeader>
        <div className="space-y-3">
          <select value={blueprintId} onChange={(e) => setBlueprintId(e.target.value)} className={inputCls}>
            <option value="">Select published blueprint</option>
            {blueprints.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
          <div>
            <label className="text-xs text-muted-foreground">Exam start</label>
            <input type="datetime-local" value={examStartAt} onChange={(e) => setExamStartAt(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Exam window close</label>
            <input type="datetime-local" value={examWindowCloseAt} onChange={(e) => setExamWindowCloseAt(e.target.value)} className={inputCls} />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button className="w-full" disabled={polling || !blueprintId || !examStartAt || !examWindowCloseAt} onClick={onGenerate}>
            {polling ? "Generating…" : "Generate paper"}
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pipeline</CardTitle>
          <CardDescription>No PDF exists at any stage</CardDescription>
        </CardHeader>
        {!paper && <p className="text-sm text-muted-foreground">Nothing generated yet.</p>}
        {paper && (
          <div className="space-y-2 text-sm">
            <Row label="Status" value={paper.status} />
            <Row label="Questions" value={String(paper.questionCount)} />
            <Row label="Storage root" value={paper.storageRoot ?? "pending"} />
            <Row label="Master paper hash" value={paper.masterPaperHash ?? "pending"} />
            <Row label="Chain anchor tx" value={paper.chainTxHash ?? "pending"} />
            <Row label="tlock timelock ref" value={paper.timelockRef ?? "not available yet"} />
            {paper.chainTxHash && !paper.timelockRef && (
              <p className="mt-2 text-xs text-warning">
                Encrypted and anchored on 0G Chain, but sealing the content key via drand/tlock hasn&apos;t
                succeeded yet — the paper cannot be marked READY until it does.
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right text-foreground" title={value}>{value}</span>
    </div>
  );
}
