/**
 * Version 5.0 — Civic Media fact-check / propaganda ordinary presentation selection.
 *
 * PLP fields (mission, coverage, focus, explanation) already exist.
 * Normal Web: canonical only (browser-native).
 * Installed PWA / hu-persisted: apply existing PLP maps with per-artifact
 * canonical fallback. No provider-on-read.
 */

import type { FactCheckResource, PropagandaAnalysisResource } from "@hu/types";

import { coverageToChips } from "../../civic-media-center/civic-media-card-utils";
import type { OrdinaryReadingOwner } from "../ordinary-reading-ownership";

export type CivicMediaResourcePlpMode = "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK";

export function selectCivicMediaFactCheckOrdinaryPresentation(input: {
  readonly owner: OrdinaryReadingOwner;
  readonly resource: Pick<FactCheckResource, "id" | "mission" | "coverage">;
  readonly missionsById?: Readonly<Record<string, string>>;
  readonly coverageById?: Readonly<Record<string, string>>;
  readonly resolvedMode?: CivicMediaResourcePlpMode;
  readonly resolvedReasonCode?: string;
  /** True when Media PLP batch maps are present for this page. */
  readonly plpBatchActive: boolean;
}): {
  readonly mission: string;
  readonly coverage: string;
  readonly chips: readonly string[];
  readonly plpMode: CivicMediaResourcePlpMode | undefined;
  readonly fallbackReason: string | undefined;
} {
  const usePersisted = input.owner === "hu-persisted" && input.plpBatchActive;

  const mission = usePersisted
    ? (input.missionsById?.[input.resource.id] ?? input.resource.mission)
    : input.resource.mission;
  const coverage = usePersisted
    ? (input.coverageById?.[input.resource.id] ?? input.resource.coverage)
    : input.resource.coverage;

  const plpMode = input.plpBatchActive
    ? usePersisted
      ? (input.resolvedMode ?? "CANONICAL_FALLBACK")
      : "CANONICAL_FALLBACK"
    : undefined;

  const fallbackReason = input.plpBatchActive
    ? input.resolvedReasonCode ??
      (input.resolvedMode !== "PUBLISHED_LOCALIZED" ? "NO_PUBLISHED_SNAPSHOT" : undefined)
    : undefined;

  return {
    mission,
    coverage,
    chips: coverageToChips(coverage),
    plpMode,
    fallbackReason,
  };
}

export function selectCivicMediaPropagandaOrdinaryPresentation(input: {
  readonly owner: OrdinaryReadingOwner;
  readonly resource: Pick<PropagandaAnalysisResource, "id" | "focus" | "explanation">;
  readonly focusById?: Readonly<Record<string, string>>;
  readonly explanationsById?: Readonly<Record<string, string>>;
  readonly resolvedMode?: CivicMediaResourcePlpMode;
  readonly resolvedReasonCode?: string;
  readonly plpBatchActive: boolean;
}): {
  readonly focus: string;
  readonly explanation: string;
  readonly plpMode: CivicMediaResourcePlpMode | undefined;
  readonly fallbackReason: string | undefined;
} {
  const usePersisted = input.owner === "hu-persisted" && input.plpBatchActive;

  const focus = usePersisted
    ? (input.focusById?.[input.resource.id] ?? input.resource.focus)
    : input.resource.focus;
  const explanation = usePersisted
    ? (input.explanationsById?.[input.resource.id] ?? input.resource.explanation)
    : input.resource.explanation;

  const plpMode = input.plpBatchActive
    ? usePersisted
      ? (input.resolvedMode ?? "CANONICAL_FALLBACK")
      : "CANONICAL_FALLBACK"
    : undefined;

  const fallbackReason = input.plpBatchActive
    ? input.resolvedReasonCode ??
      (input.resolvedMode !== "PUBLISHED_LOCALIZED" ? "NO_PUBLISHED_SNAPSHOT" : undefined)
    : undefined;

  return {
    focus,
    explanation,
    plpMode,
    fallbackReason,
  };
}
