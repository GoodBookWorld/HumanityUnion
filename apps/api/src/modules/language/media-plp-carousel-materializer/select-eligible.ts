/**
 * Reset 03E.10 — eligibility selection for bounded carousel materialization.
 * Pure: no I/O, no provider, no bodies.
 */

import type { MediaPlpCarouselEntityRow } from "../media-plp-carousel/run-carousel.js";
import { MEDIA_PLP_CAROUSEL_MATERIALIZE_PLAN_MAX } from "../media-plp-carousel/constants.js";

export type MediaPlpCarouselSkipReason =
  | "USABLE_LOCALIZED"
  | "ZERO_TRANSLATABLE_NODES"
  | "DOMAIN_NOT_YET_MIGRATED"
  | "SOURCE_NOT_FOUND"
  | "LIMIT_EXCEEDED"
  | "NOT_MATERIALIZER_SOURCE";

export type MediaPlpCarouselSelectedEntity = {
  readonly entityType: string;
  readonly entityId: string;
  readonly surface: string;
  readonly rebuildReason: string;
  readonly nodes: number;
  readonly bytes: number | null;
  readonly wouldCallProvider: true;
  readonly wouldPublish: true;
};

export type MediaPlpCarouselSelectionResult = {
  readonly TOTAL_DISCOVERED: number;
  readonly ELIGIBLE: number;
  readonly SKIPPED_USABLE: number;
  readonly SKIPPED_ZERO_NODES: number;
  readonly SKIPPED_DOMAIN: number;
  readonly SKIPPED_SOURCE_NOT_FOUND: number;
  readonly SKIPPED_NOT_MATERIALIZER_SOURCE: number;
  readonly SELECTED_BY_LIMIT: number;
  readonly selected: readonly MediaPlpCarouselSelectedEntity[];
  readonly skipped: readonly {
    readonly entityType: string;
    readonly entityId: string;
    readonly reason: MediaPlpCarouselSkipReason;
  }[];
};

/**
 * Deterministic order = discover/diagnostic row order.
 * Eligible: REBUILD_REQUIRED + nodes > 0 + Media PLP materializer source.
 */
export function selectMediaPlpCarouselMaterializeEntities(
  rows: readonly MediaPlpCarouselEntityRow[],
  limit: number = MEDIA_PLP_CAROUSEL_MATERIALIZE_PLAN_MAX,
): MediaPlpCarouselSelectionResult {
  const hardLimit = Math.min(
    Math.max(1, limit),
    MEDIA_PLP_CAROUSEL_MATERIALIZE_PLAN_MAX,
  );

  let skippedUsable = 0;
  let skippedZero = 0;
  let skippedDomain = 0;
  let skippedSource = 0;
  let skippedNotSource = 0;
  const skipped: MediaPlpCarouselSelectionResult["skipped"][number][] = [];
  const eligible: MediaPlpCarouselSelectedEntity[] = [];

  for (const row of rows) {
    if (row.rebuildReason === "DOMAIN_NOT_YET_MIGRATED" || row.entityType === "initiative") {
      skippedDomain += 1;
      skipped.push({
        entityType: row.entityType,
        entityId: row.entityId,
        reason: "DOMAIN_NOT_YET_MIGRATED",
      });
      continue;
    }
    if (row.rebuildReason === "SOURCE_NOT_FOUND") {
      skippedSource += 1;
      skipped.push({
        entityType: row.entityType,
        entityId: row.entityId,
        reason: "SOURCE_NOT_FOUND",
      });
      continue;
    }
    if (!row.inMaterializerSource) {
      skippedNotSource += 1;
      skipped.push({
        entityType: row.entityType,
        entityId: row.entityId,
        reason: "NOT_MATERIALIZER_SOURCE",
      });
      continue;
    }
    if (row.usability === "USABLE_LOCALIZED" && row.rebuildReason === "NONE") {
      skippedUsable += 1;
      skipped.push({
        entityType: row.entityType,
        entityId: row.entityId,
        reason: "USABLE_LOCALIZED",
      });
      continue;
    }

    const nodes = row.translatableNodeCount ?? 0;
    if (nodes <= 0) {
      skippedZero += 1;
      skipped.push({
        entityType: row.entityType,
        entityId: row.entityId,
        reason: "ZERO_TRANSLATABLE_NODES",
      });
      continue;
    }

    // Remaining rebuild-required Media PLP entities with work to do.
    if (row.rebuildReason === "NONE") {
      // Defensive: treat as usable/skip if somehow not rebuild.
      skippedUsable += 1;
      skipped.push({
        entityType: row.entityType,
        entityId: row.entityId,
        reason: "USABLE_LOCALIZED",
      });
      continue;
    }

    eligible.push({
      entityType: row.entityType,
      entityId: row.entityId,
      surface: row.surface,
      rebuildReason: row.rebuildReason,
      nodes,
      bytes: row.payloadByteEstimate,
      wouldCallProvider: true,
      wouldPublish: true,
    });
  }

  const selected = eligible.slice(0, hardLimit);
  for (const overflow of eligible.slice(hardLimit)) {
    skipped.push({
      entityType: overflow.entityType,
      entityId: overflow.entityId,
      reason: "LIMIT_EXCEEDED",
    });
  }

  return {
    TOTAL_DISCOVERED: rows.length,
    ELIGIBLE: eligible.length,
    SKIPPED_USABLE: skippedUsable,
    SKIPPED_ZERO_NODES: skippedZero,
    SKIPPED_DOMAIN: skippedDomain,
    SKIPPED_SOURCE_NOT_FOUND: skippedSource,
    SKIPPED_NOT_MATERIALIZER_SOURCE: skippedNotSource,
    SELECTED_BY_LIMIT: selected.length,
    selected,
    skipped,
  };
}
