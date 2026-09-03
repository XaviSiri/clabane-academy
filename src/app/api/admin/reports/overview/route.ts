import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthorizedSession } from "@/lib/auth/rbac";

export async function GET() {
  const auth = await getAuthorizedSession(["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const [totalEmployees, employees, requiredModules] = await Promise.all([
    prisma.user.count({ where: { role: "EMPLOYEE" } }),
    prisma.user.findMany({
      where: { role: "EMPLOYEE" },
      include: { moduleProgress: true, certificates: true },
    }),
    prisma.module.count({ where: { isPublished: true, isRequired: true } }),
  ]);

  let notStarted = 0;
  let onboarding = 0;
  let completed = 0;

  for (const emp of employees) {
    const completedCount = emp.moduleProgress.filter((m) => m.status === "COMPLETED").length;
    if (emp.certificates.length > 0 || (requiredModules > 0 && completedCount >= requiredModules)) {
      completed++;
    } else if (emp.moduleProgress.some((m) => m.status !== "NOT_STARTED")) {
      onboarding++;
    } else {
      notStarted++;
    }
  }

  const completionRate = totalEmployees === 0 ? 0 : Math.round((completed / totalEmployees) * 100);

  const attempts = await prisma.assessmentAttempt.findMany({
    where: { status: { not: "IN_PROGRESS" } },
    include: { assessment: { include: { module: true } } },
  });

  const avgScore =
    attempts.length === 0
      ? 0
      : Math.round(attempts.reduce((sum, a) => sum + (a.scorePercent ?? 0), 0) / attempts.length);

  const scoresByModule = new Map<string, { title: string; total: number; count: number }>();
  for (const a of attempts) {
    const key = a.assessment.moduleId;
    const entry = scoresByModule.get(key) ?? { title: a.assessment.module.title, total: 0, count: 0 };
    entry.total += a.scorePercent ?? 0;
    entry.count += 1;
    scoresByModule.set(key, entry);
  }
  const modulesWithLowestScores = Array.from(scoresByModule.entries())
    .map(([moduleId, v]) => ({ moduleId, title: v.title, averageScore: Math.round(v.total / v.count) }))
    .sort((a, b) => a.averageScore - b.averageScore)
    .slice(0, 5);

  return NextResponse.json({
    totalEmployees,
    notStarted,
    onboarding,
    completed,
    completionRate,
    averageAssessmentScore: avgScore,
    modulesWithLowestScores,
  });
}
