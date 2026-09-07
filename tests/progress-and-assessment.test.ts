import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import { createAdmin, createEmployee, createPublishedModuleWithAssessment } from "./factories";
import { markLessonComplete, areAllLessonsComplete, getEmployeeOnboardingSummary } from "@/lib/services/progress";
import { recordVideoProgress } from "@/lib/services/video-progress";
import { startAssessmentAttempt, submitAssessmentAttempt, AssessmentError } from "@/lib/services/assessment";
import { checkAndIssueCertificate } from "@/lib/services/certificate";

describe("lesson and module progress", () => {
  it("marks a text lesson complete and reflects it in the onboarding summary", async () => {
    const { user: admin } = await createAdmin();
    const { user: employee } = await createEmployee();
    const { module: mod, lesson } = await createPublishedModuleWithAssessment({ adminId: admin.id });

    let summary = await getEmployeeOnboardingSummary(employee.id);
    expect(summary.modules[0].status).toBe("NOT_STARTED");
    expect(summary.modules[0].lessonsCompleted).toBe(0);

    await markLessonComplete(employee.id, lesson.id);

    summary = await getEmployeeOnboardingSummary(employee.id);
    expect(summary.modules[0].status).toBe("IN_PROGRESS");
    expect(summary.modules[0].lessonsCompleted).toBe(1);
    expect(await areAllLessonsComplete(employee.id, mod.id)).toBe(true);
  });

  it("does not consider a module's lessons complete until all of them are", async () => {
    const { user: admin } = await createAdmin();
    const { user: employee } = await createEmployee();
    const { module: mod, lesson } = await createPublishedModuleWithAssessment({ adminId: admin.id });
    const secondLesson = await prisma.lesson.create({
      data: { moduleId: mod.id, slug: "lesson-two", title: "Lesson Two", order: 1, isPublished: true },
    });

    await markLessonComplete(employee.id, lesson.id);
    expect(await areAllLessonsComplete(employee.id, mod.id)).toBe(false);

    await markLessonComplete(employee.id, secondLesson.id);
    expect(await areAllLessonsComplete(employee.id, mod.id)).toBe(true);
  });
});

describe("video progress and completion threshold", () => {
  it("marks a video complete only once the configured threshold is reached", async () => {
    const { user: admin } = await createAdmin();
    const { user: employee } = await createEmployee();
    const { lesson } = await createPublishedModuleWithAssessment({ adminId: admin.id });

    const video = await prisma.video.create({
      data: {
        lessonId: lesson.id,
        title: "Intro Video",
        storageProvider: "local",
        storageBucket: "test",
        storageKey: "videos/intro.mp4",
        isPublished: true,
        completionThresholdPercent: 90,
        uploadedById: admin.id,
      },
    });

    let progress = await recordVideoProgress({
      employeeId: employee.id,
      videoId: video.id,
      positionSeconds: 30,
      watchedPercent: 50,
    });
    expect(progress.isCompleted).toBe(false);

    progress = await recordVideoProgress({
      employeeId: employee.id,
      videoId: video.id,
      positionSeconds: 90,
      watchedPercent: 92,
    });
    expect(progress.isCompleted).toBe(true);

    // A video-only lesson auto-completes once its videos are complete.
    const lessonProgress = await prisma.lessonProgress.findUnique({
      where: { employeeId_lessonId: { employeeId: employee.id, lessonId: lesson.id } },
    });
    expect(lessonProgress?.status).toBe("COMPLETED");
  });

  it("stays completed even if watched percentage later drops (no re-watch required)", async () => {
    const { user: admin } = await createAdmin();
    const { user: employee } = await createEmployee();
    const { lesson } = await createPublishedModuleWithAssessment({ adminId: admin.id });
    const video = await prisma.video.create({
      data: {
        lessonId: lesson.id,
        title: "Intro Video",
        storageProvider: "local",
        storageBucket: "test",
        storageKey: "videos/intro.mp4",
        isPublished: true,
        completionThresholdPercent: 90,
        uploadedById: admin.id,
      },
    });

    await recordVideoProgress({ employeeId: employee.id, videoId: video.id, positionSeconds: 100, watchedPercent: 95 });
    const afterSeek = await recordVideoProgress({
      employeeId: employee.id,
      videoId: video.id,
      positionSeconds: 5,
      watchedPercent: 5,
    });
    expect(afterSeek.isCompleted).toBe(true);
  });
});

describe("assessment engine", () => {
  it("blocks starting an assessment until all lessons in the module are complete", async () => {
    const { user: admin } = await createAdmin();
    const { user: employee } = await createEmployee();
    const { assessment } = await createPublishedModuleWithAssessment({ adminId: admin.id });

    await expect(startAssessmentAttempt(employee.id, assessment.id)).rejects.toThrow(AssessmentError);
  });

  it("scores correctly, enforces the 80% pass mark, and records every retake attempt", async () => {
    const { user: admin } = await createAdmin();
    const { user: employee } = await createEmployee();
    const { lesson, assessment, question } = await createPublishedModuleWithAssessment({
      adminId: admin.id,
      passMarkPercent: 80,
    });
    await markLessonComplete(employee.id, lesson.id);

    const wrongOption = question.options.find((o) => !o.isCorrect)!;
    const correctOption = question.options.find((o) => o.isCorrect)!;

    // Attempt 1: fail.
    const attempt1 = await startAssessmentAttempt(employee.id, assessment.id);
    const result1 = await submitAssessmentAttempt({
      employeeId: employee.id,
      attemptId: attempt1.id,
      answers: [{ questionId: question.id, selectedOptionId: wrongOption.id }],
    });
    expect(result1.passed).toBe(false);
    expect(result1.scorePercent).toBe(0);
    expect(result1.attemptNumber).toBe(1);

    let moduleProgress = await prisma.moduleProgress.findFirst({ where: { employeeId: employee.id } });
    expect(moduleProgress?.status).toBe("FAILED");

    // Attempt 2: pass.
    const attempt2 = await startAssessmentAttempt(employee.id, assessment.id);
    expect(attempt2.attemptNumber).toBe(2);
    const result2 = await submitAssessmentAttempt({
      employeeId: employee.id,
      attemptId: attempt2.id,
      answers: [{ questionId: question.id, selectedOptionId: correctOption.id }],
    });
    expect(result2.passed).toBe(true);
    expect(result2.scorePercent).toBe(100);
    expect(result2.attemptNumber).toBe(2);

    moduleProgress = await prisma.moduleProgress.findFirst({ where: { employeeId: employee.id } });
    expect(moduleProgress?.status).toBe("COMPLETED");

    const attempts = await prisma.assessmentAttempt.findMany({
      where: { employeeId: employee.id },
      orderBy: { attemptNumber: "asc" },
    });
    expect(attempts.map((a) => [a.attemptNumber, a.scorePercent, a.status])).toEqual([
      [1, 0, "FAILED"],
      [2, 100, "PASSED"],
    ]);
  });

  it("rejects submitting the same attempt twice", async () => {
    const { user: admin } = await createAdmin();
    const { user: employee } = await createEmployee();
    const { lesson, assessment, question } = await createPublishedModuleWithAssessment({ adminId: admin.id });
    await markLessonComplete(employee.id, lesson.id);

    const attempt = await startAssessmentAttempt(employee.id, assessment.id);
    const correctOption = question.options.find((o) => o.isCorrect)!;
    await submitAssessmentAttempt({
      employeeId: employee.id,
      attemptId: attempt.id,
      answers: [{ questionId: question.id, selectedOptionId: correctOption.id }],
    });

    await expect(
      submitAssessmentAttempt({
        employeeId: employee.id,
        attemptId: attempt.id,
        answers: [{ questionId: question.id, selectedOptionId: correctOption.id }],
      })
    ).rejects.toThrow(AssessmentError);
  });

  // Regression test: two near-simultaneous calls to start an assessment
  // (a double-click, a retried request, React StrictMode's dev-mode double
  // effect invocation) can both read "no in-progress attempt yet" before
  // either write commits, and both try to insert the same attemptNumber —
  // the loser used to surface as an unhandled 500 instead of just handing
  // back the winner's attempt.
  it("handles two concurrent start calls without throwing an unhandled error", async () => {
    const { user: admin } = await createAdmin();
    const { user: employee } = await createEmployee();
    const { lesson, assessment } = await createPublishedModuleWithAssessment({ adminId: admin.id });
    await markLessonComplete(employee.id, lesson.id);

    const [first, second] = await Promise.all([
      startAssessmentAttempt(employee.id, assessment.id),
      startAssessmentAttempt(employee.id, assessment.id),
    ]);

    expect(first.id).toBe(second.id);
    expect(first.attemptNumber).toBe(1);

    const attempts = await prisma.assessmentAttempt.findMany({
      where: { employeeId: employee.id, assessmentId: assessment.id },
    });
    expect(attempts).toHaveLength(1);
  });
});

describe("certification", () => {
  it("issues a certificate only once every required module is completed", async () => {
    const { user: admin } = await createAdmin();
    const { user: employee } = await createEmployee();

    const moduleA = await createPublishedModuleWithAssessment({ adminId: admin.id, order: 0 });
    const moduleB = await createPublishedModuleWithAssessment({ adminId: admin.id, order: 1 });

    await markLessonComplete(employee.id, moduleA.lesson.id);
    const attemptA = await startAssessmentAttempt(employee.id, moduleA.assessment.id);
    await submitAssessmentAttempt({
      employeeId: employee.id,
      attemptId: attemptA.id,
      answers: [{ questionId: moduleA.question.id, selectedOptionId: moduleA.question.options.find((o) => o.isCorrect)!.id }],
    });

    expect(await checkAndIssueCertificate(employee.id)).toBeNull();
    expect(await prisma.certificate.count({ where: { employeeId: employee.id } })).toBe(0);

    await markLessonComplete(employee.id, moduleB.lesson.id);
    const attemptB = await startAssessmentAttempt(employee.id, moduleB.assessment.id);
    await submitAssessmentAttempt({
      employeeId: employee.id,
      attemptId: attemptB.id,
      answers: [{ questionId: moduleB.question.id, selectedOptionId: moduleB.question.options.find((o) => o.isCorrect)!.id }],
    });

    const certificate = await prisma.certificate.findFirst({ where: { employeeId: employee.id } });
    expect(certificate).not.toBeNull();
    expect(certificate!.certificateNo).toMatch(/^CLA-\d{4}-\d{6}$/);
    expect(certificate!.storageKey).toContain(employee.id);
  });

  it("is idempotent — calling it again after issuance does not create a second certificate", async () => {
    const { user: admin } = await createAdmin();
    const { user: employee } = await createEmployee();
    const { lesson, assessment, question } = await createPublishedModuleWithAssessment({ adminId: admin.id });

    await markLessonComplete(employee.id, lesson.id);
    const attempt = await startAssessmentAttempt(employee.id, assessment.id);
    await submitAssessmentAttempt({
      employeeId: employee.id,
      attemptId: attempt.id,
      answers: [{ questionId: question.id, selectedOptionId: question.options.find((o) => o.isCorrect)!.id }],
    });

    await checkAndIssueCertificate(employee.id);
    await checkAndIssueCertificate(employee.id);

    expect(await prisma.certificate.count({ where: { employeeId: employee.id } })).toBe(1);
  });
});
