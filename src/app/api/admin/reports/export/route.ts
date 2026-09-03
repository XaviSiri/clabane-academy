import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthorizedSession } from "@/lib/auth/rbac";
import { getEmployeeOnboardingSummary } from "@/lib/services/progress";

function csvEscape(value: unknown): string {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export async function GET() {
  const auth = await getAuthorizedSession(["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const employees = await prisma.user.findMany({
    where: { role: "EMPLOYEE" },
    include: { profile: true, certificates: true },
    orderBy: { createdAt: "asc" },
  });

  const headers = [
    "Name",
    "Email",
    "Department",
    "Status",
    "Overall Progress",
    "Completed Modules",
    "Total Modules",
    "Certificate Issued",
    "Last Activity",
  ];
  const rows: string[] = [headers.join(",")];

  for (const emp of employees) {
    const summary = await getEmployeeOnboardingSummary(emp.id);
    rows.push(
      [
        csvEscape(emp.profile?.fullName),
        csvEscape(emp.email),
        csvEscape(emp.profile?.department),
        csvEscape(emp.status),
        csvEscape(`${summary.overallPercent}%`),
        csvEscape(summary.completedModules),
        csvEscape(summary.totalModules),
        csvEscape(emp.certificates.length > 0 ? "Yes" : "No"),
        csvEscape(emp.lastLoginAt?.toISOString() ?? ""),
      ].join(",")
    );
  }

  return new NextResponse(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clabane-academy-completion-report.csv"`,
    },
  });
}
