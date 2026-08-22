import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import type { MediaObjectStorage } from "./media-object-storage.js";
import type { MediaUploadPurpose } from "./media-upload.types.js";

const PURPOSE_PREFIX: Record<MediaUploadPurpose, string> = {
  avatar: "avatars",
  "initiative-image": "initiatives",
  "blog-image": "blog",
  "media-resource-logo": "media-resources",
};

export interface R2MediaStorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
}

export function resolveR2MediaStorageConfig(): R2MediaStorageConfig {
  const accountId = process.env.R2_ACCOUNT_ID?.trim() ?? "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() ?? "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() ?? "";
  const bucket = process.env.R2_BUCKET?.trim() ?? "";
  const publicBaseUrl = (process.env.R2_PUBLIC_BASE_URL?.trim() ?? "").replace(/\/$/, "");

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    throw new Error(
      "R2 media storage requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, and R2_PUBLIC_BASE_URL.",
    );
  }

  return { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl };
}

/**
 * Cloudflare R2 via S3-compatible API.
 * Secrets stay server-side; never log credential values.
 */
export class R2MediaObjectStorage implements MediaObjectStorage {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(config: R2MediaStorageConfig = resolveR2MediaStorageConfig()) {
    this.bucket = config.bucket;
    this.publicBaseUrl = config.publicBaseUrl;
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  buildPublicUrl(storageKey: string): string {
    const key = storageKey.replace(/\\/g, "/").replace(/^\/+/, "");
    return `${this.publicBaseUrl}/${key}`;
  }

  async saveFile(input: {
    purpose: MediaUploadPurpose;
    buffer: Buffer;
    mimeType: string;
    extension: string;
    storageKey?: string;
  }): Promise<{ storageKey: string }> {
    const storageKey =
      input.storageKey?.replace(/\\/g, "/").replace(/^\/+/, "") ??
      `${PURPOSE_PREFIX[input.purpose]}/${Date.now()}-${crypto.randomUUID()}${input.extension}`;

    if (storageKey.includes("..")) {
      throw new Error("Invalid media storage key.");
    }

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: input.buffer,
        ContentType: input.mimeType,
      }),
    );

    return { storageKey };
  }

  async deleteFile(storageKey: string): Promise<void> {
    const key = storageKey.replace(/\\/g, "/");
    if (key.includes("..")) {
      throw new Error("Invalid media storage key.");
    }

    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }
}
