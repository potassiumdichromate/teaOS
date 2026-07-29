import { describe, expect, it } from "vitest";
import { scoreAnswers, type MasterPaperQuestion } from "./scoring.js";

const questions: MasterPaperQuestion[] = [
  { questionId: "q1", marks: 4, options: [{ text: "a", isCorrect: false }, { text: "b", isCorrect: true }] },
  { questionId: "q2", marks: 4, options: [{ text: "a", isCorrect: true }, { text: "b", isCorrect: false }] },
  { questionId: "q3", marks: 2, options: [{ text: "a", isCorrect: false }, { text: "b", isCorrect: true }] },
];

describe("scoreAnswers", () => {
  it("awards full marks for a correct answer", () => {
    const result = scoreAnswers(questions, [{ questionId: "q1", selectedOptionIndex: 1, markedForReview: false }], 0.25);
    expect(result).toEqual({ rawScore: 4, correctCount: 1, incorrectCount: 0, unattemptedCount: 0 });
  });

  it("deducts negative marking for a wrong answer", () => {
    const result = scoreAnswers(questions, [{ questionId: "q1", selectedOptionIndex: 0, markedForReview: false }], 0.25);
    expect(result).toEqual({ rawScore: -1, correctCount: 0, incorrectCount: 1, unattemptedCount: 0 });
  });

  it("scores an unattempted question as zero, not wrong", () => {
    const result = scoreAnswers(questions, [{ questionId: "q1", selectedOptionIndex: null, markedForReview: true }], 0.25);
    expect(result).toEqual({ rawScore: 0, correctCount: 0, incorrectCount: 0, unattemptedCount: 1 });
  });

  it("applies zero negative marking when the blueprint has none", () => {
    const result = scoreAnswers(questions, [{ questionId: "q1", selectedOptionIndex: 0, markedForReview: false }], 0);
    expect(result).toEqual({ rawScore: 0, correctCount: 0, incorrectCount: 1, unattemptedCount: 0 });
  });

  it("ignores an answer for a question that isn't in the master paper", () => {
    const result = scoreAnswers(questions, [{ questionId: "not-in-paper", selectedOptionIndex: 0, markedForReview: false }], 0.25);
    expect(result).toEqual({ rawScore: 0, correctCount: 0, incorrectCount: 0, unattemptedCount: 0 });
  });

  it("aggregates a full attempt across multiple questions correctly", () => {
    const result = scoreAnswers(
      questions,
      [
        { questionId: "q1", selectedOptionIndex: 1, markedForReview: false }, // correct, +4
        { questionId: "q2", selectedOptionIndex: 1, markedForReview: false }, // wrong, -1
        { questionId: "q3", selectedOptionIndex: null, markedForReview: false }, // unattempted
      ],
      0.25,
    );
    expect(result).toEqual({ rawScore: 3, correctCount: 1, incorrectCount: 1, unattemptedCount: 1 });
  });

  it("treats an out-of-range selectedOptionIndex as incorrect rather than throwing", () => {
    const result = scoreAnswers(questions, [{ questionId: "q1", selectedOptionIndex: 99, markedForReview: false }], 0.25);
    expect(result).toEqual({ rawScore: -1, correctCount: 0, incorrectCount: 1, unattemptedCount: 0 });
  });
});
