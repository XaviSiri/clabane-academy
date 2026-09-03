import { prisma } from "@/lib/db";
import { areAllLessonsComplete } from "./progress";
import { checkAndIssueCertificate } from "./certificate";
import { recordAuditLog } from "@/lib/audit";

export class AssessmentError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

/**
 * Starts a new attempt. Enforces the business rule that an employee must
 * finish all lessons in the module before attempting its assessment, and
 * records every attempt (never overwrites a previous one) so the full
 * history (e.g. Attempt 1: 65%, Attempt 2: 75%, Attempt 3: 90%) is
 * reconstructable.
 */
export async function startAssessmentAttempt(employeeId: string, assessmentId: string) {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: { module: true },
  });
  if (!assessment || !assessment.isPublished) {
    throw new AssessmentError("Assessment not found.", 404);
  }

  const allComplete = await areAllLessonsComplete(employeeId, assessment.moduleId);
  if (!allComplete) {
    throw new AssessmentError(
      "Complete all lessons in this module before taking the assessment.",
      400
    );
  }

  const lastAttempt = await prisma.assessmentAttempt.findFirst({
    where: { employeeId, assessmentId },
    orderBy: { attemptNumber: "desc" },
  });

  if (lastAttempt?.status === "IN_PROGRESS") {
    return lastAttempt;
  }

  return prisma.assessmentAttempt.create({
    data: {
      employeeId,
      assessmentId,
      attemptNumber: (lastAttempt?.attemptNumber ?? 0) + 1,
      status: "IN_PROGRESS",
    },
  });
}

interface SubmittedAnswer {
  questionId: string;
  selectedOptionId: string;
}

const PASS_MARK_FALLBACK = Number(process.env.DEFAULT_ASSESSMENT_PASS_MARK ?? 80);

export async function submitAssessmentAttempt(params: {
  employeeId: string;
  attemptId: string;
  answers: SubmittedAnswer[];
  ipAddress?: string | null;
}) {
  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: params.attemptId },
    include: {
      assessment: { include: { questions: { include: { options: true } } } },
    },
  });

  if (!attempt || attempt.employeeId !== params.employeeId) {
    throw new AssessmentError("Attempt not found.", 404);
  }
  if (attempt.status !== "IN_PROGRESS") {
    throw new AssessmentError("This attempt has already been submitted.", 400);
  }

  const activeQuestions = attempt.assessment.questions.filter((q) => q.isActive);
  const totalMarks = activeQuestions.reduce((sum, q) => sum + q.marks, 0) || 1;

  let earnedMarks = 0;
  const answerRows = activeQuestions.map((question) => {
    const submitted = params.answers.find((a) => a.questionId === question.id);
    const selectedOption = question.options.find((o) => o.id === submitted?.selectedOptionId);
    const isCorrect = !!selectedOption?.isCorrect;
    if (isCorrect) earnedMarks += question.marks;
    return {
      questionId: question.id,
      selectedOptionId: selectedOption?.id ?? null,
      isCorrect,
    };
  });

  const scorePercent = Math.round((earnedMarks / totalMarks) * 100);
  const passMark = attempt.assessment.passMarkPercent || PASS_MARK_FALLBACK;
  const passed = scorePercent >= passMark;
  const submittedAt = new Date();
  const timeTakenSeconds = Math.max(
    0,
    Math.round((submittedAt.getTime() - attempt.startedAt.getTime()) / 1000)
  );

  await prisma.$transaction([
    ...answerRows.map((row) =>
      prisma.attemptAnswer.create({
        data: { attemptId: attempt.id, ...row },
      })
    ),
    prisma.assessmentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: passed ? "PASSED" : "FAILED",
        scorePercent,
        submittedAt,
        timeTakenSeconds,
      },
    }),
  ]);

  await recordAuditLog({
    userId: params.employeeId,
    action: "ASSESSMENT_SUBMITTED",
    entityType: "Assessment",
    entityId: attempt.assessmentId,
    metadata: { attemptNumber: attempt.attemptNumber, scorePercent, passed },
    ipAddress: params.ipAddress,
  });

  if (passed) {
    await prisma.moduleProgress.upsert({
      where: {
        employeeId_moduleId: { employeeId: params.employeeId, moduleId: attempt.assessment.moduleId },
      },
      update: { status: "COMPLETED", completedAt: new Date() },
      create: {
        employeeId: params.employeeId,
        moduleId: attempt.assessment.moduleId,
        status: "COMPLETED",
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    await checkAndIssueCertificate(params.employeeId, params.ipAddress);
  } else {
    await prisma.moduleProgress.upsert({
      where: {
        employeeId_moduleId: { employeeId: params.employeeId, moduleId: attempt.assessment.moduleId },
      },
      update: { status: "FAILED" },
      create: {
        employeeId: params.employeeId,
        moduleId: attempt.assessment.moduleId,
        status: "FAILED",
        startedAt: new Date(),
      },
    });
  }

  return {
    scorePercent,
    passed,
    passMark,
    attemptNumber: attempt.attemptNumber,
    allowAnswerReview: attempt.assessment.allowAnswerReview,
  };
}
