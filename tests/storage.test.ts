import { describe, it, expect, beforeEach } from "vitest";
import { LocalStorageProvider } from "@/lib/storage/local-provider";
import fs from "fs/promises";
import os from "os";
import path from "path";

describe("StorageService (local provider)", () => {
  let rootDir: string;
  let provider: LocalStorageProvider;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "clabane-storage-test-"));
    provider = new LocalStorageProvider({ bucket: "test-bucket", rootDir });
  });

  it("stores an object and returns metadata that never includes the bytes", async () => {
    const body = Buffer.from("fake video bytes");
    const result = await provider.putObject({ key: "videos/a.mp4", body, contentType: "video/mp4" });
    expect(result).toEqual({
      provider: "local",
      bucket: "test-bucket",
      key: "videos/a.mp4",
      sizeBytes: body.length,
    });
    // The only place the bytes exist is the object store's own file, not any
    // structure returned to the caller (which is what a DB row would hold).
    const onDisk = await fs.readFile(path.join(rootDir, "test-bucket", "videos/a.mp4"));
    expect(onDisk.toString()).toBe("fake video bytes");
  });

  it("deleteObject removes the file and is idempotent on a missing object", async () => {
    await provider.putObject({ key: "docs/a.pdf", body: Buffer.from("x"), contentType: "application/pdf" });
    await provider.deleteObject({ provider: "local", bucket: "test-bucket", key: "docs/a.pdf" });
    await expect(fs.readFile(path.join(rootDir, "test-bucket", "docs/a.pdf"))).rejects.toThrow();
    // Deleting again (already gone) must not throw — this is what keeps a
    // retry after a partial failure from being treated as an error.
    await expect(
      provider.deleteObject({ provider: "local", bucket: "test-bucket", key: "docs/a.pdf" })
    ).resolves.toBeUndefined();
  });

  it("sanitizes path traversal in object keys instead of escaping the bucket directory", async () => {
    await provider.putObject({ key: "../../etc/passwd", body: Buffer.from("x"), contentType: "text/plain" });
    // The leading ".." segments must be stripped, landing the file inside
    // the bucket directory rather than actually reaching /etc/passwd.
    const sanitizedPath = path.join(rootDir, "test-bucket", "etc/passwd");
    await expect(fs.readFile(sanitizedPath)).resolves.toEqual(Buffer.from("x"));
  });

  it("issues a signed URL that is not a permanent/public storage URL", async () => {
    await provider.putObject({ key: "videos/b.mp4", body: Buffer.from("x"), contentType: "video/mp4" });
    const url = await provider.getSignedDownloadUrl({ provider: "local", bucket: "test-bucket", key: "videos/b.mp4" });
    expect(url).toMatch(/^\/api\/files\/local\?token=/);
    expect(url).not.toContain("videos/b.mp4"); // key is opaque-encoded, not exposed in plain text
  });
});
