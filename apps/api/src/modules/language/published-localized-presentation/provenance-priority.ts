/**
 * Reset 02 — provenance priority helpers (no Brand/Legal/Glossary store duplication).
 */

import type { PublishedLocalizationProvenanceSource } from "@hu/types";
import { PUBLISHED_LOCALIZATION_PROVENANCE_PRIORITY } from "@hu/types";

const RANK = new Map<PublishedLocalizationProvenanceSource, number>(
  PUBLISHED_LOCALIZATION_PROVENANCE_PRIORITY.map((source, index) => [source, index]),
);

export function provenanceRank(source: PublishedLocalizationProvenanceSource): number {
  return RANK.get(source) ?? PUBLISHED_LOCALIZATION_PROVENANCE_PRIORITY.length;
}

/** True when `incoming` may replace `existing` (equal or higher priority = lower rank index). */
export function mayOverwriteProvenance(input: {
  readonly existing: PublishedLocalizationProvenanceSource;
  readonly incoming: PublishedLocalizationProvenanceSource;
}): boolean {
  return provenanceRank(input.incoming) <= provenanceRank(input.existing);
}

/**
 * Merge candidate values onto a base tree by provenance priority.
 * Higher-priority existing provenance wins; MACHINE cannot overwrite MANUAL/BRAND/LEGAL/etc.
 */
export function selectWinningProvenance(input: {
  readonly existing?: PublishedLocalizationProvenanceSource;
  readonly incoming: PublishedLocalizationProvenanceSource;
}): PublishedLocalizationProvenanceSource {
  if (!input.existing) {
    return input.incoming;
  }
  return mayOverwriteProvenance({
    existing: input.existing,
    incoming: input.incoming,
  })
    ? input.incoming
    : input.existing;
}
