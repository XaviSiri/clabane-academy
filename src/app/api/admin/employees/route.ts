import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthorizedSession } from "@/lib/auth/rbac";
import { createEmployeeSchema } from "@/lib/validation/content";
import { generateRawToken, hashToken, ACTIVATION_TOKEN_TTL_MS } from "@/lib/auth/tokens";
import { recordAuditLog, getClientIp } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const auth = await getAuthorizedSession(["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status");

  const employees = await prisma.user.findMany({
    where: {
      role: "EMPLOYEE",
      ...(status ? { status: status as never } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { profile: { fullName: { contains: q, mode: "insensitive" } } },
              { profile: { department: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: { profile: true, moduleProgress: true, certificates: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    employees: employees.map((e) => ({
      id: e.id,
      email: e.email,
      status: e.status,
      fullName: e.profile?.fullName,
      department: e.profile?.department,
      jobTitle: e.profile?.jobTitle,
      startDate: e.profile?.startDate,
      lastLoginAt: e.lastLoginAt,
      completedModules: e.moduleProgress.filter((m) => m.status === "COMPLETED").length,
      hasCertificate: e.certificates.length > 0,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthorizedSession(["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const parsed = createEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }
  const { email, fullName, department, jobTitle, startDate } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const rawToken = generateRawToken();
  const user = await prisma.user.create({
    data: {
      email,
      role: "EMPLOYEE",
      status: "PENDING_ACTIVATION",
      activationTokenHash: hashToken(rawToken),
      activationExpiresAt: new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS),
      profile: {
        create: {
          fullName,
          department,
          jobTitle,
          startDate: startDate ? new Date(startDate) : undefined,
        },
      },
    },
    include: { profile: true },
  });

  await recordAuditLog({
    userId: auth.session.sub,
    action: "EMPLOYEE_CREATED",
    entityType: "User",
    entityId: user.id,
    metadata: { email },
    ipAddress: getClientIp(req.headers),
  });

  const baseUrl = process.env.APPLICATION_URL || "http://localhost:3000";
  const activationLink = `${baseUrl}/activate?token=${rawToken}`;

  // Email delivery is out of scope for Phase 1 (see README / NOTIFICATIONS
  // section of the architecture). The activation link is returned to the
  // admin here so they can deliver it manually until an email provider is
  // wired up behind this same boundary.
  return NextResponse.json({ employee: user, activationLink }, { status: 201 });
}
