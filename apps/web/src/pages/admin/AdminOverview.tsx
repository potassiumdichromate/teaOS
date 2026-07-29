import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, Building2, CalendarClock, Link2, ShieldAlert, Users } from "lucide-react";
import { api } from "@/lib/api.js";
import { useLiveLogs } from "@/lib/live-logs.js";
import { Badge, HealthDot, StatusBadge } from "@/components/ui/badge.js";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.js";
import { EmptyState } from "@/components/ui/empty-state.js";
import { SkeletonRows } from "@/components/ui/loading.js";
import { HashValue, explorerTxUrl } from "@/components/ui/mono.js";
import { PageHeader } from "@/components/ui/page-header.js";
import { StatGrid, StatTile } from "@/components/ui/stat.js";
import { DataTable, type Column } from "@/components/ui/table.js";
import { networkLabel } from "@/components/ui/network-badge.js";

interface Overview {
  totalTeachers: number;
  totalStudents: number;
  questionsByStatus: Record<string, number>;
  questionsBySubject: { subject: string; count: number }[];
  questionsByDifficulty: { difficulty: string; count: number }[];
  teacherActivity: { teacher: string; count: number }[];
}
interface Health {
  network: string;
  db: boolean;
  redis: boolean;
  zgChain: { reachable: boolean; blockNumber: number | null };
  queues: Record<string, { active: number; waiting: number; completed: number; failed: number }>;
}
interface SecurityEvent {
  id: string;
  severity: string;
  category: string;
  createdAt: string;
  detail: unknown;
}
interface ChainAnchor {
  id: string;
  contractName: string;
  entityType: string;
  txHash: string;
  createdAt: string;
}
interface BlockchainEvents {
  chainAnchors: ChainAnchor[];
}
interface CenterRow {
  id: string;
  name: string;
  centerCode: string;
  _count: { examPCs: number; sessions: number };
}
interface ScheduleRow {
  id: string;
  status: string;
  examStartAt: string;
  examWindowCloseAt: string;
  blueprint: { title: string };
}

// Single hue for both charts: each is one series, so color carries no
// identity here — it would be noise, not information.
const SERIES = "hsl(212 92% 60%)";
const AXIS_TICK = { fill: "hsl(215 12% 58%)", fontSize: 11 };
const GRID = "hsl(222 14% 18%)";
const TOOLTIP_STYLE = {
  background: "hsl(222 16% 12%)",
  border: "1px solid hsl(222 12% 28%)",
  borderRadius: 8,
  fontSize: 12,
  padding: "6px 10px",
} as const;

export default function AdminOverview() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[] | null>(null);
  const [blockchainEvents, setBlockchainEvents] = useState<BlockchainEvents | null>(null);
  const [centers, setCenters] = useState<CenterRow[] | null>(null);
  const [schedule, setSchedule] = useState<ScheduleRow[] | null>(null);
  const liveLogs = useLiveLogs();

  useEffect(() => {
    api<Overview>("/admin/overview").then(setOverview);
    api<Health>("/admin/system-health").then(setHealth);
    api<SecurityEvent[]>("/admin/security-events").then(setSecurityEvents);
    api<BlockchainEvents>("/admin/blockchain-events").then(setBlockchainEvents);
    api<CenterRow[]>("/admin/centers").then(setCenters);
    api<ScheduleRow[]>("/admin/schedule").then(setSchedule);
  }, []);

  const anchorColumns: Column<ChainAnchor>[] = [
    {
      key: "contract",
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

  const securityColumns: Column<SecurityEvent>[] = [
    {
      key: "category",
      header: "Category",
      cell: (e) => <span className="text-foreground">{e.category}</span>,
    },
    {
      key: "severity",
      header: "Severity",
      cell: (e) => <StatusBadge status={e.severity} />,
    },
    {
      key: "at",
      header: "When",
      align: "right",
      cell: (e) => (
        <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
          {new Date(e.createdAt).toLocaleTimeString()}
        </span>
      ),
    },
  ];

  const centerColumns: Column<CenterRow>[] = [
    {
      key: "name",
      header: "Center",
      cell: (c) => (
        <span>
          <span className="block text-foreground">{c.name}</span>
          <span className="block font-mono text-2xs text-muted-foreground">{c.centerCode}</span>
        </span>
      ),
    },
    {
      key: "pcs",
      header: "PCs",
      align: "right",
      cell: (c) => <span className="font-mono tabular-nums">{c._count.examPCs}</span>,
      width: "w-20",
    },
    {
      key: "sessions",
      header: "Candidates",
      align: "right",
      cell: (c) => <span className="font-mono tabular-nums">{c._count.sessions}</span>,
      width: "w-28",
    },
  ];

  const scheduleColumns: Column<ScheduleRow>[] = [
    {
      key: "title",
      header: "Paper",
      cell: (s) => <span className="text-foreground">{s.blueprint.title}</span>,
    },
    {
      key: "window",
      header: "Exam window opens",
      cell: (s) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {new Date(s.examStartAt).toLocaleString()}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "status",
      header: "Status",
      align: "right",
      cell: (s) => <StatusBadge status={s.status} />,
      width: "w-32",
    },
  ];

  const activityColumns: Column<{ teacher: string; count: number }>[] = [
    {
      key: "teacher",
      header: "Author",
      cell: (t) => <span className="text-foreground">{t.teacher}</span>,
    },
    {
      key: "count",
      header: "Questions authored",
      align: "right",
      cell: (t) => <span className="font-mono tabular-nums">{t.count}</span>,
      width: "w-44",
    },
  ];

  return (
    <>
      <PageHeader
        title="Control plane"
        description="Live state of the assessment estate — question bank, infrastructure health, on-chain anchoring and the audit trail, all read from the running system."
        actions={
          health ? (
            <Badge tone={health.zgChain.reachable ? "success" : "danger"} dot>
              {networkLabel(health.network)}
            </Badge>
          ) : null
        }
      />

      <StatGrid columns={4}>
        <StatTile
          label="Authors"
          value={overview?.totalTeachers ?? 0}
          loading={!overview}
          icon={<Users className="h-3.5 w-3.5" />}
        />
        <StatTile
          label="Candidates"
          value={overview?.totalStudents ?? 0}
          loading={!overview}
          icon={<Users className="h-3.5 w-3.5" />}
        />
        <StatTile
          label="Accepted questions"
          value={overview?.questionsByStatus.ACCEPTED ?? 0}
          tone="success"
          loading={!overview}
          hint="Validated, encrypted and anchored"
        />
        <StatTile
          label="Rejected questions"
          value={overview?.questionsByStatus.REJECTED ?? 0}
          tone={(overview?.questionsByStatus.REJECTED ?? 0) > 0 ? "danger" : "default"}
          loading={!overview}
          hint="Failed a validation threshold"
        />
      </StatGrid>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Questions by subject</CardTitle>
            <CardDescription>Accepted question-bank composition</CardDescription>
          </CardHeader>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={overview?.questionsBySubject ?? []}
                margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
              >
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="subject" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: "hsl(210 20% 94%)" }}
                  itemStyle={{ color: "hsl(215 12% 58%)" }}
                  cursor={{ fill: "hsl(222 16% 14% / 0.6)" }}
                />
                <Bar dataKey="count" name="Questions" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Questions by difficulty</CardTitle>
            <CardDescription>AI-predicted, not author-suggested</CardDescription>
          </CardHeader>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={overview?.questionsByDifficulty ?? []}
                margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
              >
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="difficulty" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: "hsl(210 20% 94%)" }}
                  itemStyle={{ color: "hsl(215 12% 58%)" }}
                  cursor={{ fill: "hsl(222 16% 14% / 0.6)" }}
                />
                <Bar dataKey="count" name="Questions" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>System health</CardTitle>
            <CardDescription>{health ? networkLabel(health.network) : "Checking…"}</CardDescription>
          </CardHeader>
          {!health ? (
            <SkeletonRows rows={4} />
          ) : (
            <div className="space-y-3">
              <dl className="divide-y divide-border/70">
                <HealthRow label="Postgres" ok={health.db} />
                <HealthRow label="Redis" ok={health.redis} />
                <HealthRow
                  label="0G Chain"
                  ok={health.zgChain.reachable}
                  value={
                    health.zgChain.blockNumber != null
                      ? `block ${health.zgChain.blockNumber.toLocaleString()}`
                      : "—"
                  }
                />
              </dl>
              <div>
                <p className="ui-label mb-2">Workers</p>
                <div className="space-y-2">
                  {Object.entries(health.queues).map(([name, counts]) => (
                    <div key={name} className="text-xs">
                      <p className="text-foreground">{name}</p>
                      <p className="font-mono tabular-nums text-muted-foreground">
                        <span className={counts.active > 0 ? "text-primary" : ""}>
                          {counts.active}
                        </span>
                        <span> active · {counts.waiting} waiting · </span>
                        <span className={counts.failed > 0 ? "text-danger" : ""}>
                          {counts.failed}
                        </span>
                        <span> failed</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card flush className="overflow-hidden">
          <CardHeader
            className="mb-0 px-5 pt-5"
            action={
              <Badge tone={liveLogs.length > 0 ? "success" : "neutral"} dot pulse={liveLogs.length > 0}>
                {liveLogs.length > 0 ? "Streaming" : "Idle"}
              </Badge>
            }
          >
            <CardTitle>Live audit log</CardTitle>
            <CardDescription>
              Pushed over WebSocket as events are written — not a polled snapshot.
            </CardDescription>
          </CardHeader>
          <div className="mt-4 max-h-64 overflow-y-auto border-t border-border">
            {liveLogs.length === 0 ? (
              <EmptyState
                compact
                icon={<Activity className="h-4 w-4" />}
                title="Waiting for activity"
                description="Anything the platform does — logins, validations, anchors — appears here the moment it is recorded."
              />
            ) : (
              <ul className="divide-y divide-border/60 font-mono text-xs">
                {liveLogs.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-4 px-5 py-1.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={
                          l.type === "security"
                            ? "h-1.5 w-1.5 shrink-0 rounded-full bg-warning"
                            : "h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                        }
                      />
                      <span className="truncate text-foreground">
                        {l.action ?? `${l.severity}:${l.category}`}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {new Date(l.createdAt).toLocaleTimeString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card flush>
          <CardHeader className="mb-0 px-5 pt-5">
            <CardTitle>On-chain anchors</CardTitle>
            <CardDescription>
              0G Chain registry writes. Every hash here is re-checkable in the block explorer
              without trusting this dashboard.
            </CardDescription>
          </CardHeader>
          <div className="mt-4">
            <DataTable
              columns={anchorColumns}
              rows={blockchainEvents?.chainAnchors}
              rowKey={(a) => a.id}
              maxHeight="max-h-72"
              dense
              emptyIcon={<Link2 className="h-4 w-4" />}
              emptyTitle="No anchors yet"
              emptyDescription="Anchors appear once a question, paper, submission or result is written on-chain."
            />
          </div>
        </Card>

        <Card flush>
          <CardHeader className="mb-0 px-5 pt-5">
            <CardTitle>Security events</CardTitle>
            <CardDescription>Authentication failures and anomalies</CardDescription>
          </CardHeader>
          <div className="mt-4">
            <DataTable
              columns={securityColumns}
              rows={securityEvents}
              rowKey={(e) => e.id}
              maxHeight="max-h-72"
              dense
              emptyIcon={<ShieldAlert className="h-4 w-4" />}
              emptyTitle="No security events recorded"
              emptyDescription="Nothing anomalous has been logged on this deployment."
            />
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card flush>
          <CardHeader className="mb-0 px-5 pt-5">
            <CardTitle>Examination centers</CardTitle>
            <CardDescription>Registered machines and enrolled candidates</CardDescription>
          </CardHeader>
          <div className="mt-4">
            <DataTable
              columns={centerColumns}
              rows={centers}
              rowKey={(c) => c.id}
              dense
              emptyIcon={<Building2 className="h-4 w-4" />}
              emptyTitle="No centers registered"
            />
          </div>
        </Card>

        <Card flush>
          <CardHeader className="mb-0 px-5 pt-5">
            <CardTitle>Exam schedule</CardTitle>
            <CardDescription>Generated papers by exam window</CardDescription>
          </CardHeader>
          <div className="mt-4">
            <DataTable
              columns={scheduleColumns}
              rows={schedule}
              rowKey={(s) => s.id}
              dense
              emptyIcon={<CalendarClock className="h-4 w-4" />}
              emptyTitle="No papers scheduled"
              emptyDescription="Generate a paper from a published blueprint to schedule an exam window."
            />
          </div>
        </Card>
      </div>

      {overview && overview.teacherActivity.length > 0 ? (
        <Card flush className="mt-5">
          <CardHeader className="mb-0 px-5 pt-5">
            <CardTitle>Author activity</CardTitle>
            <CardDescription>Top contributors to the question bank</CardDescription>
          </CardHeader>
          <div className="mt-4">
            <DataTable
              columns={activityColumns}
              rows={overview.teacherActivity}
              rowKey={(t) => t.teacher}
              dense
            />
          </div>
        </Card>
      ) : null}
    </>
  );
}

function HealthRow({ label, ok, value }: { label: string; ok: boolean; value?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 first:pt-0">
      <dt className="flex items-center gap-2 text-sm text-foreground">
        <HealthDot ok={ok} />
        {label}
      </dt>
      <dd className="font-mono text-xs tabular-nums text-muted-foreground">
        {value ?? (ok ? "reachable" : "unreachable")}
      </dd>
    </div>
  );
}
