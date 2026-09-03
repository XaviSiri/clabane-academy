import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthorizedSession } from "@/lib/auth/rbac";
import { updateEmployeeSchema } from "@/lib/validation/content";
import { getEmployeeOnboardingSummary } from "@/lib/services/progress";
import { recordAuditLog, getClientIp } from "@/lib/audit";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedSession(["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const employee = await prisma.user.findFirst({
    where: { id, role: "EMPLOYEE" },
    include: { profile: true, certificates: true },
  });
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  const attempts = await prisma.assessmentAttempt.findMany({
    where: { employeeId: id },
    include: { assessment: { include: { module: true } } },
    orderBy: { startedAt: "desc" },
  });

  const summary = await getEmployeeOnboardingSummary(id);

  return NextResponse.json({ employee, summary, attempts });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedSession(["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const employee = await prisma.user.findFirst({ where: { id, role: "EMPLOYEE" } });
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  const { status, fullName, department, jobTitle } = parsed.data;

  const updated = await prisma.user.update({
    where: { id },
    data: {
      status,
      profile: {
        update: { fullName, department, jobTitle },
      },
    },
    include: { profile: true },
  });

  if (status && status !== employee.status) {
    await recordAuditLog({
      userId: auth.session.sub,
      action: status === "ACTIVE" ? "EMPLOYEE_ACTIVATED" : "EMPLOYEE_DEACTIVATED",
      entityType: "User",
      entityId: id,
      metadata: { previousStatus: employee.status, newStatus: status },
      ipAddress: getClientIp(req.headers),
    });
  }

  return NextResponse.json({ employee: updated });
}
