/**
 * Canonical Discussion comment deep links for the Initiative experience shell.
 *
 * Format: `/initiatives/public/{initiativeId}#comment-{commentId}`
 * - Opens the Center Discussion tab (same surface as `#discussion`)
 * - DOM id matches the hash fragment so reload / direct open can scroll
 * - Does not invent a second Discussion route
 */

export const DISCUSSION_COMMENT_HASH_PREFIX = "comment-";

export function buildDiscussionCommentDomId(commentId: string): string {
  return `${DISCUSSION_COMMENT_HASH_PREFIX}${commentId}`;
}

export function buildInitiativeDiscussionCommentHref(
  initiativeId: string,
  commentId: string,
): string {
  return `/initiatives/public/${encodeURIComponent(initiativeId)}#${DISCUSSION_COMMENT_HASH_PREFIX}${encodeURIComponent(commentId)}`;
}

/**
 * Extract a comment focus target from a location hash.
 * Accepts `#comment-{id}` (canonical) and ignores unrelated hashes.
 */
export function parseDiscussionCommentFocusFromHash(hash: string): string | null {
  const normalized = hash.replace(/^#/, "").trim();
  if (!normalized.toLowerCase().startsWith(DISCUSSION_COMMENT_HASH_PREFIX)) {
    return null;
  }

  const rawId = normalized.slice(DISCUSSION_COMMENT_HASH_PREFIX.length);
  if (!rawId) {
    return null;
  }

  try {
    return decodeURIComponent(rawId);
  } catch {
    return rawId;
  }
}

/**
 * Whether the focused comment is present among currently rendered ids.
 * Unrelated comments are never treated as the focus target.
 */
export function resolveDiscussionCommentFocusTarget(
  renderedCommentIds: readonly string[],
  focusCommentId: string | null | undefined,
): string | null {
  if (!focusCommentId) {
    return null;
  }

  return renderedCommentIds.includes(focusCommentId) ? focusCommentId : null;
}

export type DiscussionCommentDeepLinkPlan =
  | { action: "noop" }
  | { action: "reset_filter_all" }
  | { action: "scroll"; commentId: string; domId: string }
  | { action: "load_more" }
  | { action: "absent" };

/**
 * Data-driven deep-link plan — waits for the target to be rendered (or
 * pages to load), never uses fixed timeouts.
 */
export function planDiscussionCommentDeepLinkScroll(input: {
  focusCommentId: string | null | undefined;
  filter: string;
  renderedCommentIds: readonly string[];
  hasMore: boolean;
  loadingMore: boolean;
  alreadyScrolledFor: string | null;
}): DiscussionCommentDeepLinkPlan {
  const { focusCommentId, filter, renderedCommentIds, hasMore, loadingMore, alreadyScrolledFor } =
    input;

  if (!focusCommentId) {
    return { action: "noop" };
  }

  if (filter !== "all") {
    return { action: "reset_filter_all" };
  }

  if (alreadyScrolledFor === focusCommentId) {
    return { action: "noop" };
  }

  const matched = resolveDiscussionCommentFocusTarget(renderedCommentIds, focusCommentId);
  if (matched) {
    return {
      action: "scroll",
      commentId: matched,
      domId: buildDiscussionCommentDomId(matched),
    };
  }

  if (hasMore && !loadingMore) {
    return { action: "load_more" };
  }

  if (loadingMore || hasMore) {
    return { action: "noop" };
  }

  return { action: "absent" };
}
