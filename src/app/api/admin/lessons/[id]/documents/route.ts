import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthorizedSession } from "@/lib/auth/rbac";
import { getStorageService } from "@/lib/storage";
import { createDocumentSchema } from "@/lib/validation/content";
import { recordAuditLog, getClientIp } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedSession(["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: lessonId } = await params;
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) return NextResponse.json({ error: "Lesson not found." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = createDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const storage = getStorageService();
  const document = await prisma.document.create({
    data: {
      lessonId,
      title: parsed.data.title,
      description: parsed.data.description,
      storageProvider: storage.providerName,
      storageBucket: storage.bucket,
      storageKey: parsed.data.storageKey,
      fileSizeBytes: BigInt(parsed.data.fileSizeBytes),
      mimeType: parsed.data.mimeType,
      uploadedById: auth.session.sub,
    },
  });

  await recordAuditLog({
    userId: auth.session.sub,
    action: "DOCUMENT_UPLOADED",
    entityType: "Document",
    entityId: document.id,
    metadata: { lessonId, title: document.title },
    ipAddress: getClientIp(req.headers),
  });

  return NextResponse.json(
    { document: { ...document, fileSizeBytes: document.fileSizeBytes?.toString() } },
    { status: 201 }
  );
}
