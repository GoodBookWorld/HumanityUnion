/**
 * Community Intelligence Pack 03 — deterministic Related Initiatives presentation.
 *
 * All user-visible strings are built as single interpolations so SSR and the
 * first client render cannot diverge on whitespace text nodes (the Pack 02
 * hydration mismatch surfaced as "theme s" from split JSX text + expression).
 *
 * Pack 02G Task 08C.1 — optional formatters localize display without mutating
 * canonical topic/reason/difference values.
 */

import type { CommunityInitiativeRelationshipProjection } from "@hu/types";

type RelatedTypeKey = "possibleOverlap" | "complementary" | "relatedType";

export function relatedRelationshipLabel(
  type: CommunityInitiativeRelationshipProjection["relationshipType"],
  format?: (key: RelatedTypeKey) => string,
): string {
  const key: RelatedTypeKey =
    type === "possible_duplicate"
      ? "possibleOverlap"
      : type === "complementary"
        ? "complementary"
        : "relatedType";
  if (format) {
    return format(key);
  }
  switch (type) {
    case "possible_duplicate":
      return "Possible overlap";
    case "complementary":
      return "Complementary";
    default:
      return "Related";
  }
}

export function overlappingThemesLabel(
  sharedTopics: readonly string[],
  formatCount?: (count: number) => string,
): string | null {
  const count = sharedTopics.length;
  if (count <= 0) {
    return null;
  }
  if (formatCount) {
    return formatCount(count);
  }
  return count === 1 ? "1 overlapping theme" : `${count} overlapping themes`;
}

export function sharedTopicLabel(
  item: Pick<
    CommunityInitiativeRelationshipProjection,
    "sharedParticipationAreas" | "sharedTopics"
  >,
  format?: (topic: string) => string,
): string | null {
  const topic = item.sharedParticipationAreas[0] ?? item.sharedTopics[0];
  if (!topic) {
    return null;
  }
  return format ? format(topic) : `Shared topic: ${topic}`;
}

export function whyRelevantLabel(
  primaryReason: string | undefined,
  format?: (reason: string) => string,
): string | null {
  if (!primaryReason) {
    return null;
  }
  return format ? format(primaryReason) : `Why this is relevant: ${primaryReason}`;
}

export function keyDifferencesLabel(
  item: CommunityInitiativeRelationshipProjection,
  format?: (differences: string) => string,
): string | null {
  if (item.relationshipType !== "possible_duplicate" || item.keyDifferences.length === 0) {
    return null;
  }
  const differences = item.keyDifferences.slice(0, 2).join("; ");
  return format ? format(differences) : `Key differences: ${differences}`;
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
