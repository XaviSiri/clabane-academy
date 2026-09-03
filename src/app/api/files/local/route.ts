import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

/**
 * Serves files for the LocalStorageProvider dev fallback (see
 * src/lib/storage/local-provider.ts). Tokens are short-lived and opaque;
 * this route exists only so local development works without Docker/MinIO
 * or cloud credentials. Never used when STORAGE_PROVIDER is s3/r2/minio.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token." }, { status: 400 });

  let decoded: string;
  try {
    decoded = Buffer.from(token, "base64url").toString("utf-8");
  } catch {
    return NextResponse.json({ error: "Invalid token." }, { status: 400 });
  }

  const [bucket, key, expiresAtRaw] = decoded.split(":");
  const expiresAt = Number(expiresAtRaw);
  if (!bucket || !key || !expiresAt || Date.now() > expiresAt) {
    return NextResponse.json({ error: "This link has expired." }, { status: 403 });
  }

  const rootDir = process.env.LOCAL_STORAGE_ROOT || ".local-storage";
  const safeKey = path.normalize(key).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(process.cwd(), rootDir, bucket, safeKey);

  try {
    const data = await fs.readFile(filePath);
    return new NextResponse(new Uint8Array(data), {
      headers: { "Content-Type": guessContentType(filePath), "Cache-Control": "private, max-age=60" },
    });
  } catch {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
}

function guessContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
  };
  return map[ext] || "application/octet-stream";
}
