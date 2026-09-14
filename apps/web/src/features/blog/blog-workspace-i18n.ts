/**
 * Shared Blog workspace presentation helpers — semantic codes → WEB_UI.
 * Display-only; does not mutate API/domain values.
 */

import type { BlogAuthorWorkspacePostSummary, BlogEditorialReviewDetail } from "@hu/types";

export type BlogWorkspaceTranslator = {
  (key: string, values?: Record<string, string | number | Date>): string;
  has?: (key: string) => boolean;
};

export function resolvePublishingListStatusLabel(
  post: BlogAuthorWorkspacePostSummary,
  t: BlogWorkspaceTranslator,
): string {
  if (post.status === "draft" && post.review.reviewStatus === "changes_requested") {
    return t("status.changes_requested");
  }
  if (post.status === "draft" && post.review.reviewStatus === "declined") {
    return t("status.declined");
  }
  return t(`status.${post.status}`);
}

export function resolveEditorialPublicationStatusLabel(
  status: BlogEditorialReviewDetail["status"],
  reviewStatus: BlogEditorialReviewDetail["review"]["reviewStatus"],
  t: BlogWorkspaceTranslator,
): string {
  if (status === "draft" && reviewStatus === "changes_requested") {
    return t("publicationStatuses.draft_changes_requested");
  }
  if (status === "draft" && reviewStatus === "declined") {
    return t("publicationStatuses.draft_declined");
  }
  return t(`publicationStatuses.${status}`);
}

export function resolveEditorialReviewStatusLabel(
  reviewStatus: BlogEditorialReviewDetail["review"]["reviewStatus"],
  t: BlogWorkspaceTranslator,
): string {
  return t(`reviewStatuses.${reviewStatus}`);
}

export function resolveEditorialSafetyOutcomeLabel(
  outcome: string | null | undefined,
  t: BlogWorkspaceTranslator,
): string {
  if (!outcome) {
    return t("safetyNotEvaluated");
  }
  const key = `safetyOutcomes.${outcome}`;
  if (t.has && !t.has(key)) {
    return outcome;
  }
  return t(key);
}

export function resolveEditorialHistoryActionLabel(
  action: string,
  t: BlogWorkspaceTranslator,
): string {
  const key = `historyActions.${action}`;
  if (t.has && !t.has(key)) {
    return action;
  }
  return t(key);
}
