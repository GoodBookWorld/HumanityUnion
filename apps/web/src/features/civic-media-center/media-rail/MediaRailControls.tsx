"use client";

import { useTranslations } from "next-intl";

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
  return (
    <div
      className={
        compact ? "horizontal-rail-controls horizontal-rail-controls--compact" : "horizontal-rail-controls"
      }
      aria-label={t("navigation", { label })}
      data-hu-semantic-owner="UI_DICTIONARY"
    >
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
