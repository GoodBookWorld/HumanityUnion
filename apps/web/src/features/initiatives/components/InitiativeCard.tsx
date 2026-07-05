import type { Initiative } from "@hu/types";

import { INITIATIVE_COMMUNITY_OPTIONS } from "../api";
import {
  INITIATIVE_LIFECYCLE_PHASE_LABELS,
  formatInitiativeDate,
} from "../initiative-lifecycle-labels";

import "./initiative-card.css";

interface InitiativeCardProps {
  initiative: Initiative;
  selected: boolean;
  onSelect: (initiativeId: string) => void;
}

function communityLabel(communitySlug: string): string {
  return (
    INITIATIVE_COMMUNITY_OPTIONS.find((community) => community.slug === communitySlug)?.label ??
    communitySlug
  );
}

export function InitiativeCard({ initiative, selected, onSelect }: InitiativeCardProps) {
  return (
    <button
      type="button"
      className={`initiative-card${selected ? " initiative-card--selected" : ""}`}
      onClick={() => onSelect(initiative.initiativeId)}
      aria-pressed={selected}
    >
      <span className="initiative-card__title">{initiative.title}</span>
      <span className="initiative-card__meta">
        <span>{INITIATIVE_LIFECYCLE_PHASE_LABELS[initiative.lifecyclePhase]}</span>
        <span>{initiative.metadata.activityArea}</span>
        <span>{communityLabel(initiative.metadata.communitySlug)}</span>
      </span>
      <span className="initiative-card__dates">
        <span>Created {formatInitiativeDate(initiative.createdAt)}</span>
        <span>Updated {formatInitiativeDate(initiative.updatedAt)}</span>
      </span>
    </button>
  );
}
