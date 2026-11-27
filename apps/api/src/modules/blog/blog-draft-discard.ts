import type { BlogEditorialHistoryAction, BlogPost } from "@hu/types";

/**
 * History that proves a post was public, corrected, or archived.
 * A missing publishedVersion is not treated as zero; callers must compare with !== 0.
 */
export const DRAFT_DISCARD_BLOCKING_HISTORY: readonly BlogEditorialHistoryAction[] = [
  "correction_started",
  "approved_published",
  "published_after_safety_review",
  "archived",
];

export function isNeverPublishedDraftEligible(
  post: Pick<
    BlogPost,
    | "status"
    | "publishedVersion"
    | "administrativelyBlocked"
    | "editorialHistory"
    | "externalCover"
    | "externalVideo"
  >,
): boolean {
  if (post.status !== "draft") {
    return false;
  }
  if (post.publishedVersion !== 0) {
    return false;
  }
  if (post.administrativelyBlocked === true) {
    return false;
  }
  if (post.externalCover?.source === "integrity-media" || post.externalVideo?.source === "integrity-media") {
    return false;
  }
  return !(post.editorialHistory ?? []).some((entry) =>
    DRAFT_DISCARD_BLOCKING_HISTORY.includes(entry.action),
  );
}

export function isIntegrityLinkedBlogPost(
  post: Pick<BlogPost, "externalCover" | "externalVideo">,
): boolean {
  return post.externalCover?.source === "integrity-media" || post.externalVideo?.source === "integrity-media";
}
