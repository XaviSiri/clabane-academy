import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAuthorizedSession } from "@/lib/auth/rbac";
import { recordVideoProgress } from "@/lib/services/video-progress";

const progressSchema = z.object({
  positionSeconds: z.number().min(0),
  watchedPercent: z.number().min(0).max(100),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedSession(["EMPLOYEE"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: videoId } = await params;
  const progress = await prisma.videoProgress.findUnique({
    where: { employeeId_videoId: { employeeId: auth.session.sub, videoId } },
  });
  return NextResponse.json({ progress });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedSession(["EMPLOYEE"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: videoId } = await params;
  const video = await prisma.video.findFirst({
    where: { id: videoId, isPublished: true },
    include: { lesson: { include: { module: true } } },
  });
  if (!video || !video.lesson.isPublished || !video.lesson.module.isPublished) {
    return NextResponse.json({ error: "Video not found." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = progressSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  const progress = await recordVideoProgress({
    employeeId: auth.session.sub,
    videoId,
    positionSeconds: parsed.data.positionSeconds,
    watchedPercent: parsed.data.watchedPercent,
  });

  return NextResponse.json({ progress });
}
