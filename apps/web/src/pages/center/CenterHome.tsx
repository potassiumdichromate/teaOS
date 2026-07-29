import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, MonitorCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api.js";
import { AppShell, type NavItem } from "@/components/ui/app-shell.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.js";
import { Field, Input } from "@/components/ui/input.js";
import { StatusBadge } from "@/components/ui/badge.js";
import { DataTable, type Column } from "@/components/ui/table.js";
import { PageHeader, SectionHeading } from "@/components/ui/page-header.js";
import { LoadingLine } from "@/components/ui/loading.js";
import { StatGrid, StatTile } from "@/components/ui/stat.js";
import { ErrorState } from "@/components/ui/empty-state.js";

interface ExamPC {
  id: string;
  machineCode: string;
  healthStatus: string;
  lastHeartbeatAt: string | null;
}
interface Dashboard {
  centerCode: string;
  name: string;
  exam_pcs: ExamPC[];
  studentsConnected: number;
  onlinePCs: number;
}
interface Authorization {
  authorized: boolean;
  paperStatus: string;
  reason?: string;
}

const NAV: NavItem[] = [
  { anchor: "machines", label: "Machines", icon: MonitorCheck },
  { anchor: "authorization", label: "Release authorization", icon: KeyRound },
];

const PC_COLUMNS: Column<ExamPC>[] = [
  {
    key: "code",
    header: "Machine",
    cell: (pc) => <span className="font-mono text-xs text-foreground">{pc.machineCode}</span>,
  },
  {
    key: "heartbeat",
    header: "Last heartbeat",
    cell: (pc) => (
      <span className="whitespace-nowrap text-muted-foreground">
        {pc.lastHeartbeatAt ? new Date(pc.lastHeartbeatAt).toLocaleString() : "never"}
      </span>
    ),
    hideOnMobile: true,
  },
  {
    key: "status",
    header: "Status",
    align: "right",
    cell: (pc) => <StatusBadge status={pc.healthStatus} />,
    width: "w-32",
  },
];

export default function CenterHome() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [machineCode, setMachineCode] = useState("PC-01");
  const [paperId, setPaperId] = useState("");
  const [auth, setAuth] = useState<Authorization | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () =>
    api<Dashboard>("/center/dashboard")
      .then(setDashboard)
      .catch((e) => setLoadError(String(e)));

  useEffect(() => {
    refresh();
  }, []);

  async function onHeartbeat() {
    setBusy(true);
    try {
      await api(`/center/pcs/${encodeURIComponent(machineCode)}/heartbeat`, { method: "POST" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onCheckAuth() {
    if (!paperId) return;
    setBusy(true);
    setAuthError(null);
    try {
      setAuth(await api<Authorization>(`/center/authorization/${paperId}`));
    } catch (err) {
      setAuth(null);
      setAuthError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell role="CENTER" nav={NAV}>
      <PageHeader
        title={dashboard ? dashboard.name : "Examination center"}
        description="Machine readiness and release authorization for this center. Candidates enroll themselves from their own portal."
        actions={
          dashboard ? (
            <span className="rounded-md border border-border bg-muted/40 px-2.5 py-1 font-mono text-xs text-muted-foreground">
              {dashboard.centerCode}
            </span>
          ) : null
        }
      />

      {loadError ? <ErrorState title="Couldn't load this center" description={loadError} /> : null}

      {!dashboard && !loadError ? <LoadingLine label="Loading center" /> : null}

      {dashboard ? (
        <>
          <StatGrid columns={3}>
            <StatTile
              label="Machines online"
              value={`${dashboard.onlinePCs}/${dashboard.exam_pcs.length}`}
              tone={
                dashboard.exam_pcs.length > 0 && dashboard.onlinePCs === dashboard.exam_pcs.length
                  ? "success"
                  : dashboard.onlinePCs === 0
                    ? "warning"
                    : "default"
              }
              hint="Reporting a heartbeat"
            />
            <StatTile
              label="Candidates connected"
              value={dashboard.studentsConnected}
              hint="Sessions attached to this center"
            />
            <StatTile
              label="Center code"
              value={dashboard.centerCode}
              hint="Identifier used in the audit trail"
            />
          </StatGrid>

          <section id="machines" className="mt-8 scroll-mt-6">
            <SectionHeading
              title="Machines"
              description="Health is derived from real heartbeats, not a manually set flag."
            />
            <Card flush>
              <DataTable
                columns={PC_COLUMNS}
                rows={dashboard.exam_pcs}
                rowKey={(pc) => pc.id}
                dense
                emptyIcon={<MonitorCheck className="h-4 w-4" />}
                emptyTitle="No machines registered"
                emptyDescription="Send a heartbeat from a machine code below to register it."
              />
              <div className="flex flex-col gap-2 border-t border-border p-4 sm:flex-row sm:items-end">
                <Field label="Machine code" className="flex-1">
                  <Input
                    value={machineCode}
                    onChange={(e) => setMachineCode(e.target.value)}
                    placeholder="PC-01"
                    className="font-mono text-xs"
                  />
                </Field>
                <Button variant="outline" onClick={onHeartbeat} disabled={busy || !machineCode}>
                  Send heartbeat
                </Button>
              </div>
            </Card>
          </section>

          <div className="mt-8 max-w-xl">
            <section id="authorization" className="scroll-mt-6">
              <SectionHeading title="Release authorization" />
              <Card>
                <CardHeader>
                  <CardTitle>Can this center start the exam?</CardTitle>
                  <CardDescription>
                    Authorization is gated on the paper&apos;s real drand/tlock timelock — the
                    content key cannot be unsealed before the exam window opens, and no toggle in
                    this portal (or anywhere else) overrides that. Candidates enroll themselves
                    from their own portal — this center's job is machine readiness and this check
                    only.
                  </CardDescription>
                </CardHeader>
                <div className="space-y-3">
                  <Field label="Paper ID">
                    <Input
                      value={paperId}
                      onChange={(e) => {
                        setPaperId(e.target.value);
                        setAuth(null);
                        setAuthError(null);
                      }}
                      placeholder="Paste the paper ID for today's session"
                      className="font-mono text-xs"
                    />
                  </Field>
                  <Button variant="outline" onClick={onCheckAuth} disabled={busy || !paperId}>
                    Check authorization
                  </Button>

                  {auth ? (
                    <div
                      className={
                        auth.authorized
                          ? "rounded-md border border-success/30 bg-success/[0.07] px-4 py-3"
                          : "rounded-md border border-warning/30 bg-warning/[0.07] px-4 py-3"
                      }
                    >
                      <p
                        className={
                          auth.authorized
                            ? "flex items-center gap-2 text-sm font-medium text-success"
                            : "flex items-center gap-2 text-sm font-medium text-warning"
                        }
                      >
                        {auth.authorized ? <CheckCircle2 className="h-4 w-4" /> : null}
                        {auth.authorized ? "Authorized to start" : "Not authorized"}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Paper status <span className="font-mono text-foreground">{auth.paperStatus}</span>
                        {auth.reason ? ` — ${auth.reason}` : ""}
                      </p>
                    </div>
                  ) : null}
                  {authError ? (
                    <p className="rounded-md border border-danger/30 bg-danger/[0.07] px-3 py-2 text-xs text-danger">
                      {authError}
                    </p>
                  ) : null}
                </div>
              </Card>
            </section>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
