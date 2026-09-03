import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getAuthorizedSession } from "@/lib/auth/rbac";
import { getStorageService } from "@/lib/storage";
import { videoUploadUrlSchema } from "@/lib/validation/content";

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-100);
}

/**
 * Step 1 of the upload flow. Returns a short-lived, direct-to-storage
 * upload target so the video's bytes never pass through the app server
 * (or, for the local dev fallback, a server-upload endpoint) — either way,
 * no storage credentials are returned to the browser.
 */
export async function POST(req: NextRequest) {
  const auth = await getAuthorizedSession(["ADMIN"]);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const parsed = videoUploadUrlSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  const storage = getStorageService();
  const storageKey = `videos/${Date.now()}-${nanoid(8)}-${sanitizeFileName(parsed.data.fileName)}`;

  try {
    const uploadUrl = await storage.getSignedUploadUrl(
      { provider: storage.providerName, bucket: storage.bucket, key: storageKey },
      parsed.data.contentType,
      900
    );
    return NextResponse.json({ mode: "direct", uploadUrl, storageKey });
  } catch {
    // Local dev fallback: the provider doesn't support presigned PUTs, so
    // the browser uploads through a server route instead.
    return NextResponse.json({
      mode: "server",
      uploadEndpoint: "/api/admin/videos/server-upload",
      storageKey,
    });
  }
}
