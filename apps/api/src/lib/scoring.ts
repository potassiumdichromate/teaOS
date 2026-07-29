// Pure scoring logic extracted out of evaluation.service.ts's pipeline so it
// can be unit-tested without touching the DB, 0G Storage, 0G Chain, or the
// drand/tlock timelock — the correctness of this arithmetic is the single
// most safety-critical piece of the whole Evaluation Engine, and previously
// had zero automated coverage.
export interface MasterPaperQuestion {
  questionId: string;
  marks: number;
  options: { text: string; isCorrect: boolean }[];
}

export interface SubmittedAnswer {
  questionId: string;
  selectedOptionIndex: number | null;
  markedForReview: boolean;
}

export interface ScoreResult {
  rawScore: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
}

export function scoreAnswers(
  questions: MasterPaperQuestion[],
  answers: SubmittedAnswer[],
  negativeMarking: number,
): ScoreResult {
  const questionsById = new Map(questions.map((q) => [q.questionId, q]));
  let rawScore = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unattemptedCount = 0;

  for (const answer of answers) {
    const question = questionsById.get(answer.questionId);
    if (!question) continue;
    if (answer.selectedOptionIndex === null) {
      unattemptedCount++;
      continue;
    }
    const isCorrect = question.options[answer.selectedOptionIndex]?.isCorrect === true;
    if (isCorrect) {
      rawScore += question.marks;
      correctCount++;
    } else {
      rawScore -= question.marks * negativeMarking;
      incorrectCount++;
    }
  }

  return { rawScore, correctCount, incorrectCount, unattemptedCount };
}
