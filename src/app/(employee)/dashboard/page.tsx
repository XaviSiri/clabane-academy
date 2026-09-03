import Link from "next/link";
import { requireEmployee } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { getEmployeeOnboardingSummary } from "@/lib/services/progress";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusBadge } from "@/components/StatusBadge";

export default async function DashboardPage() {
  const session = await requireEmployee();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.sub },
    include: { profile: true, certificates: true },
  });
  const summary = await getEmployeeOnboardingSummary(session.sub);
  const pendingModules = summary.modules.filter((m) => m.status !== "COMPLETED");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Welcome, {user.profile?.fullName ?? user.email}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Complete your onboarding programme to earn your Clabane Academy certificate.
        </p>
      </div>

      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-700">Onboarding Progress</h2>
          <span className="text-sm font-semibold text-slate-900">{summary.overallPercent}% Complete</span>
        </div>
        <ProgressBar percent={summary.overallPercent} />
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <Stat label="Completed Modules" value={`${summary.completedModules}/${summary.totalModules}`} />
          <Stat label="Pending Modules" value={String(pendingModules.length)} />
          <Stat
            label="Latest Assessment Score"
            value={
              summary.modules.find((m) => m.latestScorePercent !== null)?.latestScorePercent !== undefined
                ? `${summary.modules.filter((m) => m.latestScorePercent !== null).slice(-1)[0]?.latestScorePercent ?? "—"}%`
                : "—"
            }
          />
          <Stat label="Certificate Status" value={user.certificates.length > 0 ? "Issued" : "Not yet issued"} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-medium text-slate-900">Required Modules</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {summary.modules.map((mod, idx) => (
            <Link
              key={mod.moduleId}
              href={`/modules/${mod.moduleId}`}
              className="card flex items-center justify-between transition hover:border-slate-300 hover:shadow-md"
            >
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Module {idx + 1}
                </p>
                <p className="mt-1 font-medium text-slate-900">{mod.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {mod.lessonsCompleted}/{mod.lessonsTotal} lessons complete
                </p>
              </div>
              <StatusBadge status={mod.status} />
            </Link>
          ))}
          {summary.modules.length === 0 && (
            <p className="text-sm text-slate-500">
              No onboarding modules have been published yet. Check back soon.
            </p>
          )}
        </div>
      </div>

      {user.lastLoginAt && (
        <p className="text-xs text-slate-400">
          Last activity: {user.lastLoginAt.toLocaleString("en-GB")}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}
