/**
 * Task 07.7.9 — Guarded reconciler for stale durable media recovery rollback state.
 *
 * Advances created_verified (or safe rollback_failed) → rollback_deleted when
 * destination R2 is proven ABSENT. Never Put/Delete R2. Never deletes recovery rows.
 * Never touches Initiative/civic/member/profile/media payload collections.
 */

import type { Db } from "mongodb";

import {
  PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_FLAG,
  PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE,
  PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE,
} from "./constants.js";
import { ProductionInitiativeMigrationError } from "./errors.js";
import { assertMigrationDestinationDatabase } from "./guards.js";
import type { MediaR2PreflightReader } from "./media-r2-preflight.js";
import {
  MEDIA_RECOVERY_COLLECTION,
  MongoDurableMediaRecoveryStore,
  type DurableMediaRecoveryStore,
  type MediaRecoveryStatus,
} from "./media-recovery-store.js";
import { assertNoSecretLeak } from "./redact.js";

/** Known failed controlled-execute that left stale created_verified rows. */
export const FAILED_PRODUCTION_INITIATIVE_MIGRATION_EXECUTION_ID_FOR_RECONCILE =
  "mig_c4e677f1-8338-4ab2-bdd5-d9ddde60074d" as const;

export type RecoveryRollbackReconcileVerdict =
  | "DRY_RUN_READY"
  | "RECONCILED"
  | "BLOCKED";

export type RecoveryRollbackReconcileRowAction =
  | "would_mark_rollback_deleted"
  | "marked_rollback_deleted"
  | "already_rollback_deleted"
  | "preexisting_equivalent_untouched"
  | "present_blocked"
  | "status_skipped";

export interface RecoveryRollbackReconcileReport {
  tool: "reconcile-production-initiative-migration-recovery-rollback-state";
  mode: "dry-run" | "execute";
  migrationExecutionId: string;
  destinationDatabase: string;
  recoveryCollection: typeof MEDIA_RECOVERY_COLLECTION;
  rowsScanned: number;
  absentCreatedVerified: number;
  alreadyRollbackDeleted: number;
  preexistingEquivalentUntouched: number;
  presentBlocked: number;
  statusSkipped: number;
  rowsUpdated: number;
  rows: Array<{
    storageKey: string;
    durableStatus: string;
    destinationPresent: boolean | null;
    action: RecoveryRollbackReconcileRowAction;
  }>;
  mutationProof: {
    mongoWrites: number;
    putObjectCalls: number;
    deleteObjectCalls: number;
    recoveryStoreWrites: number;
  };
  blockers: string[];
  verdict: RecoveryRollbackReconcileVerdict;
}

/** Only this recovery collection may be written by the reconciler. */
export function assertRecoveryRollbackReconcileWriteCollection(collection: string): void {
  if (collection !== MEDIA_RECOVERY_COLLECTION) {
    throw new ProductionInitiativeMigrationError(
      `Recovery rollback reconciler refuses write to collection "${collection}".`,
      "RECOVERY_RECONCILE_WRITE_FORBIDDEN",
    );
  }
}

export function assertValidMigrationExecutionId(executionId: string): string {
  const id = executionId.trim();
  if (!id.startsWith("mig_") || id.length < 8) {
    throw new ProductionInitiativeMigrationError(
      "execution-id must be an exact migrationExecutionId starting with mig_.",
      "INVALID_EXECUTION_ID",
    );
  }
  if (id.includes("*") || id.toLowerCase() === "all") {
    throw new ProductionInitiativeMigrationError(
      "Broad/all-execution reconcile is forbidden.",
      "BROAD_EXECUTION_ID_FORBIDDEN",
    );
  }
  return id;
}

function isReconcileEligibleStatus(status: MediaRecoveryStatus | string): boolean {
  return status === "created_verified" || status === "rollback_failed";
}

/**
 * Dry-run by default. Execute requires confirm=YES and updates only
 * production_initiative_migration_media_recovery status fields.
 */
export async function reconcileProductionInitiativeMigrationRecoveryRollbackState(input: {
  destinationDb: Db;
  mediaReader: MediaR2PreflightReader;
  migrationExecutionId: string;
  destinationDatabase: string;
  execute?: boolean;
  confirm?: string;
  allowTestIsolation?: boolean;
  durableRecoveryStore?: DurableMediaRecoveryStore;
}): Promise<RecoveryRollbackReconcileReport> {
  const migrationExecutionId = assertValidMigrationExecutionId(input.migrationExecutionId);
  const destinationDatabase = assertMigrationDestinationDatabase(input.destinationDatabase, {
    allowTestIsolation: input.allowTestIsolation,
  });

  if (
    !input.allowTestIsolation &&
    destinationDatabase !== PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE
  ) {
    throw new ProductionInitiativeMigrationError(
      `Destination database must be ${PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE}.`,
      "WRONG_DESTINATION_DATABASE",
    );
  }

  const executeRequested = input.execute === true;
  const confirmed = input.confirm === PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE;
  if (executeRequested && !confirmed) {
    throw new ProductionInitiativeMigrationError(
      `Refusing write: set ${PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_FLAG}=${PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE} with --execute.`,
      "MISSING_CONFIRMATION",
    );
  }
  const mode: "dry-run" | "execute" = executeRequested && confirmed ? "execute" : "dry-run";

  const store =
    input.durableRecoveryStore ?? new MongoDurableMediaRecoveryStore(input.destinationDb);
  const records = await store.listByExecutionId(migrationExecutionId);
  if (records.length === 0) {
    throw new ProductionInitiativeMigrationError(
      `No durable recovery rows for execution-id=${migrationExecutionId}.`,
      "EXECUTION_ID_NOT_FOUND",
    );
  }

  const blockers: string[] = [];
  const rows: RecoveryRollbackReconcileReport["rows"] = [];
  let absentCreatedVerified = 0;
  let alreadyRollbackDeleted = 0;
  let preexistingEquivalentUntouched = 0;
  let presentBlocked = 0;
  let statusSkipped = 0;
  const wouldUpdateKeys: string[] = [];

  for (const record of records) {
    if (record.status === "rollback_deleted") {
      alreadyRollbackDeleted += 1;
      rows.push({
        storageKey: record.storageKey,
        durableStatus: record.status,
        destinationPresent: null,
        action: "already_rollback_deleted",
      });
      continue;
    }

    if (record.status === "preexisting_equivalent") {
      preexistingEquivalentUntouched += 1;
      rows.push({
        storageKey: record.storageKey,
        durableStatus: record.status,
        destinationPresent: null,
        action: "preexisting_equivalent_untouched",
      });
      continue;
    }

    if (!isReconcileEligibleStatus(record.status)) {
      statusSkipped += 1;
      const msg = `Unsupported durable status for reconcile: ${record.status} (${record.storageKey})`;
      blockers.push(msg);
      rows.push({
        storageKey: record.storageKey,
        durableStatus: record.status,
        destinationPresent: null,
        action: "status_skipped",
      });
      continue;
    }

    const observed = await input.mediaReader.inspectDestinationObject(
      record.storageKey,
      migrationExecutionId,
    );

    if (observed) {
      presentBlocked += 1;
      const msg = `Destination R2 still present for ${record.storageKey}; reconciler never deletes R2`;
      blockers.push(msg);
      rows.push({
        storageKey: record.storageKey,
        durableStatus: record.status,
        destinationPresent: true,
        action: "present_blocked",
      });
      continue;
    }

    absentCreatedVerified += 1;
    wouldUpdateKeys.push(record.storageKey);
    rows.push({
      storageKey: record.storageKey,
      durableStatus: record.status,
      destinationPresent: false,
      action: mode === "execute" ? "marked_rollback_deleted" : "would_mark_rollback_deleted",
    });
  }

  let rowsUpdated = 0;
  let recoveryStoreWrites = 0;

  // Fail closed: any present object or unsupported status blocks all writes.
  const writeBlocked = presentBlocked > 0 || statusSkipped > 0;
  if (mode === "execute" && writeBlocked) {
    blockers.push("Refusing all recovery status updates while unsafe rows remain");
    for (const row of rows) {
      if (row.action === "marked_rollback_deleted") {
        row.action = "would_mark_rollback_deleted";
      }
    }
  } else if (mode === "execute" && wouldUpdateKeys.length > 0) {
    assertRecoveryRollbackReconcileWriteCollection(MEDIA_RECOVERY_COLLECTION);
    for (const storageKey of wouldUpdateKeys) {
      await store.markRollbackDeleted(migrationExecutionId, storageKey);
      rowsUpdated += 1;
      recoveryStoreWrites += 1;
    }
  }

  const putObjectCalls = input.mediaReader.getWriteCount?.() ?? 0;
  const deleteObjectCalls = input.mediaReader.getDeleteCount?.() ?? 0;
  if (putObjectCalls > 0 || deleteObjectCalls > 0) {
    blockers.push("Refusing verdict: R2 mutation detected during recovery-state reconciler");
  }

  let verdict: RecoveryRollbackReconcileVerdict;
  if (writeBlocked || putObjectCalls > 0 || deleteObjectCalls > 0) {
    verdict = "BLOCKED";
  } else if (mode === "execute") {
    verdict = "RECONCILED";
  } else {
    verdict = "DRY_RUN_READY";
  }

  const report: RecoveryRollbackReconcileReport = {
    tool: "reconcile-production-initiative-migration-recovery-rollback-state",
    mode,
    migrationExecutionId,
    destinationDatabase,
    recoveryCollection: MEDIA_RECOVERY_COLLECTION,
    rowsScanned: records.length,
    absentCreatedVerified,
    alreadyRollbackDeleted,
    preexistingEquivalentUntouched,
    presentBlocked,
    statusSkipped,
    rowsUpdated,
    rows,
    mutationProof: {
      mongoWrites: recoveryStoreWrites,
      putObjectCalls,
      deleteObjectCalls,
      recoveryStoreWrites,
    },
    blockers: [...new Set(blockers)],
    verdict,
  };

  assertNoSecretLeak(JSON.stringify(report));
  return report;
}
