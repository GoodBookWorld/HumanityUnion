/**
 * Canonical Discussion comment / Collaboration deep links for the Initiative shell.
 *
 * Format: `/initiatives/public/{initiativeId}#comment-{commentId}`
 * Collaboration: `?filter=collaboration#discussion`
 *
 * Lifecycle Staging Fix 05C — desktop Collaboration/Discussion deep-links are
 * owned by `pie-layout__center` (not the document). Mobile keeps document scroll.
 */

export const DISCUSSION_COMMENT_HASH_PREFIX = "comment-";
export const DISCUSSION_TITLE_DOM_ID = "pie-discussion-title";
export const COLLABORATION_LIST_DOM_ID = "pie-collaboration-list";
export const CENTER_SCROLL_CONTAINER_SELECTOR = ".pie-layout__center";
export const DESKTOP_COLUMN_SCROLL_MIN_WIDTH_PX = 768;

export function buildDiscussionCommentDomId(commentId: string): string {
  return `${DISCUSSION_COMMENT_HASH_PREFIX}${commentId}`;
}

export function buildInitiativeDiscussionCommentHref(
  initiativeId: string,
  commentId: string,
): string {
  return `/initiatives/public/${encodeURIComponent(initiativeId)}#${DISCUSSION_COMMENT_HASH_PREFIX}${encodeURIComponent(commentId)}`;
}

export type DiscussionDeepLinkScrollOwner = "center_pane" | "document";

/**
 * Desktop columns (≥768px) own Discussion positioning inside the center pane.
 * Below that breakpoint the document is the single scroll owner.
 */
export function resolveDiscussionDeepLinkScrollOwner(
  viewportWidth: number = typeof window !== "undefined" ? window.innerWidth : DESKTOP_COLUMN_SCROLL_MIN_WIDTH_PX,
): DiscussionDeepLinkScrollOwner {
  return viewportWidth >= DESKTOP_COLUMN_SCROLL_MIN_WIDTH_PX ? "center_pane" : "document";
}

/**
 * Lifecycle Staging Fix 05C — collaboration notification scroll plan.
 * Desktop: center pane owns scroll (never document). Mobile: document scroll.
 */
export function planCollaborationNotificationScroll(input?: {
  readonly viewportWidth?: number;
}): {
  readonly scrollOwner: DiscussionDeepLinkScrollOwner;
  readonly titleDomId: string;
  readonly listDomId: string;
  readonly containerSelector: string;
  readonly titleBlock: "start";
  readonly listBlock: "nearest";
} {
  return {
    scrollOwner: resolveDiscussionDeepLinkScrollOwner(input?.viewportWidth),
    titleDomId: DISCUSSION_TITLE_DOM_ID,
    listDomId: COLLABORATION_LIST_DOM_ID,
    containerSelector: CENTER_SCROLL_CONTAINER_SELECTOR,
    titleBlock: "start",
    listBlock: "nearest",
  };
}

function readScrollPaddingTop(container: HTMLElement): number {
  const raw = getComputedStyle(container).scrollPaddingTop;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Scroll `target` inside `container` only — does not move the document.
 */
export function scrollElementWithinContainer(
  container: HTMLElement,
  target: HTMLElement,
  block: "start" | "nearest" | "center" = "start",
): void {
  const paddingTop = readScrollPaddingTop(container);
  const targetOffset =
    target.getBoundingClientRect().top -
    container.getBoundingClientRect().top +
    container.scrollTop;

  if (block === "nearest") {
    const viewTop = container.scrollTop + paddingTop;
    const viewBottom = container.scrollTop + container.clientHeight;
    const targetTop = targetOffset;
    const targetBottom = targetOffset + target.offsetHeight;
    if (targetTop >= viewTop && targetBottom <= viewBottom) {
      return;
    }
    if (targetTop < viewTop) {
      container.scrollTo({ top: Math.max(0, targetTop - paddingTop), behavior: "smooth" });
      return;
    }
    container.scrollTo({
      top: Math.max(0, targetBottom - container.clientHeight),
      behavior: "smooth",
    });
    return;
  }

  if (block === "center") {
    const top = targetOffset - container.clientHeight / 2 + target.offsetHeight / 2;
    container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    return;
  }

  container.scrollTo({ top: Math.max(0, targetOffset - paddingTop), behavior: "smooth" });
}

export function resolveCenterScrollContainer(from: Element | null): HTMLElement | null {
  if (from) {
    const closest = from.closest(CENTER_SCROLL_CONTAINER_SELECTOR);
    if (closest instanceof HTMLElement) {
      return closest;
    }
  }
  const fallback = document.querySelector(CENTER_SCROLL_CONTAINER_SELECTOR);
  return fallback instanceof HTMLElement ? fallback : null;
}

/**
 * Apply collaboration notification positioning with a single scroll owner.
 * Desktop scrolls only `pie-layout__center`; mobile uses document scrollIntoView.
 */
export function applyCollaborationNotificationScroll(input?: {
  readonly viewportWidth?: number;
}): boolean {
  const plan = planCollaborationNotificationScroll(input);
  const list = document.getElementById(plan.listDomId);
  if (!list) {
    return false;
  }

  const title =
    document.getElementById(plan.titleDomId) ??
    document.querySelector<HTMLElement>(".pie-discussion__title");

  if (plan.scrollOwner === "center_pane") {
    const container = resolveCenterScrollContainer(list);
    if (!container) {
      return false;
    }
    if (title instanceof HTMLElement) {
      scrollElementWithinContainer(container, title, plan.titleBlock);
    }
    scrollElementWithinContainer(container, list, plan.listBlock);
    return true;
  }

  title?.scrollIntoView({ behavior: "smooth", block: plan.titleBlock });
  list.scrollIntoView({ behavior: "smooth", block: plan.listBlock });
  return true;
}

/**
 * Desktop comment deep-links scroll the center pane; mobile uses document.
 */
export function applyDiscussionCommentDeepLinkScroll(domId: string): boolean {
  const element = document.getElementById(domId);
  if (!element) {
    return false;
  }

  if (resolveDiscussionDeepLinkScrollOwner() === "center_pane") {
    const container = resolveCenterScrollContainer(element);
    if (!container) {
      return false;
    }
    scrollElementWithinContainer(container, element, "center");
    return true;
  }

  element.scrollIntoView({ behavior: "smooth", block: "center" });
  return true;
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
