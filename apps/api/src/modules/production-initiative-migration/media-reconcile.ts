import { PRODUCTION_MEDIA_PUBLIC_BASE_URL } from "./constants.js";
import { ProductionInitiativeMigrationError } from "./errors.js";
import type { PlannedMediaCopy } from "./types.js";
import type { MediaPlanItem } from "./types.js";

export type { PlannedMediaCopy } from "./types.js";

export interface MediaReferenceMappingRow {
  storageKey: string;
  referenceCount: number;
  destinationAction: MediaPlanItem["destinationAction"];
  publicPrivate: MediaPlanItem["publicPrivate"];
  owningInitiativeId: string | null;
  /** Canonical production URL all refs for this key must resolve to. */
  destinationUrl: string;
  sources: Array<{
    sourceCollection: string;
    recordId: string | null;
    destinationAction: MediaPlanItem["destinationAction"];
    publicPrivate: MediaPlanItem["publicPrivate"];
    destinationUrl: string;
  }>;
}

export interface MediaReconciliationResult {
  /** Undeduped COPY_PUBLIC references (preflight summarizeMediaPlan.copyPublic). */
  copyPublicReferenceCount: number;
  /** Undeduped COPY_PRIVATE references. */
  copyPrivateReferenceCount: number;
  /** Unique destination storage keys for COPY_PUBLIC. */
  uniquePublicObjectCount: number;
  uniquePrivateObjectCount: number;
  /** referenceCount − uniquePublicObjectCount for COPY_PUBLIC. */
  duplicatePublicReferencesCollapsed: number;
  mapping: MediaReferenceMappingRow[];
  uniquePublicCopies: PlannedMediaCopy[];
  explanation: string;
}

function storageKeyForItem(item: MediaPlanItem): string | null {
  const key = item.sourceStorageKey?.trim();
  if (key) return key;
  if (item.sourceUrlHost && item.recordId) {
    return `${item.sourceUrlHost}/${item.recordId}`;
  }
  return null;
}

function assertCompatibleMerge(
  existing: MediaPlanItem,
  incoming: MediaPlanItem,
  storageKey: string,
  existingDestinationUrl: string,
  incomingDestinationUrl: string,
): void {
  if (existing.destinationAction !== incoming.destinationAction) {
    throw new ProductionInitiativeMigrationError(
      `Incompatible media collapse for storageKey=${storageKey}: destinationAction ${existing.destinationAction} vs ${incoming.destinationAction}`,
      "MEDIA_KEY_COLLISION_INCOMPATIBLE",
    );
  }
  if (existing.publicPrivate !== incoming.publicPrivate) {
    throw new ProductionInitiativeMigrationError(
      `Incompatible media collapse for storageKey=${storageKey}: publicPrivate ${existing.publicPrivate} vs ${incoming.publicPrivate}`,
      "MEDIA_KEY_COLLISION_INCOMPATIBLE",
    );
  }
  if (existingDestinationUrl !== incomingDestinationUrl) {
    throw new ProductionInitiativeMigrationError(
      `Incompatible media collapse for storageKey=${storageKey}: destinationUrl mismatch`,
      "MEDIA_KEY_COLLISION_INCOMPATIBLE",
    );
  }
}

/**
 * Deterministic reference → unique storageKey reconciliation.
 * Explains preflight reference counts vs execution unique planned copies.
 * Hard-fails when logically incompatible references share a destination key.
 */
export function reconcileMediaPlanReferences(
  items: readonly MediaPlanItem[],
): MediaReconciliationResult {
  const copyPublicRefs = items.filter((i) => i.destinationAction === "COPY_PUBLIC");
  const copyPrivateRefs = items.filter((i) => i.destinationAction === "COPY_PRIVATE");
  const base = PRODUCTION_MEDIA_PUBLIC_BASE_URL.replace(/\/$/, "");

  const groups = new Map<string, MediaPlanItem[]>();
  const destinationUrlByKey = new Map<string, string>();
  for (const item of items) {
    if (item.destinationAction === "NO_COPY") continue;
    if (item.destinationAction === "ERROR") {
      throw new ProductionInitiativeMigrationError(
        `Media plan ERROR reference in ${item.sourceCollection} recordId=${item.recordId ?? "unknown"}`,
        "MEDIA_PLAN_ERROR",
      );
    }
    const storageKey = storageKeyForItem(item);
    if (!storageKey) {
      throw new ProductionInitiativeMigrationError(
        `Media reference missing storageKey in ${item.sourceCollection}`,
        "MEDIA_MISSING_STORAGE_KEY",
      );
    }
    const destinationUrl = `${base}/${storageKey.replace(/^\/+/, "")}`;
    const list = groups.get(storageKey) ?? [];
    if (list.length > 0) {
      assertCompatibleMerge(
        list[0]!,
        item,
        storageKey,
        destinationUrlByKey.get(storageKey)!,
        destinationUrl,
      );
    }
    list.push(item);
    groups.set(storageKey, list);
    destinationUrlByKey.set(storageKey, destinationUrl);
  }

  const mapping: MediaReferenceMappingRow[] = [...groups.entries()]
    .map(([storageKey, refs]) => {
      const lead = refs[0]!;
      const destinationUrl = destinationUrlByKey.get(storageKey)!;
      return {
        storageKey,
        referenceCount: refs.length,
        destinationAction: lead.destinationAction,
        publicPrivate: lead.publicPrivate,
        owningInitiativeId: lead.owningInitiativeId,
        destinationUrl,
        sources: refs.map((r) => ({
          sourceCollection: r.sourceCollection,
          recordId: r.recordId,
          destinationAction: r.destinationAction,
          publicPrivate: r.publicPrivate,
          destinationUrl,
        })),
      };
    })
    .sort((a, b) => a.storageKey.localeCompare(b.storageKey));

  const uniquePublicCopies: PlannedMediaCopy[] = mapping
    .filter((row) => row.destinationAction === "COPY_PUBLIC")
    .map((row) => ({
      storageKey: row.storageKey,
      destinationUrl: row.destinationUrl,
      publicPrivate: row.publicPrivate,
      owningInitiativeId: row.owningInitiativeId,
      sourceCollections: [...new Set(row.sources.map((s) => s.sourceCollection))],
      destinationAction: "COPY_PUBLIC" as const,
    }));

  const uniquePrivateObjectCount = mapping.filter(
    (row) => row.destinationAction === "COPY_PRIVATE",
  ).length;

  const copyPublicReferenceCount = copyPublicRefs.length;
  const uniquePublicObjectCount = uniquePublicCopies.length;

  return {
    copyPublicReferenceCount,
    copyPrivateReferenceCount: copyPrivateRefs.length,
    uniquePublicObjectCount,
    uniquePrivateObjectCount,
    duplicatePublicReferencesCollapsed: copyPublicReferenceCount - uniquePublicObjectCount,
    mapping,
    uniquePublicCopies,
    explanation:
      `Preflight counts undeduped COPY_PUBLIC references (${copyPublicReferenceCount}); ` +
      `execution plans unique destination objects by storageKey (${uniquePublicObjectCount}); ` +
      `collapsed duplicate references=${copyPublicReferenceCount - uniquePublicObjectCount}.`,
  };
}

/**
 * Build a deterministic synthetic plan proving 31 COPY_PUBLIC references → 13 unique keys.
 * Mirrors the live arithmetic (duplicate initiative URL + upload-record references).
 */
export function buildThirtyOneToThirteenMediaFixture(): MediaPlanItem[] {
  const uniqueKeys = Array.from({ length: 13 }, (_, i) => `initiatives/fixture-unique-${i + 1}.png`);
  const items: MediaPlanItem[] = [];

  // 13 unique upload-record references
  for (let i = 0; i < 13; i += 1) {
    items.push({
      sourceStorageKey: uniqueKeys[i]!,
      publicPrivate: "public",
      owningInitiativeId: `initiative-fixture-${(i % 9) + 1}`,
      mediaUploadRecordPresent: true,
      sourceUrlHost: "media-staging.huws.org",
      hostClassification: "staging_r2",
      destinationAction: "COPY_PUBLIC",
      urlRewriteRequired: true,
      sourceCollection: "media_upload_records",
      recordId: `media-${i + 1}`,
      ownerIsSystemMediaRecovery: false,
    });
  }

  // 9 initiative imageUrl refs → first 9 unique keys (duplicates)
  for (let i = 0; i < 9; i += 1) {
    items.push({
      sourceStorageKey: uniqueKeys[i]!,
      publicPrivate: "public",
      owningInitiativeId: `initiative-fixture-${i + 1}`,
      mediaUploadRecordPresent: true,
      sourceUrlHost: "media-staging.huws.org",
      hostClassification: "staging_r2",
      destinationAction: "COPY_PUBLIC",
      urlRewriteRequired: true,
      sourceCollection: "initiatives",
      recordId: `initiative-fixture-${i + 1}`,
      ownerIsSystemMediaRecovery: false,
    });
  }

  // 9 initiative coverMedia refs → first 9 unique keys again (more duplicates)
  for (let i = 0; i < 9; i += 1) {
    items.push({
      sourceStorageKey: uniqueKeys[i]!,
      publicPrivate: "public",
      owningInitiativeId: `initiative-fixture-${i + 1}`,
      mediaUploadRecordPresent: true,
      sourceUrlHost: "media-staging.huws.org",
      hostClassification: "staging_r2",
      destinationAction: "COPY_PUBLIC",
      urlRewriteRequired: true,
      sourceCollection: "initiatives",
      recordId: `initiative-fixture-${i + 1}-cover`,
      ownerIsSystemMediaRecovery: false,
    });
  }

  // 31 = 13 + 9 + 9
  return items;
}
