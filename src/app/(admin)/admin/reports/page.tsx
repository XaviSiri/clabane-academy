import { prisma } from "@/lib/db";
import { getEmployeeOnboardingSummary } from "@/lib/services/progress";
import { StatusBadge } from "@/components/StatusBadge";

export default async function ReportsPage() {
  const employees = await prisma.user.findMany({
    where: { role: "EMPLOYEE" },
    include: { profile: true, certificates: true },
    orderBy: { createdAt: "asc" },
  });

  const rows = await Promise.all(
    employees.map(async (emp) => ({
      emp,
      summary: await getEmployeeOnboardingSummary(emp.id),
    }))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
        <a href="/api/admin/reports/export" className="btn-secondary">
          Export CSV
        </a>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Overall Progress</th>
              <th className="px-4 py-3">Modules Completed</th>
              <th className="px-4 py-3">Certificate</th>
              <th className="px-4 py-3">Last Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ emp, summary }) => (
              <tr key={emp.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{emp.profile?.fullName}</td>
                <td className="px-4 py-3 text-slate-600">{emp.profile?.department || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{summary.overallPercent}%</td>
                <td className="px-4 py-3 text-slate-600">
                  {summary.completedModules}/{summary.totalModules}
                </td>
                <td className="px-4 py-3">
                  {emp.certificates.length > 0 ? (
                    <StatusBadge status="COMPLETED" />
                  ) : (
                    <StatusBadge status="NOT_STARTED" />
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {emp.lastLoginAt ? emp.lastLoginAt.toLocaleDateString("en-GB") : "Never"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
