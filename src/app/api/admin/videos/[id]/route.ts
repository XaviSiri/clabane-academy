import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthorizedSession } from "@/lib/auth/rbac";
import { getStorageService } from "@/lib/storage";
import { updateVideoSchema } from "@/lib/validation/content";
import { recordAuditLog, getClientIp } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedSession(["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateVideoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const before = await prisma.video.findUnique({ where: { id } });
  if (!before) return NextResponse.json({ error: "Video not found." }, { status: 404 });

  const updated = await prisma.video.update({ where: { id }, data: parsed.data });

  if (parsed.data.isPublished !== undefined && parsed.data.isPublished !== before.isPublished) {
    await recordAuditLog({
      userId: auth.session.sub,
      action: parsed.data.isPublished ? "VIDEO_PUBLISHED" : "VIDEO_UNPUBLISHED",
      entityType: "Video",
      entityId: id,
      ipAddress: getClientIp(req.headers),
    });
  }

  return NextResponse.json({ video: { ...updated, fileSizeBytes: updated.fileSizeBytes?.toString() } });
}

/** Safe deletion: remove the storage object first, then the DB row, so a
 *  failed delete never leaves a dangling DB reference to a missing file —
 *  and a retry after a partial failure cannot orphan the object either,
 *  since deleteObject is a no-op when the object is already gone. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedSession(["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const video = await prisma.video.findUnique({ where: { id } });
  if (!video) return NextResponse.json({ error: "Video not found." }, { status: 404 });

  const storage = getStorageService();
  await storage.deleteObject({
    provider: video.storageProvider,
    bucket: video.storageBucket,
    key: video.storageKey,
  });
  await prisma.video.delete({ where: { id } });

  await recordAuditLog({
    userId: auth.session.sub,
    action: "VIDEO_DELETED",
    entityType: "Video",
    entityId: id,
    metadata: { title: video.title },
    ipAddress: getClientIp(req.headers),
  });

  return NextResponse.json({ ok: true });
}
