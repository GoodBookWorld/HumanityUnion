import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import {
  DESTINATION_R2_ACCESS_KEY_ID_ENV,
  DESTINATION_R2_ACCOUNT_ID_ENV,
  DESTINATION_R2_BUCKET_ENV,
  DESTINATION_R2_PUBLIC_BASE_URL_ENV,
  DESTINATION_R2_SECRET_ACCESS_KEY_ENV,
  PRODUCTION_MEDIA_PUBLIC_BASE_URL,
  SOURCE_R2_ACCESS_KEY_ID_ENV,
  SOURCE_R2_ACCOUNT_ID_ENV,
  SOURCE_R2_BUCKET_ENV,
  SOURCE_R2_SECRET_ACCESS_KEY_ENV,
} from "./constants.js";
import { ProductionInitiativeMigrationError } from "./errors.js";
import { sha256Hex } from "./media-recovery-journal.js";
import type { ObjectIntegrityFingerprint } from "./types.js";

export interface DualR2BucketConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export interface DualR2MediaCopyConfig {
  source: DualR2BucketConfig;
  destination: DualR2BucketConfig;
  destinationPublicBaseUrl: string;
}

function requireEnv(name: string, value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    throw new ProductionInitiativeMigrationError(
      `Missing required dual-R2 env: ${name}`,
      "MISSING_DUAL_R2_ENV",
    );
  }
  return trimmed;
}

/** Resolve explicit source + destination R2 configs. Never reuse a single R2_* provider set. */
export function resolveDualR2MediaCopyConfig(
  env: NodeJS.ProcessEnv = process.env,
): DualR2MediaCopyConfig {
  const source: DualR2BucketConfig = {
    accountId: requireEnv(SOURCE_R2_ACCOUNT_ID_ENV, env[SOURCE_R2_ACCOUNT_ID_ENV]),
    accessKeyId: requireEnv(SOURCE_R2_ACCESS_KEY_ID_ENV, env[SOURCE_R2_ACCESS_KEY_ID_ENV]),
    secretAccessKey: requireEnv(
      SOURCE_R2_SECRET_ACCESS_KEY_ENV,
      env[SOURCE_R2_SECRET_ACCESS_KEY_ENV],
    ),
    bucket: requireEnv(SOURCE_R2_BUCKET_ENV, env[SOURCE_R2_BUCKET_ENV]),
  };
  const destination: DualR2BucketConfig = {
    accountId: requireEnv(DESTINATION_R2_ACCOUNT_ID_ENV, env[DESTINATION_R2_ACCOUNT_ID_ENV]),
    accessKeyId: requireEnv(
      DESTINATION_R2_ACCESS_KEY_ID_ENV,
      env[DESTINATION_R2_ACCESS_KEY_ID_ENV],
    ),
    secretAccessKey: requireEnv(
      DESTINATION_R2_SECRET_ACCESS_KEY_ENV,
      env[DESTINATION_R2_SECRET_ACCESS_KEY_ENV],
    ),
    bucket: requireEnv(DESTINATION_R2_BUCKET_ENV, env[DESTINATION_R2_BUCKET_ENV]),
  };
  const destinationPublicBaseUrl = requireEnv(
    DESTINATION_R2_PUBLIC_BASE_URL_ENV,
    env[DESTINATION_R2_PUBLIC_BASE_URL_ENV],
  ).replace(/\/$/, "");

  if (destinationPublicBaseUrl !== PRODUCTION_MEDIA_PUBLIC_BASE_URL) {
    throw new ProductionInitiativeMigrationError(
      `Destination public base must be ${PRODUCTION_MEDIA_PUBLIC_BASE_URL} (got ${destinationPublicBaseUrl}).`,
      "WRONG_MEDIA_PUBLIC_BASE",
    );
  }

  if (
    source.accountId === destination.accountId &&
    source.bucket === destination.bucket
  ) {
    throw new ProductionInitiativeMigrationError(
      "Source and destination R2 buckets must be distinct.",
      "SAME_SOURCE_DESTINATION_R2",
    );
  }

  return { source, destination, destinationPublicBaseUrl };
}

export function createR2S3Client(config: DualR2BucketConfig): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export function normalizeEtag(etag: string | undefined | null): string | null {
  if (!etag?.trim()) return null;
  return etag.trim().replace(/^W\//, "").replaceAll('"', "").toLowerCase();
}

/**
 * Equivalence requires size + content SHA-256.
 * ETag is never sufficient alone (not a guaranteed content hash on S3/R2).
 */
export function isObjectIntegrityEquivalent(
  source: ObjectIntegrityFingerprint,
  destination: ObjectIntegrityFingerprint,
): boolean {
  if (source.contentLength !== destination.contentLength) return false;
  if (!source.checksumSHA256 || !destination.checksumSHA256) return false;
  if (source.checksumSHA256 !== destination.checksumSHA256) return false;
  if (
    source.contentType &&
    destination.contentType &&
    source.contentType !== destination.contentType
  ) {
    return false;
  }
  return true;
}

export type MediaCopyOutcome =
  | {
      status: "created";
      destinationUrl: string;
      integrity: ObjectIntegrityFingerprint;
      createdByThisExecution: true;
    }
  | {
      status: "already_equivalent";
      destinationUrl: string;
      integrity: ObjectIntegrityFingerprint;
      createdByThisExecution: false;
    }
  | {
      status: "deferred";
      destinationUrl: string;
      createdByThisExecution: false;
    };

async function headExists(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<{ contentLength: number; contentType: string | null; etag: string | null } | null> {
  try {
    const head = await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
    if (head.ContentLength == null || !Number.isFinite(head.ContentLength)) {
      throw new ProductionInitiativeMigrationError(
        "Object metadata missing contentLength.",
        "MEDIA_INTEGRITY_INCOMPLETE",
      );
    }
    return {
      contentLength: head.ContentLength,
      contentType: head.ContentType?.trim() || null,
      etag: normalizeEtag(head.ETag),
    };
  } catch (error) {
    const name =
      error && typeof error === "object" && "name" in error
        ? String((error as { name: unknown }).name)
        : "";
    const httpStatus =
      error && typeof error === "object" && "$metadata" in error
        ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata
            ?.httpStatusCode
        : undefined;
    if (name === "NotFound" || name === "NoSuchKey" || httpStatus === 404) {
      return null;
    }
    throw error;
  }
}

async function streamToBuffer(body: unknown): Promise<Buffer> {
  if (!body) {
    throw new ProductionInitiativeMigrationError(
      "Source object body missing.",
      "MEDIA_SOURCE_BODY_MISSING",
    );
  }
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof (body as { transformToByteArray?: unknown }).transformToByteArray === "function") {
    const bytes = await (
      body as { transformToByteArray: () => Promise<Uint8Array> }
    ).transformToByteArray();
    return Buffer.from(bytes);
  }
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function getObjectBytes(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<{ body: Buffer; contentType: string | null }> {
  const got = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
  );
  const body = await streamToBuffer(got.Body);
  return { body, contentType: got.ContentType?.trim() || null };
}

/**
 * Cross-bucket public media copy with byte-level SHA-256 integrity.
 * Uses GetObject + PutObject so source/destination accounts may differ.
 */
export class DualBucketR2MediaCopyExecutor {
  private readonly sourceClient: S3Client;
  private readonly destinationClient: S3Client;
  private readonly sourceBucket: string;
  private readonly destinationBucket: string;
  private readonly destinationPublicBaseUrl: string;
  private writeCount = 0;

  constructor(config: DualR2MediaCopyConfig) {
    this.sourceClient = createR2S3Client(config.source);
    this.destinationClient = createR2S3Client(config.destination);
    this.sourceBucket = config.source.bucket;
    this.destinationBucket = config.destination.bucket;
    this.destinationPublicBaseUrl = config.destinationPublicBaseUrl;
  }

  getWriteCount(): number {
    return this.writeCount;
  }

  async copyPublicObject(input: {
    storageKey: string;
    destinationUrl: string;
  }): Promise<MediaCopyOutcome> {
    const key = input.storageKey.replace(/^\/+/, "");
    if (!key || key.includes("..")) {
      throw new ProductionInitiativeMigrationError(
        "Invalid media storage key.",
        "MEDIA_INVALID_STORAGE_KEY",
      );
    }

    const sourceHead = await headExists(this.sourceClient, this.sourceBucket, key);
    if (!sourceHead) {
      throw new ProductionInitiativeMigrationError(
        `Source R2 object missing for storageKey=${key}`,
        "MEDIA_SOURCE_MISSING",
      );
    }

    const sourceObj = await getObjectBytes(this.sourceClient, this.sourceBucket, key);
    if (sourceObj.body.byteLength !== sourceHead.contentLength) {
      throw new ProductionInitiativeMigrationError(
        `Source body length mismatch for storageKey=${key}`,
        "MEDIA_INTEGRITY_FAILED",
      );
    }
    const sourceSha = sha256Hex(sourceObj.body);
    const sourceFp: ObjectIntegrityFingerprint = {
      contentLength: sourceObj.body.byteLength,
      etag: sourceHead.etag,
      contentType: sourceObj.contentType ?? sourceHead.contentType,
      checksumSHA256: sourceSha,
    };

    const destHead = await headExists(this.destinationClient, this.destinationBucket, key);
    if (destHead) {
      const destObj = await getObjectBytes(this.destinationClient, this.destinationBucket, key);
      const destSha = sha256Hex(destObj.body);
      const destFp: ObjectIntegrityFingerprint = {
        contentLength: destObj.body.byteLength,
        etag: destHead.etag,
        contentType: destObj.contentType ?? destHead.contentType,
        checksumSHA256: destSha,
      };
      // ETag match without SHA-256 is intentionally insufficient.
      if (isObjectIntegrityEquivalent(sourceFp, destFp)) {
        return {
          status: "already_equivalent",
          destinationUrl: input.destinationUrl,
          integrity: destFp,
          createdByThisExecution: false,
        };
      }
      throw new ProductionInitiativeMigrationError(
        `Destination R2 collision for storageKey=${key} (not content-equivalent)`,
        "MEDIA_DESTINATION_COLLISION",
      );
    }

    const contentType =
      sourceFp.contentType ?? "application/octet-stream";
    await this.destinationClient.send(
      new PutObjectCommand({
        Bucket: this.destinationBucket,
        Key: key,
        Body: sourceObj.body,
        ContentType: contentType,
      }),
    );
    this.writeCount += 1;

    const verifiedObj = await getObjectBytes(this.destinationClient, this.destinationBucket, key);
    const verifiedSha = sha256Hex(verifiedObj.body);
    if (verifiedObj.body.byteLength !== sourceFp.contentLength || verifiedSha !== sourceSha) {
      throw new ProductionInitiativeMigrationError(
        `Post-copy SHA-256/size mismatch for storageKey=${key}`,
        "MEDIA_INTEGRITY_FAILED",
      );
    }
    if (
      sourceFp.contentType &&
      verifiedObj.contentType &&
      sourceFp.contentType !== verifiedObj.contentType
    ) {
      throw new ProductionInitiativeMigrationError(
        `Post-copy contentType mismatch for storageKey=${key}`,
        "MEDIA_INTEGRITY_FAILED",
      );
    }

    return {
      status: "created",
      destinationUrl: input.destinationUrl || `${this.destinationPublicBaseUrl}/${key}`,
      integrity: {
        contentLength: verifiedObj.body.byteLength,
        etag: null,
        contentType: verifiedObj.contentType ?? contentType,
        checksumSHA256: verifiedSha,
      },
      createdByThisExecution: true,
    };
  }

  async deleteOwnedObject(storageKey: string): Promise<void> {
    const key = storageKey.replace(/^\/+/, "");
    if (!key || key.includes("..")) {
      throw new ProductionInitiativeMigrationError(
        "Invalid media storage key for delete.",
        "MEDIA_INVALID_STORAGE_KEY",
      );
    }
    await this.destinationClient.send(
      new DeleteObjectCommand({
        Bucket: this.destinationBucket,
        Key: key,
      }),
    );
  }
}

/** In-memory fake for unit tests — no network I/O. */
export class InMemoryMediaCopyExecutor {
  readonly source = new Map<string, { body: Buffer; contentType: string; etag: string }>();
  readonly destination = new Map<
    string,
    { body: Buffer; contentType: string; etag: string }
  >();
  writeCount = 0;
  deleteCount = 0;
  /** Test hook: force SHA mismatch after put. */
  corruptAfterCopy = false;

  seedSource(storageKey: string, body: Buffer, contentType = "image/png"): void {
    this.source.set(storageKey, {
      body,
      contentType,
      etag: `etag-${storageKey}-${body.byteLength}`,
    });
  }

  seedDestination(storageKey: string, body: Buffer, contentType = "image/png"): void {
    this.destination.set(storageKey, {
      body,
      contentType,
      etag: `etag-${storageKey}-${body.byteLength}`,
    });
  }

  async copyPublicObject(input: {
    storageKey: string;
    destinationUrl: string;
  }): Promise<MediaCopyOutcome> {
    const src = this.source.get(input.storageKey);
    if (!src) {
      throw new ProductionInitiativeMigrationError(
        `Source R2 object missing for storageKey=${input.storageKey}`,
        "MEDIA_SOURCE_MISSING",
      );
    }
    const sourceSha = sha256Hex(src.body);
    const sourceFp: ObjectIntegrityFingerprint = {
      contentLength: src.body.byteLength,
      etag: normalizeEtag(src.etag),
      contentType: src.contentType,
      checksumSHA256: sourceSha,
    };
    const dest = this.destination.get(input.storageKey);
    if (dest) {
      const destSha = sha256Hex(dest.body);
      const destFp: ObjectIntegrityFingerprint = {
        contentLength: dest.body.byteLength,
        etag: normalizeEtag(dest.etag),
        contentType: dest.contentType,
        checksumSHA256: destSha,
      };
      if (isObjectIntegrityEquivalent(sourceFp, destFp)) {
        return {
          status: "already_equivalent",
          destinationUrl: input.destinationUrl,
          integrity: destFp,
          createdByThisExecution: false,
        };
      }
      throw new ProductionInitiativeMigrationError(
        `Destination R2 collision for storageKey=${input.storageKey} (not content-equivalent)`,
        "MEDIA_DESTINATION_COLLISION",
      );
    }
    this.destination.set(input.storageKey, { ...src });
    this.writeCount += 1;
    if (this.corruptAfterCopy) {
      const corrupt = Buffer.from(`${src.body.toString("hex")}-corrupt`);
      this.destination.set(input.storageKey, {
        body: corrupt,
        contentType: src.contentType,
        etag: "corrupt",
      });
      throw new ProductionInitiativeMigrationError(
        `Post-copy SHA-256/size mismatch for storageKey=${input.storageKey}`,
        "MEDIA_INTEGRITY_FAILED",
      );
    }
    return {
      status: "created",
      destinationUrl: input.destinationUrl,
      integrity: sourceFp,
      createdByThisExecution: true,
    };
  }

  async deleteOwnedObject(storageKey: string): Promise<void> {
    this.destination.delete(storageKey);
    this.deleteCount += 1;
  }
}
