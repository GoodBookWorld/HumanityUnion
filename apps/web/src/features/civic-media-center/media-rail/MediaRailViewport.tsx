"use client";

import type { ReactNode } from "react";

import type { HorizontalRailLayout } from "./horizontal-section.types";
import { useHorizontalRail } from "./useMediaHorizontalRail";

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
  if (items.length === 0) {
    return null;
  }

  const visibleScrollHint = resolveScrollHint(showScrollHint && rail.canScrollNext, scrollHint);
  const shouldShowCount = showCount && !hideSummary && !rail.allItemsVisible;

  return (
    <div
      className="horizontal-rail"
      aria-roledescription="carousel"
      aria-label={label}
      data-visible-count={rail.visibleCount}
      data-layout={layout}
    >
      <p id={rail.instructionsId} className="horizontal-rail__visually-hidden">
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
          rail.canScrollPrevious ? "horizontal-rail__frame--fade-start" : "",
          rail.canScrollNext ? "horizontal-rail__frame--fade-end" : "",
          rail.canScrollNext && !rail.allItemsVisible
            ? "horizontal-rail__frame--preview-next"
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div
          ref={rail.viewportRef}
          className={["horizontal-rail__viewport", viewportClassName].filter(Boolean).join(" ")}
          role="list"
          aria-live="polite"
          aria-describedby={rail.instructionsId}
          tabIndex={0}
          onKeyDown={rail.handleKeyDown}
          onScroll={rail.handleScroll}
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
              Showing {rail.startIndex + 1}–{rail.visibleEnd} of {items.length}
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
