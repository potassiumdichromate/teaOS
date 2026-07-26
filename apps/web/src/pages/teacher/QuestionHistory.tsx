import { useEffect, useState } from "react";
import { api } from "@/lib/api.js";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.js";

interface QuestionRow {
  id: string;
  status: string;
  createdAt: string;
  aiReport?: { duplicatePct: number; topicClassified: string } | null;
}

export default function QuestionHistory() {
  const [questions, setQuestions] = useState<QuestionRow[] | null>(null);

  useEffect(() => {
    api<QuestionRow[]>("/teacher/questions").then(setQuestions);
  }, []);

  if (!questions) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (questions.length === 0) return <p className="text-sm text-muted-foreground">No questions submitted yet.</p>;

  return (
    <div className="space-y-3">
      {questions.map((q) => (
        <Card key={q.id} className="flex items-center justify-between">
          <CardHeader className="mb-0">
            <CardTitle>{q.id}</CardTitle>
            <CardDescription>
              {new Date(q.createdAt).toLocaleString()}
              {q.aiReport ? ` · ${q.aiReport.topicClassified} · ${q.aiReport.duplicatePct}% duplicate` : ""}
            </CardDescription>
          </CardHeader>
          <span className="text-sm text-accent">{q.status}</span>
        </Card>
      ))}
    </div>
  );
}
