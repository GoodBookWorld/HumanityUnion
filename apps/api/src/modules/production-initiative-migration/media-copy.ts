import {
  MEDIA_COPY_ENABLED_ENV,
  PRODUCTION_MEDIA_PUBLIC_BASE_URL,
} from "./constants.js";
import { ProductionInitiativeMigrationError } from "./errors.js";
import type { MediaPlanItem } from "./types.js";
import type { MigrationOwnershipLedger } from "./ownership-ledger.js";

export interface PlannedMediaCopy {
  storageKey: string;
  destinationUrl: string;
  publicPrivate: "public" | "private" | "unknown";
  owningInitiativeId: string | null;
  sourceCollections: string[];
  destinationAction: MediaPlanItem["destinationAction"];
}

/**
 * Deduplicate media plan items by storageKey (or host+path fingerprint when key absent).
 */
export function deduplicateMediaPlanItems(items: MediaPlanItem[]): PlannedMediaCopy[] {
  const byKey = new Map<string, PlannedMediaCopy>();
  for (const item of items) {
    if (item.destinationAction === "NO_COPY") continue;
    const storageKey =
      item.sourceStorageKey?.trim() ||
      (item.sourceUrlHost && item.recordId
        ? `${item.sourceUrlHost}/${item.recordId}`
        : null);
    if (!storageKey) continue;
    const existing = byKey.get(storageKey);
    if (existing) {
      if (!existing.sourceCollections.includes(item.sourceCollection)) {
        existing.sourceCollections.push(item.sourceCollection);
      }
      continue;
    }
    const base = PRODUCTION_MEDIA_PUBLIC_BASE_URL.replace(/\/$/, "");
    byKey.set(storageKey, {
      storageKey,
      destinationUrl: `${base}/${storageKey.replace(/^\/+/, "")}`,
      publicPrivate: item.publicPrivate,
      owningInitiativeId: item.owningInitiativeId,
      sourceCollections: [item.sourceCollection],
      destinationAction: item.destinationAction,
    });
  }
  return [...byKey.values()].sort((a, b) => a.storageKey.localeCompare(b.storageKey));
}

export interface MediaCopyExecutor {
  /**
   * Copy one public object staging → production R2.
   * Task 07.2 default implementation refuses to copy.
   */
  copyPublicObject(input: {
    storageKey: string;
    destinationUrl: string;
  }): Promise<{ copied: boolean; destinationUrl: string }>;
}

/** Default: plan-only. Never performs R2 I/O. */
export class DeferredMediaCopyExecutor implements MediaCopyExecutor {
  async copyPublicObject(input: {
    storageKey: string;
    destinationUrl: string;
  }): Promise<{ copied: boolean; destinationUrl: string }> {
    void input;
    return { copied: false, destinationUrl: input.destinationUrl };
  }
}

/**
 * Guarded executor — refuses real copy unless MEDIA_COPY env is YES.
 * Even then, Task 07.2 does not wire a live R2 client; callers must inject one later.
 */
export class GatedMediaCopyExecutor implements MediaCopyExecutor {
  constructor(
    private readonly inner: MediaCopyExecutor | null,
    private readonly mediaCopyEnabled: boolean,
  ) {}

  static fromEnv(inner: MediaCopyExecutor | null = null): GatedMediaCopyExecutor {
    const enabled = process.env[MEDIA_COPY_ENABLED_ENV]?.trim() === "YES";
    return new GatedMediaCopyExecutor(inner, enabled);
  }

  async copyPublicObject(input: {
    storageKey: string;
    destinationUrl: string;
  }): Promise<{ copied: boolean; destinationUrl: string }> {
    if (!this.mediaCopyEnabled) {
      return { copied: false, destinationUrl: input.destinationUrl };
    }
    if (!this.inner) {
      throw new ProductionInitiativeMigrationError(
        "Media copy enabled but no R2 executor injected. Refusing.",
        "MEDIA_COPY_EXECUTOR_MISSING",
      );
    }
    return this.inner.copyPublicObject(input);
  }
}

/**
 * Phase E: record planned copies on the ownership ledger.
 * Does not perform R2 copy in Task 07.2 (deferred / plan-only).
 */
export async function executeMediaCopyPhase(input: {
  planned: PlannedMediaCopy[];
  ledger: MigrationOwnershipLedger;
  executor: MediaCopyExecutor;
  performCopies: boolean;
}): Promise<{
  plannedCount: number;
  copiedCount: number;
  deferred: boolean;
  storageKeys: string[];
}> {
  let copiedCount = 0;
  for (const item of input.planned) {
    if (item.destinationAction === "ERROR") {
      throw new ProductionInitiativeMigrationError(
        `Media plan ERROR for storageKey=${item.storageKey}`,
        "MEDIA_PLAN_ERROR",
      );
    }
    let copied = false;
    if (input.performCopies && item.destinationAction === "COPY_PUBLIC") {
      const result = await input.executor.copyPublicObject({
        storageKey: item.storageKey,
        destinationUrl: item.destinationUrl,
      });
      copied = result.copied;
      if (copied) copiedCount += 1;
    }
    input.ledger.recordMediaObject({
      storageKey: item.storageKey,
      destinationUrl: item.destinationUrl,
      copied,
      migrationExecutionId: input.ledger.migrationExecutionId,
    });
  }
  return {
    plannedCount: input.planned.length,
    copiedCount,
    deferred: copiedCount === 0,
    storageKeys: input.planned.map((row) => row.storageKey),
  };
}
