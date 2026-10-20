/** Matches the public article page: ignore the edit stamp from the initial publication minute. */
export const BLOG_LAST_EDITED_AFTER_MS = 60_000;

/**
 * Whether the public article page shows the localized "last edited" date.
 * The label is rendered beside the publication date. It is never written into
 * the article HTML.
 */
export function shouldShowBlogLastEdited(
  publishedAt: string | null | undefined,
  updatedAt: string | null | undefined,
): boolean {
  if (!publishedAt || !updatedAt) {
    return false;
  }
  const published = Date.parse(publishedAt);
  const updated = Date.parse(updatedAt);
  if (!Number.isFinite(published) || !Number.isFinite(updated)) {
    return false;
  }
  return updated - published > BLOG_LAST_EDITED_AFTER_MS;
}
