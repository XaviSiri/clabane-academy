import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthorizedSession } from "@/lib/auth/rbac";
import { createLessonSchema } from "@/lib/validation/content";
import { recordAuditLog, getClientIp } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedSession(["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: moduleId } = await params;
  const module_ = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!module_) return NextResponse.json({ error: "Module not found." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = createLessonSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const existing = await prisma.lesson.findUnique({
    where: { moduleId_slug: { moduleId, slug: parsed.data.slug } },
  });
  if (existing) {
    return NextResponse.json({ error: "A lesson with this slug already exists in this module." }, { status: 409 });
  }

  const lesson = await prisma.lesson.create({ data: { ...parsed.data, moduleId } });

  await recordAuditLog({
    userId: auth.session.sub,
    action: "LESSON_CREATED",
    entityType: "Lesson",
    entityId: lesson.id,
    metadata: { moduleId, title: lesson.title },
    ipAddress: getClientIp(req.headers),
  });

  return NextResponse.json({ lesson }, { status: 201 });
}
