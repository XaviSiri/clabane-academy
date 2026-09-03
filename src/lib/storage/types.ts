/**
 * Storage abstraction contract.
 *
 * The rest of the application (videos, documents, certificates) talks only
 * to this interface — never to an S3 client, a bucket name, or a provider
 * SDK directly. That is what lets the storage provider change later
 * (S3 -> R2 -> GCS -> Azure) without touching business logic.
 *
 * The relational database stores metadata that *references* an object via
 * (provider, bucket, key). It never stores the object's bytes.
 */

export interface StoredObjectRef {
  provider: string;
  bucket: string;
  key: string;
}

export interface UploadResult extends StoredObjectRef {
  sizeBytes: number;
}

export interface PutObjectInput {
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}

export interface StorageService {
  /** Upload a file and return the reference to store in the database. */
  putObject(input: PutObjectInput): Promise<UploadResult>;

  /** Permanently delete the object. Must not throw if already absent. */
  deleteObject(ref: StoredObjectRef): Promise<void>;

  /**
   * A short-lived, signed URL the browser can stream/download directly
   * from object storage. No storage credentials are ever exposed to the
   * caller — only this single-use, time-limited URL.
   */
  getSignedDownloadUrl(ref: StoredObjectRef, expiresInSeconds?: number): Promise<string>;

  /**
   * A short-lived, signed URL the browser can PUT the file to directly,
   * so large video uploads never pass through the app server.
   */
  getSignedUploadUrl(
    ref: StoredObjectRef,
    contentType: string,
    expiresInSeconds?: number
  ): Promise<string>;

  readonly providerName: string;
  readonly bucket: string;
}
