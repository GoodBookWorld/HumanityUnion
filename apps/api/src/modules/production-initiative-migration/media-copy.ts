import {
  MEDIA_COPY_ENABLED_ENV,
  MEDIA_COPY_ENABLED_VALUE,
  PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_FLAG,
  PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE,
  PRODUCTION_MEDIA_PUBLIC_BASE_URL,
} from "./constants.js";
import { ProductionInitiativeMigrationError } from "./errors.js";
import { reconcileMediaPlanReferences } from "./media-reconcile.js";
import type { MediaRecoveryJournal } from "./media-recovery-journal.js";
import type { MigrationOwnershipLedger } from "./ownership-ledger.js";
import type { MediaCopyOutcome } from "./r2-media-copy.js";
import type { MediaPlanItem, PlannedMediaCopy } from "./types.js";

export type { PlannedMediaCopy } from "./types.js";

/**
 * @deprecated Prefer reconcileMediaPlanReferences — retained as thin wrapper.
 * Deduplicate compatible COPY_* items by storageKey; hard-fails on incompatible collapse.
 */
export function deduplicateMediaPlanItems(items: MediaPlanItem[]): PlannedMediaCopy[] {
  const reconciled = reconcileMediaPlanReferences(items);
  const base = PRODUCTION_MEDIA_PUBLIC_BASE_URL.replace(/\/$/, "");
  const privateCopies: PlannedMediaCopy[] = reconciled.mapping
    .filter((row) => row.destinationAction === "COPY_PRIVATE")
    .map((row) => ({
      storageKey: row.storageKey,
      destinationUrl: `${base}/${row.storageKey.replace(/^\/+/, "")}`,
      publicPrivate: row.publicPrivate,
      owningInitiativeId: row.owningInitiativeId,
      sourceCollections: [...new Set(row.sources.map((s) => s.sourceCollection))],
      destinationAction: "COPY_PRIVATE" as const,
    }));
  return [...reconciled.uniquePublicCopies, ...privateCopies];
}

export interface MediaCopyExecutor {
  copyPublicObject(input: {
    storageKey: string;
    destinationUrl: string;
  }): Promise<MediaCopyOutcome>;
  deleteOwnedObject?(storageKey: string): Promise<void>;
}

/** Default: plan-only. Never performs R2 I/O. */
export class DeferredMediaCopyExecutor implements MediaCopyExecutor {
  async copyPublicObject(input: {
    storageKey: string;
    destinationUrl: string;
  }): Promise<MediaCopyOutcome> {
    return {
      status: "deferred",
      destinationUrl: input.destinationUrl,
      createdByThisExecution: false,
    };
  }
}

/**
 * Real R2 copies require media-copy env YES + injected inner executor.
 * performMediaCopies alone cannot bypass this gate.
 */
export class GatedMediaCopyExecutor implements MediaCopyExecutor {
  constructor(
    private readonly inner: MediaCopyExecutor | null,
    private readonly mediaCopyEnabled: boolean,
  ) {}

  static fromEnv(inner: MediaCopyExecutor | null = null): GatedMediaCopyExecutor {
    const enabled = process.env[MEDIA_COPY_ENABLED_ENV]?.trim() === MEDIA_COPY_ENABLED_VALUE;
    return new GatedMediaCopyExecutor(inner, enabled);
  }

  async copyPublicObject(input: {
    storageKey: string;
    destinationUrl: string;
  }): Promise<MediaCopyOutcome> {
    if (!this.mediaCopyEnabled) {
      return {
        status: "deferred",
        destinationUrl: input.destinationUrl,
        createdByThisExecution: false,
      };
    }
    if (!this.inner) {
      throw new ProductionInitiativeMigrationError(
        "Media copy enabled but no R2 executor injected. Refusing.",
        "MEDIA_COPY_EXECUTOR_MISSING",
      );
    }
    return this.inner.copyPublicObject(input);
  }

  async deleteOwnedObject(storageKey: string): Promise<void> {
    if (!this.mediaCopyEnabled || !this.inner?.deleteOwnedObject) return;
    await this.inner.deleteOwnedObject(storageKey);
  }
}

export function resolveMediaCopyAuthorization(input: {
  mode: "dry-run" | "execute";
  confirm?: string;
  performMediaCopies?: boolean;
  mediaCopyEnvValue?: string;
}): {
  authorized: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  const envValue =
    input.mediaCopyEnvValue?.trim() ??
    process.env[MEDIA_COPY_ENABLED_ENV]?.trim() ??
    "";

  if (input.mode !== "execute") {
    reasons.push("mode is not execute");
  }
  if (input.confirm !== PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE) {
    reasons.push(
      `${PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_FLAG}!=${PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE}`,
    );
  }
  if (envValue !== MEDIA_COPY_ENABLED_VALUE) {
    reasons.push(`${MEDIA_COPY_ENABLED_ENV}!=${MEDIA_COPY_ENABLED_VALUE}`);
  }
  if (input.performMediaCopies !== true) {
    reasons.push("performMediaCopies!=true");
  }

  return { authorized: reasons.length === 0, reasons };
}

export function assertMediaCopyAuthorized(input: {
  mode: "dry-run" | "execute";
  confirm?: string;
  performMediaCopies?: boolean;
  mediaCopyEnvValue?: string;
}): void {
  const result = resolveMediaCopyAuthorization(input);
  if (!result.authorized) {
    throw new ProductionInitiativeMigrationError(
      `Refusing R2 media copy: ${result.reasons.join("; ")}. performMediaCopies alone is insufficient.`,
      "MEDIA_COPY_NOT_AUTHORIZED",
    );
  }
}

/**
 * Phase E1: copy + verify physical R2 objects (or defer).
 * Only status=created objects are ownership/rollback eligible.
 * Durable journal (when provided) records created objects for post-crash recovery.
 */
export async function executeMediaCopyPhase(input: {
  planned: PlannedMediaCopy[];
  ledger: MigrationOwnershipLedger;
  executor: MediaCopyExecutor;
  performCopies: boolean;
  recoveryJournal?: MediaRecoveryJournal | null;
}): Promise<{
  plannedCount: number;
  copiedCount: number;
  alreadyEquivalentCount: number;
  deferredCount: number;
  deferred: boolean;
  storageKeys: string[];
  outcomes: Array<{ storageKey: string; status: MediaCopyOutcome["status"] }>;
}> {
  let copiedCount = 0;
  let alreadyEquivalentCount = 0;
  let deferredCount = 0;
  const outcomes: Array<{ storageKey: string; status: MediaCopyOutcome["status"] }> = [];

  for (const item of input.planned) {
    if (item.destinationAction === "ERROR") {
      throw new ProductionInitiativeMigrationError(
        `Media plan ERROR for storageKey=${item.storageKey}`,
        "MEDIA_PLAN_ERROR",
      );
    }
    if (item.destinationAction === "COPY_PRIVATE") {
      throw new ProductionInitiativeMigrationError(
        `COPY_PRIVATE not supported by public R2 migration path (storageKey=${item.storageKey})`,
        "MEDIA_PRIVATE_COPY_UNSUPPORTED",
      );
    }

    let outcome: MediaCopyOutcome;
    if (input.performCopies && item.destinationAction === "COPY_PUBLIC") {
      outcome = await input.executor.copyPublicObject({
        storageKey: item.storageKey,
        destinationUrl: item.destinationUrl,
      });
    } else {
      outcome = {
        status: "deferred",
        destinationUrl: item.destinationUrl,
        createdByThisExecution: false,
      };
    }

    outcomes.push({ storageKey: item.storageKey, status: outcome.status });

    if (outcome.status === "created") {
      copiedCount += 1;
      const contentSha256 = outcome.integrity.checksumSHA256;
      if (!contentSha256) {
        throw new ProductionInitiativeMigrationError(
          `Created object missing contentSha256 for storageKey=${item.storageKey}`,
          "MEDIA_INTEGRITY_INCOMPLETE",
        );
      }
      input.ledger.recordMediaObject({
        storageKey: item.storageKey,
        destinationUrl: outcome.destinationUrl,
        copied: true,
        createdByThisExecution: true,
        contentSha256,
        migrationExecutionId: input.ledger.migrationExecutionId,
      });
      if (input.recoveryJournal) {
        await input.recoveryJournal.recordCreated({
          migrationExecutionId: input.ledger.migrationExecutionId,
          storageKey: item.storageKey,
          destinationUrl: outcome.destinationUrl,
          contentSha256,
          contentLength: outcome.integrity.contentLength,
          contentType: outcome.integrity.contentType,
          createdAt: new Date().toISOString(),
          status: "created",
        });
      }
    } else if (outcome.status === "already_equivalent") {
      alreadyEquivalentCount += 1;
      input.ledger.recordMediaObject({
        storageKey: item.storageKey,
        destinationUrl: outcome.destinationUrl,
        copied: false,
        createdByThisExecution: false,
        contentSha256: outcome.integrity.checksumSHA256,
        migrationExecutionId: input.ledger.migrationExecutionId,
      });
    } else {
      deferredCount += 1;
      input.ledger.recordMediaObject({
        storageKey: item.storageKey,
        destinationUrl: outcome.destinationUrl,
        copied: false,
        createdByThisExecution: false,
        migrationExecutionId: input.ledger.migrationExecutionId,
      });
    }
  }

  return {
    plannedCount: input.planned.length,
    copiedCount,
    alreadyEquivalentCount,
    deferredCount,
    deferred: copiedCount === 0 && alreadyEquivalentCount === 0,
    storageKeys: input.planned.map((row) => row.storageKey),
    outcomes,
  };
}

export async function rollbackOwnedMediaObjects(
  executor: MediaCopyExecutor,
  ledger: MigrationOwnershipLedger,
): Promise<number> {
  const keys = ledger.rollbackEligibleMediaKeys();
  if (!executor.deleteOwnedObject) {
    if (keys.length > 0) {
      throw new ProductionInitiativeMigrationError(
        "Media rollback required but executor cannot deleteOwnedObject.",
        "MEDIA_ROLLBACK_UNSUPPORTED",
      );
    }
    return 0;
  }
  let deleted = 0;
  for (const key of [...keys].reverse()) {
    await executor.deleteOwnedObject(key);
    deleted += 1;
  }
  return deleted;
}
