import { prisma } from "@/lib/db";

async function getOverview() {
  const [totalEmployees, employees, requiredModules] = await Promise.all([
    prisma.user.count({ where: { role: "EMPLOYEE" } }),
    prisma.user.findMany({ where: { role: "EMPLOYEE" }, include: { moduleProgress: true, certificates: true } }),
    prisma.module.count({ where: { isPublished: true, isRequired: true } }),
  ]);

  let notStarted = 0;
  let onboarding = 0;
  let completed = 0;
  for (const emp of employees) {
    const completedCount = emp.moduleProgress.filter((m) => m.status === "COMPLETED").length;
    if (emp.certificates.length > 0 || (requiredModules > 0 && completedCount >= requiredModules)) completed++;
    else if (emp.moduleProgress.some((m) => m.status !== "NOT_STARTED")) onboarding++;
    else notStarted++;
  }

  const attempts = await prisma.assessmentAttempt.findMany({
    where: { status: { not: "IN_PROGRESS" } },
    include: { assessment: { include: { module: true } } },
  });
  const avgScore = attempts.length
    ? Math.round(attempts.reduce((s, a) => s + (a.scorePercent ?? 0), 0) / attempts.length)
    : 0;

  const byModule = new Map<string, { title: string; total: number; count: number }>();
  for (const a of attempts) {
    const entry = byModule.get(a.assessment.moduleId) ?? { title: a.assessment.module.title, total: 0, count: 0 };
    entry.total += a.scorePercent ?? 0;
    entry.count += 1;
    byModule.set(a.assessment.moduleId, entry);
  }
  const lowestScoring = Array.from(byModule.values())
    .map((v) => ({ title: v.title, averageScore: Math.round(v.total / v.count) }))
    .sort((a, b) => a.averageScore - b.averageScore)
    .slice(0, 5);

  return {
    totalEmployees,
    notStarted,
    onboarding,
    completed,
    completionRate: totalEmployees ? Math.round((completed / totalEmployees) * 100) : 0,
    avgScore,
    lowestScoring,
  };
}

export default async function AdminDashboardPage() {
  const data = await getOverview();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-slate-900">Administrator Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Employees" value={data.totalEmployees} />
        <StatCard label="Not Started" value={data.notStarted} />
        <StatCard label="Onboarding" value={data.onboarding} />
        <StatCard label="Completed" value={data.completed} />
        <StatCard label="Completion Rate" value={`${data.completionRate}%`} />
        <StatCard label="Avg. Assessment Score" value={`${data.avgScore}%`} />
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-medium text-slate-700">Modules With Lowest Scores</h2>
        {data.lowestScoring.length === 0 ? (
          <p className="text-sm text-slate-500">No assessment attempts recorded yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {data.lowestScoring.map((m) => (
              <li key={m.title} className="flex items-center justify-between">
                <span className="text-slate-700">{m.title}</span>
                <span className="font-medium text-slate-900">{m.averageScore}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
