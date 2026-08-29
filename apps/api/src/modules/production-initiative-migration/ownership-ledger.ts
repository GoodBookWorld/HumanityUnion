/**
 * Tracks only documents/objects created by this migration execution.
 * Rollback deletes solely by insertedId returned from this run's insertOne.
 * Never deletes by initiativeId alone.
 */

const FORBIDDEN_LEDGER_FILTER_KEYS = new Set([
  "shippingAddress",
  "addressLine1",
  "addressLine2",
  "recipientName",
  "phone",
  "passwordHash",
]);

export interface OwnedMongoInsert {
  collection: string;
  /** Exact _id returned by insertOne for this execution — required for execute rollback. */
  insertedId: unknown | null;
  /** Diagnostic primary-key filter (never used alone for destructive rollback). */
  primaryFilter: Record<string, unknown>;
  initiativeId?: string;
  phase: string;
  migrationExecutionId: string;
}

export interface OwnedMediaObject {
  storageKey: string;
  destinationUrl: string;
  copied: boolean;
  migrationExecutionId: string;
}

export class MigrationOwnershipLedger {
  readonly migrationExecutionId: string;
  private readonly mongoInserts: OwnedMongoInsert[] = [];
  private readonly mediaObjects: OwnedMediaObject[] = [];

  constructor(migrationExecutionId: string) {
    this.migrationExecutionId = migrationExecutionId;
  }

  recordMongoInsert(entry: Omit<OwnedMongoInsert, "migrationExecutionId">): void {
    for (const key of Object.keys(entry.primaryFilter)) {
      if (FORBIDDEN_LEDGER_FILTER_KEYS.has(key)) {
        throw new Error(`Ownership ledger refuses private filter key: ${key}`);
      }
    }
    this.mongoInserts.push({
      ...entry,
      migrationExecutionId: this.migrationExecutionId,
    });
  }

  recordMediaObject(entry: OwnedMediaObject): void {
    if (entry.migrationExecutionId !== this.migrationExecutionId) {
      throw new Error("Media object executionId mismatch");
    }
    this.mediaObjects.push(entry);
  }

  listMongoInserts(): readonly OwnedMongoInsert[] {
    return this.mongoInserts;
  }

  listMediaObjects(): readonly OwnedMediaObject[] {
    return this.mediaObjects;
  }

  /** Only keys this execution marked as copied=true are rollback-eligible for R2 delete. */
  rollbackEligibleMediaKeys(): string[] {
    return this.mediaObjects
      .filter(
        (row) => row.copied && row.migrationExecutionId === this.migrationExecutionId,
      )
      .map((row) => row.storageKey);
  }

  /**
   * Rollback candidates: only rows with an insertedId from this execution.
   * Dry-run planned rows (insertedId null) are never deleted.
   */
  rollbackEligibleMongoInserts(): OwnedMongoInsert[] {
    return this.mongoInserts.filter(
      (row) =>
        row.migrationExecutionId === this.migrationExecutionId && row.insertedId != null,
    );
  }

  toSafeReport(): {
    migrationExecutionId: string;
    mongoInsertCount: number;
    rollbackEligibleMongoInsertCount: number;
    mediaObjectCount: number;
    mediaCopiedCount: number;
    collections: string[];
  } {
    return {
      migrationExecutionId: this.migrationExecutionId,
      mongoInsertCount: this.mongoInserts.length,
      rollbackEligibleMongoInsertCount: this.rollbackEligibleMongoInserts().length,
      mediaObjectCount: this.mediaObjects.length,
      mediaCopiedCount: this.mediaObjects.filter((row) => row.copied).length,
      collections: [...new Set(this.mongoInserts.map((row) => row.collection))].sort(),
    };
  }
}
