import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateRawToken, hashToken, RESET_TOKEN_TTL_MS } from "@/lib/auth/tokens";
import { requestPasswordResetSchema } from "@/lib/validation/auth";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { recordAuditLog, getClientIp } from "@/lib/audit";

/**
 * Always returns a generic success response, whether or not the email
 * exists, so this endpoint cannot be used to enumerate accounts. Email
 * delivery is out of scope for Phase 1 (see README) — in development the
 * raw reset link is returned directly so the flow is testable end to end;
 * in production this would be swapped for an email send behind the same
 * function boundary.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers) ?? "unknown";
  const rate = checkRateLimit(`reset:${ip}`, 5, 15 * 60 * 1000);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = requestPasswordResetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: true });
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  let devResetLink: string | undefined;

  if (user && user.status === "ACTIVE") {
    const rawToken = generateRawToken();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: hashToken(rawToken),
        resetExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });
    await recordAuditLog({ userId: user.id, action: "PASSWORD_RESET_REQUESTED", ipAddress: ip });

    const baseUrl = process.env.APPLICATION_URL || "http://localhost:3000";
    devResetLink = `${baseUrl}/reset-password?token=${rawToken}`;
  }

  return NextResponse.json({
    ok: true,
    ...(process.env.NODE_ENV !== "production" && devResetLink ? { devResetLink } : {}),
  });
}
