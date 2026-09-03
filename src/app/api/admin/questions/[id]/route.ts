import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthorizedSession } from "@/lib/auth/rbac";
import { z } from "zod";

const updateQuestionSchema = z.object({
  text: z.string().trim().min(1).max(2000).optional(),
  explanation: z.string().trim().max(2000).optional(),
  marks: z.number().int().min(1).max(100).optional(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedSession(["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateQuestionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  const question = await prisma.question.findUnique({ where: { id } });
  if (!question) return NextResponse.json({ error: "Question not found." }, { status: 404 });

  const updated = await prisma.question.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ question: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedSession(["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  await prisma.question.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
