/**
 * Pack 20A — horizontal Admin nav scroll helpers (DOM-safe; no document scroll).
 */

/**
 * Compute horizontal scrollLeft so `item` is centered in `scroller` when possible,
 * clamped to valid scroll bounds.
 */
export function computeAdminPanelNavCenteredScrollLeft(input: {
  scrollerScrollLeft: number;
  scrollerClientWidth: number;
  scrollerScrollWidth: number;
  itemLeftInViewport: number;
  scrollerLeftInViewport: number;
  itemWidth: number;
}): number {
  const itemCenterInScroller =
    input.itemLeftInViewport -
    input.scrollerLeftInViewport +
    input.scrollerScrollLeft +
    input.itemWidth / 2;
  const target = itemCenterInScroller - input.scrollerClientWidth / 2;
  const maxScroll = Math.max(0, input.scrollerScrollWidth - input.scrollerClientWidth);
  return Math.min(maxScroll, Math.max(0, target));
}

/**
 * Scroll only the horizontal Admin nav scroller (not the document).
 */
export function scrollAdminPanelNavItemIntoView(
  scroller: HTMLElement | null,
  item: HTMLElement | null,
): void {
  if (!scroller || !item) {
    return;
  }

  const scrollerRect = scroller.getBoundingClientRect();
  const itemRect = item.getBoundingClientRect();
  scroller.scrollLeft = computeAdminPanelNavCenteredScrollLeft({
    scrollerScrollLeft: scroller.scrollLeft,
    scrollerClientWidth: scroller.clientWidth,
    scrollerScrollWidth: scroller.scrollWidth,
    itemLeftInViewport: itemRect.left,
    scrollerLeftInViewport: scrollerRect.left,
    itemWidth: itemRect.width,
  });
}
