/**
 * Closure 08 — bounded Media carousel HU-owned PLP presence for one locale.
 * Static catalog only (principle/trusted/fact_check/propaganda). Excludes public_news.
 */

import type { LanguageLocalizationCountBucket } from "@hu/types";
import { emptyLanguageLocalizationCountBucket } from "@hu/types";

import { discoverMediaPlpCarouselStaticEntities } from "./media-plp-carousel/discover-entities.js";
import { findCurrentPublishedPresentation } from "./published-localized-presentation/persistence/repository.js";

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
  /** When set, only probe this entity type. */
  readonly entityType?: string;
};

export type MediaCarouselPlpPresenceByKind = {
  readonly kindId: string;
  readonly counts: LanguageLocalizationCountBucket;
  readonly checked: number;
};

/**
 * Read-only PLP presence for /media carousel HU-owned static catalog entities.
 * Does not hydrate bodies. Does not call TranslationProvider.
 */
export async function assessMediaCarouselPlpPresenceForLocale(
  input: AssessMediaCarouselPlpPresenceInput,
): Promise<{
  readonly total: LanguageLocalizationCountBucket;
  readonly byKind: readonly MediaCarouselPlpPresenceByKind[];
}> {
  const pageSize = Math.max(1, Math.min(input.pageSize ?? 50, 100));
  const findPlp = input.findPlp ?? findCurrentPublishedPresentation;
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
    { current: number; missing: number; checked: number }
  >();

  let probed = 0;
  for (const ref of refs) {
    if (probed >= pageSize) {
      break;
    }
    probed += 1;
    const kindId = String(ref.entityType);
    const row = byKindMap.get(kindId) ?? { current: 0, missing: 0, checked: 0 };
    row.checked += 1;
    const snapshot = await findPlp({
      entityType: ref.entityType,
      entityId: ref.entityId,
      locale,
    }).catch(() => null);
    if (snapshot) {
      row.current += 1;
    } else {
      row.missing += 1;
    }
    byKindMap.set(kindId, row);
  }

  const byKind: MediaCarouselPlpPresenceByKind[] = [];
  let total = emptyLanguageLocalizationCountBucket();
  for (const [kindId, row] of byKindMap) {
    const counts: LanguageLocalizationCountBucket = {
      current: row.current,
      missing: row.missing,
      stale: 0,
      failed: 0,
      pending: 0,
      workItemsRequired: row.missing,
    };
    byKind.push({ kindId, counts, checked: row.checked });
    total = {
      current: total.current + counts.current,
      missing: total.missing + counts.missing,
      stale: total.stale,
      failed: total.failed,
      pending: total.pending,
      workItemsRequired: total.workItemsRequired + counts.workItemsRequired,
    };
  }

  return { total, byKind };
}
