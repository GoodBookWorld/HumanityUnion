/**
 * Blog dual-R2 copy executor — GetObject + PutObject with ownership metadata.
 * Never uses CopyObject. Deletes only when ownership is re-proven.
 * Independent of production-initiative-migration.
 */

import { createHash } from "node:crypto";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import {
  BLOG_DESTINATION_R2_ACCESS_KEY_ID_ENV,
  BLOG_DESTINATION_R2_ACCOUNT_ID_ENV,
  BLOG_DESTINATION_R2_BUCKET_ENV,
  BLOG_DESTINATION_R2_SECRET_ACCESS_KEY_ENV,
  BLOG_SOURCE_R2_ACCESS_KEY_ID_ENV,
  BLOG_SOURCE_R2_ACCOUNT_ID_ENV,
  BLOG_SOURCE_R2_BUCKET_ENV,
  BLOG_SOURCE_R2_SECRET_ACCESS_KEY_ENV,
  PRODUCTION_MEDIA_PUBLIC_BASE_URL,
} from "./constants.js";
import { ProductionBlogMigrationError } from "./errors.js";
import { isBlogMigrationR2Configured } from "./guards.js";
import {
  blogOwnershipProofFromMetadata,
  buildBlogMigrationOwnershipMetadata,
  isProvenOwnedByBlogMigration,
  parseBlogMigrationOwnershipMetadata,
  type BlogMigrationObjectOwnershipProof,
} from "./media-ownership.js";

export function sha256Hex(body: Buffer): string {
  return createHash("sha256").update(body).digest("hex");
}

export type BlogObjectIntegrityFingerprint = {
  contentLength: number;
  contentType: string | null;
  checksumSHA256: string;
};

export function isBlogObjectIntegrityEquivalent(
  source: BlogObjectIntegrityFingerprint,
  destination: BlogObjectIntegrityFingerprint,
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

export type BlogMediaCopyOutcome =
  | {
      status: "created";
      destinationUrl: string;
      integrity: BlogObjectIntegrityFingerprint;
      createdByThisExecution: true;
    }
  | {
      status: "already_equivalent";
      destinationUrl: string;
      integrity: BlogObjectIntegrityFingerprint;
      createdByThisExecution: false;
    };

export interface BlogPreparedSourceObject {
  storageKey: string;
  body: Buffer;
  contentLength: number;
  contentType: string | null;
  checksumSHA256: string;
}

export interface BlogDestinationObjectInspection {
  contentLength: number;
  contentType: string | null;
  checksumSHA256: string;
  ownership: BlogMigrationObjectOwnershipProof;
  rawOwnershipExecutionId: string | null;
  rawOwnershipMarker: string | null;
}

export interface BlogMediaCopyExecutor {
  prepareSourceObject(storageKey: string): Promise<BlogPreparedSourceObject>;
  inspectDestinationObject(
    storageKey: string,
    expectedMigrationExecutionId?: string,
  ): Promise<BlogDestinationObjectInspection | null>;
  copyPublicObject(input: {
    storageKey: string;
    destinationUrl: string;
    preparedSource?: BlogPreparedSourceObject;
    migrationExecutionId: string;
  }): Promise<BlogMediaCopyOutcome>;
  deleteOwnedObject(storageKey: string, migrationExecutionId: string): Promise<void>;
  getWriteCount(): number;
  getDeleteCount(): number;
}

export interface DualBlogR2BucketConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export interface DualBlogR2CopyConfig {
  source: DualBlogR2BucketConfig;
  destination: DualBlogR2BucketConfig;
  destinationPublicBaseUrl: string;
}

function requireEnv(name: string, value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    throw new ProductionBlogMigrationError(
      `Missing required Blog dual-R2 env: ${name}`,
      "MISSING_DUAL_R2_ENV",
    );
  }
  return trimmed;
}

export function resolveDualBlogR2CopyConfig(
  env: NodeJS.ProcessEnv = process.env,
): DualBlogR2CopyConfig {
  if (!isBlogMigrationR2Configured(env)) {
    throw new ProductionBlogMigrationError(
      "Blog dual-R2 credentials are not fully configured.",
      "MISSING_DUAL_R2_ENV",
    );
  }
  const source: DualBlogR2BucketConfig = {
    accountId: requireEnv(BLOG_SOURCE_R2_ACCOUNT_ID_ENV, env[BLOG_SOURCE_R2_ACCOUNT_ID_ENV]),
    accessKeyId: requireEnv(
      BLOG_SOURCE_R2_ACCESS_KEY_ID_ENV,
      env[BLOG_SOURCE_R2_ACCESS_KEY_ID_ENV],
    ),
    secretAccessKey: requireEnv(
      BLOG_SOURCE_R2_SECRET_ACCESS_KEY_ENV,
      env[BLOG_SOURCE_R2_SECRET_ACCESS_KEY_ENV],
    ),
    bucket: requireEnv(BLOG_SOURCE_R2_BUCKET_ENV, env[BLOG_SOURCE_R2_BUCKET_ENV]),
  };
  const destination: DualBlogR2BucketConfig = {
    accountId: requireEnv(
      BLOG_DESTINATION_R2_ACCOUNT_ID_ENV,
      env[BLOG_DESTINATION_R2_ACCOUNT_ID_ENV],
    ),
    accessKeyId: requireEnv(
      BLOG_DESTINATION_R2_ACCESS_KEY_ID_ENV,
      env[BLOG_DESTINATION_R2_ACCESS_KEY_ID_ENV],
    ),
    secretAccessKey: requireEnv(
      BLOG_DESTINATION_R2_SECRET_ACCESS_KEY_ENV,
      env[BLOG_DESTINATION_R2_SECRET_ACCESS_KEY_ENV],
    ),
    bucket: requireEnv(BLOG_DESTINATION_R2_BUCKET_ENV, env[BLOG_DESTINATION_R2_BUCKET_ENV]),
  };
  if (
    source.accountId === destination.accountId &&
    source.bucket === destination.bucket
  ) {
    throw new ProductionBlogMigrationError(
      "Source and destination Blog R2 buckets must be distinct.",
      "SAME_SOURCE_DESTINATION_R2",
    );
  }
  return {
    source,
    destination,
    destinationPublicBaseUrl: PRODUCTION_MEDIA_PUBLIC_BASE_URL,
  };
}

function createR2S3Client(config: DualBlogR2BucketConfig): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

async function headExists(
  client: S3Client,
  bucket: string,
  key: string,
): Promise<{
  contentLength: number;
  contentType: string | null;
  metadata: Record<string, string>;
} | null> {
  try {
    const head = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    );
    if (head.ContentLength == null || !Number.isFinite(head.ContentLength)) {
      throw new ProductionBlogMigrationError(
        "Object metadata missing contentLength.",
        "MEDIA_INTEGRITY_INCOMPLETE",
      );
    }
    const metadata: Record<string, string> = {};
    if (head.Metadata) {
      for (const [k, v] of Object.entries(head.Metadata)) {
        if (typeof v === "string") metadata[k.toLowerCase()] = v;
      }
    }
    return {
      contentLength: head.ContentLength,
      contentType: head.ContentType?.trim() || null,
      metadata,
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
    throw new ProductionBlogMigrationError(
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
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  const body = await streamToBuffer(got.Body);
  return { body, contentType: got.ContentType?.trim() || null };
}

/** True for S3/R2 412 PreconditionFailed (If-None-Match create-only reject). */
export function isPreconditionFailed(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name =
    "name" in error ? String((error as { name: unknown }).name) : "";
  const httpStatus =
    "$metadata" in error
      ? (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode
      : undefined;
  const code =
    "Code" in error
      ? String((error as { Code: unknown }).Code)
      : "code" in error
        ? String((error as { code: unknown }).code)
        : "";
  return (
    httpStatus === 412 ||
    name === "PreconditionFailed" ||
    code === "PreconditionFailed"
  );
}

export class DualBucketBlogR2CopyExecutor implements BlogMediaCopyExecutor {
  private readonly sourceClient: S3Client;
  private readonly destinationClient: S3Client;
  private readonly sourceBucket: string;
  private readonly destinationBucket: string;
  private readonly destinationPublicBaseUrl: string;
  private writeCount = 0;
  private deleteCount = 0;

  constructor(config: DualBlogR2CopyConfig) {
    this.sourceClient = createR2S3Client(config.source);
    this.destinationClient = createR2S3Client(config.destination);
    this.sourceBucket = config.source.bucket;
    this.destinationBucket = config.destination.bucket;
    this.destinationPublicBaseUrl = config.destinationPublicBaseUrl;
  }

  getWriteCount(): number {
    return this.writeCount;
  }

  getDeleteCount(): number {
    return this.deleteCount;
  }

  async prepareSourceObject(storageKey: string): Promise<BlogPreparedSourceObject> {
    const key = storageKey.replace(/^\/+/, "");
    if (!key || key.includes("..")) {
      throw new ProductionBlogMigrationError(
        "Invalid Blog media storage key.",
        "MEDIA_INVALID_STORAGE_KEY",
      );
    }
    const sourceHead = await headExists(this.sourceClient, this.sourceBucket, key);
    if (!sourceHead) {
      throw new ProductionBlogMigrationError(
        `Source R2 object missing for storageKey=${key}`,
        "MEDIA_SOURCE_MISSING",
      );
    }
    const sourceObj = await getObjectBytes(this.sourceClient, this.sourceBucket, key);
    if (sourceObj.body.byteLength !== sourceHead.contentLength) {
      throw new ProductionBlogMigrationError(
        `Source body length mismatch for storageKey=${key}`,
        "MEDIA_INTEGRITY_FAILED",
      );
    }
    return {
      storageKey: key,
      body: sourceObj.body,
      contentLength: sourceObj.body.byteLength,
      contentType: sourceObj.contentType ?? sourceHead.contentType,
      checksumSHA256: sha256Hex(sourceObj.body),
    };
  }

  async inspectDestinationObject(
    storageKey: string,
    expectedMigrationExecutionId?: string,
  ): Promise<BlogDestinationObjectInspection | null> {
    const key = storageKey.replace(/^\/+/, "");
    const destHead = await headExists(this.destinationClient, this.destinationBucket, key);
    if (!destHead) return null;
    const destObj = await getObjectBytes(this.destinationClient, this.destinationBucket, key);
    const raw = blogOwnershipProofFromMetadata(destHead.metadata);
    const ownership = expectedMigrationExecutionId
      ? parseBlogMigrationOwnershipMetadata(destHead.metadata, expectedMigrationExecutionId)
      : raw.rawOwnershipExecutionId
        ? ({
            kind: "foreign" as const,
            migrationExecutionId: raw.rawOwnershipExecutionId,
            marker: raw.rawOwnershipMarker,
          } satisfies BlogMigrationObjectOwnershipProof)
        : ({ kind: "unproven" as const } satisfies BlogMigrationObjectOwnershipProof);
    return {
      contentLength: destObj.body.byteLength,
      contentType: destObj.contentType ?? destHead.contentType,
      checksumSHA256: sha256Hex(destObj.body),
      ownership,
      rawOwnershipExecutionId: raw.rawOwnershipExecutionId,
      rawOwnershipMarker: raw.rawOwnershipMarker,
    };
  }

  async copyPublicObject(input: {
    storageKey: string;
    destinationUrl: string;
    preparedSource?: BlogPreparedSourceObject;
    migrationExecutionId: string;
  }): Promise<BlogMediaCopyOutcome> {
    const key = input.storageKey.replace(/^\/+/, "");
    if (!key || key.includes("..")) {
      throw new ProductionBlogMigrationError(
        "Invalid Blog media storage key.",
        "MEDIA_INVALID_STORAGE_KEY",
      );
    }
    if (!input.migrationExecutionId.startsWith("mig_")) {
      throw new ProductionBlogMigrationError(
        "migrationExecutionId required for Blog media copy ownership.",
        "MEDIA_OWNERSHIP_METADATA_INVALID",
      );
    }

    const prepared = input.preparedSource ?? (await this.prepareSourceObject(key));
    const sourceFp: BlogObjectIntegrityFingerprint = {
      contentLength: prepared.contentLength,
      contentType: prepared.contentType,
      checksumSHA256: prepared.checksumSHA256,
    };

    const destHead = await headExists(this.destinationClient, this.destinationBucket, key);
    if (destHead) {
      const destObj = await getObjectBytes(this.destinationClient, this.destinationBucket, key);
      const destFp: BlogObjectIntegrityFingerprint = {
        contentLength: destObj.body.byteLength,
        contentType: destObj.contentType ?? destHead.contentType,
        checksumSHA256: sha256Hex(destObj.body),
      };
      if (isBlogObjectIntegrityEquivalent(sourceFp, destFp)) {
        return {
          status: "already_equivalent",
          destinationUrl: input.destinationUrl,
          integrity: destFp,
          createdByThisExecution: false,
        };
      }
      throw new ProductionBlogMigrationError(
        `Destination R2 collision for storageKey=${key}`,
        "MEDIA_DESTINATION_COLLISION",
      );
    }

    const contentType = sourceFp.contentType ?? "application/octet-stream";
    const ownershipMetadata = buildBlogMigrationOwnershipMetadata(input.migrationExecutionId);
    try {
      // Atomic create-only: Cloudflare R2 + AWS SDK PutObject IfNoneMatch:"*"
      // Rejects with 412 if the key already exists — never overwrites.
      await this.destinationClient.send(
        new PutObjectCommand({
          Bucket: this.destinationBucket,
          Key: key,
          Body: prepared.body,
          ContentType: contentType,
          Metadata: ownershipMetadata,
          IfNoneMatch: "*",
        }),
      );
    } catch (error) {
      if (isPreconditionFailed(error)) {
        throw new ProductionBlogMigrationError(
          `Destination R2 create-only PUT rejected (TOCTOU race) for storageKey=${key}`,
          "MEDIA_DESTINATION_RACE",
        );
      }
      throw error;
    }
    this.writeCount += 1;

    const verifiedHead = await headExists(this.destinationClient, this.destinationBucket, key);
    const verifiedObj = await getObjectBytes(this.destinationClient, this.destinationBucket, key);
    const verifiedSha = sha256Hex(verifiedObj.body);
    if (
      verifiedObj.body.byteLength !== sourceFp.contentLength ||
      verifiedSha !== prepared.checksumSHA256
    ) {
      throw new ProductionBlogMigrationError(
        `Post-copy SHA-256/size mismatch for storageKey=${key}`,
        "MEDIA_INTEGRITY_FAILED",
      );
    }
    const ownership = parseBlogMigrationOwnershipMetadata(
      verifiedHead?.metadata,
      input.migrationExecutionId,
    );
    if (!isProvenOwnedByBlogMigration(ownership)) {
      throw new ProductionBlogMigrationError(
        `Post-copy ownership metadata missing for storageKey=${key}`,
        "MEDIA_OWNERSHIP_METADATA_MISSING",
      );
    }

    return {
      status: "created",
      destinationUrl:
        input.destinationUrl || `${this.destinationPublicBaseUrl}/${key}`,
      integrity: {
        contentLength: verifiedObj.body.byteLength,
        contentType: verifiedObj.contentType ?? contentType,
        checksumSHA256: verifiedSha,
      },
      createdByThisExecution: true,
    };
  }

  async deleteOwnedObject(
    storageKey: string,
    migrationExecutionId: string,
  ): Promise<void> {
    const key = storageKey.replace(/^\/+/, "");
    if (!key || key.includes("..")) {
      throw new ProductionBlogMigrationError(
        "Invalid Blog media storage key for delete.",
        "MEDIA_INVALID_STORAGE_KEY",
      );
    }
    const destHead = await headExists(this.destinationClient, this.destinationBucket, key);
    if (!destHead) return;
    const ownership = parseBlogMigrationOwnershipMetadata(
      destHead.metadata,
      migrationExecutionId,
    );
    if (!isProvenOwnedByBlogMigration(ownership)) {
      throw new ProductionBlogMigrationError(
        `Refusing delete: ownership not proven for storageKey=${key}`,
        "MEDIA_OWNERSHIP_UNPROVEN",
      );
    }
    await this.destinationClient.send(
      new DeleteObjectCommand({
        Bucket: this.destinationBucket,
        Key: key,
      }),
    );
    this.deleteCount += 1;
  }
}

/** In-memory fake for unit tests — no network I/O. */
export class InMemoryBlogR2CopyExecutor implements BlogMediaCopyExecutor {
  readonly source = new Map<string, { body: Buffer; contentType: string }>();
  readonly destination = new Map<
    string,
    { body: Buffer; contentType: string; metadata: Record<string, string> }
  >();
  writeCount = 0;
  deleteCount = 0;
  failBeforePut = false;
  failAfterPut = false;
  /**
   * Simulate TOCTOU: after HEAD-absent path, insert a foreign object before
   * conditional create so create-only PUT must fail closed without overwrite.
   */
  raceAppearBeforeConditionalPut = new Set<string>();
  /** Foreign body inserted by raceAppearBeforeConditionalPut. */
  raceForeignBody = Buffer.from("foreign-race-bytes");
  unreadableSources = new Set<string>();

  seedSource(storageKey: string, body: Buffer, contentType = "image/png"): void {
    this.source.set(storageKey, { body, contentType });
  }

  seedDestination(
    storageKey: string,
    body: Buffer,
    contentType = "image/png",
    metadata: Record<string, string> = {},
  ): void {
    this.destination.set(storageKey, {
      body,
      contentType,
      metadata: { ...metadata },
    });
  }

  getWriteCount(): number {
    return this.writeCount;
  }

  getDeleteCount(): number {
    return this.deleteCount;
  }

  async prepareSourceObject(storageKey: string): Promise<BlogPreparedSourceObject> {
    if (this.unreadableSources.has(storageKey)) {
      throw new ProductionBlogMigrationError(
        `Source R2 object unreadable for storageKey=${storageKey}`,
        "MEDIA_SOURCE_UNREADABLE",
      );
    }
    const src = this.source.get(storageKey);
    if (!src) {
      throw new ProductionBlogMigrationError(
        `Source R2 object missing for storageKey=${storageKey}`,
        "MEDIA_SOURCE_MISSING",
      );
    }
    return {
      storageKey,
      body: src.body,
      contentLength: src.body.byteLength,
      contentType: src.contentType,
      checksumSHA256: sha256Hex(src.body),
    };
  }

  async inspectDestinationObject(
    storageKey: string,
    expectedMigrationExecutionId?: string,
  ): Promise<BlogDestinationObjectInspection | null> {
    const dest = this.destination.get(storageKey);
    if (!dest) return null;
    const raw = blogOwnershipProofFromMetadata(dest.metadata);
    const ownership = expectedMigrationExecutionId
      ? parseBlogMigrationOwnershipMetadata(dest.metadata, expectedMigrationExecutionId)
      : raw.rawOwnershipExecutionId
        ? ({
            kind: "foreign" as const,
            migrationExecutionId: raw.rawOwnershipExecutionId,
            marker: raw.rawOwnershipMarker,
          } satisfies BlogMigrationObjectOwnershipProof)
        : ({ kind: "unproven" as const } satisfies BlogMigrationObjectOwnershipProof);
    return {
      contentLength: dest.body.byteLength,
      contentType: dest.contentType,
      checksumSHA256: sha256Hex(dest.body),
      ownership,
      rawOwnershipExecutionId: raw.rawOwnershipExecutionId,
      rawOwnershipMarker: raw.rawOwnershipMarker,
    };
  }

  async copyPublicObject(input: {
    storageKey: string;
    destinationUrl: string;
    preparedSource?: BlogPreparedSourceObject;
    migrationExecutionId: string;
  }): Promise<BlogMediaCopyOutcome> {
    const prepared =
      input.preparedSource ?? (await this.prepareSourceObject(input.storageKey));
    const sourceFp: BlogObjectIntegrityFingerprint = {
      contentLength: prepared.contentLength,
      contentType: prepared.contentType,
      checksumSHA256: prepared.checksumSHA256,
    };
    const existing = this.destination.get(input.storageKey);
    if (existing) {
      const destFp: BlogObjectIntegrityFingerprint = {
        contentLength: existing.body.byteLength,
        contentType: existing.contentType,
        checksumSHA256: sha256Hex(existing.body),
      };
      if (isBlogObjectIntegrityEquivalent(sourceFp, destFp)) {
        return {
          status: "already_equivalent",
          destinationUrl: input.destinationUrl,
          integrity: destFp,
          createdByThisExecution: false,
        };
      }
      throw new ProductionBlogMigrationError(
        `Destination R2 collision for storageKey=${input.storageKey}`,
        "MEDIA_DESTINATION_COLLISION",
      );
    }
    if (this.failBeforePut) {
      throw new ProductionBlogMigrationError(
        "Simulated R2 put failure before write",
        "MEDIA_COPY_FAILED",
      );
    }

    // TOCTOU: object appears after HEAD-absent, before conditional create.
    if (this.raceAppearBeforeConditionalPut.has(input.storageKey)) {
      this.destination.set(input.storageKey, {
        body: Buffer.from(this.raceForeignBody),
        contentType: "image/png",
        metadata: {},
      });
    }

    // Conditional create-only (IfNoneMatch:"*" semantics): never overwrite.
    if (this.destination.has(input.storageKey)) {
      throw new ProductionBlogMigrationError(
        `Destination R2 create-only PUT rejected (TOCTOU race) for storageKey=${input.storageKey}`,
        "MEDIA_DESTINATION_RACE",
      );
    }

    const metadata = buildBlogMigrationOwnershipMetadata(input.migrationExecutionId);
    this.destination.set(input.storageKey, {
      body: Buffer.from(prepared.body),
      contentType: prepared.contentType ?? "application/octet-stream",
      metadata,
    });
    this.writeCount += 1;
    if (this.failAfterPut) {
      throw new ProductionBlogMigrationError(
        "Simulated R2 failure after put",
        "MEDIA_COPY_FAILED",
      );
    }
    return {
      status: "created",
      destinationUrl: input.destinationUrl,
      integrity: {
        contentLength: prepared.contentLength,
        contentType: prepared.contentType,
        checksumSHA256: prepared.checksumSHA256,
      },
      createdByThisExecution: true,
    };
  }

  async deleteOwnedObject(
    storageKey: string,
    migrationExecutionId: string,
  ): Promise<void> {
    const dest = this.destination.get(storageKey);
    if (!dest) return;
    const ownership = parseBlogMigrationOwnershipMetadata(
      dest.metadata,
      migrationExecutionId,
    );
    if (!isProvenOwnedByBlogMigration(ownership)) {
      throw new ProductionBlogMigrationError(
        `Refusing delete: ownership not proven for storageKey=${storageKey}`,
        "MEDIA_OWNERSHIP_UNPROVEN",
      );
    }
    this.destination.delete(storageKey);
    this.deleteCount += 1;
  }
}

/** Dry-run / deferred — never writes. */
export class DeferredBlogMediaCopyExecutor implements BlogMediaCopyExecutor {
  getWriteCount(): number {
    return 0;
  }
  getDeleteCount(): number {
    return 0;
  }
  async prepareSourceObject(storageKey: string): Promise<BlogPreparedSourceObject> {
    throw new ProductionBlogMigrationError(
      `Deferred Blog media executor cannot prepare ${storageKey}`,
      "MEDIA_COPY_DEFERRED",
    );
  }
  async inspectDestinationObject(): Promise<BlogDestinationObjectInspection | null> {
    return null;
  }
  async copyPublicObject(): Promise<BlogMediaCopyOutcome> {
    throw new ProductionBlogMigrationError(
      "Deferred Blog media executor refuses copy",
      "MEDIA_COPY_DEFERRED",
    );
  }
  async deleteOwnedObject(): Promise<void> {
    throw new ProductionBlogMigrationError(
      "Deferred Blog media executor refuses delete",
      "MEDIA_COPY_DEFERRED",
    );
  }
}

export function destinationUrlForBlogStorageKey(storageKey: string): string {
  return `${PRODUCTION_MEDIA_PUBLIC_BASE_URL}/${storageKey.replace(/^\/+/, "")}`;
}
