import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthorizedSession } from "@/lib/auth/rbac";
import { markLessonComplete } from "@/lib/services/progress";

/** For lessons with no video: an explicit "mark as complete" action. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedSession(["EMPLOYEE"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: lessonId } = await params;
  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, isPublished: true },
    include: { module: true, videos: { where: { isPublished: true } } },
  });
  if (!lesson || !lesson.module.isPublished) {
    return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  }

  await markLessonComplete(auth.session.sub, lessonId);
  return NextResponse.json({ ok: true });
}
