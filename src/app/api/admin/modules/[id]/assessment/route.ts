import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthorizedSession } from "@/lib/auth/rbac";
import { createAssessmentSchema } from "@/lib/validation/content";
import { recordAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedSession(["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: moduleId } = await params;
  const module_ = await prisma.module.findUnique({ where: { id: moduleId }, include: { assessment: true } });
  if (!module_) return NextResponse.json({ error: "Module not found." }, { status: 404 });
  if (module_.assessment) {
    return NextResponse.json({ error: "This module already has an assessment." }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createAssessmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const assessment = await prisma.assessment.create({ data: { ...parsed.data, moduleId } });

  await recordAuditLog({
    userId: auth.session.sub,
    action: "ASSESSMENT_CREATED",
    entityType: "Assessment",
    entityId: assessment.id,
    metadata: { moduleId },
  });

  return NextResponse.json({ assessment }, { status: 201 });
}
