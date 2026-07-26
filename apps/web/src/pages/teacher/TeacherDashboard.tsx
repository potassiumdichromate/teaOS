import { useEffect, useState } from "react";
import { api } from "@/lib/api.js";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.js";

interface DashboardData {
  fullName: string;
  submissionCounts: Record<string, number>;
}

export default function TeacherDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<DashboardData>("/teacher/dashboard").then(setData).catch((e) => setError(String(e)));
  }, []);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const statuses = ["DRAFT", "SUBMITTED", "VALIDATING", "ACCEPTED", "REJECTED"];

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground">Welcome back, {data.fullName}</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {statuses.map((status) => (
          <Card key={status} className="text-center">
            <CardHeader>
              <CardTitle>{data.submissionCounts[status] ?? 0}</CardTitle>
              <CardDescription>{status}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
