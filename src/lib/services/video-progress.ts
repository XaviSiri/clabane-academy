import { prisma } from "@/lib/db";
import { markLessonComplete } from "./progress";

/**
 * A video is "completed" once watchedPercent reaches its configured
 * threshold (default 90%, see Video.completionThresholdPercent). Once
 * completed, isCompleted is sticky — a later lower watchedPercent (e.g. the
 * employee re-opens the video and seeks to the start) never un-completes it,
 * per the "should not need to watch the entire video again" requirement.
 */
export async function recordVideoProgress(params: {
  employeeId: string;
  videoId: string;
  positionSeconds: number;
  watchedPercent: number;
}) {
  const video = await prisma.video.findUniqueOrThrow({
    where: { id: params.videoId },
    select: { id: true, lessonId: true, completionThresholdPercent: true },
  });

  const clampedPercent = Math.max(0, Math.min(100, Math.round(params.watchedPercent)));
  const existing = await prisma.videoProgress.findUnique({
    where: { employeeId_videoId: { employeeId: params.employeeId, videoId: params.videoId } },
  });

  const justCompleted =
    !existing?.isCompleted && clampedPercent >= video.completionThresholdPercent;
  const isCompleted = existing?.isCompleted || justCompleted;

  const updated = await prisma.videoProgress.upsert({
    where: { employeeId_videoId: { employeeId: params.employeeId, videoId: params.videoId } },
    update: {
      lastPositionSeconds: params.positionSeconds,
      watchedPercent: Math.max(clampedPercent, existing?.watchedPercent ?? 0),
      isCompleted,
      lastWatchedAt: new Date(),
      completedAt: isCompleted ? existing?.completedAt ?? new Date() : null,
    },
    create: {
      employeeId: params.employeeId,
      videoId: params.videoId,
      lastPositionSeconds: params.positionSeconds,
      watchedPercent: clampedPercent,
      isCompleted,
      completedAt: isCompleted ? new Date() : null,
    },
  });

  if (justCompleted) {
    await maybeCompleteLesson(params.employeeId, video.lessonId);
  }

  return updated;
}

async function maybeCompleteLesson(employeeId: string, lessonId: string) {
  const videos = await prisma.video.findMany({
    where: { lessonId, isPublished: true },
    select: { id: true },
  });
  if (videos.length === 0) return;

  const completedCount = await prisma.videoProgress.count({
    where: { employeeId, videoId: { in: videos.map((v) => v.id) }, isCompleted: true },
  });

  if (completedCount === videos.length) {
    await markLessonComplete(employeeId, lessonId);
  }
}
