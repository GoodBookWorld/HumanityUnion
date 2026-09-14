/**
 * Durable per-object Blog media recovery ledger on destination Mongo.
 * Safe fields only — no credentials, emails, tokens, or object bodies.
 */

import type { Db } from "mongodb";

import { BLOG_MEDIA_RECOVERY_COLLECTION } from "./constants.js";
import { ProductionBlogMigrationError } from "./errors.js";

export type BlogMediaRecoveryStatus =
  | "planned"
  | "destination_absent_proven"
  | "create_attempted"
  | "created_owned"
  | "created_verified"
  | "preexisting_equivalent"
  | "create_rejected_race"
  | "rollback_deleted"
  | "rollback_failed";

export interface BlogDurableMediaRecoveryRecord {
  migrationExecutionId: string;
  storageKey: string;
  destinationUrl: string;
  expectedContentSha256: string;
  expectedContentLength: number;
  expectedContentType: string | null;
  preCopyDestinationState: "ABSENT" | "EQUIVALENT" | "UNKNOWN";
  status: BlogMediaRecoveryStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BlogDurableMediaRecoveryStore {
  upsertPlanned(input: {
    migrationExecutionId: string;
    storageKey: string;
    destinationUrl: string;
    expectedContentSha256: string;
    expectedContentLength: number;
    expectedContentType: string | null;
    preCopyDestinationState: "ABSENT" | "EQUIVALENT" | "UNKNOWN";
  }): Promise<BlogDurableMediaRecoveryRecord>;
  markDestinationAbsentProven(
    migrationExecutionId: string,
    storageKey: string,
  ): Promise<void>;
  markCreateAttempted(migrationExecutionId: string, storageKey: string): Promise<void>;
  markCreatedOwned(migrationExecutionId: string, storageKey: string): Promise<void>;
  markCreatedVerified(migrationExecutionId: string, storageKey: string): Promise<void>;
  markPreexistingEquivalent(migrationExecutionId: string, storageKey: string): Promise<void>;
  markCreateRejectedRace(migrationExecutionId: string, storageKey: string): Promise<void>;
  markRollbackDeleted(migrationExecutionId: string, storageKey: string): Promise<void>;
  markRollbackFailed(migrationExecutionId: string, storageKey: string): Promise<void>;
  /** @deprecated use markCreateAttempted — retained for older call sites */
  markCopying(migrationExecutionId: string, storageKey: string): Promise<void>;
  listByExecutionId(migrationExecutionId: string): Promise<BlogDurableMediaRecoveryRecord[]>;
  get(
    migrationExecutionId: string,
    storageKey: string,
  ): Promise<BlogDurableMediaRecoveryRecord | null>;
}

function assertSanitizedRecord(record: BlogDurableMediaRecoveryRecord): void {
  if (!record.migrationExecutionId.startsWith("mig_")) {
    throw new ProductionBlogMigrationError(
      "Recovery record missing migrationExecutionId.",
      "RECOVERY_ENTRY_INVALID",
    );
  }
  if (!record.storageKey || record.storageKey.includes("..")) {
    throw new ProductionBlogMigrationError(
      "Recovery record invalid storageKey.",
      "RECOVERY_ENTRY_INVALID",
    );
  }
  if (!/^[a-f0-9]{64}$/i.test(record.expectedContentSha256)) {
    throw new ProductionBlogMigrationError(
      "Recovery record requires expectedContentSha256.",
      "RECOVERY_ENTRY_INVALID",
    );
  }
  const text = JSON.stringify(record);
  if (
    /SECRET|ACCESS_KEY|password|emailNormalized|confirmTokenHash|unsubscribeTokenHash/i.test(
      text,
    )
  ) {
    throw new ProductionBlogMigrationError(
      "Recovery record must not contain credential or private fields.",
      "RECOVERY_ENTRY_UNSAFE",
    );
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

export class InMemoryBlogDurableMediaRecoveryStore
  implements BlogDurableMediaRecoveryStore
{
  readonly records = new Map<string, BlogDurableMediaRecoveryRecord>();
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
    preCopyDestinationState: "ABSENT" | "EQUIVALENT" | "UNKNOWN";
  }): Promise<BlogDurableMediaRecoveryRecord> {
    const createdAt = nowIso();
    const record: BlogDurableMediaRecoveryRecord = {
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

  async markDestinationAbsentProven(
    migrationExecutionId: string,
    storageKey: string,
  ): Promise<void> {
    await this.updateStatus(migrationExecutionId, storageKey, "destination_absent_proven");
  }

  async markCreateAttempted(
    migrationExecutionId: string,
    storageKey: string,
  ): Promise<void> {
    await this.updateStatus(migrationExecutionId, storageKey, "create_attempted");
  }

  async markCopying(migrationExecutionId: string, storageKey: string): Promise<void> {
    await this.markCreateAttempted(migrationExecutionId, storageKey);
  }

  async markCreatedOwned(
    migrationExecutionId: string,
    storageKey: string,
  ): Promise<void> {
    await this.updateStatus(migrationExecutionId, storageKey, "created_owned");
  }

  async markCreatedVerified(
    migrationExecutionId: string,
    storageKey: string,
  ): Promise<void> {
    await this.updateStatus(migrationExecutionId, storageKey, "created_verified");
  }

  async markPreexistingEquivalent(
    migrationExecutionId: string,
    storageKey: string,
  ): Promise<void> {
    await this.updateStatus(migrationExecutionId, storageKey, "preexisting_equivalent");
  }

  async markCreateRejectedRace(
    migrationExecutionId: string,
    storageKey: string,
  ): Promise<void> {
    await this.updateStatus(migrationExecutionId, storageKey, "create_rejected_race");
  }

  async markRollbackDeleted(
    migrationExecutionId: string,
    storageKey: string,
  ): Promise<void> {
    await this.updateStatus(migrationExecutionId, storageKey, "rollback_deleted");
  }

  async markRollbackFailed(
    migrationExecutionId: string,
    storageKey: string,
  ): Promise<void> {
    await this.updateStatus(migrationExecutionId, storageKey, "rollback_failed");
  }

  private async updateStatus(
    migrationExecutionId: string,
    storageKey: string,
    status: BlogMediaRecoveryStatus,
  ): Promise<void> {
    const existing = this.records.get(this.key(migrationExecutionId, storageKey));
    if (!existing) {
      throw new ProductionBlogMigrationError(
        `Recovery record missing for ${storageKey}`,
        "RECOVERY_ENTRY_MISSING",
      );
    }
    const next = { ...existing, status, updatedAt: nowIso() };
    assertSanitizedRecord(next);
    this.records.set(this.key(migrationExecutionId, storageKey), next);
    this.writeCount += 1;
  }

  async listByExecutionId(
    migrationExecutionId: string,
  ): Promise<BlogDurableMediaRecoveryRecord[]> {
    return [...this.records.values()]
      .filter((row) => row.migrationExecutionId === migrationExecutionId)
      .sort((a, b) => a.storageKey.localeCompare(b.storageKey));
  }

  async get(
    migrationExecutionId: string,
    storageKey: string,
  ): Promise<BlogDurableMediaRecoveryRecord | null> {
    return this.records.get(this.key(migrationExecutionId, storageKey)) ?? null;
  }
}

export class MongoBlogDurableMediaRecoveryStore implements BlogDurableMediaRecoveryStore {
  constructor(private readonly destinationDb: Db) {}

  private collection() {
    return this.destinationDb.collection(BLOG_MEDIA_RECOVERY_COLLECTION);
  }

  async upsertPlanned(input: {
    migrationExecutionId: string;
    storageKey: string;
    destinationUrl: string;
    expectedContentSha256: string;
    expectedContentLength: number;
    expectedContentType: string | null;
    preCopyDestinationState: "ABSENT" | "EQUIVALENT" | "UNKNOWN";
  }): Promise<BlogDurableMediaRecoveryRecord> {
    const createdAt = nowIso();
    const record: BlogDurableMediaRecoveryRecord = {
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
          preCopyDestinationState: record.preCopyDestinationState,
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

  async markDestinationAbsentProven(
    migrationExecutionId: string,
    storageKey: string,
  ): Promise<void> {
    await this.setStatus(migrationExecutionId, storageKey, "destination_absent_proven");
  }

  async markCreateAttempted(
    migrationExecutionId: string,
    storageKey: string,
  ): Promise<void> {
    await this.setStatus(migrationExecutionId, storageKey, "create_attempted");
  }

  async markCopying(migrationExecutionId: string, storageKey: string): Promise<void> {
    await this.markCreateAttempted(migrationExecutionId, storageKey);
  }

  async markCreatedOwned(
    migrationExecutionId: string,
    storageKey: string,
  ): Promise<void> {
    await this.setStatus(migrationExecutionId, storageKey, "created_owned");
  }

  async markCreatedVerified(
    migrationExecutionId: string,
    storageKey: string,
  ): Promise<void> {
    await this.setStatus(migrationExecutionId, storageKey, "created_verified");
  }

  async markPreexistingEquivalent(
    migrationExecutionId: string,
    storageKey: string,
  ): Promise<void> {
    await this.setStatus(migrationExecutionId, storageKey, "preexisting_equivalent");
  }

  async markCreateRejectedRace(
    migrationExecutionId: string,
    storageKey: string,
  ): Promise<void> {
    await this.setStatus(migrationExecutionId, storageKey, "create_rejected_race");
  }

  async markRollbackDeleted(
    migrationExecutionId: string,
    storageKey: string,
  ): Promise<void> {
    await this.setStatus(migrationExecutionId, storageKey, "rollback_deleted");
  }

  async markRollbackFailed(
    migrationExecutionId: string,
    storageKey: string,
  ): Promise<void> {
    await this.setStatus(migrationExecutionId, storageKey, "rollback_failed");
  }

  private async setStatus(
    migrationExecutionId: string,
    storageKey: string,
    status: BlogMediaRecoveryStatus,
  ): Promise<void> {
    const updatedAt = nowIso();
    const result = await this.collection().updateOne(
      { migrationExecutionId, storageKey },
      { $set: { status, updatedAt } },
    );
    if (result.matchedCount === 0) {
      throw new ProductionBlogMigrationError(
        `Recovery record missing for ${storageKey}`,
        "RECOVERY_ENTRY_MISSING",
      );
    }
  }

  async listByExecutionId(
    migrationExecutionId: string,
  ): Promise<BlogDurableMediaRecoveryRecord[]> {
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
        typeof row.expectedContentType === "string" ? row.expectedContentType : null,
      preCopyDestinationState:
        row.preCopyDestinationState === "ABSENT" ||
        row.preCopyDestinationState === "EQUIVALENT"
          ? row.preCopyDestinationState
          : "UNKNOWN",
      status: row.status as BlogMediaRecoveryStatus,
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt),
    }));
  }

  async get(
    migrationExecutionId: string,
    storageKey: string,
  ): Promise<BlogDurableMediaRecoveryRecord | null> {
    const row = await this.collection().findOne({ migrationExecutionId, storageKey });
    if (!row) return null;
    const list = await this.listByExecutionId(migrationExecutionId);
    return list.find((r) => r.storageKey === storageKey) ?? null;
  }
}
