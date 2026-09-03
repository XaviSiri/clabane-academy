import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthorizedSession } from "@/lib/auth/rbac";
import { createQuestionSchema } from "@/lib/validation/content";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedSession(["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: assessmentId } = await params;
  const assessment = await prisma.assessment.findUnique({ where: { id: assessmentId } });
  if (!assessment) return NextResponse.json({ error: "Assessment not found." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = createQuestionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const question = await prisma.question.create({
    data: {
      assessmentId,
      type: parsed.data.type,
      text: parsed.data.text,
      explanation: parsed.data.explanation,
      marks: parsed.data.marks ?? 1,
      order: parsed.data.order ?? 0,
      options: {
        create: parsed.data.options.map((o, idx) => ({ text: o.text, isCorrect: o.isCorrect, order: idx })),
      },
    },
    include: { options: true },
  });

  return NextResponse.json({ question }, { status: 201 });
}
