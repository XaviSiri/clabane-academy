import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword, isPasswordStrongEnough } from "@/lib/auth/password";
import { changePasswordSchema } from "@/lib/validation/auth";
import { getAuthorizedSession } from "@/lib/auth/rbac";
import { recordAuditLog, getClientIp } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const auth = await getAuthorizedSession();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { currentPassword, newPassword } = parsed.data;

  if (!isPasswordStrongEnough(newPassword)) {
    return NextResponse.json(
      { error: "Password must be at least 10 characters and include upper case, lower case, and a number." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { id: auth.session.sub } });
  if (!user || !user.passwordHash || !(await verifyPassword(currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  await recordAuditLog({
    userId: user.id,
    action: "PASSWORD_RESET_COMPLETED",
    ipAddress: getClientIp(req.headers),
  });

  return NextResponse.json({ ok: true });
}
