import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthorizedSession } from "@/lib/auth/rbac";
import { getStorageService } from "@/lib/storage";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedSession(["EMPLOYEE", "ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const document = await prisma.document.findUnique({
    where: { id },
    include: { lesson: { include: { module: true } } },
  });
  if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  const isAdmin = auth.session.role === "ADMIN";
  if (
    !isAdmin &&
    (!document.isPublished || !document.lesson.isPublished || !document.lesson.module.isPublished)
  ) {
    return NextResponse.json({ error: "This document is not currently available." }, { status: 403 });
  }

  const storage = getStorageService();
  const url = await storage.getSignedDownloadUrl(
    { provider: document.storageProvider, bucket: document.storageBucket, key: document.storageKey },
    300
  );

  return NextResponse.json({ url });
}
