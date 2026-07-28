import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context.js";
import { api, ApiError } from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.js";

interface SessionView {
  sessionId: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "EVALUATED";
  paperReady: boolean;
  paperStatus: string;
  examStartAt: string;
  examWindowCloseAt: string;
  questionCount: number;
}
interface Option { text: string }
interface Question { questionId: string; subjectId: string; marks: number; text: string; options: Option[] }
interface AnswerState { selectedOptionIndex: number | null; markedForReview: boolean; visited: boolean }

// No calculator widget yet — deprioritized relative to core CBT mechanics
// (palette/timer/navigation/autosave/submit); a real deployment would add it
// as a self-contained overlay, not core to the exam-state model here.
export default function StudentExamClient() {
  const { logout } = useAuth();
  const [session, setSession] = useState<SessionView | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [current, setCurrent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ chainTxHash: string } | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadSession = async () => {
    try {
      const s = await api<SessionView>("/student/exam/session");
      setSession(s);
      if (s.status === "IN_PROGRESS") {
        const qs = await api<Question[]>(`/student/exam/questions?sessionId=${s.sessionId}`);
        setQuestions(qs);
        setAnswers(Object.fromEntries(qs.map((q) => [q.questionId, { selectedOptionIndex: null, markedForReview: false, visited: false }])));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  };
  useEffect(() => {
    loadSession();
  }, []);

  const remainingSeconds = useMemo(() => {
    if (!session) return 0;
    return Math.max(0, Math.floor((new Date(session.examWindowCloseAt).getTime() - now) / 1000));
  }, [session, now]);

  async function onStart() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const qs = await api<Question[]>("/student/exam/start", { method: "POST", body: JSON.stringify({ sessionId: session.sessionId }) });
      setQuestions(qs);
      setAnswers(Object.fromEntries(qs.map((q) => [q.questionId, { selectedOptionIndex: null, markedForReview: false, visited: false }])));
      setSession({ ...session, status: "IN_PROGRESS" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveAnswer(questionId: string, patch: Partial<AnswerState>) {
    const next = { ...answers[questionId], ...patch, visited: true };
    setAnswers((a) => ({ ...a, [questionId]: next }));
    if (!session) return;
    await api("/student/exam/answers", {
      method: "PUT",
      body: JSON.stringify({
        sessionId: session.sessionId,
        questionId,
        selectedOptionIndex: next.selectedOptionIndex,
        markedForReview: next.markedForReview,
      }),
    }).catch(() => void 0);
  }

  async function onSubmit() {
    if (!session) return;
    if (!window.confirm("Submit your exam? This cannot be undone.")) return;
    setBusy(true);
    try {
      const result = await api<{ chainTxHash: string }>("/student/exam/submit", {
        method: "POST",
        body: JSON.stringify({ sessionId: session.sessionId }),
      });
      setSubmitResult(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <div className="mb-6 flex items-center justify-between">
      <h1 className="text-xl font-medium">Student exam client</h1>
      <Button variant="ghost" size="sm" onClick={logout}>Sign out</Button>
    </div>
  );

  if (submitResult) {
    return (
      <div className="mx-auto max-w-md px-6 py-20">
        {header}
        <Card>
          <CardHeader>
            <CardTitle>Submitted</CardTitle>
            <CardDescription>Your answers are encrypted, uploaded, and anchored on 0G Chain</CardDescription>
          </CardHeader>
          <p className="text-sm text-muted-foreground">
            0G Chain anchor tx: <span className="break-all">{submitResult.chainTxHash}</span>
          </p>
        </Card>
      </div>
    );
  }

  if (error) return <div className="mx-auto max-w-md px-6 py-20">{header}<p className="text-sm text-danger">{error}</p></div>;
  if (!session) return <div className="mx-auto max-w-md px-6 py-20">{header}<p className="text-sm text-muted-foreground">Loading…</p></div>;

  if (session.status !== "IN_PROGRESS" || !questions) {
    return (
      <div className="mx-auto max-w-md px-6 py-20">
        {header}
        <Card>
          <CardHeader>
            <CardTitle>{session.questionCount}-question exam</CardTitle>
            <CardDescription>Starts {new Date(session.examStartAt).toLocaleString()}</CardDescription>
          </CardHeader>
          {session.paperReady ? (
            <Button className="w-full" disabled={busy} onClick={onStart}>{busy ? "Starting…" : "Start exam"}</Button>
          ) : (
            <p className="text-sm text-warning">
              Not startable yet — paper status is <span className="text-foreground">{session.paperStatus}</span>.
              The Miden key-timelock step hasn&apos;t completed (see docs/MIDEN_INTEGRATION.md); there is no
              backend override key.
            </p>
          )}
        </Card>
      </div>
    );
  }

  const q = questions[current];
  const qState = answers[q.questionId];
  const answeredCount = Object.values(answers).filter((a) => a.selectedOptionIndex !== null).length;

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-[1fr_240px] gap-6 px-6 py-6">
      <div>
        {header}
        <Card>
          <div className="mb-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Question {current + 1} of {questions.length} · {q.marks} marks</span>
            <span className={remainingSeconds < 300 ? "text-danger" : "text-foreground"}>
              {String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:{String(remainingSeconds % 60).padStart(2, "0")}
            </span>
          </div>
          <p className="mb-4 text-base text-foreground">{q.text}</p>
          <div className="space-y-2">
            {q.options.map((opt, i) => (
              <label key={i} className={`flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm ${qState?.selectedOptionIndex === i ? "border-primary bg-primary/10" : "border-border"}`}>
                <input
                  type="radio"
                  name={q.questionId}
                  checked={qState?.selectedOptionIndex === i}
                  onChange={() => saveAnswer(q.questionId, { selectedOptionIndex: i })}
                />
                {opt.text}
              </label>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => saveAnswer(q.questionId, { selectedOptionIndex: null })}>Clear response</Button>
            <Button variant="outline" size="sm" onClick={() => saveAnswer(q.questionId, { markedForReview: !qState?.markedForReview })}>
              {qState?.markedForReview ? "Unmark review" : "Mark for review"}
            </Button>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="ghost" disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>Previous</Button>
              <Button size="sm" disabled={current === questions.length - 1} onClick={() => { saveAnswer(q.questionId, {}); setCurrent((c) => c + 1); }}>
                Save & next
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <div>
        <Card>
          <CardHeader>
            <CardTitle>Question palette</CardTitle>
            <CardDescription>{answeredCount}/{questions.length} answered</CardDescription>
          </CardHeader>
          <div className="grid grid-cols-5 gap-1.5">
            {questions.map((qq, i) => {
              const st = answers[qq.questionId];
              const cls = st?.markedForReview
                ? "bg-accent text-accent-foreground"
                : st?.selectedOptionIndex !== null
                  ? "bg-success text-white"
                  : st?.visited
                    ? "border border-warning text-warning"
                    : "border border-border text-muted-foreground";
              return (
                <button key={qq.questionId} onClick={() => setCurrent(i)} className={`h-8 rounded-md text-xs ${cls} ${i === current ? "ring-2 ring-primary" : ""}`}>
                  {i + 1}
                </button>
              );
            })}
          </div>
          <Button className="mt-6 w-full" variant="danger" disabled={busy} onClick={onSubmit}>
            {busy ? "Submitting…" : "Submit exam"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
