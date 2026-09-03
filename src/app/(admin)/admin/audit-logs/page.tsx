import { prisma } from "@/lib/db";

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? 1));
  const pageSize = 50;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { email: true } } },
    }),
    prisma.auditLog.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Audit Logs</h1>

      <div className="card overflow-x-auto p-0">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">IP Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="px-4 py-3 text-slate-500">{log.createdAt.toLocaleString("en-GB")}</td>
                <td className="px-4 py-3 text-slate-600">{log.user?.email ?? "System"}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{log.action}</td>
                <td className="px-4 py-3 text-slate-500">
                  {log.entityType ? `${log.entityType}${log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ""}` : "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">{log.ipAddress || "—"}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No audit events recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          Page {page} of {totalPages} ({total} events)
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <a className="btn-secondary text-xs" href={`/admin/audit-logs?page=${page - 1}`}>
              Previous
            </a>
          )}
          {page < totalPages && (
            <a className="btn-secondary text-xs" href={`/admin/audit-logs?page=${page + 1}`}>
              Next
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
