/**
 * Pack 08I.9 — which lifecycle sourceKinds use warm content_translations
 * on record cards (presentation matrix helper; no React).
 */

import { CIVIC_TRANSLATION_FIELD_META } from "../language/civic-translation-field-meta";

const TITLE_SUMMARY_KINDS = new Set<string>([
  "collaborative_analysis",
  "petition",
  "implementation_commitment",
  "public_impact",
  "civic_archive",
  "decision_session",
  "collective_decision",
]);

const PUBLIC_TRANSLATED_TITLE_SUMMARY_KINDS = new Set<string>([
  "collaborative_analysis",
  "petition",
]);

function isCivicWarmKind(value: string | undefined): boolean {
  return Boolean(value && value in CIVIC_TRANSLATION_FIELD_META);
}

export function lifecycleRecordUsesWarmTranslation(
  sourceKind: string | undefined,
): boolean {
  if (!sourceKind) {
    return false;
  }
  if (sourceKind === "initiative") {
    return true;
  }
  if (PUBLIC_TRANSLATED_TITLE_SUMMARY_KINDS.has(sourceKind)) {
    return true;
  }
  if (sourceKind === "initiative_revision") {
    return true;
  }
  if (sourceKind === "official_response" || sourceKind === "improvement_proposal") {
    return true;
  }
  if (sourceKind === "implementation_tracking") {
    return true;
  }
  return TITLE_SUMMARY_KINDS.has(sourceKind) && isCivicWarmKind(sourceKind);
}

export const LIFECYCLE_PUBLIC_WARM_SOURCE_KINDS = [
  "initiative",
  "collaborative_analysis",
  "petition",
  "initiative_revision",
  "decision_session",
  "collective_decision",
  "implementation_commitment",
  "implementation_tracking",
  "official_response",
  "improvement_proposal",
  "public_impact",
  "civic_archive",
] as const;
