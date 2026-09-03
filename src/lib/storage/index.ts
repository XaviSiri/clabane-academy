import { S3StorageProvider } from "./s3-provider";
import { LocalStorageProvider } from "./local-provider";
import type { StorageService } from "./types";

export * from "./types";

/**
 * Single factory for the whole app. STORAGE_PROVIDER selects the backend;
 * everything else (video upload, document upload, certificate storage,
 * signed URL issuance) depends only on the StorageService interface above.
 *
 * Supported values: "s3" | "r2" | "minio" | "local".
 * s3 / r2 / minio all use the same S3-API client — only the endpoint/region
 * differ — which is exactly what makes provider migration a config change.
 */
let cached: StorageService | null = null;

export function getStorageService(): StorageService {
  if (cached) return cached;

  const provider = (process.env.STORAGE_PROVIDER || "local").toLowerCase();
  const bucket = process.env.STORAGE_BUCKET || "clabane-academy";

  switch (provider) {
    case "s3":
      cached = new S3StorageProvider({
        providerName: "s3",
        bucket,
        region: required("STORAGE_REGION"),
        accessKeyId: required("STORAGE_ACCESS_KEY"),
        secretAccessKey: required("STORAGE_SECRET_KEY"),
        forcePathStyle: false,
      });
      break;
    case "r2":
      cached = new S3StorageProvider({
        providerName: "r2",
        bucket,
        region: "auto",
        endpoint: required("STORAGE_ENDPOINT"),
        accessKeyId: required("STORAGE_ACCESS_KEY"),
        secretAccessKey: required("STORAGE_SECRET_KEY"),
        forcePathStyle: true,
      });
      break;
    case "minio":
      cached = new S3StorageProvider({
        providerName: "minio",
        bucket,
        region: process.env.STORAGE_REGION || "us-east-1",
        endpoint: process.env.STORAGE_ENDPOINT || "http://localhost:9000",
        accessKeyId: process.env.STORAGE_ACCESS_KEY || "minioadmin",
        secretAccessKey: process.env.STORAGE_SECRET_KEY || "minioadmin",
        forcePathStyle: true,
      });
      break;
    case "local":
    default:
      cached = new LocalStorageProvider({
        bucket,
        rootDir: process.env.LOCAL_STORAGE_ROOT || ".local-storage",
      });
      break;
  }

  return cached;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
