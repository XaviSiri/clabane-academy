import { promises as fs } from "fs";
import path from "path";
import type { PutObjectInput, StorageService, StoredObjectRef, UploadResult } from "./types";

/**
 * Disk-backed provider used only when no S3-compatible endpoint is
 * configured (e.g. a laptop with no Docker running). It implements the same
 * StorageService contract as the S3 provider so the rest of the app is
 * unaffected. "Signed URLs" here are short-lived tokens verified by the
 * app's own file-serving route — not suitable for production, but keeps
 * local development possible with zero external dependencies.
 */
export class LocalStorageProvider implements StorageService {
  readonly providerName = "local";
  readonly bucket: string;
  private rootDir: string;

  constructor(opts: { bucket: string; rootDir: string }) {
    this.bucket = opts.bucket;
    this.rootDir = opts.rootDir;
  }

  private resolvePath(key: string) {
    const safeKey = path.normalize(key).replace(/^(\.\.[/\\])+/, "");
    return path.join(this.rootDir, this.bucket, safeKey);
  }

  async putObject(input: PutObjectInput): Promise<UploadResult> {
    const fullPath = this.resolvePath(input.key);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, input.body);
    return {
      provider: this.providerName,
      bucket: this.bucket,
      key: input.key,
      sizeBytes: input.body.length,
    };
  }

  async deleteObject(ref: StoredObjectRef): Promise<void> {
    try {
      await fs.unlink(this.resolvePath(ref.key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  async getSignedDownloadUrl(ref: StoredObjectRef): Promise<string> {
    const token = Buffer.from(`${ref.bucket}:${ref.key}:${Date.now() + 5 * 60_000}`).toString(
      "base64url"
    );
    return `/api/files/local?token=${token}`;
  }

  async getSignedUploadUrl(): Promise<string> {
    throw new Error(
      "LocalStorageProvider does not support direct browser uploads; use the server upload route."
    );
  }
}
