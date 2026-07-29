import { useEffect, useState } from "react";
import { Cpu, ListChecks, ScrollText, ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api.js";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.js";
import { EmptyState, ErrorState } from "@/components/ui/empty-state.js";
import { Field, Input } from "@/components/ui/input.js";
import { LoadingLine } from "@/components/ui/loading.js";
import { HashValue, Mono } from "@/components/ui/mono.js";
import { PageHeader } from "@/components/ui/page-header.js";
import { StatGrid, StatTile } from "@/components/ui/stat.js";
import { DataTable, KeyValueList, type Column } from "@/components/ui/table.js";

interface QueueJobCounts {
  active: number;
  waiting: number;
  completed: number;
  failed: number;
}
interface QueueResponse {
  jobCounts: QueueJobCounts;
  pending: { id: string; subjectId: string; chapterId: string; updatedAt: string }[];
}
interface AuditLogRow {
  id: string;
  action: string;
  questionId: string | null;
  metadata: unknown;
  createdAt: string;
}
interface ValidationReport {
  id: string;
  questionId: string;
  duplicatePct: number;
  similarQuestionIds: string[];
  grammarIssues: unknown[];
  biasFlags: unknown[];
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

export default function ComputeDashboard() {
  const [queue, setQueue] = useState<QueueResponse | null>(null);
  const [auditLog, setAuditLog] = useState<AuditLogRow[] | null>(null);
  const [models, setModels] = useState<string[] | null>(null);

  const [questionId, setQuestionId] = useState("");
  const [reportId, setReportId] = useState("");
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);

  const refreshQueue = () => api<QueueResponse>("/compute/queue").then(setQueue);
  useEffect(() => {
    refreshQueue();
    api<AuditLogRow[]>("/compute/audit-log?take=25").then(setAuditLog);
    api<{ models: string[] }>("/compute/privacy-models")
      .then((r) => setModels(r.models))
      .catch(() => setModels([]));
  }, []);

  async function lookupByQuestion(id: string) {
    if (!id) return;
    setLookupError(null);
    setLookupBusy(true);
    setQuestionId(id);
    try {
      // Real endpoint, same one the Teacher/Admin question-detail view uses —
      // returns the full AIValidationReport for a given question, no separate
      // report-id lookup step needed when you already know the question.
      setReport(await api<ValidationReport>(`/validation/reports/${id}`));
    } catch (err) {
      setReport(null);
      setLookupError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setLookupBusy(false);
    }
  }

  async function lookupByReport(id: string) {
    if (!id) return;
    setLookupError(null);
    setLookupBusy(true);
    setReportId(id);
    try {
      // GET /compute/attestations/:reportId — a subset of the same report,
      // keyed by the report's own id rather than the question's.
      const attestation = await api<
        Pick<
          ValidationReport,
          "id" | "questionId" | "modelName" | "providerAddress" | "trustMode" | "attestationRef" | "passedThresholds" | "createdAt"
        >
      >(`/compute/attestations/${id}`);
      setReport((prev) => ({
        ...(prev ?? {
          duplicatePct: 0,
          similarQuestionIds: [],
          grammarIssues: [],
          biasFlags: [],
          difficultyPredicted: "—",
          bloomLevelPredicted: "—",
          topicClassified: "—",
          estimatedSolvingSeconds: 0,
          weightageSuggested: 0,
        }),
        ...attestation,
      }));
    } catch (err) {
      setReport(null);
      setLookupError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setLookupBusy(false);
    }
  }

  const auditColumns: Column<AuditLogRow>[] = [
    {
      key: "action",
      header: "Action",
      cell: (a) => <span className="font-mono text-xs text-foreground">{a.action}</span>,
    },
    {
      key: "question",
      header: "Question",
      cell: (a) =>
        a.questionId ? <HashValue value={a.questionId} head={10} tail={4} /> : <span className="text-muted-foreground">—</span>,
    },
    {
      key: "at",
      header: "Recorded",
      align: "right",
      cell: (a) => (
        <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
          {new Date(a.createdAt).toLocaleString()}
        </span>
      ),
      hideOnMobile: true,
    },
  ];

  const pendingColumns: Column<QueueResponse["pending"][number]>[] = [
    {
      key: "id",
      header: "Question",
      cell: (q) => <HashValue value={q.id} head={10} tail={4} />,
    },
    {
      key: "since",
      header: "Waiting since",
      align: "right",
      cell: (q) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {new Date(q.updatedAt).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Confidential compute"
        description="Question validation runs inside a real hardware TEE (0G Compute, private trust mode) — duplicate/grammar/bias/difficulty screening with independent attestation, never a plain API call to an unattested model."
      />

      <StatGrid columns={4}>
        <StatTile label="Active" value={queue?.jobCounts.active ?? 0} loading={!queue} />
        <StatTile label="Waiting" value={queue?.jobCounts.waiting ?? 0} loading={!queue} />
        <StatTile label="Completed" value={queue?.jobCounts.completed ?? 0} tone="success" loading={!queue} />
        <StatTile label="Failed" value={queue?.jobCounts.failed ?? 0} tone={queue && queue.jobCounts.failed > 0 ? "danger" : "default"} loading={!queue} />
      </StatGrid>

      <div className="mt-5 grid gap-5 lg:grid-cols-[360px_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Look up a validation report</CardTitle>
              <CardDescription>By question, or directly by the report's own id.</CardDescription>
            </CardHeader>
            <div className="space-y-3">
              <Field label="Question ID">
                <div className="flex gap-2">
                  <Input
                    placeholder="Paste a question id"
                    value={questionId}
                    onChange={(e) => setQuestionId(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <Button size="default" disabled={!questionId || lookupBusy} onClick={() => lookupByQuestion(questionId)}>
                    Look up
                  </Button>
                </div>
              </Field>
              <Field label="Report ID" hint="From a previously-looked-up report's own id.">
                <div className="flex gap-2">
                  <Input
                    placeholder="Paste a report id"
                    value={reportId}
                    onChange={(e) => setReportId(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <Button
                    size="default"
                    variant="outline"
                    disabled={!reportId || lookupBusy}
                    onClick={() => lookupByReport(reportId)}
                  >
                    Verify
                  </Button>
                </div>
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>TeeML-capable models</CardTitle>
              <CardDescription>Live from 0G Compute's own model catalog.</CardDescription>
            </CardHeader>
            {models === null ? (
              <LoadingLine label="Checking 0G Compute" />
            ) : models.length === 0 ? (
              <EmptyState icon={<Cpu className="h-4 w-4" />} title="No TeeML providers reported right now" compact />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {models.map((m) => (
                  <Badge key={m} tone="primary">
                    {m}
                  </Badge>
                ))}
              </div>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Attestation detail</CardTitle>
            <CardDescription>Never the question's own content — only the validation metadata and the trust proof behind it.</CardDescription>
          </CardHeader>
          {lookupBusy ? (
            <LoadingLine label="Fetching" />
          ) : lookupError ? (
            <ErrorState description={lookupError} />
          ) : !report ? (
            <EmptyState
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Nothing selected"
              description="Look up a question or report id, or click a row below."
            />
          ) : (
            <KeyValueList
              items={[
                { label: "Report ID", value: <HashValue value={report.id} /> },
                { label: "Question", value: <HashValue value={report.questionId} /> },
                { label: "Model", value: <Mono>{report.modelName}</Mono> },
                { label: "Provider", value: <HashValue value={report.providerAddress} /> },
                {
                  label: "Trust mode",
                  value: (
                    <Badge tone={report.trustMode === "private" ? "success" : report.trustMode === "verified" ? "primary" : "neutral"}>
                      {report.trustMode}
                    </Badge>
                  ),
                },
                {
                  label: "Attestation ref",
                  value: report.attestationRef ? <HashValue value={report.attestationRef} /> : "—",
                },
                {
                  label: "Passed thresholds",
                  value: <Badge tone={report.passedThresholds ? "success" : "danger"}>{report.passedThresholds ? "Passed" : "Failed"}</Badge>,
                },
                { label: "Duplicate %", value: <Mono>{report.duplicatePct}%</Mono> },
                { label: "Difficulty predicted", value: report.difficultyPredicted },
                { label: "Topic classified", value: report.topicClassified },
                { label: "Recorded", value: new Date(report.createdAt).toLocaleString() },
              ]}
            />
          )}
        </Card>
      </div>

      <Card flush className="mt-5">
        <CardHeader className="px-5 pt-5">
          <CardTitle>Pending validation queue</CardTitle>
          <CardDescription>Questions currently inside the TEE validation pipeline.</CardDescription>
        </CardHeader>
        <DataTable
          columns={pendingColumns}
          rows={queue?.pending}
          loading={!queue}
          rowKey={(q) => q.id}
          onRowClick={(q) => lookupByQuestion(q.id)}
          emptyIcon={<ListChecks className="h-4 w-4" />}
          emptyTitle="Nothing waiting"
          emptyDescription="Every submitted question has either been validated or hasn't been submitted yet."
        />
      </Card>

      <Card flush className="mt-5">
        <CardHeader className="px-5 pt-5">
          <CardTitle>AI validation audit trail</CardTitle>
          <CardDescription>Every AI_VALIDATION entry from the append-only audit log — click a row to load its report.</CardDescription>
        </CardHeader>
        <DataTable
          columns={auditColumns}
          rows={auditLog}
          rowKey={(a) => a.id}
          onRowClick={(a) => a.questionId && lookupByQuestion(a.questionId)}
          emptyIcon={<ScrollText className="h-4 w-4" />}
          emptyTitle="No validation activity yet"
        />
      </Card>
    </>
  );
}
