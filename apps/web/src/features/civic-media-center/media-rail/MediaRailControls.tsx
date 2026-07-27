"use client";

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
  return (
    <div
      className={
        compact ? "horizontal-rail-controls horizontal-rail-controls--compact" : "horizontal-rail-controls"
      }
      aria-label={`${label} navigation`}
    >
      <button
        type="button"
        className="horizontal-rail-controls__button horizontal-rail-controls__button--previous"
        aria-label={`Previous ${label}`}
        title={`Previous ${label}`}
        disabled={!canScrollPrevious}
        onClick={onPrevious}
      >
        <span aria-hidden="true">←</span>
      </button>
      <button
        type="button"
        className="horizontal-rail-controls__button horizontal-rail-controls__button--next"
        aria-label={`Next ${label}`}
        title={`Next ${label}`}
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
