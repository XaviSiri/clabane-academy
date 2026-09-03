import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthorizedSession } from "@/lib/auth/rbac";
import { submitAssessmentAttempt, AssessmentError } from "@/lib/services/assessment";

const submitSchema = z.object({
  answers: z.array(z.object({ questionId: z.string(), selectedOptionId: z.string() })),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ attemptId: string }> }) {
  const auth = await getAuthorizedSession(["EMPLOYEE"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { attemptId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  try {
    const result = await submitAssessmentAttempt({
      employeeId: auth.session.sub,
      attemptId,
      answers: parsed.data.answers,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AssessmentError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
