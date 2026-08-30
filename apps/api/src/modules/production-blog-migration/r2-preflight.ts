/**
 * Blog Migration 03 — Read-only dual-R2 verification for canonical Blog media.
 * Independent of production-initiative-migration.
 *
 * Prefer HEAD/stat. Never PutObject / DeleteObject.
 * EQUIVALENT only when ContentLength matches and SHA-256 is present on both sides.
 */

import { createHash } from "node:crypto";

import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

import {
  BLOG_DESTINATION_R2_ACCESS_KEY_ID_ENV,
  BLOG_DESTINATION_R2_ACCOUNT_ID_ENV,
  BLOG_DESTINATION_R2_BUCKET_ENV,
  BLOG_DESTINATION_R2_SECRET_ACCESS_KEY_ENV,
  BLOG_SOURCE_R2_ACCESS_KEY_ID_ENV,
  BLOG_SOURCE_R2_ACCOUNT_ID_ENV,
  BLOG_SOURCE_R2_BUCKET_ENV,
  BLOG_SOURCE_R2_SECRET_ACCESS_KEY_ENV,
} from "./constants.js";
import { ProductionBlogMigrationError } from "./errors.js";
import { isBlogMigrationR2Configured } from "./guards.js";

export type BlogR2ObjectHead = {
  contentLength: number;
  contentType: string | null;
  /** Hex SHA-256 when available from ChecksumSHA256 or object metadata. */
  checksumSHA256: string | null;
};

export type BlogDestinationR2Classification = "ABSENT" | "EQUIVALENT" | "COLLISION";

export type BlogR2ObjectVerificationStatus =
  | "DEFERRED"
  | "PASS"
  | "FAIL";

export interface BlogCanonicalR2VerificationReport {
  expectedCanonicalObjects: number;
  sourceObjectsPresent: number;
  sourceObjectsMissing: string[];
  destinationAbsent: number;
  destinationEquivalent: number;
  destinationCollisions: string[];
  r2ObjectVerification: BlogR2ObjectVerificationStatus;
  mediaCopyReady: boolean;
  putObjectCalls: number;
  deleteObjectCalls: number;
  blockers: string[];
}

export interface BlogR2ObjectInspector {
  headSourceObject(storageKey: string): Promise<BlogR2ObjectHead | null>;
  headDestinationObject(storageKey: string): Promise<BlogR2ObjectHead | null>;
  getWriteCount(): number;
  getDeleteCount(): number;
}

export interface DualBlogR2BucketConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export interface DualBlogR2Config {
  source: DualBlogR2BucketConfig;
  destination: DualBlogR2BucketConfig;
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

export function resolveDualBlogR2Config(
  env: NodeJS.ProcessEnv = process.env,
): DualBlogR2Config {
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
  return { source, destination };
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

function normalizeChecksumHex(value: string | undefined | null): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  // S3 ChecksumSHA256 is base64; metadata may already be hex.
  if (/^[a-f0-9]{64}$/i.test(trimmed)) return trimmed.toLowerCase();
  try {
    const buf = Buffer.from(trimmed, "base64");
    if (buf.byteLength === 32) return buf.toString("hex");
  } catch {
    // fall through
  }
  return null;
}

function checksumFromMetadata(metadata: Record<string, string>): string | null {
  return (
    normalizeChecksumHex(metadata.sha256) ??
    normalizeChecksumHex(metadata["checksum-sha256"]) ??
    normalizeChecksumHex(metadata["content-sha256"]) ??
    normalizeChecksumHex(metadata.checksumsha256)
  );
}

async function headObject(
  client: S3Client,
  bucket: string,
  storageKey: string,
): Promise<BlogR2ObjectHead | null> {
  const key = storageKey.replace(/^\/+/, "");
  if (!key || key.includes("..")) {
    throw new ProductionBlogMigrationError(
      "Invalid Blog media storageKey for R2 HEAD.",
      "INVALID_STORAGE_KEY",
    );
  }
  try {
    const head = await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
        ChecksumMode: "ENABLED",
      }),
    );
    if (head.ContentLength == null || !Number.isFinite(head.ContentLength)) {
      throw new ProductionBlogMigrationError(
        `R2 HEAD missing ContentLength for storageKey=${key}`,
        "R2_HEAD_INCOMPLETE",
      );
    }
    const metadata: Record<string, string> = {};
    if (head.Metadata) {
      for (const [k, v] of Object.entries(head.Metadata)) {
        if (typeof v === "string") metadata[k.toLowerCase()] = v;
      }
    }
    const checksumSHA256 =
      normalizeChecksumHex(head.ChecksumSHA256) ?? checksumFromMetadata(metadata);
    return {
      contentLength: head.ContentLength,
      contentType: head.ContentType?.trim() || null,
      checksumSHA256,
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

/** Live dual-bucket HEAD inspector — never writes. */
export class DualBucketBlogR2Inspector implements BlogR2ObjectInspector {
  private readonly sourceClient: S3Client;
  private readonly destinationClient: S3Client;
  private readonly sourceBucket: string;
  private readonly destinationBucket: string;
  private writeCount = 0;
  private deleteCount = 0;

  constructor(config: DualBlogR2Config) {
    this.sourceClient = createR2S3Client(config.source);
    this.destinationClient = createR2S3Client(config.destination);
    this.sourceBucket = config.source.bucket;
    this.destinationBucket = config.destination.bucket;
  }

  getWriteCount(): number {
    return this.writeCount;
  }

  getDeleteCount(): number {
    return this.deleteCount;
  }

  async headSourceObject(storageKey: string): Promise<BlogR2ObjectHead | null> {
    return headObject(this.sourceClient, this.sourceBucket, storageKey);
  }

  async headDestinationObject(storageKey: string): Promise<BlogR2ObjectHead | null> {
    return headObject(this.destinationClient, this.destinationBucket, storageKey);
  }
}

/** In-memory fake for unit tests — no network I/O. */
export class InMemoryBlogR2Inspector implements BlogR2ObjectInspector {
  readonly source = new Map<string, BlogR2ObjectHead>();
  readonly destination = new Map<string, BlogR2ObjectHead>();
  writeCount = 0;
  deleteCount = 0;
  unreadableSources = new Set<string>();

  seedSource(
    storageKey: string,
    head: BlogR2ObjectHead | { body: Buffer; contentType?: string },
  ): void {
    if ("body" in head) {
      this.source.set(storageKey, {
        contentLength: head.body.byteLength,
        contentType: head.contentType ?? "image/png",
        checksumSHA256: createHash("sha256").update(head.body).digest("hex"),
      });
      return;
    }
    this.source.set(storageKey, head);
  }

  seedDestination(storageKey: string, head: BlogR2ObjectHead): void {
    this.destination.set(storageKey, head);
  }

  getWriteCount(): number {
    return this.writeCount;
  }

  getDeleteCount(): number {
    return this.deleteCount;
  }

  async headSourceObject(storageKey: string): Promise<BlogR2ObjectHead | null> {
    if (this.unreadableSources.has(storageKey)) {
      throw new ProductionBlogMigrationError(
        `Source R2 object unreadable for storageKey=${storageKey}`,
        "R2_SOURCE_UNREADABLE",
      );
    }
    return this.source.get(storageKey) ?? null;
  }

  async headDestinationObject(storageKey: string): Promise<BlogR2ObjectHead | null> {
    return this.destination.get(storageKey) ?? null;
  }
}

/**
 * Classify destination vs source HEAD.
 * EQUIVALENT requires matching ContentLength + matching SHA-256 on both sides.
 * Length-only match without hashes → COLLISION (fail closed).
 */
export function classifyBlogDestinationR2Object(input: {
  source: BlogR2ObjectHead;
  destination: BlogR2ObjectHead | null;
}): BlogDestinationR2Classification {
  if (!input.destination) return "ABSENT";
  if (input.destination.contentLength !== input.source.contentLength) {
    return "COLLISION";
  }
  if (
    !input.source.checksumSHA256 ||
    !input.destination.checksumSHA256 ||
    input.source.checksumSHA256 !== input.destination.checksumSHA256
  ) {
    return "COLLISION";
  }
  return "EQUIVALENT";
}

/**
 * Verify canonical Blog storageKeys on dual R2 (read-only).
 * External HTTPS preserves must not be passed in.
 */
export async function verifyCanonicalBlogR2Objects(input: {
  storageKeys: readonly string[];
  inspector: BlogR2ObjectInspector;
}): Promise<BlogCanonicalR2VerificationReport> {
  const keys = [...new Set(input.storageKeys.map((k) => k.replace(/^\/+/, "")).filter(Boolean))].sort();
  const blockers: string[] = [];
  const sourceObjectsMissing: string[] = [];
  const destinationCollisions: string[] = [];
  let sourceObjectsPresent = 0;
  let destinationAbsent = 0;
  let destinationEquivalent = 0;

  for (const storageKey of keys) {
    let sourceHead: BlogR2ObjectHead | null;
    try {
      sourceHead = await input.inspector.headSourceObject(storageKey);
    } catch (error) {
      sourceObjectsMissing.push(storageKey);
      blockers.push(
        `Source R2 unreadable for storageKey=${storageKey}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      continue;
    }
    if (!sourceHead) {
      sourceObjectsMissing.push(storageKey);
      blockers.push(`Source R2 object missing for storageKey=${storageKey}`);
      continue;
    }
    sourceObjectsPresent += 1;

    let destHead: BlogR2ObjectHead | null;
    try {
      destHead = await input.inspector.headDestinationObject(storageKey);
    } catch (error) {
      destinationCollisions.push(storageKey);
      blockers.push(
        `Destination R2 HEAD failed for storageKey=${storageKey}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      continue;
    }

    const classification = classifyBlogDestinationR2Object({
      source: sourceHead,
      destination: destHead,
    });
    if (classification === "ABSENT") {
      destinationAbsent += 1;
    } else if (classification === "EQUIVALENT") {
      destinationEquivalent += 1;
    } else {
      destinationCollisions.push(storageKey);
      blockers.push(`Destination R2 collision for storageKey=${storageKey}`);
    }
  }

  const putObjectCalls = input.inspector.getWriteCount();
  const deleteObjectCalls = input.inspector.getDeleteCount();
  if (putObjectCalls > 0 || deleteObjectCalls > 0) {
    blockers.push("Refusing R2 PASS: PutObject/DeleteObject detected during Blog R2 preflight");
  }

  const mediaCopyReady =
    keys.length > 0 &&
    sourceObjectsMissing.length === 0 &&
    destinationCollisions.length === 0 &&
    sourceObjectsPresent === keys.length &&
    putObjectCalls === 0 &&
    deleteObjectCalls === 0;

  return {
    expectedCanonicalObjects: keys.length,
    sourceObjectsPresent,
    sourceObjectsMissing,
    destinationAbsent,
    destinationEquivalent,
    destinationCollisions,
    r2ObjectVerification: blockers.length === 0 ? "PASS" : "FAIL",
    mediaCopyReady,
    putObjectCalls,
    deleteObjectCalls,
    blockers: [...new Set(blockers)],
  };
}
