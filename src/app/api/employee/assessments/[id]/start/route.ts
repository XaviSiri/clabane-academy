import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedSession } from "@/lib/auth/rbac";
import { startAssessmentAttempt, AssessmentError } from "@/lib/services/assessment";
import { prisma } from "@/lib/db";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedSession(["EMPLOYEE"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: assessmentId } = await params;
  try {
    const attempt = await startAssessmentAttempt(auth.session.sub, assessmentId);

    // Never leak correct answers to the client while an attempt is active.
    const assessment = await prisma.assessment.findUniqueOrThrow({
      where: { id: assessmentId },
      include: {
        questions: {
          where: { isActive: true },
          orderBy: { order: "asc" },
          include: { options: { select: { id: true, text: true, order: true } } },
        },
      },
    });

    return NextResponse.json({ attempt, assessment: { ...assessment, passMark: assessment.passMarkPercent } });
  } catch (err) {
    if (err instanceof AssessmentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
