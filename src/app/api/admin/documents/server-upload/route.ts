import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedSession } from "@/lib/auth/rbac";
import { getStorageService } from "@/lib/storage";
import { MAX_DOCUMENT_SIZE_BYTES } from "@/lib/validation/content";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await getAuthorizedSession(["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const form = await req.formData();
  const file = form.get("file");
  const storageKey = form.get("storageKey");

  if (!(file instanceof File) || typeof storageKey !== "string") {
    return NextResponse.json({ error: "Missing file or storageKey." }, { status: 400 });
  }
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return NextResponse.json({ error: "File exceeds the maximum allowed size." }, { status: 413 });
  }

  const storage = getStorageService();
  const buffer = Buffer.from(await file.arrayBuffer());
  await storage.putObject({ key: storageKey, body: buffer, contentType: file.type });

  return NextResponse.json({ ok: true, sizeBytes: buffer.length });
}
