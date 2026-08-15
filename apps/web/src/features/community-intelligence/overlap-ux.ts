/**
 * Community Intelligence Pack 03 — Initiative creation overlap UX helpers.
 *
 * Pure, framework-free logic so web tests can cover Pack 03 behavior without a
 * React DOM harness (same pattern as discussion-comment-presentation).
 */

import type { CommunityInitiativeRelationshipProjection } from "@hu/types";

/** Match API related/result bound — do not grow into a feed. */
export const COMMUNITY_INTELLIGENCE_OVERLAP_NOTICE_MAX_ITEMS = 5;

export const OVERLAP_NOTICE_INTRO =
  "You can review similar work before continuing. This does not prevent you from creating your Initiative.";

export const OVERLAP_CHECK_UNAVAILABLE_MESSAGE =
  "Related Initiative check is temporarily unavailable.";

export type SimilarityDraftFingerprintInput = {
  readonly title: string;
  readonly description: string;
  readonly activityArea: string;
  readonly activityAreaOther?: string;
  readonly countryCode?: string;
  readonly regionCode?: string;
  readonly communityCode?: string;
  readonly participationScope?: string;
  readonly excludeInitiativeId?: string | null;
};

/**
 * Stable fingerprint of the fields that feed similarity-check.
 * Used so Continue creating does not re-nag for an unchanged draft.
 */
export function buildSimilarityDraftFingerprint(input: SimilarityDraftFingerprintInput): string {
  return JSON.stringify({
    title: input.title.trim(),
    description: input.description.trim(),
    activityArea: input.activityArea.trim(),
    activityAreaOther: (input.activityAreaOther ?? "").trim(),
    countryCode: (input.countryCode ?? "").trim(),
    regionCode: (input.regionCode ?? "").trim(),
    communityCode: (input.communityCode ?? "").trim(),
    participationScope: (input.participationScope ?? "").trim(),
    excludeInitiativeId: input.excludeInitiativeId ?? "",
  });
}

export function shouldSkipSimilarityCheck(input: {
  readonly acknowledgeOverlap: boolean;
  readonly overlapAcknowledged: boolean;
  readonly currentFingerprint: string;
  readonly acknowledgedFingerprint: string | null;
}): boolean {
  if (input.acknowledgeOverlap) {
    return true;
  }
  if (!input.overlapAcknowledged || !input.acknowledgedFingerprint) {
    return false;
  }
  return input.currentFingerprint === input.acknowledgedFingerprint;
}

export function boundOverlapNoticeItems(
  items: readonly CommunityInitiativeRelationshipProjection[],
  maxItems: number = COMMUNITY_INTELLIGENCE_OVERLAP_NOTICE_MAX_ITEMS,
): CommunityInitiativeRelationshipProjection[] {
  return items.slice(0, Math.max(0, maxItems));
}

export function relationshipTypeLabel(
  type: CommunityInitiativeRelationshipProjection["relationshipType"],
): string {
  switch (type) {
    case "possible_duplicate":
      return "Possible overlap";
    case "complementary":
      return "Complementary work";
    default:
      return "Related Initiative";
  }
}

/**
 * Consider collaboration — opens the related public Initiative collaboration
 * surface in a new browsing context. Never auto-creates Ally relationships,
 * never auto-sends messages, never merges Initiatives.
 */
export function buildConsiderCollaborationHref(publicUrl: string): string {
  const base = publicUrl.trim() || "/initiatives";
  const hasQuery = base.includes("?");
  const hasHash = base.includes("#");
  const withoutHash = hasHash ? base.slice(0, base.indexOf("#")) : base;
  const collaborationQuery = hasQuery
    ? `${withoutHash}&filter=collaboration`
    : `${withoutHash}?filter=collaboration`;
  return `${collaborationQuery}#discussion`;
}

export const CONSIDER_COLLABORATION_BEHAVIOR = [
  "Opens the related public Initiative Discussion collaboration filter in a new tab.",
  "Author draft on the creation form is preserved (same-tab navigation is avoided).",
  "Does not automatically create an Ally relationship.",
  "Does not automatically send a Direct Message or Collaboration Channel message.",
  "Does not merge, replace, or suppress Initiatives.",
].join(" ");
