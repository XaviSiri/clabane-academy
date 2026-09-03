import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthorizedSession } from "@/lib/auth/rbac";
import { updateModuleSchema } from "@/lib/validation/content";
import { recordAuditLog } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedSession(["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateModuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const before = await prisma.module.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Module not found." }, { status: 404 });

  const updated = await prisma.module.update({ where: { id }, data: parsed.data });

  if (parsed.data.isPublished !== undefined && parsed.data.isPublished !== before.isPublished) {
    await recordAuditLog({
      userId: auth.session.sub,
      action: parsed.data.isPublished ? "MODULE_PUBLISHED" : "MODULE_UNPUBLISHED",
      entityType: "Module",
      entityId: id,
    });
  } else {
    await recordAuditLog({
      userId: auth.session.sub,
      action: "MODULE_UPDATED",
      entityType: "Module",
      entityId: id,
    });
  }

  return NextResponse.json({ module: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedSession(["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  await prisma.module.delete({ where: { id } });
  await recordAuditLog({ userId: auth.session.sub, action: "MODULE_UPDATED", entityType: "Module", entityId: id, metadata: { deleted: true } });
  return NextResponse.json({ ok: true });
}
