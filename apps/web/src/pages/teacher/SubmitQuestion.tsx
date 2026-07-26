import { useEffect, useState } from "react";
import { Difficulty, BloomLevel } from "@nvei/shared";
import { api, ApiError } from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.js";

interface Chapter { id: string; name: string }
interface Subject { id: string; name: string; chapters: Chapter[] }
interface Question { id: string; status: string }

type Stage = "idle" | "creating" | "submitting" | "pipeline" | "done" | "error";

export default function SubmitQuestion() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [text, setText] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [difficulty, setDifficulty] = useState<(typeof Difficulty)[number]>("MEDIUM");
  const [bloom, setBloom] = useState<(typeof BloomLevel)[number]>("UNDERSTAND");
  const [stage, setStage] = useState<Stage>("idle");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Subject[]>("/teacher/subjects").then(setSubjects).catch((e) => setError(String(e)));
  }, []);

  const selectedSubject = subjects.find((s) => s.id === subjectId);

  async function pollStatus(questionId: string) {
    setStage("pipeline");
    const started = Date.now();
    while (Date.now() - started < 120_000) {
      const res = await api<{ status: string }>(`/teacher/questions/${questionId}/status`);
      setStatus(res.status);
      if (res.status === "ACCEPTED" || res.status === "REJECTED") {
        setStage("done");
        return;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  async function onSubmit() {
    setError(null);
    try {
      setStage("creating");
      const question = await api<Question>("/teacher/questions", {
        method: "POST",
        body: JSON.stringify({
          subjectId,
          chapterId,
          text,
          options: options.map((o, i) => ({ text: o, isCorrect: i === correctIndex })),
          explanation,
          difficultySuggested: difficulty,
          bloomLevelSuggested: bloom,
          images: [],
        }),
      });
      setStage("submitting");
      await api(`/teacher/questions/${question.id}/submit`, { method: "POST" });
      await pollStatus(question.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
      setStage("error");
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Submit a question</CardTitle>
          <CardDescription>Enters the confidential validation pipeline on submit</CardDescription>
        </CardHeader>
        <div className="space-y-3">
          <select
            value={subjectId}
            onChange={(e) => { setSubjectId(e.target.value); setChapterId(""); }}
            className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
          >
            <option value="">Select subject</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select
            value={chapterId}
            onChange={(e) => setChapterId(e.target.value)}
            disabled={!selectedSubject}
            className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
          >
            <option value="">Select chapter</option>
            {selectedSubject?.chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <textarea
            placeholder="Question text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
            rows={3}
          />
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct"
                checked={correctIndex === i}
                onChange={() => setCorrectIndex(i)}
              />
              <input
                placeholder={`Option ${i + 1}`}
                value={opt}
                onChange={(e) => setOptions(options.map((o, j) => (j === i ? e.target.value : o)))}
                className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
              />
            </div>
          ))}
          <textarea
            placeholder="Explanation"
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
            rows={2}
          />
          <div className="flex gap-2">
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)} className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm">
              {Difficulty.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={bloom} onChange={(e) => setBloom(e.target.value as typeof bloom)} className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm">
              {BloomLevel.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button
            onClick={onSubmit}
            disabled={stage === "creating" || stage === "submitting" || stage === "pipeline" || !subjectId || !chapterId || !text}
            className="w-full"
          >
            {stage === "idle" || stage === "error" || stage === "done" ? "Submit question" : "Working…"}
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pipeline status</CardTitle>
          <CardDescription>Live view of the confidential-compute pipeline</CardDescription>
        </CardHeader>
        <ol className="space-y-2 text-sm">
          {["DRAFT", "SUBMITTED", "VALIDATING", "ACCEPTED / REJECTED"].map((step) => (
            <li key={step} className={status === step || (step.includes(status ?? "")) ? "text-accent" : "text-muted-foreground"}>
              {step}
            </li>
          ))}
        </ol>
        {stage === "done" && (
          <p className="mt-4 text-sm">
            Final status: <span className="text-foreground">{status}</span>
          </p>
        )}
      </Card>
    </div>
  );
}
