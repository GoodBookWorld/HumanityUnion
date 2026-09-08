/**
 * Reset 02 — persistence facade (memory default; mongo when configured + selected).
 *
 * Reset 03B.1 — CLI operators with `--mongo` MUST call
 * `requirePublishedLocalizationMongoPersistence` before any PLP publish/read.
 * Silent memory fallback under `--mongo` is a durability incident class.
 *
 * Reset 03E.8 — API HTTP runtime must bootstrap the same durable Mongo PLP
 * repository. Staging/production-like processes must not silently serve PLP
 * reads from the empty in-memory Map while Mongo holds PUBLISHED snapshots.
 */

import type { PublishedLocalizedPresentationRecord } from "@hu/types";

import { isMongoConfigured } from "../../../../infrastructure/mongodb/mongo-config.js";
import {
  findCurrentPublishedMemory,
  publishAtomicMemory,
  putPublishedSnapshotMemory,
  resetPublishedLocalizedPresentationMemoryStoreForTests,
} from "./memory.store.js";

export type PublishedLocalizationPersistenceMode = "memory" | "mongo";

/** Probe/debug class — never expose credentials or hostnames. */
export type PublishedLocalizationPersistenceRuntimeClass =
  | "MONGO"
  | "MEMORY_TEST"
  | "UNAVAILABLE"
  | "UNBOUND";

export class PublishedLocalizationPersistenceUnavailableError extends Error {
  readonly reasonCode = "PLP_PERSISTENCE_UNAVAILABLE" as const;

  constructor(message: string) {
    super(message);
    this.name = "PublishedLocalizationPersistenceUnavailableError";
  }
}

let mode: PublishedLocalizationPersistenceMode = "memory";
/** UNBOUND until API bootstrap / CLI require* / explicit test selection. */
let runtimeClass: PublishedLocalizationPersistenceRuntimeClass = "UNBOUND";
let findFailureForTests = false;

export function setPublishedLocalizationPersistenceModeForTests(
  next: PublishedLocalizationPersistenceMode,
): void {
  mode = next;
  runtimeClass = next === "mongo" ? "MONGO" : "MEMORY_TEST";
}

/**
 * Operator / CLI seam: force durable Mongo PLP persistence.
 * Fail closed when Mongo is not configured — never silently fall back to memory.
 */
export function requirePublishedLocalizationMongoPersistence(reason: string): void {
  if (!isMongoConfigured()) {
    throw new Error(
      `PLP durable Mongo persistence required (${reason}): MONGODB_URI is not configured.`,
    );
  }
  mode = "mongo";
  runtimeClass = "MONGO";
}

/**
 * Explicit local/unit memory binding (never an accidental default while Mongo URI exists).
 */
export function bindPublishedLocalizationMemoryPersistenceForTests(reason: string): void {
  void reason;
  mode = "memory";
  runtimeClass = "MEMORY_TEST";
}

/**
 * Mark durable PLP persistence unavailable (production misconfig). Finds fail closed.
 */
export function markPublishedLocalizationPersistenceUnavailable(reason: string): void {
  mode = "memory";
  runtimeClass = "UNAVAILABLE";
  void reason;
}

/**
 * API composition-root bootstrap for HTTP PLP resolve.
 * - Mongo URI present → MONGO (same store as materializer/diagnose --mongo)
 * - Otherwise → MEMORY_TEST in non-production / NODE_TEST_ENV
 * - Production without URI → UNAVAILABLE (fail closed on read)
 */
export function bootstrapPublishedLocalizationApiPersistence(): {
  readonly runtimeClass: PublishedLocalizationPersistenceRuntimeClass;
} {
  if (isMongoConfigured()) {
    requirePublishedLocalizationMongoPersistence("api HTTP PLP resolve bootstrap");
    return { runtimeClass: "MONGO" };
  }
  if (process.env.NODE_TEST_ENV === "true" || process.env.NODE_ENV !== "production") {
    mode = "memory";
    runtimeClass = "MEMORY_TEST";
    return { runtimeClass: "MEMORY_TEST" };
  }
  markPublishedLocalizationPersistenceUnavailable(
    "production API missing MONGODB_URI for PLP",
  );
  return { runtimeClass: "UNAVAILABLE" };
}

export function setPublishedLocalizationFindFailureForTests(fail: boolean): void {
  findFailureForTests = fail;
}

export function getPublishedLocalizationPersistenceMode(): PublishedLocalizationPersistenceMode {
  if (mode === "mongo" && isMongoConfigured()) {
    return "mongo";
  }
  return "memory";
}

export function getPublishedLocalizationPersistenceRuntimeClass(): PublishedLocalizationPersistenceRuntimeClass {
  return runtimeClass;
}

/**
 * Probe-safe persistence label for live-truth metadata.
 */
export function getPublishedLocalizationPersistenceProbeMode():
  | "MONGO"
  | "MEMORY_TEST"
  | "UNAVAILABLE" {
  if (runtimeClass === "MONGO" && getPublishedLocalizationPersistenceMode() === "mongo") {
    return "MONGO";
  }
  if (runtimeClass === "MEMORY_TEST") {
    return "MEMORY_TEST";
  }
  return "UNAVAILABLE";
}

/**
 * Assert the effective mode is Mongo. Use after require* / before publish.
 */
export function assertPublishedLocalizationMongoPersistenceActive(reason: string): void {
  if (getPublishedLocalizationPersistenceMode() !== "mongo") {
    throw new Error(
      `PLP persistence mode is not MONGO (${reason}). Refusing silent memory fallback.`,
    );
  }
}

/**
 * Staging/production-like: Mongo URI configured but facade still on accidental
 * memory/UNBOUND must not pretend empty memory is a valid PLP store.
 */
export function assertPublishedLocalizationHttpPersistenceSafe(): void {
  if (runtimeClass === "UNAVAILABLE") {
    throw new PublishedLocalizationPersistenceUnavailableError(
      "PLP durable persistence unavailable",
    );
  }
  if (runtimeClass === "MEMORY_TEST") {
    return;
  }
  if (runtimeClass === "MONGO" && getPublishedLocalizationPersistenceMode() === "mongo") {
    return;
  }
  // UNBOUND or mongo URI present while still defaulting to memory.
  if (isMongoConfigured() && getPublishedLocalizationPersistenceMode() !== "mongo") {
    throw new PublishedLocalizationPersistenceUnavailableError(
      "PLP persistence still on memory while MONGODB_URI is configured (bootstrap missing)",
    );
  }
  if (runtimeClass === "UNBOUND") {
    throw new PublishedLocalizationPersistenceUnavailableError(
      "PLP persistence not bootstrapped for HTTP resolve",
    );
  }
}

export function resetPublishedLocalizationPersistenceForTests(): void {
  mode = "memory";
  runtimeClass = "MEMORY_TEST";
  findFailureForTests = false;
  resetPublishedLocalizedPresentationMemoryStoreForTests();
}

/** Test-only: restore pre-bootstrap UNBOUND default (proves fail-closed mismatch). */
export function forcePublishedLocalizationPersistenceUnboundForTests(): void {
  mode = "memory";
  runtimeClass = "UNBOUND";
  findFailureForTests = false;
}

export async function findCurrentPublishedPresentation(input: {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
}): Promise<PublishedLocalizedPresentationRecord | null> {
  assertPublishedLocalizationHttpPersistenceSafe();
  if (findFailureForTests) {
    throw new Error("PUBLISHED_LOCALIZATION_FIND_FAILURE_FOR_TESTS");
  }
  if (getPublishedLocalizationPersistenceMode() === "mongo") {
    const { findCurrentPublishedMongo } = await import("./mongo.repository.js");
    return findCurrentPublishedMongo(input);
  }
  return findCurrentPublishedMemory(input);
}

export async function saveBuildingOrFailedSnapshot(
  record: PublishedLocalizedPresentationRecord,
): Promise<void> {
  if (record.state === "PUBLISHED") {
    throw new Error("PUBLISHED snapshots must use publishAtomicPublishedPresentation");
  }
  if (getPublishedLocalizationPersistenceMode() === "mongo") {
    const { putPublishedSnapshotHistoryMongo } = await import("./mongo.repository.js");
    await putPublishedSnapshotHistoryMongo(record);
    return;
  }
  putPublishedSnapshotMemory(record);
}

export async function publishAtomicPublishedPresentation(input: {
  readonly candidate: PublishedLocalizedPresentationRecord;
}): Promise<
  | {
      readonly ok: true;
      readonly record: PublishedLocalizedPresentationRecord;
      readonly supersededSnapshotId?: string;
      readonly idempotent: boolean;
    }
  | {
      readonly ok: false;
      readonly reason: "STALE_REVISION" | "PERSISTENCE_ERROR";
      readonly staleForensics?: {
        readonly STALE_ORIGIN_ID: string;
        readonly STALE_WORK_VERSION: string;
        readonly STALE_CURRENT_SOURCE_VERSION: string;
        readonly STALE_BOUNDARY: string;
        readonly STALE_AUTHORITY: string;
        readonly STALE_WORK_CONTENT_REVISION: number;
        readonly STALE_EXISTING_CONTENT_REVISION: number;
        readonly STALE_CANDIDATE_VERSION?: string;
        readonly STALE_EXISTING_SNAPSHOT_VERSION?: string;
      };
      readonly staleDetail?: import("../universal/plp-stale-result.js").PlpStructuredStaleDetail;
    }
> {
  if (getPublishedLocalizationPersistenceMode() === "mongo") {
    const { publishAtomicMongo } = await import("./mongo.repository.js");
    return publishAtomicMongo(input);
  }
  const result = publishAtomicMemory(input);
  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      staleForensics: result.staleForensics,
      staleDetail: result.staleDetail,
    };
  }
  return {
    ok: true,
    record: result.record,
    supersededSnapshotId: result.supersededSnapshotId,
    idempotent: result.idempotent,
  };
}
