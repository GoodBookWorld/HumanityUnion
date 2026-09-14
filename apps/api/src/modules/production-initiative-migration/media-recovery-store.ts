import type { Db } from "mongodb";

import { ProductionInitiativeMigrationError } from "./errors.js";
import type { DestinationObjectInspection } from "./media-ownership.js";
import { isProvenOwnedByMigration } from "./media-ownership.js";
import { sha256Hex } from "./media-recovery-journal.js";

/** Narrow executor surface used by recovery inspection / authorized rollback. */
export interface MediaRecoveryR2Port {
  inspectDestinationObject?(
    storageKey: string,
    expectedMigrationExecutionId?: string,
  ): Promise<DestinationObjectInspection | null>;
  deleteOwnedObject?(
    storageKey: string,
    migrationExecutionId: string,
  ): Promise<void>;
}

/** Dedicated migration-only recovery collection on destination Mongo. */
export const MEDIA_RECOVERY_COLLECTION =
  "production_initiative_migration_media_recovery" as const;

export type MediaRecoveryStatus =
  | "planned"
  | "copying"
  | "created_verified"
  | "preexisting_equivalent"
  | "rollback_deleted"
  | "rollback_failed";

export interface DurableMediaRecoveryRecord {
  migrationExecutionId: string;
  storageKey: string;
  destinationUrl: string;
  expectedContentSha256: string;
  expectedContentLength: number;
  expectedContentType: string | null;
  status: MediaRecoveryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DurableMediaRecoveryStore {
  upsertPlanned(input: {
    migrationExecutionId: string;
    storageKey: string;
    destinationUrl: string;
    expectedContentSha256: string;
    expectedContentLength: number;
    expectedContentType: string | null;
  }): Promise<DurableMediaRecoveryRecord>;
  markCopying(migrationExecutionId: string, storageKey: string): Promise<void>;
  markCreatedVerified(migrationExecutionId: string, storageKey: string): Promise<void>;
  markPreexistingEquivalent(migrationExecutionId: string, storageKey: string): Promise<void>;
  markRollbackDeleted(migrationExecutionId: string, storageKey: string): Promise<void>;
  markRollbackFailed(migrationExecutionId: string, storageKey: string): Promise<void>;
  listByExecutionId(migrationExecutionId: string): Promise<DurableMediaRecoveryRecord[]>;
  get(
    migrationExecutionId: string,
    storageKey: string,
  ): Promise<DurableMediaRecoveryRecord | null>;
}

function assertSanitizedRecord(record: DurableMediaRecoveryRecord): void {
  if (!record.migrationExecutionId.startsWith("mig_")) {
    throw new ProductionInitiativeMigrationError(
      "Recovery record missing migrationExecutionId.",
      "RECOVERY_ENTRY_INVALID",
    );
  }
  if (!record.storageKey || record.storageKey.includes("..")) {
    throw new ProductionInitiativeMigrationError(
      "Recovery record invalid storageKey.",
      "RECOVERY_ENTRY_INVALID",
    );
  }
  if (!/^[a-f0-9]{64}$/i.test(record.expectedContentSha256)) {
    throw new ProductionInitiativeMigrationError(
      "Recovery record requires expectedContentSha256.",
      "RECOVERY_ENTRY_INVALID",
    );
  }
  const text = JSON.stringify(record);
  if (/SECRET|ACCESS_KEY|password|shippingAddress|passwordHash/i.test(text)) {
    throw new ProductionInitiativeMigrationError(
      "Recovery record must not contain credential or private fields.",
      "RECOVERY_ENTRY_UNSAFE",
    );
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

/** In-memory durable store for unit tests / dry-run modeling. */
export class InMemoryDurableMediaRecoveryStore implements DurableMediaRecoveryStore {
  readonly records = new Map<string, DurableMediaRecoveryRecord>();
  writeCount = 0;

  private key(migrationExecutionId: string, storageKey: string): string {
    return `${migrationExecutionId}::${storageKey}`;
  }

  async upsertPlanned(input: {
    migrationExecutionId: string;
    storageKey: string;
    destinationUrl: string;
    expectedContentSha256: string;
    expectedContentLength: number;
    expectedContentType: string | null;
  }): Promise<DurableMediaRecoveryRecord> {
    const createdAt = nowIso();
    const record: DurableMediaRecoveryRecord = {
      ...input,
      status: "planned",
      createdAt,
      updatedAt: createdAt,
    };
    assertSanitizedRecord(record);
    this.records.set(this.key(input.migrationExecutionId, input.storageKey), record);
    this.writeCount += 1;
    return record;
  }

  async markCopying(migrationExecutionId: string, storageKey: string): Promise<void> {
    await this.updateStatus(migrationExecutionId, storageKey, "copying");
  }

  async markCreatedVerified(migrationExecutionId: string, storageKey: string): Promise<void> {
    await this.updateStatus(migrationExecutionId, storageKey, "created_verified");
  }

  async markPreexistingEquivalent(
    migrationExecutionId: string,
    storageKey: string,
  ): Promise<void> {
    await this.updateStatus(migrationExecutionId, storageKey, "preexisting_equivalent");
  }

  async markRollbackDeleted(migrationExecutionId: string, storageKey: string): Promise<void> {
    await this.updateStatus(migrationExecutionId, storageKey, "rollback_deleted");
  }

  async markRollbackFailed(migrationExecutionId: string, storageKey: string): Promise<void> {
    await this.updateStatus(migrationExecutionId, storageKey, "rollback_failed");
  }

  private async updateStatus(
    migrationExecutionId: string,
    storageKey: string,
    status: MediaRecoveryStatus,
  ): Promise<void> {
    const existing = this.records.get(this.key(migrationExecutionId, storageKey));
    if (!existing) {
      throw new ProductionInitiativeMigrationError(
        `Recovery record missing for ${storageKey}`,
        "RECOVERY_ENTRY_MISSING",
      );
    }
    const next = { ...existing, status, updatedAt: nowIso() };
    assertSanitizedRecord(next);
    this.records.set(this.key(migrationExecutionId, storageKey), next);
    this.writeCount += 1;
  }

  async listByExecutionId(migrationExecutionId: string): Promise<DurableMediaRecoveryRecord[]> {
    return [...this.records.values()]
      .filter((row) => row.migrationExecutionId === migrationExecutionId)
      .sort((a, b) => a.storageKey.localeCompare(b.storageKey));
  }

  async get(
    migrationExecutionId: string,
    storageKey: string,
  ): Promise<DurableMediaRecoveryRecord | null> {
    return this.records.get(this.key(migrationExecutionId, storageKey)) ?? null;
  }
}

/**
 * Destination-Mongo durable recovery store.
 * Survives Render instance replacement (unlike local JSONL).
 */
export class MongoDurableMediaRecoveryStore implements DurableMediaRecoveryStore {
  constructor(private readonly destinationDb: Db) {}

  private collection() {
    return this.destinationDb.collection(MEDIA_RECOVERY_COLLECTION);
  }

  async upsertPlanned(input: {
    migrationExecutionId: string;
    storageKey: string;
    destinationUrl: string;
    expectedContentSha256: string;
    expectedContentLength: number;
    expectedContentType: string | null;
  }): Promise<DurableMediaRecoveryRecord> {
    const createdAt = nowIso();
    const record: DurableMediaRecoveryRecord = {
      ...input,
      status: "planned",
      createdAt,
      updatedAt: createdAt,
    };
    assertSanitizedRecord(record);
    await this.collection().updateOne(
      {
        migrationExecutionId: input.migrationExecutionId,
        storageKey: input.storageKey,
      },
      {
        $set: {
          destinationUrl: record.destinationUrl,
          expectedContentSha256: record.expectedContentSha256,
          expectedContentLength: record.expectedContentLength,
          expectedContentType: record.expectedContentType,
          status: "planned",
          updatedAt: createdAt,
        },
        $setOnInsert: {
          migrationExecutionId: record.migrationExecutionId,
          storageKey: record.storageKey,
          createdAt,
        },
      },
      { upsert: true },
    );
    return record;
  }

  async markCopying(migrationExecutionId: string, storageKey: string): Promise<void> {
    await this.setStatus(migrationExecutionId, storageKey, "copying");
  }

  async markCreatedVerified(migrationExecutionId: string, storageKey: string): Promise<void> {
    await this.setStatus(migrationExecutionId, storageKey, "created_verified");
  }

  async markPreexistingEquivalent(
    migrationExecutionId: string,
    storageKey: string,
  ): Promise<void> {
    await this.setStatus(migrationExecutionId, storageKey, "preexisting_equivalent");
  }

  async markRollbackDeleted(migrationExecutionId: string, storageKey: string): Promise<void> {
    await this.setStatus(migrationExecutionId, storageKey, "rollback_deleted");
  }

  async markRollbackFailed(migrationExecutionId: string, storageKey: string): Promise<void> {
    await this.setStatus(migrationExecutionId, storageKey, "rollback_failed");
  }

  private async setStatus(
    migrationExecutionId: string,
    storageKey: string,
    status: MediaRecoveryStatus,
  ): Promise<void> {
    const updatedAt = nowIso();
    const result = await this.collection().updateOne(
      { migrationExecutionId, storageKey },
      { $set: { status, updatedAt } },
    );
    if (result.matchedCount === 0) {
      throw new ProductionInitiativeMigrationError(
        `Recovery record missing for ${storageKey}`,
        "RECOVERY_ENTRY_MISSING",
      );
    }
  }

  async listByExecutionId(migrationExecutionId: string): Promise<DurableMediaRecoveryRecord[]> {
    const rows = await this.collection()
      .find({ migrationExecutionId })
      .sort({ storageKey: 1 })
      .toArray();
    return rows.map((row) => ({
      migrationExecutionId: String(row.migrationExecutionId),
      storageKey: String(row.storageKey),
      destinationUrl: String(row.destinationUrl),
      expectedContentSha256: String(row.expectedContentSha256),
      expectedContentLength: Number(row.expectedContentLength),
      expectedContentType:
        row.expectedContentType == null ? null : String(row.expectedContentType),
      status: row.status as MediaRecoveryStatus,
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
    }));
  }

  async get(
    migrationExecutionId: string,
    storageKey: string,
  ): Promise<DurableMediaRecoveryRecord | null> {
    const row = await this.collection().findOne({ migrationExecutionId, storageKey });
    if (!row) return null;
    return {
      migrationExecutionId: String(row.migrationExecutionId),
      storageKey: String(row.storageKey),
      destinationUrl: String(row.destinationUrl),
      expectedContentSha256: String(row.expectedContentSha256),
      expectedContentLength: Number(row.expectedContentLength),
      expectedContentType:
        row.expectedContentType == null ? null : String(row.expectedContentType),
      status: row.status as MediaRecoveryStatus,
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
    };
  }
}

export type MediaRecoveryInspectionClassification =
  | "object_absent"
  | "owned_created_verified"
  | "owned_created_recovered"
  | "preexisting_equivalent"
  | "equivalent_ownership_unproven"
  | "foreign_migration_object"
  | "integrity_mismatch"
  | "rollback_deleted"
  | "rollback_failed"
  | "unknown";

export interface MediaRecoveryInspectionRow {
  migrationExecutionId: string;
  storageKey: string;
  destinationUrl: string;
  durableStatus: MediaRecoveryStatus;
  classification: MediaRecoveryInspectionClassification;
  rollbackEligible: boolean;
  destinationPresent: boolean | null;
  observedContentSha256: string | null;
  ownershipProven: boolean;
  notes: string[];
}

export interface MediaRecoveryInspectionReport {
  migrationExecutionId: string;
  rows: MediaRecoveryInspectionRow[];
  counts: Record<MediaRecoveryInspectionClassification, number>;
}

function classifyPresentObject(input: {
  record: DurableMediaRecoveryRecord;
  observed: DestinationObjectInspection;
  durableOwnedHint: "created_verified" | "crash_window" | "rollback_failed";
}): {
  classification: MediaRecoveryInspectionClassification;
  rollbackEligible: boolean;
  notes: string[];
} {
  const notes: string[] = [];
  const observed = input.observed;
  const contentMatches =
    observed.checksumSHA256 === input.record.expectedContentSha256 &&
    observed.contentLength === input.record.expectedContentLength;

  if (!contentMatches) {
    notes.push(
      "Destination present but does not match expected integrity; do not delete",
    );
    return {
      classification: "integrity_mismatch",
      rollbackEligible: false,
      notes,
    };
  }

  if (observed.ownership.kind === "foreign") {
    notes.push(
      `Foreign migration ownership (${observed.ownership.migrationExecutionId}); never overwrite or delete`,
    );
    return {
      classification: "foreign_migration_object",
      rollbackEligible: false,
      notes,
    };
  }

  if (!isProvenOwnedByMigration(observed.ownership)) {
    notes.push(
      "Content matches but ownership metadata missing/unproven; fail closed — never migration-owned",
    );
    return {
      classification: "equivalent_ownership_unproven",
      rollbackEligible: false,
      notes,
    };
  }

  if (input.durableOwnedHint === "created_verified") {
    notes.push("Durably created_verified and R2 ownership metadata proven");
    return {
      classification: "owned_created_verified",
      rollbackEligible: true,
      notes,
    };
  }
  if (input.durableOwnedHint === "rollback_failed") {
    notes.push("Prior rollback failed; R2 ownership still proven — eligible for retry");
    return {
      classification: "owned_created_verified",
      rollbackEligible: true,
      notes,
    };
  }
  notes.push(
    "Crash window: object present, integrity matches, and R2 ownership metadata proves this migrationExecutionId",
  );
  return {
    classification: "owned_created_recovered",
    rollbackEligible: true,
    notes,
  };
}

/**
 * Operator-safe recovery inspection for a migrationExecutionId.
 * Never deletes. Content equivalence alone never proves ownership.
 */
export async function inspectMediaRecoveryState(input: {
  store: DurableMediaRecoveryStore;
  executor: MediaRecoveryR2Port;
  migrationExecutionId: string;
}): Promise<MediaRecoveryInspectionReport> {
  const records = await input.store.listByExecutionId(input.migrationExecutionId);
  const rows: MediaRecoveryInspectionRow[] = [];

  for (const record of records) {
    let classification: MediaRecoveryInspectionClassification = "unknown";
    let destinationPresent: boolean | null = null;
    let observedContentSha256: string | null = null;
    let rollbackEligible = false;
    let ownershipProven = false;
    let notes: string[] = [];

    if (record.status === "preexisting_equivalent") {
      classification = "preexisting_equivalent";
      rollbackEligible = false;
      notes = ["Pre-existing equivalent; never migration-owned; never delete"];
    } else if (record.status === "rollback_deleted") {
      classification = "rollback_deleted";
      rollbackEligible = false;
    } else if (
      record.status === "created_verified" ||
      record.status === "planned" ||
      record.status === "copying" ||
      record.status === "rollback_failed"
    ) {
      if (!input.executor.inspectDestinationObject) {
        throw new ProductionInitiativeMigrationError(
          "Recovery inspection requires executor.inspectDestinationObject.",
          "MEDIA_RECOVERY_INSPECT_UNSUPPORTED",
        );
      }
      const observed = await input.executor.inspectDestinationObject(
        record.storageKey,
        input.migrationExecutionId,
      );
      if (!observed) {
        destinationPresent = false;
        classification = "object_absent";
        rollbackEligible = false;
        notes =
          record.status === "created_verified" || record.status === "rollback_failed"
            ? ["Durable owned status but destination object absent"]
            : ["Crash window: durable planned/copying but destination object absent"];
      } else {
        destinationPresent = true;
        observedContentSha256 = observed.checksumSHA256;
        ownershipProven = isProvenOwnedByMigration(observed.ownership);
        const durableOwnedHint =
          record.status === "created_verified"
            ? "created_verified"
            : record.status === "rollback_failed"
              ? "rollback_failed"
              : "crash_window";
        const classified = classifyPresentObject({
          record,
          observed,
          durableOwnedHint,
        });
        classification = classified.classification;
        rollbackEligible = classified.rollbackEligible;
        notes = classified.notes;
      }
    }

    rows.push({
      migrationExecutionId: record.migrationExecutionId,
      storageKey: record.storageKey,
      destinationUrl: record.destinationUrl,
      durableStatus: record.status,
      classification,
      rollbackEligible,
      destinationPresent,
      observedContentSha256,
      ownershipProven,
      notes,
    });
  }

  const counts: Record<MediaRecoveryInspectionClassification, number> = {
    object_absent: 0,
    owned_created_verified: 0,
    owned_created_recovered: 0,
    preexisting_equivalent: 0,
    equivalent_ownership_unproven: 0,
    foreign_migration_object: 0,
    integrity_mismatch: 0,
    rollback_deleted: 0,
    rollback_failed: 0,
    unknown: 0,
  };
  for (const row of rows) {
    counts[row.classification] += 1;
  }

  return { migrationExecutionId: input.migrationExecutionId, rows, counts };
}

/**
 * Explicitly authorized rollback of migration-owned destination objects.
 * Requires production confirm + positive R2 ownership proof at delete time.
 * Never auto-deletes after crash inspection alone; never deletes on content match alone.
 */
export async function rollbackMigrationOwnedMedia(input: {
  store: DurableMediaRecoveryStore;
  executor: MediaRecoveryR2Port;
  migrationExecutionId: string;
  confirm: string;
  storageKeys?: string[];
}): Promise<{ deleted: number; failed: number; keys: string[]; skippedUnproven: number }> {
  if (input.confirm !== "YES") {
    throw new ProductionInitiativeMigrationError(
      "Refusing media rollback: confirm=YES required.",
      "MISSING_CONFIRMATION",
    );
  }
  if (!input.executor.deleteOwnedObject) {
    throw new ProductionInitiativeMigrationError(
      "Executor cannot deleteOwnedObject.",
      "MEDIA_ROLLBACK_UNSUPPORTED",
    );
  }

  const inspection = await inspectMediaRecoveryState({
    store: input.store,
    executor: input.executor,
    migrationExecutionId: input.migrationExecutionId,
  });
  const eligible = inspection.rows.filter((row) => {
    if (!row.rollbackEligible || !row.ownershipProven) return false;
    if (input.storageKeys && !input.storageKeys.includes(row.storageKey)) return false;
    return (
      row.classification === "owned_created_verified" ||
      row.classification === "owned_created_recovered"
    );
  });

  let deleted = 0;
  let failed = 0;
  let skippedUnproven = 0;
  const keys: string[] = [];
  for (const row of eligible) {
    try {
      // Re-verify ownership inside deleteOwnedObject immediately before DeleteObject.
      await input.executor.deleteOwnedObject!(
        row.storageKey,
        input.migrationExecutionId,
      );
      await input.store.markRollbackDeleted(input.migrationExecutionId, row.storageKey);
      deleted += 1;
      keys.push(row.storageKey);
    } catch (error) {
      const code =
        error instanceof ProductionInitiativeMigrationError ? error.code : null;
      if (code === "MEDIA_OWNERSHIP_UNPROVEN") {
        skippedUnproven += 1;
        await input.store.markRollbackFailed(input.migrationExecutionId, row.storageKey);
        failed += 1;
      } else {
        await input.store.markRollbackFailed(input.migrationExecutionId, row.storageKey);
        failed += 1;
      }
    }
  }
  return { deleted, failed, keys, skippedUnproven };
}

export function fingerprintBuffer(buffer: Buffer): {
  contentLength: number;
  checksumSHA256: string;
} {
  return { contentLength: buffer.byteLength, checksumSHA256: sha256Hex(buffer) };
}
