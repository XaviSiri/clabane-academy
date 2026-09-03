import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthorizedSession } from "@/lib/auth/rbac";
import { getStorageService } from "@/lib/storage";

/**
 * The single choke point for video access. An employee only ever receives
 * a short-lived signed URL, and only after we verify: the video exists, is
 * published, its lesson is published, and its module is published. There
 * is no per-employee "assignment" table yet (Phase 1 has one universal
 * onboarding programme — see ARCHITECTURE.md) but this is the seam where
 * that check would be added without touching anything else.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedSession(["EMPLOYEE", "ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const video = await prisma.video.findUnique({
    where: { id },
    include: { lesson: { include: { module: true } } },
  });

  if (!video) return NextResponse.json({ error: "Video not found." }, { status: 404 });

  const isAdmin = auth.session.role === "ADMIN";
  if (!isAdmin && (!video.isPublished || !video.lesson.isPublished || !video.lesson.module.isPublished)) {
    return NextResponse.json({ error: "This video is not currently available." }, { status: 403 });
  }

  const storage = getStorageService();
  const url = await storage.getSignedDownloadUrl(
    { provider: video.storageProvider, bucket: video.storageBucket, key: video.storageKey },
    600
  );

  return NextResponse.json({ url, completionThresholdPercent: video.completionThresholdPercent });
}
