"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { MediaSemanticNode } from "../../language/media-plp/media-semantic-contract";
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
  scrollHint,
  footerAction,
  slideClassName,
  viewportClassName,
}: HorizontalRailViewportProps<T>) {
  const t = useTranslations("civicMediaPublic.rail");
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

  const resolvedScrollHint = scrollHint ?? t("swipeHint");
  const visibleScrollHint =
    showScrollHint &&
    canScrollNext &&
    typeof window !== "undefined" &&
    !window.matchMedia("(min-width: 768px)").matches
      ? resolvedScrollHint
      : null;
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
        <MediaSemanticNode as="span" owner="UI_DICTIONARY" result="LOCALIZED_DICTIONARY">
          {t("instructions", { label })}
        </MediaSemanticNode>
      </p>

      {visibleScrollHint ? (
        <MediaSemanticNode
          as="p"
          className="horizontal-rail__scroll-hint"
          aria-hidden="true"
          owner="UI_DICTIONARY"
          result="LOCALIZED_DICTIONARY"
        >
          {visibleScrollHint}
        </MediaSemanticNode>
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
            <MediaSemanticNode
              as="p"
              className="horizontal-rail__summary"
              aria-live="polite"
              owner="UI_DICTIONARY"
              result="LOCALIZED_DICTIONARY"
            >
              {t("showing", {
                start: startIndex + 1,
                end: visibleEnd,
                total: items.length,
              })}
            </MediaSemanticNode>
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
