/**
 * Closure 08 — bounded Media carousel HU-owned PLP presence for one locale.
 * Static catalog only (principle/trusted/fact_check/propaganda). Excludes public_news.
 */

import type { LanguageLocalizationCountBucket, MediaPlpEntityType } from "@hu/types";
import {
  emptyLanguageLocalizationCountBucket,
  PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
} from "@hu/types";

import { discoverMediaPlpCarouselStaticEntities } from "./media-plp-carousel/discover-entities.js";
import { loadMediaPlpLiveCanonicalSource } from "./published-localized-presentation/media/live-source.js";
import { findCurrentPublishedPresentation } from "./published-localized-presentation/persistence/repository.js";
import { classifyUsableLocalizedPresentation } from "./published-localized-presentation/usability.js";

const HU_CAROUSEL_ENTITY_TYPES = new Set([
  "civic_media_principle",
  "civic_media_trusted",
  "civic_media_fact_check",
  "civic_media_propaganda",
]);

export type AssessMediaCarouselPlpPresenceInput = {
  readonly locale: string;
  /** Max static catalog entities to probe (default 50, max 100). */
  readonly pageSize?: number;
  readonly findPlp?: typeof findCurrentPublishedPresentation;
  readonly loadCanonical?: typeof loadMediaPlpLiveCanonicalSource;
  /** When set, only probe this entity type. */
  readonly entityType?: string;
};

export type MediaCarouselPlpPresenceByKind = {
  readonly kindId: string;
  readonly counts: LanguageLocalizationCountBucket;
  readonly checked: number;
};

type PresenceClass = "current" | "missing" | "invalid" | "stale";

async function classifyCarouselSnapshot(input: {
  readonly entityType: string;
  readonly entityId: string;
  readonly locale: string;
  readonly findPlp: typeof findCurrentPublishedPresentation;
  readonly loadCanonical: typeof loadMediaPlpLiveCanonicalSource;
}): Promise<PresenceClass> {
  const snapshot = await input
    .findPlp({
      entityType: input.entityType,
      entityId: input.entityId,
      locale: input.locale,
    })
    .catch(() => null);
  if (!snapshot) {
    return "missing";
  }
  let source;
  try {
    source = await input.loadCanonical({
      entityType: input.entityType as MediaPlpEntityType,
      entityId: input.entityId,
    });
  } catch {
    return "missing";
  }
  if (
    !source.CANONICAL_USABLE ||
    source.canonicalPresentation == null ||
    !source.CANONICAL_VERSION
  ) {
    return "missing";
  }
  const usability = classifyUsableLocalizedPresentation({
    locale: input.locale,
    liveCanonicalVersion: source.CANONICAL_VERSION,
    liveLocalizationSchemaVersion:
      snapshot.identity.localizationSchemaVersion ??
      PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
    canonicalPresentation: source.canonicalPresentation,
    snapshot,
  });
  if (usability.allowPublishedLocalized) {
    return "current";
  }
  if (usability.contentIntegrityReasonCodes.includes("DETERMINISTIC_PLACEHOLDER")) {
    return "invalid";
  }
  if (
    usability.reason === "CANONICAL_VERSION_MISMATCH" ||
    usability.reason === "SCHEMA_VERSION_MISMATCH"
  ) {
    return "stale";
  }
  if (
    usability.reason === "CONTENT_INTEGRITY_FAILED" ||
    usability.reason === "CONTENT_INTEGRITY_MISSING" ||
    usability.reason === "STRUCTURAL_INTEGRITY_FAILED" ||
    usability.reason === "STRUCTURAL_INTEGRITY_MISSING"
  ) {
    return "invalid";
  }
  return usability.rebuildRequired ? "stale" : "missing";
}

/**
 * Read-only PLP presence for /media carousel HU-owned static catalog entities.
 * Classifies each snapshot against its live canonical. Does not call TranslationProvider.
 */
export async function assessMediaCarouselPlpPresenceForLocale(
  input: AssessMediaCarouselPlpPresenceInput,
): Promise<{
  readonly total: LanguageLocalizationCountBucket;
  readonly byKind: readonly MediaCarouselPlpPresenceByKind[];
}> {
  const pageSize = Math.max(1, Math.min(input.pageSize ?? 50, 200));
  const findPlp = input.findPlp ?? findCurrentPublishedPresentation;
  const loadCanonical = input.loadCanonical ?? loadMediaPlpLiveCanonicalSource;
  const locale = input.locale.trim();

  const refs = discoverMediaPlpCarouselStaticEntities().filter(
    (ref) =>
      ref.route === "/media" &&
      ref.plpSnapshotExpected &&
      HU_CAROUSEL_ENTITY_TYPES.has(String(ref.entityType)) &&
      (input.entityType ? ref.entityType === input.entityType : true),
  );

  const byKindMap = new Map<
    string,
    { current: number; missing: number; invalid: number; stale: number; checked: number }
  >();

  let probed = 0;
  for (const ref of refs) {
    if (probed >= pageSize) {
      break;
    }
    probed += 1;
    const kindId = String(ref.entityType);
    const row = byKindMap.get(kindId) ?? {
      current: 0,
      missing: 0,
      invalid: 0,
      stale: 0,
      checked: 0,
    };
    row.checked += 1;
    const presence = await classifyCarouselSnapshot({
      entityType: ref.entityType,
      entityId: ref.entityId,
      locale,
      findPlp,
      loadCanonical,
    });
    row[presence] += 1;
    byKindMap.set(kindId, row);
  }

  const byKind: MediaCarouselPlpPresenceByKind[] = [];
  let total = emptyLanguageLocalizationCountBucket();
  for (const [kindId, row] of byKindMap) {
    const counts: LanguageLocalizationCountBucket = {
      current: row.current,
      missing: row.missing,
      stale: row.stale,
      invalid: row.invalid,
      failed: 0,
      pending: 0,
      workItemsRequired: row.missing + row.invalid + row.stale,
    };
    byKind.push({ kindId, counts, checked: row.checked });
    total = {
      current: total.current + counts.current,
      missing: total.missing + counts.missing,
      stale: total.stale + counts.stale,
      invalid: total.invalid + counts.invalid,
      failed: total.failed,
      pending: total.pending,
      workItemsRequired: total.workItemsRequired + counts.workItemsRequired,
    };
  }

  return { total, byKind };
}
