import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthorizedSession } from "@/lib/auth/rbac";
import { getStorageService } from "@/lib/storage";
import { z } from "zod";
import { recordAuditLog } from "@/lib/audit";

const updateDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  isPublished: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedSession(["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  const updated = await prisma.document.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ document: { ...updated, fileSizeBytes: updated.fileSizeBytes?.toString() } });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedSession(["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  const storage = getStorageService();
  await storage.deleteObject({ provider: doc.storageProvider, bucket: doc.storageBucket, key: doc.storageKey });
  await prisma.document.delete({ where: { id } });

  await recordAuditLog({
    userId: auth.session.sub,
    action: "DOCUMENT_DELETED",
    entityType: "Document",
    entityId: id,
    metadata: { title: doc.title },
  });

  return NextResponse.json({ ok: true });
}
