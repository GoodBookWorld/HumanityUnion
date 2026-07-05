import type { Initiative, InitiativeLifecyclePhase } from "@hu/types";

export const INITIATIVE_LIFECYCLE_PHASE_LABELS: Record<InitiativeLifecyclePhase, string> = {
  draft: "Draft",
  published: "Published",
  projected: "Projected",
  archived: "Archived",
};

export const INITIATIVE_TIMELINE_EVENT_LABELS: Record<string, string> = {
  initiative_created: "Created",
  initiative_draft_saved: "Draft saved",
  initiative_published: "Published",
  initiative_projected: "Projected",
  initiative_updated: "Updated",
  initiative_republished: "Republished",
  initiative_archived: "Archived",
};

export const MY_INITIATIVE_SECTIONS: readonly {
  id: InitiativeLifecyclePhase;
  title: string;
}[] = [
  { id: "draft", title: "My Drafts" },
  { id: "published", title: "My Published" },
  { id: "projected", title: "My Projected" },
  { id: "archived", title: "My Archived" },
];

export function groupInitiativesByLifecyclePhase(
  initiatives: Initiative[],
): Record<InitiativeLifecyclePhase, Initiative[]> {
  return {
    draft: initiatives.filter((initiative) => initiative.lifecyclePhase === "draft"),
    published: initiatives.filter((initiative) => initiative.lifecyclePhase === "published"),
    projected: initiatives.filter((initiative) => initiative.lifecyclePhase === "projected"),
    archived: initiatives.filter((initiative) => initiative.lifecyclePhase === "archived"),
  };
}

export function formatInitiativeDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatTimelineEventLabel(eventType: string): string {
  return INITIATIVE_TIMELINE_EVENT_LABELS[eventType] ?? eventType;
}
