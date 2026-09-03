import { describe, it, expect } from "vitest";
import fs from "fs/promises";
import path from "path";
import { getStorageService } from "@/lib/storage";
import { deleteStorageObjectsFor } from "@/lib/services/content-cleanup";

// Regression test: deleting a module or lesson cascades the database rows
// via Prisma's onDelete: Cascade, but that cascade has no idea object
// storage exists — the API routes must delete the backing files themselves
// first, via this helper, or a module/lesson delete would orphan files.
//
// Uses the app's actual configured storage service (the local provider,
// per .env.test) so this exercises the exact singleton the API routes call,
// then checks the filesystem directly (independent of the provider) to
// prove the objects are actually gone, not just that the call didn't throw.
describe("deleteStorageObjectsFor", () => {
  function pathFor(bucket: string, key: string) {
    const rootDir = process.env.LOCAL_STORAGE_ROOT || ".local-storage";
    return path.join(process.cwd(), rootDir, bucket, key);
  }

  it("actually removes the underlying files, not just returns successfully", async () => {
    const storage = getStorageService();
    const videoKey = `videos/cleanup-test-${Date.now()}.mp4`;
    const docKey = `documents/cleanup-test-${Date.now()}.pdf`;

    await storage.putObject({ key: videoKey, body: Buffer.from("video"), contentType: "video/mp4" });
    await storage.putObject({ key: docKey, body: Buffer.from("doc"), contentType: "application/pdf" });

    // Confirm they exist on disk first, so the later assertion proves
    // deletion rather than the files never having been written.
    await expect(fs.readFile(pathFor(storage.bucket, videoKey))).resolves.toEqual(Buffer.from("video"));
    await expect(fs.readFile(pathFor(storage.bucket, docKey))).resolves.toEqual(Buffer.from("doc"));

    await deleteStorageObjectsFor([
      { storageProvider: storage.providerName, storageBucket: storage.bucket, storageKey: videoKey },
      { storageProvider: storage.providerName, storageBucket: storage.bucket, storageKey: docKey },
    ]);

    await expect(fs.readFile(pathFor(storage.bucket, videoKey))).rejects.toThrow();
    await expect(fs.readFile(pathFor(storage.bucket, docKey))).rejects.toThrow();
  });

  it("is a no-op for an empty list", async () => {
    await expect(deleteStorageObjectsFor([])).resolves.toBeUndefined();
  });
});
