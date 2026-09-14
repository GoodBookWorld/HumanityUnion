/**
 * Tracks only documents/objects created by this Blog migration execution.
 * Rollback deletes solely by insertedId from this run's insertOne.
 * Media rollback deletes solely keys with createdByThisExecution=true.
 */

const FORBIDDEN_LEDGER_FILTER_KEYS = new Set([
  "email",
  "emailNormalized",
  "emailDisplay",
  "confirmTokenHash",
  "unsubscribeTokenHash",
  "passwordHash",
]);

export interface BlogOwnedMongoInsert {
  collection: string;
  insertedId: unknown | null;
  primaryFilter: Record<string, unknown>;
  phase: string;
  migrationExecutionId: string;
}

export interface BlogOwnedMediaObject {
  storageKey: string;
  destinationUrl: string;
  copied: boolean;
  createdByThisExecution: boolean;
  contentSha256?: string | null;
  migrationExecutionId: string;
}

export class BlogMigrationOwnershipLedger {
  readonly migrationExecutionId: string;
  private readonly mongoInserts: BlogOwnedMongoInsert[] = [];
  private readonly mediaObjects: BlogOwnedMediaObject[] = [];

  constructor(migrationExecutionId: string) {
    this.migrationExecutionId = migrationExecutionId;
  }

  recordMongoInsert(entry: Omit<BlogOwnedMongoInsert, "migrationExecutionId">): void {
    for (const key of Object.keys(entry.primaryFilter)) {
      if (FORBIDDEN_LEDGER_FILTER_KEYS.has(key)) {
        throw new Error(`Blog ownership ledger refuses private filter key: ${key}`);
      }
    }
    this.mongoInserts.push({
      ...entry,
      migrationExecutionId: this.migrationExecutionId,
    });
  }

  recordMediaObject(entry: BlogOwnedMediaObject): void {
    if (entry.migrationExecutionId !== this.migrationExecutionId) {
      throw new Error("Media object executionId mismatch");
    }
    if (entry.copied && !entry.createdByThisExecution) {
      throw new Error("copied=true requires createdByThisExecution=true");
    }
    if (entry.createdByThisExecution && !entry.copied) {
      throw new Error("createdByThisExecution=true requires copied=true");
    }
    this.mediaObjects.push(entry);
  }

  listMongoInserts(): readonly BlogOwnedMongoInsert[] {
    return this.mongoInserts;
  }

  listMediaObjects(): readonly BlogOwnedMediaObject[] {
    return this.mediaObjects;
  }

  rollbackEligibleMediaKeys(): string[] {
    return this.mediaObjects
      .filter(
        (row) =>
          row.copied &&
          row.createdByThisExecution &&
          row.migrationExecutionId === this.migrationExecutionId,
      )
      .map((row) => row.storageKey);
  }

  rollbackEligibleMongoInserts(): BlogOwnedMongoInsert[] {
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
    mediaOwnedForRollbackCount: number;
    collections: string[];
  } {
    return {
      migrationExecutionId: this.migrationExecutionId,
      mongoInsertCount: this.mongoInserts.length,
      rollbackEligibleMongoInsertCount: this.rollbackEligibleMongoInserts().length,
      mediaObjectCount: this.mediaObjects.length,
      mediaCopiedCount: this.mediaObjects.filter((row) => row.copied).length,
      mediaOwnedForRollbackCount: this.rollbackEligibleMediaKeys().length,
      collections: [...new Set(this.mongoInserts.map((row) => row.collection))].sort(),
    };
  }
}
