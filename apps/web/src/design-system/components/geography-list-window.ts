/**
 * Pack 10H1 — lightweight windowed slice for long geography option lists.
 * Avoids mounting every row; no external virtualization library.
 */

export const GEOGRAPHY_LIST_ROW_HEIGHT_PX = 40;
export const GEOGRAPHY_LIST_VIEWPORT_HEIGHT_PX = 280;
export const GEOGRAPHY_LIST_OVERSCAN = 6;
/** Window when option count exceeds this (performance only — never hides options). */
export const GEOGRAPHY_WINDOW_ABOVE = 60;

export interface GeographyWindowSlice {
  startIndex: number;
  endIndex: number;
  offsetY: number;
  totalHeight: number;
}

export function computeGeographyWindowSlice(
  itemCount: number,
  scrollTop: number,
  options?: {
    rowHeight?: number;
    viewportHeight?: number;
    overscan?: number;
  },
): GeographyWindowSlice {
  const rowHeight = options?.rowHeight ?? GEOGRAPHY_LIST_ROW_HEIGHT_PX;
  const viewportHeight = options?.viewportHeight ?? GEOGRAPHY_LIST_VIEWPORT_HEIGHT_PX;
  const overscan = options?.overscan ?? GEOGRAPHY_LIST_OVERSCAN;
  const totalHeight = Math.max(itemCount, 0) * rowHeight;

  if (itemCount <= 0) {
    return { startIndex: 0, endIndex: 0, offsetY: 0, totalHeight: 0 };
  }

  const rawStart = Math.floor(Math.max(scrollTop, 0) / rowHeight) - overscan;
  const startIndex = Math.max(0, rawStart);
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
  const endIndex = Math.min(itemCount, startIndex + visibleCount);

  return {
    startIndex,
    endIndex,
    offsetY: startIndex * rowHeight,
    totalHeight,
  };
}

export function shouldWindowGeographyOptions(optionCount: number): boolean {
  return optionCount > GEOGRAPHY_WINDOW_ABOVE;
}
