import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { PutObjectInput, StorageService, StoredObjectRef, UploadResult } from "./types";

/**
 * S3-API storage provider. This single implementation works unchanged
 * against AWS S3, Cloudflare R2, and MinIO (local dev) — all three speak
 * the S3 API — by pointing `endpoint` at the right host. Swapping provider
 * in production is an environment-variable change, not a code change.
 */
export class S3StorageProvider implements StorageService {
  private client: S3Client;
  readonly providerName: string;
  readonly bucket: string;

  constructor(opts: {
    providerName: string;
    bucket: string;
    region: string;
    endpoint?: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle?: boolean;
  }) {
    this.providerName = opts.providerName;
    this.bucket = opts.bucket;
    this.client = new S3Client({
      region: opts.region,
      endpoint: opts.endpoint,
      forcePathStyle: opts.forcePathStyle ?? true,
      credentials: {
        accessKeyId: opts.accessKeyId,
        secretAccessKey: opts.secretAccessKey,
      },
    });
  }

  async ping(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }

  async putObject(input: PutObjectInput): Promise<UploadResult> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      })
    );
    return {
      provider: this.providerName,
      bucket: this.bucket,
      key: input.key,
      sizeBytes: input.body.length,
    };
  }

  async deleteObject(ref: StoredObjectRef): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: ref.bucket, Key: ref.key }));
    } catch (err) {
      // Deleting an already-absent object should not fail the caller —
      // the goal (no orphaned object) is already satisfied.
      const code = (err as { name?: string })?.name;
      if (code !== "NoSuchKey" && code !== "NotFound") throw err;
    }
  }

  async getSignedDownloadUrl(ref: StoredObjectRef, expiresInSeconds = 300): Promise<string> {
    const command = new GetObjectCommand({ Bucket: ref.bucket, Key: ref.key });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async getSignedUploadUrl(
    ref: StoredObjectRef,
    contentType: string,
    expiresInSeconds = 300
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: ref.bucket,
      Key: ref.key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }
}
