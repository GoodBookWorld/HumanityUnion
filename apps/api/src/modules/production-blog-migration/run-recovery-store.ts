/**
 * Durable Blog migration run ledger — crash-safe recovery status for a migrationId.
 * Safe aggregate fields only.
 */

import type { ClientSession, Db } from "mongodb";

import { BLOG_RUN_RECOVERY_COLLECTION } from "./constants.js";
import { ProductionBlogMigrationError } from "./errors.js";

export type BlogMongoTransactionStatus =
  | "not_started"
  | "in_progress"
  | "committed"
  | "aborted";

export type BlogVerificationStatus =
  | "not_started"
  | "pass"
  | "fail"
  | "required";

export type BlogRunRecoveryStatus =
  | "planned"
  | "r2_copying"
  | "r2_complete"
  | "mongo_committing"
  | "mongo_committed"
  | "verified"
  | "failed_before_mongo_commit"
  | "recovery_required"
  | "rolled_back"
  | "already_complete";

export interface BlogRunRecoveryRecord {
  migrationId: string;
  status: BlogRunRecoveryStatus;
  expectedStorageKeys: string[];
  preCopyAbsentKeys: string[];
  createdStorageKeys: string[];
  equivalentSkippedKeys: string[];
  mongoTransactionStatus: BlogMongoTransactionStatus;
  verificationStatus: BlogVerificationStatus;
  phaseReached: string;
  blockers: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BlogRunRecoveryStore {
  createPlanned(input: {
    migrationId: string;
    expectedStorageKeys: string[];
  }): Promise<BlogRunRecoveryRecord>;
  update(input: {
    migrationId: string;
    patch: Partial<
      Omit<BlogRunRecoveryRecord, "migrationId" | "createdAt" | "expectedStorageKeys">
    > & { expectedStorageKeys?: string[] };
    /** When set, update participates in the destination Mongo transaction. */
    session?: ClientSession | null;
  }): Promise<BlogRunRecoveryRecord>;
  get(migrationId: string): Promise<BlogRunRecoveryRecord | null>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function assertSafe(record: BlogRunRecoveryRecord): void {
  if (!record.migrationId.startsWith("mig_")) {
    throw new ProductionBlogMigrationError(
      "Run recovery missing migrationId.",
      "RUN_RECOVERY_INVALID",
    );
  }
  const text = JSON.stringify(record);
  if (
    /SECRET|ACCESS_KEY|password|emailNormalized|confirmTokenHash|unsubscribeTokenHash/i.test(
      text,
    )
  ) {
    throw new ProductionBlogMigrationError(
      "Run recovery must not contain private fields.",
      "RUN_RECOVERY_UNSAFE",
    );
  }
}

export class InMemoryBlogRunRecoveryStore implements BlogRunRecoveryStore {
  readonly records = new Map<string, BlogRunRecoveryRecord>();
  writeCount = 0;

  async createPlanned(input: {
    migrationId: string;
    expectedStorageKeys: string[];
  }): Promise<BlogRunRecoveryRecord> {
    const createdAt = nowIso();
    const record: BlogRunRecoveryRecord = {
      migrationId: input.migrationId,
      status: "planned",
      expectedStorageKeys: [...input.expectedStorageKeys].sort(),
      preCopyAbsentKeys: [],
      createdStorageKeys: [],
      equivalentSkippedKeys: [],
      mongoTransactionStatus: "not_started",
      verificationStatus: "not_started",
      phaseReached: "P0_preflight",
      blockers: [],
      createdAt,
      updatedAt: createdAt,
    };
    assertSafe(record);
    this.records.set(input.migrationId, record);
    this.writeCount += 1;
    return record;
  }

  async update(input: {
    migrationId: string;
    patch: Partial<Omit<BlogRunRecoveryRecord, "migrationId" | "createdAt">>;
    session?: ClientSession | null;
  }): Promise<BlogRunRecoveryRecord> {
    const existing = this.records.get(input.migrationId);
    if (!existing) {
      throw new ProductionBlogMigrationError(
        `Run recovery missing for ${input.migrationId}`,
        "RUN_RECOVERY_MISSING",
      );
    }
    const next: BlogRunRecoveryRecord = {
      ...existing,
      ...input.patch,
      migrationId: existing.migrationId,
      createdAt: existing.createdAt,
      updatedAt: nowIso(),
    };
    assertSafe(next);
    this.records.set(input.migrationId, next);
    this.writeCount += 1;
    return next;
  }

  async get(migrationId: string): Promise<BlogRunRecoveryRecord | null> {
    return this.records.get(migrationId) ?? null;
  }
}

export class MongoBlogRunRecoveryStore implements BlogRunRecoveryStore {
  constructor(private readonly destinationDb: Db) {}

  private collection() {
    return this.destinationDb.collection(BLOG_RUN_RECOVERY_COLLECTION);
  }

  async createPlanned(input: {
    migrationId: string;
    expectedStorageKeys: string[];
  }): Promise<BlogRunRecoveryRecord> {
    const createdAt = nowIso();
    const record: BlogRunRecoveryRecord = {
      migrationId: input.migrationId,
      status: "planned",
      expectedStorageKeys: [...input.expectedStorageKeys].sort(),
      preCopyAbsentKeys: [],
      createdStorageKeys: [],
      equivalentSkippedKeys: [],
      mongoTransactionStatus: "not_started",
      verificationStatus: "not_started",
      phaseReached: "P0_preflight",
      blockers: [],
      createdAt,
      updatedAt: createdAt,
    };
    assertSafe(record);
    await this.collection().updateOne(
      { migrationId: input.migrationId },
      { $setOnInsert: record },
      { upsert: true },
    );
    return record;
  }

  async update(input: {
    migrationId: string;
    patch: Partial<Omit<BlogRunRecoveryRecord, "migrationId" | "createdAt">>;
    session?: ClientSession | null;
  }): Promise<BlogRunRecoveryRecord> {
    const updatedAt = nowIso();
    const result = await this.collection().findOneAndUpdate(
      { migrationId: input.migrationId },
      { $set: { ...input.patch, updatedAt } },
      {
        returnDocument: "after",
        session: input.session ?? undefined,
      },
    );
    if (!result) {
      throw new ProductionBlogMigrationError(
        `Run recovery missing for ${input.migrationId}`,
        "RUN_RECOVERY_MISSING",
      );
    }
    const record = result as unknown as BlogRunRecoveryRecord;
    assertSafe(record);
    return record;
  }

  async get(migrationId: string): Promise<BlogRunRecoveryRecord | null> {
    const row = await this.collection().findOne({ migrationId });
    return row ? (row as unknown as BlogRunRecoveryRecord) : null;
  }
}
