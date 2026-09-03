import { prisma } from "@/lib/db";
import type { ProgressStatus } from "@prisma/client";

/**
 * Lesson/module progress computation. Business rule: a lesson with at least
 * one video is complete once all of its videos reach their completion
 * threshold (see video-progress.ts); a lesson with no video requires an
 * explicit "mark complete" action from the employee. A module's assessment
 * cannot be started until every lesson in that module is complete.
 */

export async function getOrCreateModuleProgress(employeeId: string, moduleId: string) {
  return prisma.moduleProgress.upsert({
    where: { employeeId_moduleId: { employeeId, moduleId } },
    update: {},
    create: { employeeId, moduleId, status: "NOT_STARTED" },
  });
}

export async function ensureModuleInProgress(employeeId: string, moduleId: string) {
  const progress = await getOrCreateModuleProgress(employeeId, moduleId);
  if (progress.status === "NOT_STARTED") {
    await prisma.moduleProgress.update({
      where: { id: progress.id },
      data: { status: "IN_PROGRESS", startedAt: new Date() },
    });
  }
}

export async function markLessonComplete(employeeId: string, lessonId: string) {
  const lesson = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } });
  await ensureModuleInProgress(employeeId, lesson.moduleId);

  await prisma.lessonProgress.upsert({
    where: { employeeId_lessonId: { employeeId, lessonId } },
    update: { status: "COMPLETED", completedAt: new Date() },
    create: { employeeId, lessonId, status: "COMPLETED", completedAt: new Date() },
  });
}

export async function areAllLessonsComplete(employeeId: string, moduleId: string): Promise<boolean> {
  const lessons = await prisma.lesson.findMany({
    where: { moduleId, isPublished: true },
    select: { id: true },
  });
  if (lessons.length === 0) return true;

  const completed = await prisma.lessonProgress.count({
    where: {
      employeeId,
      lessonId: { in: lessons.map((l) => l.id) },
      status: "COMPLETED",
    },
  });
  return completed === lessons.length;
}

export interface ModuleSummary {
  moduleId: string;
  title: string;
  order: number;
  status: ProgressStatus;
  lessonsCompleted: number;
  lessonsTotal: number;
  hasAssessment: boolean;
  latestScorePercent: number | null;
}

export async function getEmployeeOnboardingSummary(employeeId: string) {
  const modules = await prisma.module.findMany({
    where: { isPublished: true },
    orderBy: { order: "asc" },
    include: {
      lessons: { where: { isPublished: true }, select: { id: true } },
      assessment: { select: { id: true } },
      moduleProgress: { where: { employeeId } },
    },
  });

  const summaries: ModuleSummary[] = [];
  for (const mod of modules) {
    const lessonIds = mod.lessons.map((l) => l.id);
    const lessonsCompleted = lessonIds.length
      ? await prisma.lessonProgress.count({
          where: { employeeId, lessonId: { in: lessonIds }, status: "COMPLETED" },
        })
      : 0;

    let latestScorePercent: number | null = null;
    if (mod.assessment) {
      const lastAttempt = await prisma.assessmentAttempt.findFirst({
        where: { employeeId, assessmentId: mod.assessment.id, status: { not: "IN_PROGRESS" } },
        orderBy: { attemptNumber: "desc" },
      });
      latestScorePercent = lastAttempt?.scorePercent ?? null;
    }

    summaries.push({
      moduleId: mod.id,
      title: mod.title,
      order: mod.order,
      status: mod.moduleProgress[0]?.status ?? "NOT_STARTED",
      lessonsCompleted,
      lessonsTotal: lessonIds.length,
      hasAssessment: !!mod.assessment,
      latestScorePercent,
    });
  }

  const totalModules = summaries.length;
  const completedModules = summaries.filter((m) => m.status === "COMPLETED").length;
  const overallPercent = totalModules === 0 ? 0 : Math.round((completedModules / totalModules) * 100);

  return { modules: summaries, totalModules, completedModules, overallPercent };
}
