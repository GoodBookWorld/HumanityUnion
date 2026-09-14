/**
 * Tracks only documents/objects created by this migration execution.
 * Rollback deletes solely by insertedId returned from this run's insertOne.
 * Never deletes by initiativeId alone.
 * Media rollback deletes solely keys with createdByThisExecution=true.
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

/**
 * Phase B profile visibility patch — restored on compensating rollback only when
 * the live destination value still equals the value this migration applied
 * (never blind-overwrite concurrent operator changes).
 */
export interface OwnedProfileVisibilityPatch {
  profileId: string;
  /** Value observed on destination before this migration's patch (undefined = field absent). */
  previousValue: boolean | undefined;
  /** Value this migration wrote. */
  appliedValue: boolean;
  phase: string;
  migrationExecutionId: string;
}

export interface OwnedMediaObject {
  storageKey: string;
  destinationUrl: string;
  /** True only when this execution physically created the destination object. */
  copied: boolean;
  /** Pre-existing equivalent destinations are false — never rollback-deleted. */
  createdByThisExecution: boolean;
  /** Content SHA-256 when known (durable recovery / integrity). */
  contentSha256?: string | null;
  migrationExecutionId: string;
}

export class MigrationOwnershipLedger {
  readonly migrationExecutionId: string;
  private readonly mongoInserts: OwnedMongoInsert[] = [];
  private readonly mediaObjects: OwnedMediaObject[] = [];
  private readonly profileVisibilityPatches: OwnedProfileVisibilityPatch[] = [];

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

  recordProfileVisibilityPatch(
    entry: Omit<OwnedProfileVisibilityPatch, "migrationExecutionId">,
  ): void {
    this.profileVisibilityPatches.push({
      ...entry,
      migrationExecutionId: this.migrationExecutionId,
    });
  }

  recordMediaObject(entry: OwnedMediaObject): void {
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

  listMongoInserts(): readonly OwnedMongoInsert[] {
    return this.mongoInserts;
  }

  listMediaObjects(): readonly OwnedMediaObject[] {
    return this.mediaObjects;
  }

  listProfileVisibilityPatches(): readonly OwnedProfileVisibilityPatch[] {
    return this.profileVisibilityPatches;
  }

  /**
   * Rollback candidates: only objects physically created by this execution.
   * Pre-existing equivalent destinations are never eligible.
   */
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

  rollbackEligibleProfileVisibilityPatches(): OwnedProfileVisibilityPatch[] {
    return this.profileVisibilityPatches.filter(
      (row) => row.migrationExecutionId === this.migrationExecutionId,
    );
  }

  toSafeReport(): {
    migrationExecutionId: string;
    mongoInsertCount: number;
    rollbackEligibleMongoInsertCount: number;
    mediaObjectCount: number;
    mediaCopiedCount: number;
    mediaOwnedForRollbackCount: number;
    profileVisibilityPatchCount: number;
    collections: string[];
  } {
    return {
      migrationExecutionId: this.migrationExecutionId,
      mongoInsertCount: this.mongoInserts.length,
      rollbackEligibleMongoInsertCount: this.rollbackEligibleMongoInserts().length,
      mediaObjectCount: this.mediaObjects.length,
      mediaCopiedCount: this.mediaObjects.filter((row) => row.copied).length,
      mediaOwnedForRollbackCount: this.rollbackEligibleMediaKeys().length,
      profileVisibilityPatchCount: this.profileVisibilityPatches.length,
      collections: [...new Set(this.mongoInserts.map((row) => row.collection))].sort(),
    };
  }
}
