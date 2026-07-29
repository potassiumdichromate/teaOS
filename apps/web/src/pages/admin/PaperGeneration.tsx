import { useEffect, useState } from "react";
import { FileStack } from "lucide-react";
import { api, ApiError } from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.js";
import { Field, Input, Select } from "@/components/ui/input.js";
import { EmptyState, ErrorState } from "@/components/ui/empty-state.js";
import { PageHeader } from "@/components/ui/page-header.js";
import { StatusBadge } from "@/components/ui/badge.js";
import { HashValue, Mono, explorerTxUrl } from "@/components/ui/mono.js";
import { KeyValueList } from "@/components/ui/table.js";
import { Stepper, type Step } from "@/components/ui/stepper.js";

interface BlueprintRow {
  id: string;
  title: string;
  publishedAt: string | null;
}
interface PaperDetail {
  id: string;
  status: string;
  storageRoot: string | null;
  masterPaperHash: string | null;
  chainTxHash: string | null;
  timelockRef: string | null;
  questionCount: number;
}

export default function PaperGeneration() {
  const [blueprints, setBlueprints] = useState<BlueprintRow[]>([]);
  const [blueprintId, setBlueprintId] = useState("");
  const [examStartAt, setExamStartAt] = useState("");
  const [examWindowCloseAt, setExamWindowCloseAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [paper, setPaper] = useState<PaperDetail | null>(null);
  const [polling, setPolling] = useState(false);
  const [network, setNetwork] = useState<string | null>(null);

  useEffect(() => {
    api<BlueprintRow[]>("/admin/blueprints").then((rows) =>
      setBlueprints(rows.filter((b) => b.publishedAt)),
    );
    api<{ network: string }>("/admin/system-health")
      .then((h) => setNetwork(h.network))
      .catch(() => setNetwork(null));
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

  const steps: Step[] = paper
    ? [
        {
          key: "select",
          label: "Questions selected",
          detail: `${paper.questionCount} accepted items drawn against the blueprint's allocations.`,
          state: paper.questionCount > 0 ? "done" : "active",
        },
        {
          key: "storage",
          label: "Encrypted into 0G Storage",
          detail: "The assembled paper is encrypted client-side of the storage layer; the root addresses the ciphertext.",
          state: paper.storageRoot ? "done" : "active",
        },
        {
          key: "anchor",
          label: "Anchored on 0G Chain",
          detail: "Master paper hash written to PaperRegistry.",
          state: paper.chainTxHash ? "done" : paper.storageRoot ? "active" : "pending",
        },
        {
          key: "timelock",
          label: "Content key sealed with drand/tlock",
          detail:
            "The decryption key is time-locked against drand's public randomness beacon — it cannot be unsealed early, including by us.",
          state: paper.timelockRef ? "done" : paper.chainTxHash ? "active" : "pending",
        },
        {
          key: "ready",
          label: "Paper READY",
          detail: "Centers can be authorized once the exam window opens.",
          state: paper.status === "READY" ? "done" : "pending",
        },
      ]
    : [];

  return (
    <>
      <PageHeader
        title="Paper generation"
        description="Blueprint → selection from the validated pool → assembly → encryption into 0G Storage → anchor on 0G Chain → drand/tlock seal. No PDF is produced at any stage; there is no artefact to leak."
      />

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Generate a master paper</CardTitle>
            <CardDescription>Only published blueprints can be used.</CardDescription>
          </CardHeader>
          <div className="space-y-4">
            <Field label="Blueprint">
              <Select value={blueprintId} onChange={(e) => setBlueprintId(e.target.value)}>
                <option value="">Select published blueprint</option>
                {blueprints.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Exam start" hint="When the time-locked key becomes unsealable.">
              <Input
                type="datetime-local"
                value={examStartAt}
                onChange={(e) => setExamStartAt(e.target.value)}
              />
            </Field>
            <Field label="Exam window close">
              <Input
                type="datetime-local"
                value={examWindowCloseAt}
                onChange={(e) => setExamWindowCloseAt(e.target.value)}
              />
            </Field>
            {error ? <ErrorState title="Generation failed" description={error} /> : null}
            <Button
              className="w-full"
              disabled={polling || !blueprintId || !examStartAt || !examWindowCloseAt}
              onClick={onGenerate}
            >
              {polling ? "Generating…" : "Generate paper"}
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader action={paper ? <StatusBadge status={paper.status} /> : undefined}>
            <CardTitle>Pipeline</CardTitle>
            <CardDescription>
              Polled from the real pipeline record — each row below is only marked done once the
              backing artefact actually exists.
            </CardDescription>
          </CardHeader>

          {!paper ? (
            <EmptyState
              icon={<FileStack className="h-4 w-4" />}
              title="Nothing generated yet"
              description="Pick a published blueprint and an exam window to run the pipeline."
            />
          ) : (
            <div className="space-y-5">
              <Stepper steps={steps} />
              <div className="border-t border-border pt-4">
                <KeyValueList
                  items={[
                    { label: "Paper ID", value: <HashValue value={paper.id} /> },
                    {
                      label: "Questions",
                      value: <Mono>{paper.questionCount}</Mono>,
                    },
                    {
                      label: "0G Storage root",
                      value: paper.storageRoot ? (
                        <HashValue value={paper.storageRoot} />
                      ) : (
                        <span className="text-xs text-muted-foreground">pending</span>
                      ),
                    },
                    {
                      label: "Master paper hash",
                      value: paper.masterPaperHash ? (
                        <HashValue value={paper.masterPaperHash} />
                      ) : (
                        <span className="text-xs text-muted-foreground">pending</span>
                      ),
                    },
                    {
                      label: "Chain anchor tx",
                      value: paper.chainTxHash ? (
                        <HashValue
                          value={paper.chainTxHash}
                          href={explorerTxUrl(paper.chainTxHash, network)}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">pending</span>
                      ),
                    },
                    {
                      label: "tlock timelock ref",
                      value: paper.timelockRef ? (
                        <HashValue value={paper.timelockRef} />
                      ) : (
                        <span className="text-xs text-muted-foreground">not available yet</span>
                      ),
                    },
                  ]}
                />
              </div>

              {paper.chainTxHash && !paper.timelockRef ? (
                <div className="rounded-md border border-warning/30 bg-warning/[0.07] px-4 py-3">
                  <p className="text-sm font-medium text-warning">Not releasable yet</p>
                  <p className="mt-1 text-xs leading-relaxed text-warning/80">
                    The paper is encrypted and anchored on 0G Chain, but sealing the content key via
                    drand/tlock hasn&apos;t succeeded yet — it cannot be marked READY until it does.
                    There is no operator override.
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
