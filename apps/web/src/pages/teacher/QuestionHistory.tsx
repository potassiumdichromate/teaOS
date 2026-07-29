import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileQuestion, ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.js";
import { StatusBadge } from "@/components/ui/badge.js";
import { DataTable, type Column } from "@/components/ui/table.js";
import { HashValue } from "@/components/ui/mono.js";
import { PageHeader } from "@/components/ui/page-header.js";
import { EmptyState, ErrorState } from "@/components/ui/empty-state.js";
import { LoadingLine } from "@/components/ui/loading.js";
import { ValidationReportDetail, type AIValidationReport } from "@/components/teacher/validation-report.js";

interface QuestionRow {
  id: string;
  status: string;
  createdAt: string;
  aiReport?: { duplicatePct: number; topicClassified: string } | null;
}

interface QuestionDetail {
  id: string;
  status: string;
  aiReport: AIValidationReport | null;
}

const COLUMNS: Column<QuestionRow>[] = [
  {
    key: "id",
    header: "Question ID",
    cell: (q) => <HashValue value={q.id} head={8} tail={6} />,
    width: "w-52",
  },
  {
    key: "created",
    header: "Submitted",
    cell: (q) => (
      <span className="whitespace-nowrap text-muted-foreground">
        {new Date(q.createdAt).toLocaleString()}
      </span>
    ),
    hideOnMobile: true,
  },
  {
    key: "topic",
    header: "Classified topic",
    cell: (q) =>
      q.aiReport ? (
        <span className="text-foreground">{q.aiReport.topicClassified}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
    hideOnMobile: true,
  },
  {
    key: "duplicate",
    header: "Duplicate",
    align: "right",
    cell: (q) =>
      q.aiReport ? (
        <span
          className={
            q.aiReport.duplicatePct >= 35
              ? "font-mono tabular-nums text-danger"
              : "font-mono tabular-nums text-muted-foreground"
          }
        >
          {q.aiReport.duplicatePct}%
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
    width: "w-28",
  },
  {
    key: "status",
    header: "Status",
    align: "right",
    cell: (q) => <StatusBadge status={q.status} />,
    width: "w-36",
  },
];

export default function QuestionHistory() {
  const [questions, setQuestions] = useState<QuestionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<QuestionDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    api<QuestionRow[]>("/teacher/questions")
      .then(setQuestions)
      .catch((e) => setError(String(e)));
  }, []);

  async function selectQuestion(id: string) {
    setSelectedId(id);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      // The real full detail — the same AIValidationReport shape SubmitQuestion.tsx
      // shows right after submission, not just the two summary columns in this table.
      setDetail(await api<QuestionDetail>(`/teacher/questions/${id}`));
    } catch (err) {
      setDetailError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setDetailLoading(false);
    }
  }

  if (error) return <ErrorState title="Couldn't load your questions" description={error} />;

  return (
    <>
      <PageHeader
        title="Question history"
        description="Every item you've authored. Click one to see the full validation breakdown — every reason it was accepted or rejected, not just the badge."
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
        <Card flush>
          <DataTable
            columns={COLUMNS}
            rows={questions}
            rowKey={(q) => q.id}
            onRowClick={(q) => selectQuestion(q.id)}
            emptyIcon={<FileQuestion className="h-4 w-4" />}
            emptyTitle="No questions submitted yet"
            emptyDescription="Items you submit will appear here with their validation outcome."
            emptyAction={
              <Link to="/teacher/submit">
                <Button size="sm">Submit your first question</Button>
              </Link>
            }
          />
        </Card>

        <Card className="h-fit lg:sticky lg:top-6">
          <CardHeader>
            <CardTitle>Validation report</CardTitle>
            <CardDescription>
              {selectedId ? <HashValue value={selectedId} /> : "Select a question to inspect it."}
            </CardDescription>
          </CardHeader>
          {!selectedId ? (
            <EmptyState
              icon={<ShieldCheck className="h-4 w-4" />}
              title="Nothing selected"
              description="Click any row in the table to see exactly why it was accepted or rejected."
            />
          ) : detailLoading ? (
            <LoadingLine label="Loading report" />
          ) : detailError ? (
            <ErrorState description={detailError} />
          ) : detail?.aiReport ? (
            <ValidationReportDetail report={detail.aiReport} />
          ) : (
            <EmptyState
              icon={<ShieldCheck className="h-4 w-4" />}
              title="No report yet"
              description="This question hasn't finished (or hasn't started) confidential-compute validation."
              compact
            />
          )}
        </Card>
      </div>
    </>
  );
}
