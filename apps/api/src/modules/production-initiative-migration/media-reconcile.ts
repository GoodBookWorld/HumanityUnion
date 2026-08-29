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

function expectedActionForVisibility(
  publicPrivate: "public" | "private",
): MediaPlanItem["destinationAction"] {
  return publicPrivate === "private" ? "COPY_PRIVATE" : "COPY_PUBLIC";
}

/**
 * Resolve collapsed visibility for one storageKey group.
 *
 * Fail-closed rules:
 * - canonical media_upload_records proving PUBLIC → unknown may inherit PUBLIC
 * - canonical proving PRIVATE → unknown may inherit PRIVATE; non-private public refs block
 * - public + private → hard fail
 * - public/private + unknown without canonical authority → hard fail
 * - conflicting canonical proofs → hard fail
 * - historical-recovery path / system-media-recovery owner alone never authorize
 */
export function resolveCollapsedMediaVisibility(
  refs: readonly MediaPlanItem[],
  storageKey: string,
): {
  publicPrivate: "public" | "private";
  destinationAction: MediaPlanItem["destinationAction"];
} {
  const canonicalProofs = refs.filter(
    (r) =>
      r.visibilityAuthority === "canonical_media_record" &&
      (r.publicPrivate === "public" || r.publicPrivate === "private"),
  );
  const canonicalValues = [
    ...new Set(canonicalProofs.map((r) => r.publicPrivate as "public" | "private")),
  ];
  if (canonicalValues.length > 1) {
    throw new ProductionInitiativeMigrationError(
      `Incompatible media collapse for storageKey=${storageKey}: conflicting canonical visibility ${canonicalValues.join(" vs ")}`,
      "MEDIA_KEY_COLLISION_INCOMPATIBLE",
    );
  }
  const authoritative = canonicalValues[0] ?? null;

  const distinctVisibility = [...new Set(refs.map((r) => r.publicPrivate))];
  if (distinctVisibility.includes("public") && distinctVisibility.includes("private")) {
    throw new ProductionInitiativeMigrationError(
      `Incompatible media collapse for storageKey=${storageKey}: publicPrivate public vs private`,
      "MEDIA_KEY_COLLISION_INCOMPATIBLE",
    );
  }

  let resolved: "public" | "private";
  if (authoritative) {
    for (const ref of refs) {
      if (ref.publicPrivate !== "unknown" && ref.publicPrivate !== authoritative) {
        throw new ProductionInitiativeMigrationError(
          `Incompatible media collapse for storageKey=${storageKey}: publicPrivate ${ref.publicPrivate} vs canonical ${authoritative}`,
          "MEDIA_KEY_COLLISION_INCOMPATIBLE",
        );
      }
    }
    resolved = authoritative;
  } else if (distinctVisibility.length === 1 && distinctVisibility[0] !== "unknown") {
    resolved = distinctVisibility[0] as "public" | "private";
  } else if (distinctVisibility.includes("unknown")) {
    throw new ProductionInitiativeMigrationError(
      `Incompatible media collapse for storageKey=${storageKey}: publicPrivate ${distinctVisibility.filter((v) => v !== "unknown")[0] ?? "unknown"} vs unknown (no authoritative media_upload_records proof)`,
      "MEDIA_KEY_COLLISION_INCOMPATIBLE",
    );
  } else {
    throw new ProductionInitiativeMigrationError(
      `Incompatible media collapse for storageKey=${storageKey}: unresolved publicPrivate`,
      "MEDIA_KEY_COLLISION_INCOMPATIBLE",
    );
  }

  const expectedAction = expectedActionForVisibility(resolved);
  for (const ref of refs) {
    if (ref.destinationAction === "ERROR" || ref.destinationAction === "NO_COPY") {
      throw new ProductionInitiativeMigrationError(
        `Incompatible media collapse for storageKey=${storageKey}: destinationAction ${ref.destinationAction}`,
        "MEDIA_KEY_COLLISION_INCOMPATIBLE",
      );
    }
    // Unknown-visibility refs may have been planned with the public-action heuristic;
    // after authoritative PRIVATE resolution they must collapse to COPY_PRIVATE.
    if (ref.publicPrivate === "unknown" && authoritative) {
      continue;
    }
    if (ref.destinationAction !== expectedAction) {
      throw new ProductionInitiativeMigrationError(
        `Incompatible media collapse for storageKey=${storageKey}: destinationAction ${ref.destinationAction} vs ${expectedAction}`,
        "MEDIA_KEY_COLLISION_INCOMPATIBLE",
      );
    }
  }

  return { publicPrivate: resolved, destinationAction: expectedAction };
}

function assertCompatibleDestinationUrl(
  storageKey: string,
  existingDestinationUrl: string,
  incomingDestinationUrl: string,
): void {
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
      assertCompatibleDestinationUrl(
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
      const resolved = resolveCollapsedMediaVisibility(refs, storageKey);
      const destinationUrl = destinationUrlByKey.get(storageKey)!;
      const lead = refs[0]!;
      return {
        storageKey,
        referenceCount: refs.length,
        destinationAction: resolved.destinationAction,
        publicPrivate: resolved.publicPrivate,
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

  // 13 unique upload-record references (canonical PUBLIC authority)
  for (let i = 0; i < 13; i += 1) {
    items.push({
      sourceStorageKey: uniqueKeys[i]!,
      publicPrivate: "public",
      visibilityAuthority: "canonical_media_record",
      owningInitiativeId: `initiative-fixture-${(i % 9) + 1}`,
      mediaUploadRecordPresent: true,
      sourceUrlHost: "media-staging.huws.org",
      hostClassification: "staging_r2",
      destinationAction: "COPY_PUBLIC",
      urlRewriteRequired: true,
      sourceCollection: "media_upload_records",
      recordId: `media-${i + 1}`,
      ownerIsSystemMediaRecovery: false,
      mediaPurpose: "initiative-image",
    });
  }

  // 9 initiative imageUrl refs → first 9 unique keys (duplicates)
  for (let i = 0; i < 9; i += 1) {
    items.push({
      sourceStorageKey: uniqueKeys[i]!,
      publicPrivate: "public",
      visibilityAuthority: "none",
      owningInitiativeId: `initiative-fixture-${i + 1}`,
      mediaUploadRecordPresent: true,
      sourceUrlHost: "media-staging.huws.org",
      hostClassification: "staging_r2",
      destinationAction: "COPY_PUBLIC",
      urlRewriteRequired: true,
      sourceCollection: "initiatives",
      recordId: `initiative-fixture-${i + 1}`,
      ownerIsSystemMediaRecovery: false,
      mediaPurpose: null,
    });
  }

  // 9 initiative coverMedia refs → first 9 unique keys again (more duplicates)
  for (let i = 0; i < 9; i += 1) {
    items.push({
      sourceStorageKey: uniqueKeys[i]!,
      publicPrivate: "public",
      visibilityAuthority: "none",
      owningInitiativeId: `initiative-fixture-${i + 1}`,
      mediaUploadRecordPresent: true,
      sourceUrlHost: "media-staging.huws.org",
      hostClassification: "staging_r2",
      destinationAction: "COPY_PUBLIC",
      urlRewriteRequired: true,
      sourceCollection: "initiatives",
      recordId: `initiative-fixture-${i + 1}-cover`,
      ownerIsSystemMediaRecovery: false,
      mediaPurpose: null,
    });
  }

  // 31 = 13 + 9 + 9
  return items;
}
