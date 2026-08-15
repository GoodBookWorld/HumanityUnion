/**
 * Pure, framework-free navigation math for horizontal rails
 * (`useHorizontalRail`). Extracted so the "how many cards are visible" and
 * "can the rail scroll further" arrow-state logic — the state React renders
 * previous/next button `disabled` from — can be exercised directly with
 * Node's built-in test runner, without needing a DOM or React renderer.
 *
 * Arrow enabled/disabled state must always be derived from plain values
 * (item count, breakpoint-derived visible count, current start index), never
 * read from `ref.current` during render.
 */
import type { HorizontalRailLayout } from "./horizontal-section.types";

export function getDefaultVisibleCount(layout: HorizontalRailLayout): number {
  if (layout === "four-two-one" || layout === "four-three-one") {
    return 4;
  }

  return 3;
}

export interface ViewportBreakpoints {
  isMobile: boolean;
  isTablet: boolean;
}

/** Resolves how many cards are visible for a layout at a given breakpoint. Pure — no `window` access. */
export function resolveVisibleCountForBreakpoints(
  layout: HorizontalRailLayout,
  { isMobile, isTablet }: ViewportBreakpoints,
): number {
  if (isMobile) {
    return 1;
  }

  if (isTablet) {
    return layout === "four-three-one" ? 3 : 2;
  }

  return getDefaultVisibleCount(layout);
}

export interface RailNavigationState {
  maxStart: number;
  allItemsVisible: boolean;
  canScrollPrevious: boolean;
  canScrollNext: boolean;
  visibleEnd: number;
}

/**
 * Derives every value the rail's arrow buttons and "Showing X-Y of Z" summary
 * need, purely from item count, visible count, and the current start index.
 */
export function computeRailNavigationState(
  itemCount: number,
  visibleCount: number,
  startIndex: number,
): RailNavigationState {
  const maxStart = Math.max(0, itemCount - visibleCount);
  const allItemsVisible = itemCount <= visibleCount;
  const clampedStartIndex = Math.max(0, Math.min(maxStart, startIndex));

  return {
    maxStart,
    allItemsVisible,
    canScrollPrevious: clampedStartIndex > 0,
    canScrollNext: clampedStartIndex < maxStart,
    visibleEnd: Math.min(clampedStartIndex + visibleCount, itemCount),
  };
}
