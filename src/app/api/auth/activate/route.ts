import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, isPasswordStrongEnough } from "@/lib/auth/password";
import { hashToken } from "@/lib/auth/tokens";
import { activateAccountSchema } from "@/lib/validation/auth";
import { recordAuditLog, getClientIp } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = activateAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid activation request." }, { status: 400 });
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
  const user = await prisma.user.findUnique({ where: { activationTokenHash: tokenHash } });

  if (!user || !user.activationExpiresAt || user.activationExpiresAt < new Date()) {
    return NextResponse.json(
      { error: "This activation link is invalid or has expired." },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      status: "ACTIVE",
      activationTokenHash: null,
      activationExpiresAt: null,
    },
  });

  await recordAuditLog({
    userId: user.id,
    action: "ACCOUNT_ACTIVATED",
    ipAddress: getClientIp(req.headers),
  });

  return NextResponse.json({ ok: true });
}
