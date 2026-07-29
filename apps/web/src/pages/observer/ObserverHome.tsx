import { useEffect, useState } from "react";
import { Activity, Link2, ListChecks, ServerCog, ShieldAlert } from "lucide-react";
import { api } from "@/lib/api.js";
import { AppShell, type NavItem } from "@/components/ui/app-shell.js";
import { Badge, HealthDot, StatusBadge } from "@/components/ui/badge.js";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.js";
import { SkeletonRows } from "@/components/ui/loading.js";
import { HashValue, explorerTxUrl } from "@/components/ui/mono.js";
import { NetworkBadge, networkLabel } from "@/components/ui/network-badge.js";
import { PageHeader, SectionHeading } from "@/components/ui/page-header.js";
import { Meter, StatGrid, StatTile } from "@/components/ui/stat.js";
import { DataTable, type Column } from "@/components/ui/table.js";

interface IntegritySummary {
  papers: { total: number; ready: number; anchored: number };
  questions: { accepted: number; anchored: number };
  sessions: { total: number; submittedOrEvaluated: number; anchored: number };
  evaluationResults: { total: number; anchored: number };
}
interface ChainAnchorRow {
  id: string;
  contractName: string;
  entityType: string;
  txHash: string;
  createdAt: string;
}
interface SecurityEventRow {
  id: string;
  severity: string;
  category: string;
  createdAt: string;
}
interface AuditLogRow {
  id: string;
  action: string;
  createdAt: string;
}
interface Health {
  network: string;
  db: boolean;
  redis: boolean;
  zgChain: { reachable: boolean; blockNumber: number | null };
}

const NAV: NavItem[] = [
  { anchor: "coverage", label: "Anchoring coverage", icon: ListChecks },
  { anchor: "infrastructure", label: "Infrastructure", icon: ServerCog },
  { anchor: "anchors", label: "On-chain anchors", icon: Link2 },
  { anchor: "security", label: "Security events", icon: ShieldAlert },
  { anchor: "audit", label: "Audit trail", icon: Activity },
];

export default function ObserverHome() {
  const [summary, setSummary] = useState<IntegritySummary | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [anchors, setAnchors] = useState<ChainAnchorRow[] | null>(null);
  const [securityEvents, setSecurityEvents] = useState<SecurityEventRow[] | null>(null);
  const [auditLog, setAuditLog] = useState<AuditLogRow[] | null>(null);

  useEffect(() => {
    api<IntegritySummary>("/observer/integrity-summary").then(setSummary);
    api<Health>("/observer/system-health").then(setHealth);
    api<ChainAnchorRow[]>("/observer/chain-anchors?take=20").then(setAnchors);
    api<SecurityEventRow[]>("/observer/security-events?take=20").then(setSecurityEvents);
    api<AuditLogRow[]>("/observer/audit-log?take=20").then(setAuditLog);
  }, []);

  // Derived on the client purely for display; every component figure below is
  // shown alongside it so the aggregate can be checked by hand.
  const coverage = summary
    ? (() => {
        const pairs: [number, number][] = [
          [summary.papers.anchored, summary.papers.total],
          [summary.questions.anchored, summary.questions.accepted],
          [summary.sessions.anchored, summary.sessions.submittedOrEvaluated],
          [summary.evaluationResults.anchored, summary.evaluationResults.total],
        ];
        const anchored = pairs.reduce((n, [a]) => n + a, 0);
        const total = pairs.reduce((n, [, t]) => n + t, 0);
        return { anchored, total, pct: total > 0 ? Math.round((anchored / total) * 100) : 0 };
      })()
    : null;

  const anchorColumns: Column<ChainAnchorRow>[] = [
    {
      key: "registry",
      header: "Registry",
      cell: (a) => <span className="text-foreground">{a.contractName}</span>,
    },
    {
      key: "entity",
      header: "Entity",
      cell: (a) => <span className="text-muted-foreground">{a.entityType}</span>,
      hideOnMobile: true,
    },
    {
      key: "at",
      header: "Recorded",
      cell: (a) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {new Date(a.createdAt).toLocaleString()}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "tx",
      header: "Transaction",
      align: "right",
      cell: (a) => (
        <HashValue
          value={a.txHash}
          href={explorerTxUrl(a.txHash, health?.network)}
          className="justify-end"
        />
      ),
    },
  ];

  const securityColumns: Column<SecurityEventRow>[] = [
    {
      key: "category",
      header: "Category",
      cell: (s) => <span className="text-foreground">{s.category}</span>,
    },
    {
      key: "severity",
      header: "Severity",
      cell: (s) => <StatusBadge status={s.severity} />,
    },
    {
      key: "at",
      header: "Recorded",
      align: "right",
      cell: (s) => (
        <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
          {new Date(s.createdAt).toLocaleString()}
        </span>
      ),
    },
  ];

  const auditColumns: Column<AuditLogRow>[] = [
    {
      key: "action",
      header: "Action",
      cell: (a) => <span className="font-mono text-xs text-foreground">{a.action}</span>,
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
    },
  ];

  return (
    <AppShell
      role="OBSERVER"
      nav={NAV}
      sidebarFooter={<NetworkBadge endpoint="/observer/system-health" />}
    >
      <PageHeader
        title="Independent oversight"
        description="A read-only assurance view for auditors and regulators. Every figure here is queried live from the running system, and every on-chain value can be re-checked in a public block explorer without trusting this dashboard."
        actions={
          <Badge tone="neutral" dot>
            Read-only
          </Badge>
        }
      />

      <section id="coverage" className="scroll-mt-6">
        <StatGrid columns={4}>
          <StatTile
            label="Anchoring coverage"
            value={coverage ? `${coverage.pct}%` : "—"}
            tone={coverage && coverage.pct === 100 ? "success" : "default"}
            hint={
              coverage ? `${coverage.anchored} of ${coverage.total} records anchored` : undefined
            }
            loading={!summary}
          />
          <StatTile
            label="Papers"
            value={summary?.papers.total ?? 0}
            hint={summary ? `${summary.papers.ready} reached READY` : undefined}
            loading={!summary}
          />
          <StatTile
            label="Accepted questions"
            value={summary?.questions.accepted ?? 0}
            hint="Passed confidential validation"
            loading={!summary}
          />
          <StatTile
            label="Submitted sessions"
            value={summary?.sessions.submittedOrEvaluated ?? 0}
            hint={summary ? `${summary.sessions.total} total sessions` : undefined}
            loading={!summary}
          />
        </StatGrid>

        <Card className="mt-5">
          <CardHeader>
            <CardTitle>Chain-anchoring coverage</CardTitle>
            <CardDescription>
              How much of the platform&apos;s own recorded activity actually has a corresponding
              on-chain anchor. A shortfall here is the single most useful signal an auditor has —
              it means the platform asserted something it did not commit to publicly.
            </CardDescription>
          </CardHeader>
          {!summary ? (
            <SkeletonRows rows={4} />
          ) : (
            <div className="space-y-4">
              <Meter
                label="Papers anchored"
                value={summary.papers.anchored}
                total={summary.papers.total}
                hint="PaperRegistry writes against generated master papers"
              />
              <Meter
                label="Accepted questions anchored"
                value={summary.questions.anchored}
                total={summary.questions.accepted}
                hint="QuestionRegistry writes against items that passed validation"
              />
              <Meter
                label="Submitted sessions anchored"
                value={summary.sessions.anchored}
                total={summary.sessions.submittedOrEvaluated}
                hint="SubmissionRegistry writes — the write-once guard that also prevents double submission"
              />
              <Meter
                label="Evaluation results anchored"
                value={summary.evaluationResults.anchored}
                total={summary.evaluationResults.total}
                hint="ResultRegistry writes against scored results"
              />
            </div>
          )}
        </Card>
      </section>

      <section id="infrastructure" className="mt-8 scroll-mt-6">
        <SectionHeading
          title="Infrastructure"
          description="Live checks performed at request time, not cached status flags."
        />
        <Card>
          {!health ? (
            <SkeletonRows rows={4} />
          ) : (
            <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              <HealthItem label="Network" ok value={networkLabel(health.network)} />
              <HealthItem
                label="0G Chain"
                ok={health.zgChain.reachable}
                value={
                  health.zgChain.reachable && health.zgChain.blockNumber != null
                    ? `block ${health.zgChain.blockNumber.toLocaleString()}`
                    : "unreachable"
                }
              />
              <HealthItem
                label="Database"
                ok={health.db}
                value={health.db ? "reachable" : "unreachable"}
              />
              <HealthItem
                label="Queue store"
                ok={health.redis}
                value={health.redis ? "reachable" : "unreachable"}
              />
            </dl>
          )}
        </Card>
      </section>

      <section id="anchors" className="mt-8 scroll-mt-6">
        <SectionHeading
          title="On-chain anchors"
          description="The 20 most recent registry writes. Follow any transaction to check it yourself."
        />
        <Card flush>
          <DataTable
            columns={anchorColumns}
            rows={anchors}
            rowKey={(a) => a.id}
            dense
            emptyIcon={<Link2 className="h-4 w-4" />}
            emptyTitle="No anchors recorded"
            emptyDescription="Nothing has been committed on-chain on this deployment yet."
          />
        </Card>
      </section>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <section id="security" className="scroll-mt-6">
          <SectionHeading
            title="Security events"
            description="Authentication failures and anomalies, unfiltered."
          />
          <Card flush>
            <DataTable
              columns={securityColumns}
              rows={securityEvents}
              rowKey={(s) => s.id}
              dense
              maxHeight="max-h-80"
              emptyIcon={<ShieldAlert className="h-4 w-4" />}
              emptyTitle="No security events recorded"
            />
          </Card>
        </section>

        <section id="audit" className="scroll-mt-6">
          <SectionHeading
            title="Audit trail"
            description="Append-only record of what the platform did, and when."
          />
          <Card flush>
            <DataTable
              columns={auditColumns}
              rows={auditLog}
              rowKey={(a) => a.id}
              dense
              maxHeight="max-h-80"
              emptyIcon={<Activity className="h-4 w-4" />}
              emptyTitle="No audit entries yet"
            />
          </Card>
        </section>
      </div>

      <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
        This account has no mutating capability of any kind — every oversight endpoint is a read.
        Independent verification of an individual candidate&apos;s result is available publicly, without
        an account, from the verification page.
      </p>
    </AppShell>
  );
}

function HealthItem({ label, ok, value }: { label: string; ok: boolean; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/70 pb-2">
      <dt className="flex items-center gap-2 text-sm text-foreground">
        <HealthDot ok={ok} />
        {label}
      </dt>
      <dd className="font-mono text-xs tabular-nums text-muted-foreground">{value}</dd>
    </div>
  );
}
