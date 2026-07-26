import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api.js";
import { useLiveLogs } from "@/lib/live-logs.js";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.js";

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
interface SecurityEvent { id: string; severity: string; category: string; createdAt: string; detail: unknown }
interface ChainAnchor { id: string; contractName: string; entityType: string; txHash: string; createdAt: string }
interface BlockchainEvents { chainAnchors: ChainAnchor[]; midenNotes: unknown[] }
interface CenterRow { id: string; name: string; centerCode: string; _count: { examPCs: number; sessions: number } }
interface ScheduleRow { id: string; status: string; examStartAt: string; examWindowCloseAt: string; blueprint: { title: string } }

const chartTick = { fill: "var(--text-secondary, #9a9891)", fontSize: 12 };

function HealthDot({ ok }: { ok: boolean }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-success" : "bg-danger"}`} />;
}

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

  return (
    <div className="space-y-6">
      {overview && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Teachers" value={overview.totalTeachers} />
          <StatCard label="Students" value={overview.totalStudents} />
          <StatCard label="Accepted questions" value={overview.questionsByStatus.ACCEPTED ?? 0} />
          <StatCard label="Rejected questions" value={overview.questionsByStatus.REJECTED ?? 0} />
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Questions by subject</CardTitle>
            <CardDescription>Accepted question bank composition</CardDescription>
          </CardHeader>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overview?.questionsBySubject ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="subject" tick={chartTick} axisLine={false} tickLine={false} />
                <YAxis tick={chartTick} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--surface-1)", border: "1px solid var(--border)" }} />
                <Bar dataKey="count" fill="#378ADD" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Questions by difficulty</CardTitle>
            <CardDescription>AI-predicted, not teacher-suggested</CardDescription>
          </CardHeader>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overview?.questionsByDifficulty ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="difficulty" tick={chartTick} axisLine={false} tickLine={false} />
                <YAxis tick={chartTick} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--surface-1)", border: "1px solid var(--border)" }} />
                <Bar dataKey="count" fill="#7F77DD" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>System health</CardTitle>
            <CardDescription>{health?.network ?? "…"}</CardDescription>
          </CardHeader>
          {health && (
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="flex items-center gap-2"><HealthDot ok={health.db} /> Postgres</span></div>
              <div className="flex justify-between"><span className="flex items-center gap-2"><HealthDot ok={health.redis} /> Redis</span></div>
              <div className="flex justify-between">
                <span className="flex items-center gap-2"><HealthDot ok={health.zgChain.reachable} /> 0G Chain</span>
                <span className="text-muted-foreground">block {health.zgChain.blockNumber ?? "—"}</span>
              </div>
              {Object.entries(health.queues).map(([name, counts]) => (
                <div key={name} className="flex justify-between text-muted-foreground">
                  <span>{name}</span>
                  <span>{counts.active} active · {counts.waiting} waiting · {counts.failed} failed</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security events</CardTitle>
            <CardDescription>Auth failures and anomalies</CardDescription>
          </CardHeader>
          <div className="max-h-56 space-y-1 overflow-y-auto text-sm">
            {(securityEvents ?? []).map((e) => (
              <div key={e.id} className="flex justify-between border-b border-border py-1">
                <span className={e.severity === "CRITICAL" ? "text-danger" : "text-warning"}>{e.category}</span>
                <span className="text-muted-foreground">{new Date(e.createdAt).toLocaleTimeString()}</span>
              </div>
            ))}
            {securityEvents?.length === 0 && <p className="text-muted-foreground">No events recorded.</p>}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Blockchain events</CardTitle>
            <CardDescription>0G Chain anchors · Miden notes</CardDescription>
          </CardHeader>
          <div className="max-h-56 space-y-1 overflow-y-auto text-sm">
            {(blockchainEvents?.chainAnchors ?? []).map((a) => (
              <div key={a.id} className="flex justify-between border-b border-border py-1">
                <span>{a.contractName}</span>
                <span className="truncate text-muted-foreground" title={a.txHash}>{a.txHash.slice(0, 10)}…</span>
              </div>
            ))}
            {blockchainEvents?.chainAnchors.length === 0 && <p className="text-muted-foreground">No anchors yet.</p>}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live audit log</CardTitle>
          <CardDescription>Streaming over WebSocket as it happens</CardDescription>
        </CardHeader>
        <div className="max-h-64 space-y-1 overflow-y-auto font-mono text-xs">
          {liveLogs.length === 0 && <p className="font-sans text-sm text-muted-foreground">Waiting for activity…</p>}
          {liveLogs.map((l) => (
            <div key={l.id} className="flex justify-between border-b border-border py-1 text-muted-foreground">
              <span className="text-foreground">{l.action ?? `${l.severity}:${l.category}`}</span>
              <span>{new Date(l.createdAt).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Centers</CardTitle>
            <CardDescription>PC count · students connected</CardDescription>
          </CardHeader>
          <div className="space-y-1 text-sm">
            {(centers ?? []).map((c) => (
              <div key={c.id} className="flex justify-between border-b border-border py-1">
                <span>{c.name} ({c.centerCode})</span>
                <span className="text-muted-foreground">{c._count.examPCs} PCs · {c._count.sessions} students</span>
              </div>
            ))}
            {centers?.length === 0 && <p className="text-muted-foreground">No centers registered.</p>}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Exam schedule</CardTitle>
            <CardDescription>Papers by exam window</CardDescription>
          </CardHeader>
          <div className="space-y-1 text-sm">
            {(schedule ?? []).map((s) => (
              <div key={s.id} className="flex justify-between border-b border-border py-1">
                <span>{s.blueprint.title}</span>
                <span className="text-muted-foreground">{new Date(s.examStartAt).toLocaleString()} · {s.status}</span>
              </div>
            ))}
            {schedule?.length === 0 && <p className="text-muted-foreground">No papers scheduled.</p>}
          </div>
        </Card>
      </div>

      {overview && overview.teacherActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Teacher activity</CardTitle>
            <CardDescription>Top submitters</CardDescription>
          </CardHeader>
          <div className="space-y-1 text-sm">
            {overview.teacherActivity.map((t) => (
              <div key={t.teacher} className="flex justify-between border-b border-border py-1">
                <span>{t.teacher}</span>
                <span className="text-muted-foreground">{t.count} questions</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="text-center">
      <CardHeader>
        <CardTitle>{value}</CardTitle>
        <CardDescription>{label}</CardDescription>
      </CardHeader>
    </Card>
  );
}
