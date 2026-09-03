import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthorizedSession } from "@/lib/auth/rbac";
import { updateModuleSchema } from "@/lib/validation/content";
import { recordAuditLog, getClientIp } from "@/lib/audit";
import { deleteStorageObjectsFor } from "@/lib/services/content-cleanup";

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
      ipAddress: getClientIp(req.headers),
    });
  } else {
    await recordAuditLog({
      userId: auth.session.sub,
      action: "MODULE_UPDATED",
      entityType: "Module",
      entityId: id,
      ipAddress: getClientIp(req.headers),
    });
  }

  return NextResponse.json({ module: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedSession(["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const module_ = await prisma.module.findUnique({
    where: { id },
    include: { lessons: { include: { videos: true, documents: true } } },
  });
  if (!module_) return NextResponse.json({ error: "Module not found." }, { status: 404 });

  // Prisma's onDelete: Cascade only removes the Lesson/Video/Document rows —
  // it has no idea the storage layer exists, so the objects themselves must
  // be deleted here first or they'd be orphaned in object storage.
  await deleteStorageObjectsFor(module_.lessons.flatMap((l) => [...l.videos, ...l.documents]));

  await prisma.module.delete({ where: { id } });
  await recordAuditLog({
    userId: auth.session.sub,
    action: "MODULE_UPDATED",
    entityType: "Module",
    entityId: id,
    metadata: { deleted: true, title: module_.title },
    ipAddress: getClientIp(req.headers),
  });
  return NextResponse.json({ ok: true });
}
