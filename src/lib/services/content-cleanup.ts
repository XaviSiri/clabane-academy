import { getStorageService } from "@/lib/storage";

/**
 * Deletes the storage objects backing a set of videos/documents. Used
 * before cascading a lesson/module delete in the database, so that
 * removing content never leaves orphaned files in object storage — Prisma's
 * onDelete: Cascade only cleans up the metadata rows, never the underlying
 * objects, since it has no knowledge of the storage layer.
 */
export async function deleteStorageObjectsFor(
  items: { storageProvider: string; storageBucket: string; storageKey: string }[]
) {
  const storage = getStorageService();
  await Promise.all(
    items.map((item) =>
      storage.deleteObject({
        provider: item.storageProvider,
        bucket: item.storageBucket,
        key: item.storageKey,
      })
    )
  );
}
