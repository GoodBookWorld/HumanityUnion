"use client";

import { useTranslations } from "next-intl";

import { MediaSemanticNode } from "../../language/media-plp/media-semantic-contract";

interface HorizontalRailControlsProps {
  label: string;
  canScrollPrevious: boolean;
  canScrollNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  compact?: boolean;
}

export function HorizontalRailControls({
  label,
  canScrollPrevious,
  canScrollNext,
  onPrevious,
  onNext,
  compact = false,
}: HorizontalRailControlsProps) {
  const t = useTranslations("civicMediaPublic.rail");
  const navigationLabel = t("navigation", { label });
  return (
    <div
      className={
        compact ? "horizontal-rail-controls horizontal-rail-controls--compact" : "horizontal-rail-controls"
      }
      aria-label={navigationLabel}
    >
      <MediaSemanticNode
        as="span"
        className="hu-visually-hidden"
        owner="UI_DICTIONARY"
        result="LOCALIZED_DICTIONARY"
        aria-hidden="true"
      >
        {navigationLabel}
      </MediaSemanticNode>
      <button
        type="button"
        className="horizontal-rail-controls__button horizontal-rail-controls__button--previous"
        aria-label={t("previous", { label })}
        title={t("previous", { label })}
        disabled={!canScrollPrevious}
        onClick={onPrevious}
      >
        <span aria-hidden="true">←</span>
      </button>
      <button
        type="button"
        className="horizontal-rail-controls__button horizontal-rail-controls__button--next"
        aria-label={t("next", { label })}
        title={t("next", { label })}
        disabled={!canScrollNext}
        onClick={onNext}
      >
        <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}

/** @deprecated Use HorizontalRailControls */
export const MediaRailControls = HorizontalRailControls;

export type MediaRailControlsProps = HorizontalRailControlsProps;
