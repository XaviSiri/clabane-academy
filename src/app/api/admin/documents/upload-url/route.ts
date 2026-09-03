import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getAuthorizedSession } from "@/lib/auth/rbac";
import { getStorageService } from "@/lib/storage";
import { documentUploadUrlSchema } from "@/lib/validation/content";

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-100);
}

export async function POST(req: NextRequest) {
  const auth = await getAuthorizedSession(["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const parsed = documentUploadUrlSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const storage = getStorageService();
  const storageKey = `documents/${Date.now()}-${nanoid(8)}-${sanitizeFileName(parsed.data.fileName)}`;

  try {
    const uploadUrl = await storage.getSignedUploadUrl(
      { provider: storage.providerName, bucket: storage.bucket, key: storageKey },
      parsed.data.contentType,
      600
    );
    return NextResponse.json({ mode: "direct", uploadUrl, storageKey });
  } catch {
    return NextResponse.json({
      mode: "server",
      uploadEndpoint: "/api/admin/documents/server-upload",
      storageKey,
    });
  }
}
