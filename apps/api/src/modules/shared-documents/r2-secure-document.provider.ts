import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import type { SecureDocumentStorageProvider } from "./secure-document-storage.provider.js";

/**
 * Private Shared Document bytes on Cloudflare R2.
 *
 * Uses a dedicated private bucket (no public custom domain). Objects are only
 * readable via authorized API download → GetObject — never via R2_PUBLIC_BASE_URL.
 */
export interface R2PrivateDocumentStorageConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  privateBucket: string;
}

export function resolveR2PrivateDocumentStorageConfig(): R2PrivateDocumentStorageConfig {
  const accountId = process.env.R2_ACCOUNT_ID?.trim() ?? "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() ?? "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() ?? "";
  const privateBucket = process.env.R2_PRIVATE_BUCKET?.trim() ?? "";

  if (!accountId || !accessKeyId || !secretAccessKey || !privateBucket) {
    throw new Error(
      "Private Shared Document R2 storage requires R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_PRIVATE_BUCKET.",
    );
  }

  const publicBucket = process.env.R2_BUCKET?.trim() ?? "";
  if (publicBucket && privateBucket === publicBucket) {
    throw new Error(
      "R2_PRIVATE_BUCKET must differ from R2_BUCKET so private Shared Documents are never served by the public media CDN.",
    );
  }

  return { accountId, accessKeyId, secretAccessKey, privateBucket };
}

export class R2SecureDocumentStorageProvider implements SecureDocumentStorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: R2PrivateDocumentStorageConfig = resolveR2PrivateDocumentStorageConfig()) {
    this.bucket = config.privateBucket;
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async saveFile(input: {
    buffer: Buffer;
    extension: string;
    mimeType?: string;
  }): Promise<{ storageKey: string }> {
    const storageKey = `shared-documents/${Date.now()}-${crypto.randomUUID()}${input.extension}`;

    if (storageKey.includes("..")) {
      throw new Error("Invalid Shared Document storage key.");
    }

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: input.buffer,
        ContentType: input.mimeType || "application/octet-stream",
      }),
    );

    return { storageKey };
  }

  async deleteFile(storageKey: string): Promise<void> {
    const key = storageKey.replace(/\\/g, "/");
    if (key.includes("..") || !key.startsWith("shared-documents/")) {
      throw new Error("Invalid Shared Document storage key.");
    }

    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async openReadStream(storageKey: string): Promise<NodeJS.ReadableStream> {
    const key = storageKey.replace(/\\/g, "/");
    if (key.includes("..") || !key.startsWith("shared-documents/")) {
      throw new Error("Invalid Shared Document storage key.");
    }

    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    const body = response.Body;
    if (!body) {
      throw new Error("Shared Document object body missing.");
    }

    // AWS SDK v3 Body is a web/stream-like readable in Node.
    if (body instanceof Readable) {
      return body;
    }

    return Readable.fromWeb(body as NodeWebReadableStream);
  }
}
