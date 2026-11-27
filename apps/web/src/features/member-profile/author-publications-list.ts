export const AUTHOR_PUBLICATION_PAGE_SIZE = 10;
/** Matches PUBLIC_AUTHOR_PUBLICATION_MAX_OFFSET. A larger offset is rejected by the API. */
export const AUTHOR_PUBLICATION_MAX_OFFSET = 2000;

export function canRequestAuthorPublicationOffset(offset: number): boolean {
  return Number.isInteger(offset) && offset >= 0 && offset <= AUTHOR_PUBLICATION_MAX_OFFSET;
}

/** Null means the list should use its content height (one or two cards). */
export function authorPublicationScrollMaxPx(
  heights: readonly number[],
  count: number,
): number | null {
  if (count < 3 || heights.length < 2) {
    return null;
  }
  const tallest = Math.max(heights[0] ?? 0, heights[1] ?? 0);
  if (!Number.isFinite(tallest) || tallest <= 0) {
    return null;
  }
  return Math.ceil(tallest * 2.5);
}

export function shouldLoadMoreAuthorPublications(input: {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
  hasMore: boolean;
  pending: boolean;
  distancePx?: number;
}): boolean {
  if (!input.hasMore || input.pending) {
    return false;
  }
  const distance = input.distancePx ?? 48;
  return input.scrollTop + input.clientHeight >= input.scrollHeight - distance;
}

export function mergeAuthorPublicationCards<T extends { postId: string }>(
  current: readonly T[],
  incoming: readonly T[],
): T[] {
  const seen = new Set(current.map((item) => item.postId));
  const next = [...current];
  for (const item of incoming) {
    if (seen.has(item.postId)) {
      continue;
    }
    seen.add(item.postId);
    next.push(item);
  }
  return next;
}
