export function isFeedbackFullyInViewport(
  rect: Pick<DOMRect, "top" | "right" | "bottom" | "left">,
  viewport: { width: number; height: number },
): boolean {
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= viewport.height &&
    rect.right <= viewport.width
  );
}

/**
 * Scrolls a contextual feedback node into view only when it is outside or
 * partially outside the viewport. Does not move focus. Uses an instant
 * scroll when the user prefers reduced motion.
 */
export function revealContextualFeedback(element: HTMLElement | null): boolean {
  if (!element || typeof window === "undefined") {
    return false;
  }

  const rect = element.getBoundingClientRect();
  const viewport = {
    width: window.innerWidth || document.documentElement?.clientWidth || 0,
    height: window.innerHeight || document.documentElement?.clientHeight || 0,
  };

  if (isFeedbackFullyInViewport(rect, viewport)) {
    return false;
  }

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  element.scrollIntoView({
    block: "nearest",
    inline: "nearest",
    behavior: reduceMotion ? "auto" : "smooth",
  });
  return true;
}

let queuedReveal: HTMLElement | null = null;
let revealFlushScheduled = false;

/**
 * When several independent action results appear in the same turn, only the
 * latest one asks the viewport to move. A single result still reveals.
 */
export function queueContextualFeedbackReveal(element: HTMLElement | null): void {
  if (!element) {
    return;
  }
  queuedReveal = element;
  if (revealFlushScheduled) {
    return;
  }
  revealFlushScheduled = true;
  queueMicrotask(() => {
    revealFlushScheduled = false;
    const target = queuedReveal;
    queuedReveal = null;
    revealContextualFeedback(target);
  });
}
