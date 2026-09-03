import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { loginSchema } from "@/lib/validation/auth";
import { recordAuditLog, getClientIp } from "@/lib/audit";

const MAX_ATTEMPTS_PER_WINDOW = 8;
const WINDOW_MS = 10 * 60 * 1000;
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers) ?? "unknown";
  const rate = checkRateLimit(`login:${ip}`, MAX_ATTEMPTS_PER_WINDOW, WINDOW_MS);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });

  // Constant-shaped response whether the account exists or not, to avoid
  // leaking which emails are registered.
  const genericError = NextResponse.json({ error: "Invalid email or password." }, { status: 401 });

  if (!user || !user.passwordHash) {
    await recordAuditLog({ action: "EMPLOYEE_LOGIN_FAILED", metadata: { email }, ipAddress: ip });
    return genericError;
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return NextResponse.json(
      { error: "This account is temporarily locked due to repeated failed logins." },
      { status: 423 }
    );
  }

  if (user.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "This account is not active. Contact your administrator." },
      { status: 403 }
    );
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const failedCount = user.failedLoginCount + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: failedCount,
        lockedUntil:
          failedCount >= LOCKOUT_THRESHOLD ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
      },
    });
    await recordAuditLog({
      userId: user.id,
      action: "EMPLOYEE_LOGIN_FAILED",
      ipAddress: ip,
    });
    return genericError;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  const token = await createSessionToken({ sub: user.id, role: user.role, email: user.email });
  await setSessionCookie(token);

  await recordAuditLog({ userId: user.id, action: "EMPLOYEE_LOGIN", ipAddress: ip });

  return NextResponse.json({
    ok: true,
    role: user.role,
    redirectTo: user.role === "ADMIN" ? "/admin" : "/dashboard",
  });
}
