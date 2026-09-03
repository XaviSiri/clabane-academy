import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthorizedSession } from "@/lib/auth/rbac";
import { getStorageService } from "@/lib/storage";
import { createVideoSchema } from "@/lib/validation/content";
import { recordAuditLog, getClientIp } from "@/lib/audit";

/** Step 2 of the upload flow: persist metadata once the object exists in storage. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedSession(["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: lessonId } = await params;
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) return NextResponse.json({ error: "Lesson not found." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = createVideoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const storage = getStorageService();
  const video = await prisma.video.create({
    data: {
      lessonId,
      title: parsed.data.title,
      description: parsed.data.description,
      storageProvider: storage.providerName,
      storageBucket: storage.bucket,
      storageKey: parsed.data.storageKey,
      fileSizeBytes: BigInt(parsed.data.fileSizeBytes),
      mimeType: parsed.data.mimeType,
      durationSeconds: parsed.data.durationSeconds,
      completionThresholdPercent:
        parsed.data.completionThresholdPercent ??
        Number(process.env.DEFAULT_VIDEO_COMPLETION_THRESHOLD ?? 90),
      uploadedById: auth.session.sub,
    },
  });

  await recordAuditLog({
    userId: auth.session.sub,
    action: "VIDEO_UPLOADED",
    entityType: "Video",
    entityId: video.id,
    metadata: { lessonId, title: video.title },
    ipAddress: getClientIp(req.headers),
  });

  return NextResponse.json({ video: { ...video, fileSizeBytes: video.fileSizeBytes?.toString() } }, { status: 201 });
}
