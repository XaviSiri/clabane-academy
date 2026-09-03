import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getEmployeeOnboardingSummary } from "@/lib/services/progress";
import { StatusBadge } from "@/components/StatusBadge";
import { EmployeeStatusToggle } from "@/components/admin/EmployeeStatusToggle";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employee = await prisma.user.findFirst({
    where: { id, role: "EMPLOYEE" },
    include: { profile: true, certificates: true },
  });
  if (!employee) notFound();

  const summary = await getEmployeeOnboardingSummary(id);
  const attempts = await prisma.assessmentAttempt.findMany({
    where: { employeeId: id },
    include: { assessment: { include: { module: true } } },
    orderBy: { startedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <Link href="/admin/employees" className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to employees
      </Link>

      <div className="card flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{employee.profile?.fullName}</h1>
          <p className="text-sm text-slate-500">{employee.email}</p>
          <p className="mt-1 text-xs text-slate-400">
            {employee.profile?.department} {employee.profile?.jobTitle ? `· ${employee.profile.jobTitle}` : ""}
          </p>
        </div>
        <EmployeeStatusToggle employeeId={employee.id} status={employee.status} />
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-medium text-slate-700">
          Onboarding Progress — {summary.overallPercent}% Complete
        </h2>
        <ul className="divide-y divide-slate-100">
          {summary.modules.map((m) => (
            <li key={m.moduleId} className="flex items-center justify-between py-2 text-sm">
              <span>{m.title}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">
                  {m.lessonsCompleted}/{m.lessonsTotal} lessons
                </span>
                {m.latestScorePercent !== null && (
                  <span className="text-xs text-slate-500">Score: {m.latestScorePercent}%</span>
                )}
                <StatusBadge status={m.status} />
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-medium text-slate-700">Assessment Attempts</h2>
        {attempts.length === 0 ? (
          <p className="text-sm text-slate-500">No attempts recorded yet.</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="py-1.5">Module</th>
                <th className="py-1.5">Attempt</th>
                <th className="py-1.5">Score</th>
                <th className="py-1.5">Status</th>
                <th className="py-1.5">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attempts.map((a) => (
                <tr key={a.id}>
                  <td className="py-1.5">{a.assessment.module.title}</td>
                  <td className="py-1.5">{a.attemptNumber}</td>
                  <td className="py-1.5">{a.scorePercent ?? "—"}%</td>
                  <td className="py-1.5">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="py-1.5 text-slate-500">{a.startedAt.toLocaleDateString("en-GB")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2 className="mb-2 text-sm font-medium text-slate-700">Certification</h2>
        {employee.certificates.length > 0 ? (
          <p className="text-sm text-slate-600">
            Certificate {employee.certificates[0].certificateNo} issued{" "}
            {employee.certificates[0].issuedAt.toLocaleDateString("en-GB")}.
          </p>
        ) : (
          <p className="text-sm text-slate-500">No certificate issued yet.</p>
        )}
      </div>
    </div>
  );
}
