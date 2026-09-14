/**
 * Pack 08K.3.1 — /media route localization diagnostic (deterministic counters).
 * Operates on PublicLocalizedPresentation fixtures — no prose, no live Gemini.
 */

import type {
  PublicLocalizedPresentation,
  PublicLocalizedPresentationCoverage,
} from "@hu/types";

export type MediaPresentationDiagnosticRow = {
  readonly sourceKind: string;
  readonly sourceRecordId: string;
  readonly locale: string;
  readonly semanticNodeCount: number;
  readonly localizedNodeCount: number;
  readonly canonicalFallbackNodeCount: number;
  readonly protectedNodeCount: number;
  readonly translationState: PublicLocalizedPresentationCoverage["status"];
};

export type MediaRouteDiagnosticAggregate = {
  readonly MEDIA_PRESENTATIONS: number;
  readonly MEDIA_SEMANTIC_NODES: number;
  readonly MEDIA_LOCALIZED_NODES: number;
  readonly MEDIA_CANONICAL_FALLBACK_NODES: number;
  readonly MEDIA_PRESENTATIONS_WITH_FALLBACK: number;
  readonly rows: readonly MediaPresentationDiagnosticRow[];
};

export function rowFromPublicLocalizedPresentation(
  localized: PublicLocalizedPresentation,
): MediaPresentationDiagnosticRow {
  const coverage = localized.coverage;
  return {
    sourceKind: localized.identity.sourceKind,
    sourceRecordId: localized.identity.sourceRecordId,
    locale: localized.targetLanguage,
    semanticNodeCount: coverage.semanticNodeCount,
    localizedNodeCount: coverage.localizedNodeCount,
    canonicalFallbackNodeCount: coverage.canonicalFallbackNodeCount,
    protectedNodeCount: coverage.protectedNodeCount,
    translationState: coverage.status,
  };
}

export function aggregateMediaRouteDiagnostic(
  presentations: readonly PublicLocalizedPresentation[],
): MediaRouteDiagnosticAggregate {
  const rows = presentations.map(rowFromPublicLocalizedPresentation);
  let semantic = 0;
  let localized = 0;
  let fallback = 0;
  let withFallback = 0;
  for (const row of rows) {
    semantic += row.semanticNodeCount;
    localized += row.localizedNodeCount;
    fallback += row.canonicalFallbackNodeCount;
    if (row.canonicalFallbackNodeCount > 0) {
      withFallback += 1;
    }
  }
  return {
    MEDIA_PRESENTATIONS: rows.length,
    MEDIA_SEMANTIC_NODES: semantic,
    MEDIA_LOCALIZED_NODES: localized,
    MEDIA_CANONICAL_FALLBACK_NODES: fallback,
    MEDIA_PRESENTATIONS_WITH_FALLBACK: withFallback,
    rows,
  };
}

/** Emit machine-readable counter lines (no prose). */
export function formatMediaRouteDiagnosticCounters(
  aggregate: MediaRouteDiagnosticAggregate,
): string {
  const lines = [
    `MEDIA_PRESENTATIONS=${aggregate.MEDIA_PRESENTATIONS}`,
    `MEDIA_SEMANTIC_NODES=${aggregate.MEDIA_SEMANTIC_NODES}`,
    `MEDIA_LOCALIZED_NODES=${aggregate.MEDIA_LOCALIZED_NODES}`,
    `MEDIA_CANONICAL_FALLBACK_NODES=${aggregate.MEDIA_CANONICAL_FALLBACK_NODES}`,
    `MEDIA_PRESENTATIONS_WITH_FALLBACK=${aggregate.MEDIA_PRESENTATIONS_WITH_FALLBACK}`,
  ];
  for (const row of aggregate.rows) {
    lines.push(
      [
        `sourceKind=${row.sourceKind}`,
        `sourceRecordId=${row.sourceRecordId}`,
        `locale=${row.locale}`,
        `semanticNodeCount=${row.semanticNodeCount}`,
        `localizedNodeCount=${row.localizedNodeCount}`,
        `canonicalFallbackNodeCount=${row.canonicalFallbackNodeCount}`,
        `protectedNodeCount=${row.protectedNodeCount}`,
        `translationState=${row.translationState}`,
      ].join(" "),
    );
  }
  return lines.join("\n");
}
