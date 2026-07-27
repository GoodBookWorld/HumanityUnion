"use client";

import type { ReactNode } from "react";

import { MediaRailControls } from "./MediaRailControls";
import { useMediaHorizontalRail, type MediaRailLayout } from "./useMediaHorizontalRail";

import "./media-rail.css";

interface MediaHorizontalRailProps<T> {
  label: string;
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  getItemKey: (item: T, index: number) => string;
  layout?: MediaRailLayout;
  emptyState?: ReactNode;
  hideSummary?: boolean;
  controlsPlacement?: "header" | "inline";
  renderHeaderControls?: (controls: ReactNode) => ReactNode;
}

export function MediaHorizontalRail<T>({
  label,
  items,
  renderItem,
  getItemKey,
  layout = "three-two-one",
  emptyState = null,
  hideSummary = false,
  controlsPlacement = "inline",
  renderHeaderControls,
}: MediaHorizontalRailProps<T>) {
  const rail = useMediaHorizontalRail({
    itemCount: items.length,
    layout,
    label,
  });

  if (items.length === 0) {
    return emptyState;
  }

  const controls =
    items.length > 0 && !rail.allItemsVisible ? (
      <MediaRailControls
        label={label}
        canScrollPrevious={rail.canScrollPrevious}
        canScrollNext={rail.canScrollNext}
        onPrevious={rail.showPrevious}
        onNext={rail.showNext}
      />
    ) : null;

  return (
    <>
      {controlsPlacement === "header" && renderHeaderControls ? renderHeaderControls(controls) : null}

      <div
        className="media-horizontal-rail"
        aria-roledescription="carousel"
        aria-label={label}
        data-visible-count={rail.visibleCount}
        data-layout={layout}
      >
        <p id={rail.instructionsId} className="media-rail__visually-hidden">
          {label}. Use the previous and next buttons, arrow keys, or horizontal scrolling to browse
          additional cards.
        </p>

        <div
          className={`media-horizontal-rail__frame${
            rail.canScrollPrevious ? " media-horizontal-rail__frame--fade-start" : ""
          }${rail.canScrollNext ? " media-horizontal-rail__frame--fade-end" : ""}${
            rail.canScrollNext && !rail.allItemsVisible
              ? " media-horizontal-rail__frame--preview-next"
              : ""
          }`}
        >
          {controlsPlacement === "inline" ? (
            <div className="media-horizontal-rail__controls media-horizontal-rail__controls--start">
              {controls}
            </div>
          ) : null}

          <div
            ref={rail.viewportRef}
            className="media-horizontal-rail__viewport"
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
                className="media-horizontal-rail__slide"
                role="listitem"
                data-horizontal-rail-index={index}
              >
                {renderItem(item, index)}
              </div>
            ))}
          </div>

          {controlsPlacement === "inline" ? (
            <div className="media-horizontal-rail__controls media-horizontal-rail__controls--end">
              {controls}
            </div>
          ) : null}
        </div>

        {!hideSummary && !rail.allItemsVisible ? (
          <p className="media-horizontal-rail__summary" aria-live="polite">
            Showing {rail.startIndex + 1}–{rail.visibleEnd} of {items.length}
          </p>
        ) : null}
      </div>
    </>
  );
}
