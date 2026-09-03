import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthorizedSession } from "@/lib/auth/rbac";
import { z } from "zod";
import { recordAuditLog } from "@/lib/audit";

const updateAssessmentSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  passMarkPercent: z.number().int().min(1).max(100).optional(),
  allowAnswerReview: z.boolean().optional(),
  isPublished: z.boolean().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedSession(["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const assessment = await prisma.assessment.findUnique({
    where: { id },
    include: { questions: { include: { options: true }, orderBy: { order: "asc" } }, module: true },
  });
  if (!assessment) return NextResponse.json({ error: "Assessment not found." }, { status: 404 });
  return NextResponse.json({ assessment });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedSession(["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateAssessmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const assessment = await prisma.assessment.findUnique({ where: { id } });
  if (!assessment) return NextResponse.json({ error: "Assessment not found." }, { status: 404 });

  const updated = await prisma.assessment.update({ where: { id }, data: parsed.data });

  await recordAuditLog({
    userId: auth.session.sub,
    action: "ASSESSMENT_UPDATED",
    entityType: "Assessment",
    entityId: id,
  });

  return NextResponse.json({ assessment: updated });
}
