import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, isPasswordStrongEnough } from "@/lib/auth/password";
import { hashToken } from "@/lib/auth/tokens";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { recordAuditLog, getClientIp } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { token, password } = parsed.data;

  if (!isPasswordStrongEnough(password)) {
    return NextResponse.json(
      {
        error:
          "Password must be at least 10 characters and include upper case, lower case, and a number.",
      },
      { status: 400 }
    );
  }

  const tokenHash = hashToken(token);
  const user = await prisma.user.findUnique({ where: { resetTokenHash: tokenHash } });

  if (!user || !user.resetExpiresAt || user.resetExpiresAt < new Date()) {
    return NextResponse.json({ error: "This reset link is invalid or has expired." }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetTokenHash: null,
      resetExpiresAt: null,
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });

  await recordAuditLog({
    userId: user.id,
    action: "PASSWORD_RESET_COMPLETED",
    ipAddress: getClientIp(req.headers),
  });

  return NextResponse.json({ ok: true });
}
