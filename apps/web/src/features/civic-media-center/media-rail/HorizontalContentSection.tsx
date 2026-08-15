"use client";

import type { ReactNode } from "react";

import type { HuxExperienceVariant } from "../../horizontal-experience/hux.types";

import { HorizontalSectionShell } from "./CivicMediaSectionShell";
import { HorizontalRailControls } from "./MediaRailControls";
import { HorizontalRailViewport } from "./MediaRailViewport";
import type { HorizontalRailLayout, HorizontalSectionVariant, HorizontalSurfaceStyle } from "./horizontal-section.types";
import { useHorizontalRail } from "./useMediaHorizontalRail";

import "./media-rail.css";

export interface HorizontalContentSectionProps<T> {
  sectionId: string;
  title?: string;
  /** @deprecated Use title */
  heading?: string;
  description?: string;
  eyebrow?: string;
  label: string;
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  getItemKey: (item: T, index: number) => string;
  layout?: HorizontalRailLayout;
  variant?: HorizontalSectionVariant;
  surfaceStyle?: HorizontalSurfaceStyle;
  emptyState?: ReactNode;
  showCount?: boolean;
  hideSummary?: boolean;
  showScrollHint?: boolean;
  className?: string;
  nested?: boolean;
  metadata?: ReactNode;
  headerAction?: ReactNode;
  footerAction?: ReactNode;
  toolbar?: ReactNode;
  childrenBeforeRail?: ReactNode;
  categoryIcon?: ReactNode;
  experience?: HuxExperienceVariant;
  viewportClassName?: string;
}

export function HorizontalContentSection<T>({
  sectionId,
  title,
  heading,
  description,
  eyebrow,
  label,
  items,
  renderItem,
  getItemKey,
  layout = "three-two-one",
  variant = "default",
  surfaceStyle = "elevated",
  emptyState = null,
  showCount = true,
  hideSummary = false,
  showScrollHint = false,
  className,
  nested = false,
  metadata,
  headerAction,
  footerAction,
  toolbar,
  childrenBeforeRail,
  categoryIcon,
  experience,
  viewportClassName,
}: HorizontalContentSectionProps<T>) {
  const resolvedTitle = title ?? heading ?? "";
  const headingId = `${sectionId}-heading`;
  const rail = useHorizontalRail({
    itemCount: items.length,
    layout,
    label,
  });

  const sourceCountLabel =
    items.length > 0 ? `${items.length} source${items.length === 1 ? "" : "s"}` : undefined;

  const controls =
    items.length > 0 && !rail.allItemsVisible ? (
      <HorizontalRailControls
        label={label}
        canScrollPrevious={rail.canScrollPrevious}
        canScrollNext={rail.canScrollNext}
        onPrevious={rail.showPrevious}
        onNext={rail.showNext}
        compact={nested}
      />
    ) : null;

  const resolvedMetadata =
    metadata ??
    (nested && sourceCountLabel ? (
      <span className="horizontal-section-chip">{sourceCountLabel}</span>
    ) : null);

  return (
    <HorizontalSectionShell
      sectionId={sectionId}
      headingId={headingId}
      variant={variant}
      surfaceStyle={nested ? "plain" : surfaceStyle}
      eyebrow={eyebrow}
      heading={resolvedTitle}
      description={description}
      metadata={
        categoryIcon || resolvedMetadata ? (
          <div className="horizontal-section-shell__category-meta">
            {categoryIcon ? (
              <span className="horizontal-section-category-icon" aria-hidden="true">
                {categoryIcon}
              </span>
            ) : null}
            {resolvedMetadata}
          </div>
        ) : null
      }
      headerAction={headerAction}
      controls={controls}
      nested={nested}
      className={[
        experience ? `hux-section hux-section--${experience}` : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      footer={footerAction}
    >
      {childrenBeforeRail}
      {toolbar}

      {items.length === 0 ? (
        emptyState
      ) : (
        <HorizontalRailViewport
          label={label}
          layout={layout}
          items={items}
          renderItem={renderItem}
          getItemKey={getItemKey}
          rail={rail}
          hideSummary={hideSummary}
          showCount={showCount}
          showScrollHint={showScrollHint}
          viewportClassName={viewportClassName}
        />
      )}
    </HorizontalSectionShell>
  );
}

/** @deprecated Use HorizontalContentSection */
export const MediaRailSection = HorizontalContentSection;

export type MediaRailSectionProps<T> = HorizontalContentSectionProps<T> & {
  /** @deprecated Use title */
  heading?: string;
};
