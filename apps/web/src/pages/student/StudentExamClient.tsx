import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, CheckCircle2, ChevronLeft, ChevronRight, Flag, LogOut, RotateCcw, Timer, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context.js";
import { api, ApiError } from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.js";
import { Badge } from "@/components/ui/badge.js";
import { Brand } from "@/components/ui/brand.js";
import { ErrorState } from "@/components/ui/empty-state.js";
import { Field, Input } from "@/components/ui/input.js";
import { LoadingLine } from "@/components/ui/loading.js";
import { HashValue } from "@/components/ui/mono.js";
import { cn } from "@/lib/utils.js";

interface SessionView {
  sessionId: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "SUBMITTED" | "EVALUATED";
  paperReady: boolean;
  paperStatus: string;
  examStartAt: string;
  examWindowCloseAt: string;
  questionCount: number;
}
interface Option {
  text: string;
}
interface Question {
  questionId: string;
  subjectId: string;
  marks: number;
  text: string;
  options: Option[];
}
interface AnswerState {
  selectedOptionIndex: number | null;
  markedForReview: boolean;
  visited: boolean;
}

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
  const [needsEnrollment, setNeedsEnrollment] = useState(false);

  // ── Self-enrollment (moved here from the Center portal, 2026-07-30) ──────
  const [enrollAppId, setEnrollAppId] = useState("");
  const [enrollPaperId, setEnrollPaperId] = useState("");
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [enrollBusy, setEnrollBusy] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    // Release the camera on unmount regardless of which screen we leave from.
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const loadSession = async () => {
    try {
      const s = await api<SessionView>("/student/exam/session");
      setSession(s);
      setNeedsEnrollment(false);
      if (s.status === "IN_PROGRESS") {
        const qs = await api<Question[]>(`/student/exam/questions?sessionId=${s.sessionId}`);
        setQuestions(qs);
        setAnswers(
          Object.fromEntries(
            qs.map((q) => [
              q.questionId,
              { selectedOptionIndex: null, markedForReview: false, visited: false },
            ]),
          ),
        );
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNeedsEnrollment(true);
        return;
      }
      setError(err instanceof ApiError ? err.message : String(err));
    }
  };
  useEffect(() => {
    loadSession();
  }, []);

  async function startCamera() {
    setEnrollError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      setCameraActive(true);
      // The <video> element only mounts once cameraActive is true, so attach
      // the stream on the next tick once the ref is actually available.
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 0);
    } catch {
      setEnrollError("Couldn't access the camera — check your browser's camera permission for this site.");
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    setPhotoDataUrl(canvas.toDataURL("image/jpeg", 0.85));
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }

  function retakePhoto() {
    setPhotoDataUrl(null);
    startCamera();
  }

  async function onEnrollSubmit() {
    setEnrollError(null);
    setEnrollBusy(true);
    try {
      await api("/student/exam/enroll", {
        method: "POST",
        body: JSON.stringify({
          applicationId: enrollAppId,
          paperId: enrollPaperId,
          photoDataUrl: photoDataUrl ?? undefined,
        }),
      });
      await loadSession();
    } catch (err) {
      setEnrollError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setEnrollBusy(false);
    }
  }

  const remainingSeconds = useMemo(() => {
    if (!session) return 0;
    return Math.max(0, Math.floor((new Date(session.examWindowCloseAt).getTime() - now) / 1000));
  }, [session, now]);

  async function onStart() {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const qs = await api<Question[]>("/student/exam/start", {
        method: "POST",
        body: JSON.stringify({ sessionId: session.sessionId }),
      });
      setQuestions(qs);
      setAnswers(
        Object.fromEntries(
          qs.map((q) => [
            q.questionId,
            { selectedOptionIndex: null, markedForReview: false, visited: false },
          ]),
        ),
      );
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

  const minutes = String(Math.floor(remainingSeconds / 60)).padStart(2, "0");
  const seconds = String(remainingSeconds % 60).padStart(2, "0");
  const lowTime = remainingSeconds < 300;

  const examChrome = (right?: React.ReactNode) => (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
        <Brand compact subLabel="Candidate client" />
        <div className="flex items-center gap-3">
          {right}
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </div>
    </header>
  );

  /* ---------- Submitted ---------- */
  if (submitResult) {
    return (
      <div className="min-h-screen">
        {examChrome()}
        <div className="mx-auto max-w-lg px-5 py-16">
          <Card>
            <CardHeader>
              <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-full border border-success/40 bg-success/10 text-success">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <CardTitle>Your answers are submitted</CardTitle>
              <CardDescription>
                They were encrypted, uploaded to 0G Storage, and anchored on 0G Chain. The anchor is
                write-once — nothing, including a second submission, can overwrite it.
              </CardDescription>
            </CardHeader>
            <div className="rounded-md border border-border bg-background/40 px-4 py-3">
              <p className="ui-label mb-1.5">0G Chain anchor transaction</p>
              <HashValue value={submitResult.chainTxHash} head={14} tail={10} />
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Keep this transaction hash. Once results are published you can check your own result
              against it from the{" "}
              <Link to="/verify" className="text-primary hover:underline">
                public verification page
              </Link>
              , without needing an account or trusting this platform.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  /* ---------- Self-enrollment ---------- */
  if (needsEnrollment) {
    return (
      <div className="min-h-screen">
        {examChrome()}
        <div className="mx-auto max-w-lg px-5 py-16">
          <Card>
            <CardHeader>
              <CardTitle>Enroll for an exam</CardTitle>
              <CardDescription>
                You don&apos;t have an active exam session yet. Enter your Application ID and the
                Paper ID for today&apos;s session — this binds it to your account.
              </CardDescription>
            </CardHeader>
            <div className="space-y-3">
              <Field label="Application ID">
                <Input
                  value={enrollAppId}
                  onChange={(e) => setEnrollAppId(e.target.value)}
                  placeholder="e.g. APP-000123"
                  className="font-mono text-xs"
                />
              </Field>
              <Field label="Paper ID">
                <Input
                  value={enrollPaperId}
                  onChange={(e) => setEnrollPaperId(e.target.value)}
                  placeholder="Given to you by your center or admin"
                  className="font-mono text-xs"
                />
              </Field>

              <div className="rounded-md border border-border bg-background/40 p-3">
                <p className="ui-label mb-2">Identity photo (optional, for now)</p>
                {photoDataUrl ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={photoDataUrl}
                      alt="Captured identity"
                      className="h-20 w-20 rounded-md border border-border object-cover"
                    />
                    <Button variant="outline" size="sm" onClick={retakePhoto}>
                      <RotateCcw className="h-3.5 w-3.5" />
                      Retake
                    </Button>
                  </div>
                ) : cameraActive ? (
                  <div className="space-y-2">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full max-w-xs rounded-md border border-border"
                    />
                    <Button size="sm" onClick={capturePhoto}>
                      <Camera className="h-3.5 w-3.5" />
                      Capture photo
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={startCamera}>
                    <Camera className="h-3.5 w-3.5" />
                    Enable camera
                  </Button>
                )}
                <p className="mt-2 text-2xs leading-relaxed text-muted-foreground">
                  A placeholder for a real identity check — see the platform&apos;s future-scale
                  plan. Any photo is accepted for this demo; enrolling without one is fine too.
                </p>
              </div>

              {enrollError ? (
                <p className="rounded-md border border-danger/30 bg-danger/[0.07] px-3 py-2 text-xs text-danger">
                  {enrollError}
                </p>
              ) : null}

              <Button
                className="w-full"
                disabled={enrollBusy || !enrollAppId || !enrollPaperId}
                onClick={onEnrollSubmit}
              >
                {enrollBusy ? "Enrolling…" : "Enroll"}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  /* ---------- Error / loading ---------- */
  if (error) {
    return (
      <div className="min-h-screen">
        {examChrome()}
        <div className="mx-auto max-w-lg px-5 py-16">
          <ErrorState title="Something went wrong" description={error} />
        </div>
      </div>
    );
  }
  if (!session) {
    return (
      <div className="min-h-screen">
        {examChrome()}
        <div className="mx-auto max-w-lg px-5 py-16">
          <LoadingLine label="Loading your session" />
        </div>
      </div>
    );
  }

  /* ---------- Pre-exam ---------- */
  if (session.status !== "IN_PROGRESS" || !questions) {
    return (
      <div className="min-h-screen">
        {examChrome()}
        <div className="mx-auto max-w-lg px-5 py-16">
          <Card>
            <CardHeader action={<Badge tone="neutral">{session.questionCount} questions</Badge>}>
              <CardTitle>Your assessment</CardTitle>
              <CardDescription>
                Opens {new Date(session.examStartAt).toLocaleString()} · closes{" "}
                {new Date(session.examWindowCloseAt).toLocaleString()}
              </CardDescription>
            </CardHeader>

            {session.paperReady ? (
              <>
                <ul className="mb-5 space-y-2 text-xs leading-relaxed text-muted-foreground">
                  <li>· Every candidate gets the same questions in a personally randomized order.</li>
                  <li>· Answers save automatically as you go.</li>
                  <li>· Submitting is final and is anchored on-chain.</li>
                </ul>
                <Button className="w-full" size="lg" disabled={busy} onClick={onStart}>
                  {busy ? "Starting…" : "Start exam"}
                </Button>
              </>
            ) : (
              <div className="rounded-md border border-warning/30 bg-warning/[0.07] px-4 py-3">
                <p className="text-sm font-medium text-warning">Not startable yet</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  The paper&apos;s status is{" "}
                  <span className="font-mono text-foreground">{session.paperStatus}</span>. Its
                  content key is sealed with drand/tlock and cannot be unsealed until the exam
                  window opens — there is no backend override, for anyone.
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  }

  /* ---------- In progress ---------- */
  const q = questions[current];
  const qState = answers[q.questionId];
  const answeredCount = Object.values(answers).filter((a) => a.selectedOptionIndex !== null).length;
  const markedCount = Object.values(answers).filter((a) => a.markedForReview).length;

  return (
    <div className="min-h-screen">
      {examChrome(
        <div
          className={cn(
            "flex items-center gap-2 rounded-md border px-3 py-1.5 font-mono text-sm tabular-nums",
            lowTime
              ? "border-danger/40 bg-danger/10 text-danger"
              : "border-border bg-muted/40 text-foreground",
          )}
        >
          <Timer className="h-3.5 w-3.5" />
          {minutes}:{seconds}
        </div>,
      )}

      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[1fr_268px]">
        <div className="min-w-0">
          <Card>
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3">
              <span className="flex items-baseline gap-2">
                <span className="ui-label">Question</span>
                <span className="font-mono text-sm tabular-nums text-foreground">
                  {current + 1}
                  <span className="text-muted-foreground"> / {questions.length}</span>
                </span>
              </span>
              <div className="flex items-center gap-2">
                {qState?.markedForReview ? (
                  <Badge tone="pending" dot>
                    Marked
                  </Badge>
                ) : null}
                <Badge tone="neutral">{q.marks} marks</Badge>
              </div>
            </div>

            <p className="mb-5 text-[15px] leading-relaxed text-foreground">{q.text}</p>

            <div className="space-y-2">
              {q.options.map((opt, i) => {
                const selected = qState?.selectedOptionIndex === i;
                return (
                  <label
                    key={i}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-md border px-3.5 py-3 text-sm transition-colors",
                      selected
                        ? "border-primary/60 bg-primary/[0.09] text-foreground"
                        : "border-border hover:border-border-strong hover:bg-muted/40",
                    )}
                  >
                    <input
                      type="radio"
                      name={q.questionId}
                      className="mt-0.5"
                      checked={selected}
                      onChange={() => saveAnswer(q.questionId, { selectedOptionIndex: i })}
                    />
                    <span
                      className={cn(
                        "mt-px w-4 shrink-0 font-mono text-2xs",
                        selected ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="min-w-0 leading-relaxed">{opt.text}</span>
                  </label>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => saveAnswer(q.questionId, { selectedOptionIndex: null })}
              >
                <X className="h-3.5 w-3.5" />
                Clear response
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  saveAnswer(q.questionId, { markedForReview: !qState?.markedForReview })
                }
              >
                <Flag className="h-3.5 w-3.5" />
                {qState?.markedForReview ? "Unmark review" : "Mark for review"}
              </Button>
              <div className="ml-auto flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={current === 0}
                  onClick={() => setCurrent((c) => c - 1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </Button>
                <Button
                  size="sm"
                  disabled={current === questions.length - 1}
                  onClick={() => {
                    saveAnswer(q.questionId, {});
                    setCurrent((c) => c + 1);
                  }}
                >
                  Save &amp; next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-[73px] lg:h-fit">
          <Card>
            <CardHeader>
              <CardTitle>Question palette</CardTitle>
              <CardDescription>
                {answeredCount}/{questions.length} answered
                {markedCount > 0 ? ` · ${markedCount} marked` : ""}
              </CardDescription>
            </CardHeader>

            <div className="grid grid-cols-6 gap-1.5 lg:grid-cols-5">
              {questions.map((qq, i) => {
                const st = answers[qq.questionId];
                const cls = st?.markedForReview
                  ? "border border-accent/50 bg-accent/20 text-accent"
                  : st && st.selectedOptionIndex !== null
                    ? "border border-success/50 bg-success/20 text-success"
                    : st?.visited
                      ? "border border-warning/50 text-warning"
                      : "border border-border text-muted-foreground hover:border-border-strong";
                return (
                  <button
                    key={qq.questionId}
                    onClick={() => setCurrent(i)}
                    aria-label={`Go to question ${i + 1}`}
                    aria-current={i === current}
                    className={cn(
                      "h-8 rounded-md font-mono text-xs tabular-nums transition-colors",
                      cls,
                      i === current && "ring-2 ring-primary/80 ring-offset-1 ring-offset-card",
                    )}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            <dl className="mt-4 space-y-1.5 border-t border-border pt-4 text-2xs">
              <LegendRow className="border-success/50 bg-success/20" label="Answered" value={answeredCount} />
              <LegendRow className="border-accent/50 bg-accent/20" label="Marked for review" value={markedCount} />
              <LegendRow
                className="border-warning/50"
                label="Seen, not answered"
                value={
                  Object.values(answers).filter(
                    (a) => a.visited && a.selectedOptionIndex === null && !a.markedForReview,
                  ).length
                }
              />
              <LegendRow
                className="border-border"
                label="Not visited"
                value={Object.values(answers).filter((a) => !a.visited).length}
              />
            </dl>

            <Button
              className="mt-5 w-full"
              variant="danger-outline"
              disabled={busy}
              onClick={onSubmit}
            >
              {busy ? "Submitting…" : "Submit exam"}
            </Button>
            <p className="mt-2 text-center text-2xs text-muted-foreground">
              Submitting is final and anchored on-chain.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function LegendRow({
  className,
  label,
  value,
}: {
  className: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="flex items-center gap-2 text-muted-foreground">
        <span className={cn("h-2.5 w-2.5 rounded-sm border", className)} />
        {label}
      </dt>
      <dd className="font-mono tabular-nums text-muted-foreground">{value}</dd>
    </div>
  );
}
