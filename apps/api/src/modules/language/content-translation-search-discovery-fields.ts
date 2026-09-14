/**
 * Step 06C.2A — Search discovery CT field map (sourceKind-driven).
 *
 * Compact Search discovery translates only these fields. Full Extended
 * Localization continues to use the normal CT allowlist / loaded bag.
 *
 * civic_media intentionally omitted: Global Search extractTitleSummary does not
 * yet consume overviewTitle / initiativeFlowTitle field names.
 */

import type { ContentTranslationSourceKind } from "@hu/types";

/**
 * Authoritative discovery field allowlist per CT sourceKind.
 * Absent kinds are unsupported for search_discovery (no silent full translate).
 */
export const CONTENT_TRANSLATION_SEARCH_DISCOVERY_FIELDS = {
  initiative: ["title", "description"],
  collaborative_analysis: ["title", "summary"],
  improvement_proposal: ["title", "summary"],
  initiative_revision: ["title", "description", "revisionSummary"],
  petition: ["title", "summary"],
  decision_session: ["title"],
  collective_decision: ["question", "outcomeSummary"],
  implementation_commitment: ["title", "summary"],
  implementation_tracking: ["summary"],
  official_response: ["subject", "summary"],
  public_impact: ["title", "summary"],
  civic_archive: ["title", "summary"],
  blog_post: ["title", "excerpt"],
} as const satisfies Partial<Record<ContentTranslationSourceKind, readonly string[]>>;

export type SearchDiscoveryMappedSourceKind =
  keyof typeof CONTENT_TRANSLATION_SEARCH_DISCOVERY_FIELDS;

export function isSearchDiscoveryMappedSourceKind(
  sourceKind: ContentTranslationSourceKind,
): sourceKind is SearchDiscoveryMappedSourceKind {
  return Object.prototype.hasOwnProperty.call(
    CONTENT_TRANSLATION_SEARCH_DISCOVERY_FIELDS,
    sourceKind,
  );
}

export function listSearchDiscoveryFieldKeys(
  sourceKind: ContentTranslationSourceKind,
): readonly string[] | null {
  if (!isSearchDiscoveryMappedSourceKind(sourceKind)) {
    return null;
  }
  return CONTENT_TRANSLATION_SEARCH_DISCOVERY_FIELDS[sourceKind];
}

/**
 * Project a loaded/sanitized field bag onto the discovery allowlist.
 * Keys not in the map (or absent/empty on the source) are omitted.
 */
export function projectFieldsToSearchDiscoveryAllowlist(input: {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly fields: Readonly<Record<string, string>>;
}): Record<string, string> | null {
  const keys = listSearchDiscoveryFieldKeys(input.sourceKind);
  if (!keys) {
    return null;
  }
  const out: Record<string, string> = {};
  for (const key of keys) {
    const value = input.fields[key];
    if (typeof value === "string") {
      out[key] = value;
    }
  }
  return out;
}
