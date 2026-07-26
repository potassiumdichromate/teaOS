import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context.js";
import { api, ApiError } from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.js";

interface ExamPC { id: string; machineCode: string; healthStatus: string; lastHeartbeatAt: string | null }
interface Dashboard { centerCode: string; name: string; exam_pcs: ExamPC[]; studentsConnected: number; onlinePCs: number }
interface Authorization { authorized: boolean; paperStatus: string; reason?: string }

const inputCls = "w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm";

export default function CenterHome() {
  const { logout } = useAuth();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [machineCode, setMachineCode] = useState("PC-01");
  const [paperId, setPaperId] = useState("");
  const [auth, setAuth] = useState<Authorization | null>(null);
  const [applicationId, setApplicationId] = useState("");
  const [enrollMsg, setEnrollMsg] = useState<string | null>(null);

  const refresh = () => api<Dashboard>("/center/dashboard").then(setDashboard);
  useEffect(() => {
    refresh();
  }, []);

  async function onHeartbeat() {
    await api(`/center/pcs/${encodeURIComponent(machineCode)}/heartbeat`, { method: "POST" });
    refresh();
  }

  async function onCheckAuth() {
    if (!paperId) return;
    setAuth(await api<Authorization>(`/center/authorization/${paperId}`));
  }

  async function onEnroll() {
    setEnrollMsg(null);
    try {
      await api("/center/sessions", { method: "POST", body: JSON.stringify({ applicationId, paperId }) });
      setEnrollMsg("Enrolled.");
      refresh();
    } catch (err) {
      setEnrollMsg(err instanceof ApiError ? err.message : String(err));
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-xl font-medium">Examination center</h1>
        <Button variant="ghost" size="sm" onClick={logout}>Sign out</Button>
      </div>

      {!dashboard ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{dashboard.name}</CardTitle>
              <CardDescription>{dashboard.centerCode} · {dashboard.studentsConnected} students connected · {dashboard.onlinePCs}/{dashboard.exam_pcs.length} PCs online</CardDescription>
            </CardHeader>
            <div className="space-y-2">
              {dashboard.exam_pcs.map((pc) => (
                <div key={pc.id} className="flex justify-between border-b border-border py-1.5 text-sm">
                  <span>{pc.machineCode}</span>
                  <span className={pc.healthStatus === "ONLINE" ? "text-success" : "text-muted-foreground"}>{pc.healthStatus}</span>
                </div>
              ))}
              <div className="flex gap-2 pt-3">
                <input value={machineCode} onChange={(e) => setMachineCode(e.target.value)} className={inputCls} placeholder="Machine code" />
                <Button onClick={onHeartbeat}>Heartbeat</Button>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Exam authorization</CardTitle>
              <CardDescription>Checks the real Miden timelock gate, not a fake toggle</CardDescription>
            </CardHeader>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input value={paperId} onChange={(e) => setPaperId(e.target.value)} className={inputCls} placeholder="Paper ID" />
                <Button onClick={onCheckAuth}>Check</Button>
              </div>
              {auth && (
                <p className={`text-sm ${auth.authorized ? "text-success" : "text-warning"}`}>
                  {auth.authorized ? "Authorized to start" : `Not authorized: ${auth.reason}`}
                </p>
              )}
            </div>

            <CardHeader className="mt-6">
              <CardTitle>Enroll a student</CardTitle>
              <CardDescription>Creates their exam session</CardDescription>
            </CardHeader>
            <div className="space-y-2">
              <input value={applicationId} onChange={(e) => setApplicationId(e.target.value)} className={inputCls} placeholder="Application ID" />
              <Button className="w-full" onClick={onEnroll} disabled={!applicationId || !paperId}>Enroll for the paper above</Button>
              {enrollMsg && <p className="text-sm text-muted-foreground">{enrollMsg}</p>}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
