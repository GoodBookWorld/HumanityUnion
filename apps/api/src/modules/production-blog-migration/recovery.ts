/**
 * Blog migration recovery helpers — inspect, reconcile create_attempted orphans,
 * and authorized owned-media rollback.
 */

import { PRODUCTION_BLOG_MIGRATION_CONFIRM_VALUE } from "./constants.js";
import { ProductionBlogMigrationError } from "./errors.js";
import { isProvenOwnedByBlogMigration } from "./media-ownership.js";
import type { BlogDurableMediaRecoveryStore } from "./media-recovery-store.js";
import type { BlogMigrationOwnershipLedger } from "./ownership-ledger.js";
import {
  isBlogObjectIntegrityEquivalent,
  type BlogMediaCopyExecutor,
} from "./r2-copy.js";
import type { BlogRunRecoveryStore } from "./run-recovery-store.js";

export async function inspectBlogMigrationRecoveryState(input: {
  migrationId: string;
  durableMediaStore: BlogDurableMediaRecoveryStore;
  runStore: BlogRunRecoveryStore;
  mediaExecutor: BlogMediaCopyExecutor;
}): Promise<{
  migrationId: string;
  runStatus: string | null;
  mongoTransactionStatus: string | null;
  verificationStatus: string | null;
  mediaRows: Array<{
    storageKey: string;
    status: string;
    preCopyDestinationState: string;
    destinationPresent: boolean;
    ownershipKind: string;
  }>;
}> {
  const run = await input.runStore.get(input.migrationId);
  const rows = await input.durableMediaStore.listByExecutionId(input.migrationId);
  const mediaRows = [];
  for (const row of rows) {
    const dest = await input.mediaExecutor.inspectDestinationObject(
      row.storageKey,
      input.migrationId,
    );
    mediaRows.push({
      storageKey: row.storageKey,
      status: row.status,
      preCopyDestinationState: row.preCopyDestinationState,
      destinationPresent: Boolean(dest),
      ownershipKind: dest?.ownership.kind ?? "absent",
    });
  }
  return {
    migrationId: input.migrationId,
    runStatus: run?.status ?? null,
    mongoTransactionStatus: run?.mongoTransactionStatus ?? null,
    verificationStatus: run?.verificationStatus ?? null,
    mediaRows,
  };
}

/**
 * Crash window: PUT may have succeeded while durable status is still
 * create_attempted / created_owned. Reconcile from R2 ownership metadata +
 * expected content fingerprint. Never invent ownership without R2 proof.
 */
export async function reconcileBlogMediaCreateAttempted(input: {
  migrationId: string;
  durableMediaStore: BlogDurableMediaRecoveryStore;
  mediaExecutor: BlogMediaCopyExecutor;
  ledger?: BlogMigrationOwnershipLedger;
}): Promise<{
  ownedKeys: string[];
  racedOrForeignKeys: string[];
  absentKeys: string[];
}> {
  const ownedKeys: string[] = [];
  const racedOrForeignKeys: string[] = [];
  const absentKeys: string[] = [];
  const rows = await input.durableMediaStore.listByExecutionId(input.migrationId);

  for (const row of rows) {
    if (
      row.status !== "create_attempted" &&
      row.status !== "created_owned" &&
      row.status !== "destination_absent_proven"
    ) {
      continue;
    }

    const dest = await input.mediaExecutor.inspectDestinationObject(
      row.storageKey,
      input.migrationId,
    );
    if (!dest) {
      absentKeys.push(row.storageKey);
      continue;
    }

    if (!isProvenOwnedByBlogMigration(dest.ownership)) {
      // Present but not our ownership — race/foreign. Never claim owned; never delete.
      racedOrForeignKeys.push(row.storageKey);
      if (
        row.status === "create_attempted" ||
        row.status === "destination_absent_proven"
      ) {
        await input.durableMediaStore.markCreateRejectedRace(
          input.migrationId,
          row.storageKey,
        );
      }
      continue;
    }

    const contentMatches = isBlogObjectIntegrityEquivalent(
      {
        contentLength: row.expectedContentLength,
        contentType: row.expectedContentType,
        checksumSHA256: row.expectedContentSha256,
      },
      {
        contentLength: dest.contentLength,
        contentType: dest.contentType,
        checksumSHA256: dest.checksumSHA256,
      },
    );

    // Owned by this migrationId (metadata proof). Content match → verified;
    // mismatch still owned for compensating delete (we created it).
    if (row.status !== "created_owned") {
      await input.durableMediaStore.markCreatedOwned(input.migrationId, row.storageKey);
    }
    if (contentMatches) {
      await input.durableMediaStore.markCreatedVerified(
        input.migrationId,
        row.storageKey,
      );
    }

    ownedKeys.push(row.storageKey);
    if (input.ledger) {
      const already = input.ledger
        .listMediaObjects()
        .some((m) => m.storageKey === row.storageKey && m.createdByThisExecution);
      if (!already) {
        input.ledger.recordMediaObject({
          storageKey: row.storageKey,
          destinationUrl: row.destinationUrl,
          copied: true,
          createdByThisExecution: true,
          contentSha256: dest.checksumSHA256,
          migrationExecutionId: input.migrationId,
        });
      }
    }
  }

  return { ownedKeys, racedOrForeignKeys, absentKeys };
}

/**
 * Delete only destination objects proven owned by this migrationId.
 * Requires CONFIRM=YES. Re-checks ownership marker immediately before delete.
 */
export async function rollbackBlogMigrationOwnedMedia(input: {
  migrationId: string;
  confirm?: string;
  durableMediaStore: BlogDurableMediaRecoveryStore;
  runStore: BlogRunRecoveryStore;
  mediaExecutor: BlogMediaCopyExecutor;
}): Promise<{ deleted: string[]; skipped: string[]; failed: string[] }> {
  if (input.confirm !== PRODUCTION_BLOG_MIGRATION_CONFIRM_VALUE) {
    throw new ProductionBlogMigrationError(
      "Owned media rollback requires PRODUCTION_BLOG_MIGRATION_CONFIRM=YES",
      "MISSING_CONFIRMATION",
    );
  }

  // First reconcile any create_attempted orphans so ownership ledger is accurate.
  await reconcileBlogMediaCreateAttempted({
    migrationId: input.migrationId,
    durableMediaStore: input.durableMediaStore,
    mediaExecutor: input.mediaExecutor,
  });

  const deleted: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];
  const rows = await input.durableMediaStore.listByExecutionId(input.migrationId);
  for (const row of rows) {
    if (
      row.status !== "created_verified" &&
      row.status !== "created_owned"
    ) {
      skipped.push(row.storageKey);
      continue;
    }

    const dest = await input.mediaExecutor.inspectDestinationObject(
      row.storageKey,
      input.migrationId,
    );
    if (!dest) {
      await input.durableMediaStore.markRollbackDeleted(input.migrationId, row.storageKey);
      deleted.push(row.storageKey);
      continue;
    }
    if (!isProvenOwnedByBlogMigration(dest.ownership)) {
      // Ownership marker/runId mismatch — never delete.
      skipped.push(row.storageKey);
      continue;
    }
    try {
      // deleteOwnedObject re-checks ownership marker for exact migrationId.
      await input.mediaExecutor.deleteOwnedObject(row.storageKey, input.migrationId);
      await input.durableMediaStore.markRollbackDeleted(input.migrationId, row.storageKey);
      deleted.push(row.storageKey);
    } catch {
      await input.durableMediaStore.markRollbackFailed(input.migrationId, row.storageKey);
      failed.push(row.storageKey);
    }
  }
  await input.runStore.update({
    migrationId: input.migrationId,
    patch: {
      status: failed.length ? "recovery_required" : "rolled_back",
      blockers: failed.map((k) => `rollback_failed:${k}`),
    },
  });
  return { deleted, skipped, failed };
}
