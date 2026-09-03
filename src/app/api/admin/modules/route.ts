import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthorizedSession } from "@/lib/auth/rbac";
import { createModuleSchema } from "@/lib/validation/content";
import { recordAuditLog } from "@/lib/audit";

export async function GET() {
  const auth = await getAuthorizedSession(["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const modules = await prisma.module.findMany({
    orderBy: { order: "asc" },
    include: {
      lessons: { orderBy: { order: "asc" } },
      assessment: { include: { questions: true } },
    },
  });
  return NextResponse.json({ modules });
}

export async function POST(req: NextRequest) {
  const auth = await getAuthorizedSession(["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const parsed = createModuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const existing = await prisma.module.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) {
    return NextResponse.json({ error: "A module with this slug already exists." }, { status: 409 });
  }

  const module_ = await prisma.module.create({
    data: { ...parsed.data, createdById: auth.session.sub },
  });

  await recordAuditLog({
    userId: auth.session.sub,
    action: "MODULE_CREATED",
    entityType: "Module",
    entityId: module_.id,
    metadata: { title: module_.title },
  });

  return NextResponse.json({ module: module_ }, { status: 201 });
}
