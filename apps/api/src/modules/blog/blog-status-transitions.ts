import type { BlogPostStatus } from "@hu/types";

/**
 * Canonical server-side Blog status transition table.
 * Clients never invent transitions.
 */
const ALLOWED: ReadonlyMap<BlogPostStatus, ReadonlySet<BlogPostStatus>> = new Map<
  BlogPostStatus,
  ReadonlySet<BlogPostStatus>
>([
  ["draft", new Set<BlogPostStatus>(["submitted_for_review", "published", "scheduled"])],
  [
    "submitted_for_review",
    new Set<BlogPostStatus>(["draft", "published", "scheduled"]),
  ],
  ["scheduled", new Set<BlogPostStatus>(["draft", "published", "archived"])],
  /**
   * Pack 16A — Author correction: return published → draft so unreviewed
   * replacement content is never public. Trusted Authors update in-place instead.
   */
  ["published", new Set<BlogPostStatus>(["archived", "draft"])],
  ["archived", new Set<BlogPostStatus>(["published"])],
]);

export function canTransitionBlogStatus(
  from: BlogPostStatus,
  to: BlogPostStatus,
): boolean {
  if (from === to) {
    return false;
  }

  return ALLOWED.get(from)?.has(to) ?? false;
}

export function assertBlogStatusTransition(
  from: BlogPostStatus,
  to: BlogPostStatus,
): void {
  if (!canTransitionBlogStatus(from, to)) {
    throw new Error(`Invalid Blog status transition: ${from} → ${to}.`);
  }
}
