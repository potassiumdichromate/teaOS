import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.js";

interface Chapter { id: string; name: string; subjectId: string }
interface Subject { id: string; name: string; chapters: Chapter[] }
interface SubjectAllocRow { subjectId: string; questionCount: number; marksEach: number }
interface ChapterAllocRow { chapterId: string; questionCount: number; easy: number; medium: number; hard: number }
interface BlueprintRow {
  id: string;
  title: string;
  publishedAt: string | null;
  totalMarks: number;
  totalQuestions: number;
}

const inputCls = "w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm";

export default function BlueprintGenerator() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [blueprints, setBlueprints] = useState<BlueprintRow[]>([]);
  const [title, setTitle] = useState("");
  const [totalMarks, setTotalMarks] = useState(100);
  const [totalQuestions, setTotalQuestions] = useState(50);
  const [negativeMarking, setNegativeMarking] = useState(0.25);
  const [subjectRows, setSubjectRows] = useState<SubjectAllocRow[]>([]);
  const [chapterRows, setChapterRows] = useState<ChapterAllocRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    api<Subject[]>("/admin/subjects").then(setSubjects);
    api<BlueprintRow[]>("/admin/blueprints").then(setBlueprints);
  };
  useEffect(refresh, []);

  const allChapters = subjects.flatMap((s) => s.chapters);

  async function onCreate() {
    setError(null);
    setBusy(true);
    try {
      await api("/admin/blueprints", {
        method: "POST",
        body: JSON.stringify({
          title,
          totalMarks,
          totalQuestions,
          negativeMarking,
          subjectAllocations: subjectRows,
          chapterAllocations: chapterRows.map((r) => ({
            chapterId: r.chapterId,
            questionCount: r.questionCount,
            difficultyPct: { EASY: r.easy, MEDIUM: r.medium, HARD: r.hard },
          })),
        }),
      });
      setTitle("");
      setSubjectRows([]);
      setChapterRows([]);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onPublish(id: string) {
    await api(`/admin/blueprints/${id}/publish`, { method: "POST" });
    refresh();
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>New blueprint</CardTitle>
          <CardDescription>Subject %, chapter %, difficulty %, marks, question count, negative marking</CardDescription>
        </CardHeader>
        <div className="space-y-3">
          <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
          <div className="grid grid-cols-3 gap-2">
            <input type="number" placeholder="Total marks" value={totalMarks} onChange={(e) => setTotalMarks(+e.target.value)} className={inputCls} />
            <input type="number" placeholder="Total questions" value={totalQuestions} onChange={(e) => setTotalQuestions(+e.target.value)} className={inputCls} />
            <input type="number" step="0.01" placeholder="Negative marking" value={negativeMarking} onChange={(e) => setNegativeMarking(+e.target.value)} className={inputCls} />
          </div>

          <p className="pt-2 text-sm text-muted-foreground">Subject allocations</p>
          {subjectRows.map((row, i) => (
            <div key={i} className="grid grid-cols-3 gap-2">
              <select value={row.subjectId} onChange={(e) => setSubjectRows(subjectRows.map((r, j) => (j === i ? { ...r, subjectId: e.target.value } : r)))} className={inputCls}>
                <option value="">Subject</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input type="number" placeholder="Questions" value={row.questionCount} onChange={(e) => setSubjectRows(subjectRows.map((r, j) => (j === i ? { ...r, questionCount: +e.target.value } : r)))} className={inputCls} />
              <input type="number" placeholder="Marks each" value={row.marksEach} onChange={(e) => setSubjectRows(subjectRows.map((r, j) => (j === i ? { ...r, marksEach: +e.target.value } : r)))} className={inputCls} />
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setSubjectRows([...subjectRows, { subjectId: "", questionCount: 10, marksEach: 4 }])}>
            + Subject allocation
          </Button>

          <p className="pt-2 text-sm text-muted-foreground">Chapter allocations</p>
          {chapterRows.map((row, i) => (
            <div key={i} className="grid grid-cols-5 gap-2">
              <select value={row.chapterId} onChange={(e) => setChapterRows(chapterRows.map((r, j) => (j === i ? { ...r, chapterId: e.target.value } : r)))} className={`${inputCls} col-span-2`}>
                <option value="">Chapter</option>
                {allChapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input type="number" placeholder="Count" value={row.questionCount} onChange={(e) => setChapterRows(chapterRows.map((r, j) => (j === i ? { ...r, questionCount: +e.target.value } : r)))} className={inputCls} />
              <input type="number" placeholder="Easy %" value={row.easy} onChange={(e) => setChapterRows(chapterRows.map((r, j) => (j === i ? { ...r, easy: +e.target.value } : r)))} className={inputCls} />
              <input type="number" placeholder="Med %" value={row.medium} onChange={(e) => setChapterRows(chapterRows.map((r, j) => (j === i ? { ...r, medium: +e.target.value } : r)))} className={inputCls} />
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setChapterRows([...chapterRows, { chapterId: "", questionCount: 5, easy: 40, medium: 40, hard: 20 }])}>
            + Chapter allocation
          </Button>

          {error && <p className="text-sm text-danger">{error}</p>}
          <Button className="w-full" disabled={busy || !title || subjectRows.length === 0 || chapterRows.length === 0} onClick={onCreate}>
            Create blueprint
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Blueprints</CardTitle>
          <CardDescription>Publish before generating a paper</CardDescription>
        </CardHeader>
        <div className="space-y-2">
          {blueprints.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
              <div>
                <p className="text-foreground">{b.title}</p>
                <p className="text-muted-foreground">{b.totalQuestions} questions · {b.totalMarks} marks</p>
              </div>
              {b.publishedAt ? (
                <span className="text-success">Published</span>
              ) : (
                <Button size="sm" onClick={() => onPublish(b.id)}>Publish</Button>
              )}
            </div>
          ))}
          {blueprints.length === 0 && <p className="text-sm text-muted-foreground">No blueprints yet.</p>}
        </div>
      </Card>
    </div>
  );
}
