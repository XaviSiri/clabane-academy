import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthorizedSession } from "@/lib/auth/rbac";
import { updateLessonSchema } from "@/lib/validation/content";
import { recordAuditLog } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedSession(["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateLessonSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const lesson = await prisma.lesson.findUnique({ where: { id } });
  if (!lesson) return NextResponse.json({ error: "Lesson not found." }, { status: 404 });

  const updated = await prisma.lesson.update({ where: { id }, data: parsed.data });

  await recordAuditLog({
    userId: auth.session.sub,
    action: "LESSON_UPDATED",
    entityType: "Lesson",
    entityId: id,
  });

  return NextResponse.json({ lesson: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedSession(["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  await prisma.lesson.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
