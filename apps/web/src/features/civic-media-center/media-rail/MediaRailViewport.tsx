"use client";

import type { ReactNode } from "react";

import type { HorizontalRailLayout } from "./horizontal-section.types";
import type { useHorizontalRail } from "./useMediaHorizontalRail";

type HorizontalRailState = ReturnType<typeof useHorizontalRail>;

interface HorizontalRailViewportProps<T> {
  label: string;
  layout: HorizontalRailLayout;
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  getItemKey: (item: T, index: number) => string;
  rail: HorizontalRailState;
  hideSummary?: boolean;
  showCount?: boolean;
  showScrollHint?: boolean;
  scrollHint?: string;
  footerAction?: ReactNode;
  slideClassName?: string;
  viewportClassName?: string;
}

function resolveScrollHint(showScrollHint: boolean, scrollHint: string): string | null {
  if (!showScrollHint || typeof window === "undefined") {
    return null;
  }

  if (window.matchMedia("(min-width: 768px)").matches) {
    return null;
  }

  return scrollHint;
}

export function HorizontalRailViewport<T>({
  label,
  layout,
  items,
  renderItem,
  getItemKey,
  rail,
  hideSummary = false,
  showCount = true,
  showScrollHint = false,
  scrollHint = "Swipe to explore",
  footerAction,
  slideClassName,
  viewportClassName,
}: HorizontalRailViewportProps<T>) {
  const {
    instructionsId,
    viewportRef,
    startIndex,
    visibleCount,
    canScrollPrevious,
    canScrollNext,
    allItemsVisible,
    visibleEnd,
    handleKeyDown,
    handleScroll,
  } = rail;

  if (items.length === 0) {
    return null;
  }

  const visibleScrollHint = resolveScrollHint(showScrollHint && canScrollNext, scrollHint);
  const shouldShowCount = showCount && !hideSummary && !allItemsVisible;

  return (
    <div
      className="horizontal-rail"
      aria-roledescription="carousel"
      aria-label={label}
      data-visible-count={visibleCount}
      data-layout={layout}
    >
      <p id={instructionsId} className="horizontal-rail__visually-hidden">
        {label}. Use the previous and next buttons, arrow keys, or horizontal scrolling to browse
        additional cards.
      </p>

      {visibleScrollHint ? (
        <p className="horizontal-rail__scroll-hint" aria-hidden="true">
          {visibleScrollHint}
        </p>
      ) : null}

      <div
        className={[
          "horizontal-rail__frame",
          canScrollPrevious ? "horizontal-rail__frame--fade-start" : "",
          canScrollNext ? "horizontal-rail__frame--fade-end" : "",
          canScrollNext && !allItemsVisible ? "horizontal-rail__frame--preview-next" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div
          ref={viewportRef}
          className={["horizontal-rail__viewport", viewportClassName].filter(Boolean).join(" ")}
          role="list"
          aria-live="polite"
          aria-describedby={instructionsId}
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
        >
          {items.map((item, index) => (
            <div
              key={getItemKey(item, index)}
              className={["horizontal-rail__slide", slideClassName].filter(Boolean).join(" ")}
              role="listitem"
              data-horizontal-rail-index={index}
            >
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>

      {shouldShowCount || footerAction ? (
        <div className="horizontal-rail__footer">
          {shouldShowCount ? (
            <p className="horizontal-rail__summary" aria-live="polite">
              Showing {startIndex + 1}–{visibleEnd} of {items.length}
            </p>
          ) : null}
          {footerAction ? (
            <div className="horizontal-rail__footer-action">{footerAction}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated Use HorizontalRailViewport */
export const MediaRailViewport = HorizontalRailViewport;

export type MediaRailViewportProps<T> = HorizontalRailViewportProps<T>;
