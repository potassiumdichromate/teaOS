import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, FileText, ShieldCheck, XCircle } from "lucide-react";
import { api } from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.js";
import { ErrorState } from "@/components/ui/empty-state.js";
import { PageHeader } from "@/components/ui/page-header.js";
import { StatGrid, StatTile, type StatTone } from "@/components/ui/stat.js";

interface DashboardData {
  fullName: string;
  submissionCounts: Record<string, number>;
}

const STATUSES: { key: string; label: string; hint: string; tone: StatTone }[] = [
  { key: "DRAFT", label: "Draft", hint: "Not yet submitted", tone: "default" },
  { key: "SUBMITTED", label: "Submitted", hint: "Queued for validation", tone: "default" },
  { key: "VALIDATING", label: "Validating", hint: "Running in 0G Compute", tone: "warning" },
  { key: "ACCEPTED", label: "Accepted", hint: "Anchored, in the bank", tone: "success" },
  { key: "REJECTED", label: "Rejected", hint: "Failed a threshold", tone: "danger" },
];

const PIPELINE = [
  {
    icon: FileText,
    title: "Authoring",
    body: "You write the item, its options, the correct answer and an explanation. Nothing leaves your account yet.",
  },
  {
    icon: ShieldCheck,
    title: "Confidential AI validation",
    body: "On submit the item is screened by hardware-attested AI validation (0G Compute, private trust mode): duplicate similarity, bias flags, grammar, topic classification and a difficulty prediction.",
  },
  {
    icon: CheckCircle2,
    title: "Accept and anchor",
    body: "An accepted item is encrypted into 0G Storage and its hash anchored to QuestionRegistry on 0G Chain, so the bank's contents stay tamper-evident.",
  },
  {
    icon: XCircle,
    title: "Reject",
    body: "If a threshold is breached the item is rejected with the validation report attached. Nothing is silently dropped.",
  },
];

export default function TeacherDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<DashboardData>("/teacher/dashboard")
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <ErrorState title="Couldn't load your dashboard" description={error} />;

  const counts = data?.submissionCounts ?? {};
  const total = STATUSES.reduce((sum, s) => sum + (counts[s.key] ?? 0), 0);

  return (
    <>
      <PageHeader
        title={data ? `Welcome back, ${data.fullName}` : "Dashboard"}
        description={
          data && total > 0
            ? `${total} item${total === 1 ? "" : "s"} authored on this account.`
            : "Author an item to start populating the question bank."
        }
        actions={
          <Link to="/teacher/submit">
            <Button>
              Submit a question
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        }
      />

      <StatGrid columns={5}>
        {STATUSES.map((s) => (
          <StatTile
            key={s.key}
            label={s.label}
            value={counts[s.key] ?? 0}
            hint={s.hint}
            tone={(counts[s.key] ?? 0) > 0 ? s.tone : "default"}
            loading={!data}
          />
        ))}
      </StatGrid>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>What happens to an item after you submit it</CardTitle>
          <CardDescription>
            Every stage below is real infrastructure, not a status label the platform sets for
            itself.
          </CardDescription>
        </CardHeader>
        <ol className="grid gap-5 sm:grid-cols-2">
          {PIPELINE.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground">
                <step.icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-2xs text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm font-medium text-foreground">{step.title}</span>
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  {step.body}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </Card>
    </>
  );
}
