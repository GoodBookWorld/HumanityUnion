/**
 * Pack 08K.3.3 — deterministic Home map + country Recommended Media diagnostics.
 * Metadata counters only (no prose). Local fixtures — no live Mongo / Gemini.
 */

import type {
  PublicLocalizedPresentation,
  PublicLocalizedPresentationCoverage,
} from "@hu/types";

export type HomeCountrySurfaceFamily = "HOME_MAP" | "COUNTRY_RECOMMENDED_MEDIA";

export type HomeCountryPresentationDiagnosticRow = {
  readonly surface: HomeCountrySurfaceFamily;
  readonly sourceKind: string;
  readonly sourceRecordId: string;
  readonly locale: string;
  readonly semanticNodeCount: number;
  readonly localizedNodeCount: number;
  readonly canonicalFallbackNodeCount: number;
  readonly protectedNodeCount: number;
  readonly translationState: PublicLocalizedPresentationCoverage["status"];
  readonly fallbackPaths: readonly string[];
};

export type HomeCountryDiagnosticAggregate = {
  readonly HOME_MAP_PRESENTATIONS: number;
  readonly HOME_MAP_CANONICAL_FALLBACK_NODES: number;
  readonly COUNTRY_MEDIA_PRESENTATIONS: number;
  readonly COUNTRY_MEDIA_CANONICAL_FALLBACK_NODES: number;
  readonly rows: readonly HomeCountryPresentationDiagnosticRow[];
};

export function rowFromHomeCountryPresentation(input: {
  readonly surface: HomeCountrySurfaceFamily;
  readonly localized: PublicLocalizedPresentation;
}): HomeCountryPresentationDiagnosticRow {
  const coverage = input.localized.coverage;
  return {
    surface: input.surface,
    sourceKind: input.localized.identity.sourceKind,
    sourceRecordId: input.localized.identity.sourceRecordId,
    locale: input.localized.targetLanguage,
    semanticNodeCount: coverage.semanticNodeCount,
    localizedNodeCount: coverage.localizedNodeCount,
    canonicalFallbackNodeCount: coverage.canonicalFallbackNodeCount,
    protectedNodeCount: coverage.protectedNodeCount,
    translationState: coverage.status,
    fallbackPaths: coverage.canonicalFallbackPaths,
  };
}

export function aggregateHomeCountryDiagnostics(
  rows: readonly HomeCountryPresentationDiagnosticRow[],
): HomeCountryDiagnosticAggregate {
  let homeMap = 0;
  let homeFallback = 0;
  let countryMedia = 0;
  let countryFallback = 0;
  for (const row of rows) {
    if (row.surface === "HOME_MAP") {
      homeMap += 1;
      homeFallback += row.canonicalFallbackNodeCount;
    } else {
      countryMedia += 1;
      countryFallback += row.canonicalFallbackNodeCount;
    }
  }
  return {
    HOME_MAP_PRESENTATIONS: homeMap,
    HOME_MAP_CANONICAL_FALLBACK_NODES: homeFallback,
    COUNTRY_MEDIA_PRESENTATIONS: countryMedia,
    COUNTRY_MEDIA_CANONICAL_FALLBACK_NODES: countryFallback,
    rows,
  };
}

/** Emit machine-readable counter lines (no prose). */
export function formatHomeCountryDiagnosticCounters(
  aggregate: HomeCountryDiagnosticAggregate,
): string {
  const lines = [
    `HOME_MAP_PRESENTATIONS=${aggregate.HOME_MAP_PRESENTATIONS}`,
    `HOME_MAP_CANONICAL_FALLBACK_NODES=${aggregate.HOME_MAP_CANONICAL_FALLBACK_NODES}`,
    `COUNTRY_MEDIA_PRESENTATIONS=${aggregate.COUNTRY_MEDIA_PRESENTATIONS}`,
    `COUNTRY_MEDIA_CANONICAL_FALLBACK_NODES=${aggregate.COUNTRY_MEDIA_CANONICAL_FALLBACK_NODES}`,
  ];
  for (const row of aggregate.rows) {
    lines.push(
      [
        `surface=${row.surface}`,
        `locale=${row.locale}`,
        `semanticNodeCount=${row.semanticNodeCount}`,
        `localizedNodeCount=${row.localizedNodeCount}`,
        `canonicalFallbackNodeCount=${row.canonicalFallbackNodeCount}`,
        `protectedNodeCount=${row.protectedNodeCount}`,
        `translationState=${row.translationState}`,
        `fallbackPaths=${row.fallbackPaths.join(",")}`,
      ].join(" "),
    );
  }
  return lines.join("\n");
}
