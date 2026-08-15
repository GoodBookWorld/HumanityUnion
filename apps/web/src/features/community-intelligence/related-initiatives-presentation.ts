/**
 * Community Intelligence Pack 03 — deterministic Related Initiatives presentation.
 *
 * All user-visible strings are built as single interpolations so SSR and the
 * first client render cannot diverge on whitespace text nodes (the Pack 02
 * hydration mismatch surfaced as "theme s" from split JSX text + expression).
 */

import type { CommunityInitiativeRelationshipProjection } from "@hu/types";

export function relatedRelationshipLabel(
  type: CommunityInitiativeRelationshipProjection["relationshipType"],
): string {
  switch (type) {
    case "possible_duplicate":
      return "Possible overlap";
    case "complementary":
      return "Complementary";
    default:
      return "Related";
  }
}

export function overlappingThemesLabel(sharedTopics: readonly string[]): string | null {
  const count = sharedTopics.length;
  if (count <= 0) {
    return null;
  }
  return count === 1 ? "1 overlapping theme" : `${count} overlapping themes`;
}

export function sharedTopicLabel(
  item: Pick<
    CommunityInitiativeRelationshipProjection,
    "sharedParticipationAreas" | "sharedTopics"
  >,
): string | null {
  const topic = item.sharedParticipationAreas[0] ?? item.sharedTopics[0];
  if (!topic) {
    return null;
  }
  return `Shared topic: ${topic}`;
}

export function whyRelevantLabel(primaryReason: string | undefined): string | null {
  if (!primaryReason) {
    return null;
  }
  return `Why this is relevant: ${primaryReason}`;
}

export function keyDifferencesLabel(item: CommunityInitiativeRelationshipProjection): string | null {
  if (item.relationshipType !== "possible_duplicate" || item.keyDifferences.length === 0) {
    return null;
  }
  return `Key differences: ${item.keyDifferences.slice(0, 2).join("; ")}`;
}

/**
 * Normalize projection fields so missing arrays never produce SSR/client
 * branch divergence inside the widget.
 */
export function normalizeRelatedItem(
  item: CommunityInitiativeRelationshipProjection,
): CommunityInitiativeRelationshipProjection {
  return {
    ...item,
    reasons: item.reasons ?? [],
    sharedTopics: item.sharedTopics ?? [],
    sharedParticipationAreas: item.sharedParticipationAreas ?? [],
    sharedPriorities: item.sharedPriorities ?? [],
    keyDifferences: item.keyDifferences ?? [],
  };
}
