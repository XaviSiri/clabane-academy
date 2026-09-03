import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthorizedSession } from "@/lib/auth/rbac";
import { getStorageService } from "@/lib/storage";
import { replaceVideoSchema } from "@/lib/validation/content";
import { recordAuditLog, getClientIp } from "@/lib/audit";

/**
 * Step 2 of a replace: the new file has already been uploaded (via the same
 * upload-url flow as a new video) to `storageKey`. This swaps the metadata
 * to point at it and deletes the old object so nothing is orphaned.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedSession(["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const video = await prisma.video.findUnique({ where: { id } });
  if (!video) return NextResponse.json({ error: "Video not found." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = replaceVideoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const oldRef = { provider: video.storageProvider, bucket: video.storageBucket, key: video.storageKey };

  const updated = await prisma.video.update({
    where: { id },
    data: {
      storageKey: parsed.data.storageKey,
      fileSizeBytes: BigInt(parsed.data.fileSizeBytes),
      mimeType: parsed.data.mimeType,
      durationSeconds: parsed.data.durationSeconds,
      isPublished: false, // require the admin to re-review/publish the replacement
    },
  });

  const storage = getStorageService();
  await storage.deleteObject(oldRef);

  await recordAuditLog({
    userId: auth.session.sub,
    action: "VIDEO_REPLACED",
    entityType: "Video",
    entityId: id,
    ipAddress: getClientIp(req.headers),
  });

  return NextResponse.json({ video: { ...updated, fileSizeBytes: updated.fileSizeBytes?.toString() } });
}
