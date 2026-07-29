import { useEffect, useState } from "react";
import { Plus, ScrollText, X } from "lucide-react";
import { api, ApiError } from "@/lib/api.js";
import { Button } from "@/components/ui/button.js";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.js";
import { Field, Input, Label, Select } from "@/components/ui/input.js";
import { ErrorState } from "@/components/ui/empty-state.js";
import { PageHeader } from "@/components/ui/page-header.js";
import { Badge } from "@/components/ui/badge.js";
import { DataTable, type Column } from "@/components/ui/table.js";

interface Chapter {
  id: string;
  name: string;
  subjectId: string;
}
interface Subject {
  id: string;
  name: string;
  chapters: Chapter[];
}
interface SubjectAllocRow {
  subjectId: string;
  questionCount: number;
  marksEach: number;
}
interface ChapterAllocRow {
  chapterId: string;
  questionCount: number;
  easy: number;
  medium: number;
}
interface BlueprintRow {
  id: string;
  title: string;
  publishedAt: string | null;
  totalMarks: number;
  totalQuestions: number;
}

export default function BlueprintGenerator() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [blueprints, setBlueprints] = useState<BlueprintRow[] | null>(null);
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
  const allocatedQuestions = subjectRows.reduce((n, r) => n + (r.questionCount || 0), 0);
  const allocatedMarks = subjectRows.reduce(
    (n, r) => n + (r.questionCount || 0) * (r.marksEach || 0),
    0,
  );
  const hasInvalidDifficultyPct = chapterRows.some((r) => r.easy + r.medium > 100);

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
            difficultyPct: { EASY: r.easy, MEDIUM: r.medium, HARD: 100 - r.easy - r.medium },
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

  const columns: Column<BlueprintRow>[] = [
    {
      key: "title",
      header: "Blueprint",
      cell: (b) => (
        <span>
          <span className="block text-foreground">{b.title}</span>
          <span className="block font-mono text-2xs text-muted-foreground">
            {b.totalQuestions} questions · {b.totalMarks} marks
          </span>
        </span>
      ),
    },
    {
      key: "state",
      header: "State",
      align: "right",
      cell: (b) =>
        b.publishedAt ? (
          <Badge tone="success" dot>
            Published
          </Badge>
        ) : (
          <Button size="xs" onClick={() => onPublish(b.id)}>
            Publish
          </Button>
        ),
      width: "w-32",
    },
  ];

  return (
    <>
      <PageHeader
        title="Blueprints"
        description="A blueprint fixes the shape of a paper — subject split, chapter split, difficulty mix, marks and negative marking — before a single question is selected. It must be published before a paper can be generated from it."
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle>New blueprint</CardTitle>
            <CardDescription>
              Allocations are the constraint the selection engine has to satisfy from the accepted
              question bank.
            </CardDescription>
          </CardHeader>

          <div className="space-y-5">
            <Field label="Title">
              <Input
                placeholder="e.g. Physics — Session 1, 2026"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Total marks">
                <Input
                  type="number"
                  value={totalMarks}
                  onChange={(e) => setTotalMarks(+e.target.value)}
                />
              </Field>
              <Field label="Total questions">
                <Input
                  type="number"
                  value={totalQuestions}
                  onChange={(e) => setTotalQuestions(+e.target.value)}
                />
              </Field>
              <Field label="Negative marking">
                <Input
                  type="number"
                  step="0.01"
                  value={negativeMarking}
                  onChange={(e) => setNegativeMarking(+e.target.value)}
                />
              </Field>
            </div>

            <section className="space-y-2 rounded-md border border-border bg-background/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <Label>Subject allocations</Label>
                <span className="font-mono text-2xs tabular-nums text-muted-foreground">
                  {allocatedQuestions}/{totalQuestions} questions · {allocatedMarks}/{totalMarks}{" "}
                  marks
                </span>
              </div>
              {subjectRows.length === 0 ? (
                <p className="py-1 text-xs text-muted-foreground">
                  No subject allocation yet — add at least one.
                </p>
              ) : null}
              {subjectRows.map((row, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select
                    value={row.subjectId}
                    onChange={(e) =>
                      setSubjectRows(
                        subjectRows.map((r, j) => (j === i ? { ...r, subjectId: e.target.value } : r)),
                      )
                    }
                    className="flex-[2]"
                  >
                    <option value="">Subject</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="number"
                    aria-label="Questions"
                    title="Questions"
                    value={row.questionCount}
                    onChange={(e) =>
                      setSubjectRows(
                        subjectRows.map((r, j) =>
                          j === i ? { ...r, questionCount: +e.target.value } : r,
                        ),
                      )
                    }
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    aria-label="Marks each"
                    title="Marks each"
                    value={row.marksEach}
                    onChange={(e) =>
                      setSubjectRows(
                        subjectRows.map((r, j) =>
                          j === i ? { ...r, marksEach: +e.target.value } : r,
                        ),
                      )
                    }
                    className="flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove allocation"
                    onClick={() => setSubjectRows(subjectRows.filter((_, j) => j !== i))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setSubjectRows([...subjectRows, { subjectId: "", questionCount: 10, marksEach: 4 }])
                }
              >
                <Plus className="h-3.5 w-3.5" />
                Subject allocation
              </Button>
            </section>

            <section className="space-y-2 rounded-md border border-border bg-background/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <Label>Chapter allocations</Label>
                <span className="font-mono text-2xs text-muted-foreground">
                  chapter · count · easy% · medium% · hard%
                </span>
              </div>
              {chapterRows.length === 0 ? (
                <p className="py-1 text-xs text-muted-foreground">
                  No chapter allocation yet — add at least one.
                </p>
              ) : null}
              {chapterRows.map((row, i) => {
                const hard = 100 - row.easy - row.medium;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <Select
                      value={row.chapterId}
                      onChange={(e) =>
                        setChapterRows(
                          chapterRows.map((r, j) =>
                            j === i ? { ...r, chapterId: e.target.value } : r,
                          ),
                        )
                      }
                      className="flex-[2]"
                    >
                      <option value="">Chapter</option>
                      {allChapters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="number"
                      aria-label="Question count"
                      title="Question count"
                      value={row.questionCount}
                      onChange={(e) =>
                        setChapterRows(
                          chapterRows.map((r, j) =>
                            j === i ? { ...r, questionCount: +e.target.value } : r,
                          ),
                        )
                      }
                      className="w-20"
                    />
                    <Input
                      type="number"
                      aria-label="Easy percent"
                      title="Easy %"
                      value={row.easy}
                      onChange={(e) =>
                        setChapterRows(
                          chapterRows.map((r, j) => (j === i ? { ...r, easy: +e.target.value } : r)),
                        )
                      }
                      className="w-20"
                    />
                    <Input
                      type="number"
                      aria-label="Medium percent"
                      title="Medium %"
                      value={row.medium}
                      onChange={(e) =>
                        setChapterRows(
                          chapterRows.map((r, j) =>
                            j === i ? { ...r, medium: +e.target.value } : r,
                          ),
                        )
                      }
                      className="w-20"
                    />
                    <span
                      title="Hard % — derived as 100 - easy% - medium%"
                      className={`w-16 shrink-0 text-right font-mono text-xs tabular-nums ${
                        hard < 0 ? "text-danger" : "text-muted-foreground"
                      }`}
                    >
                      {hard}% hard
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove allocation"
                      onClick={() => setChapterRows(chapterRows.filter((_, j) => j !== i))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
              {hasInvalidDifficultyPct ? (
                <p className="text-xs text-danger">
                  Easy % + Medium % exceeds 100 on at least one row — hard % would go negative.
                </p>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setChapterRows([
                    ...chapterRows,
                    { chapterId: "", questionCount: 5, easy: 40, medium: 40 },
                  ])
                }
              >
                <Plus className="h-3.5 w-3.5" />
                Chapter allocation
              </Button>
            </section>

            {error ? <ErrorState title="Couldn't create the blueprint" description={error} /> : null}

            <Button
              className="w-full"
              disabled={
                busy ||
                !title ||
                subjectRows.length === 0 ||
                chapterRows.length === 0 ||
                hasInvalidDifficultyPct
              }
              onClick={onCreate}
            >
              {busy ? "Creating…" : "Create blueprint"}
            </Button>
          </div>
        </Card>

        <Card flush className="h-fit">
          <CardHeader className="mb-0 px-5 pt-5">
            <CardTitle>Blueprints</CardTitle>
            <CardDescription>Publish before generating a paper.</CardDescription>
          </CardHeader>
          <div className="mt-4">
            <DataTable
              columns={columns}
              rows={blueprints}
              rowKey={(b) => b.id}
              emptyIcon={<ScrollText className="h-4 w-4" />}
              emptyTitle="No blueprints yet"
              emptyDescription="Define the shape of a paper on the left to get started."
            />
          </div>
        </Card>
      </div>
    </>
  );
}
