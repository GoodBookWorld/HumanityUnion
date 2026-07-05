/**
 * Civic initiative lifecycle (Capability 02).
 * Draft → Published → Projected, with Archive as terminal state.
 */
export type InitiativeLifecyclePhase = "draft" | "published" | "projected" | "archived";

export const INITIATIVE_LIFECYCLE_PHASE_LABELS: Record<InitiativeLifecyclePhase, string> = {
  draft: "Draft",
  published: "Published",
  projected: "Projected",
  archived: "Archived",
};

export const INITIATIVE_LIFECYCLE_TRANSITIONS: Record<
  InitiativeLifecyclePhase,
  readonly InitiativeLifecyclePhase[]
> = {
  draft: ["published", "archived"],
  published: ["projected", "archived"],
  projected: ["archived"],
  archived: [],
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

export function canTransitionInitiativeLifecycle(
  from: InitiativeLifecyclePhase,
  to: InitiativeLifecyclePhase,
): boolean {
  return INITIATIVE_LIFECYCLE_TRANSITIONS[from].includes(to);
}

export function isInitiativePubliclyProjected(lifecyclePhase: InitiativeLifecyclePhase): boolean {
  return lifecyclePhase === "projected";
}

export function isInitiativeArchived(lifecyclePhase: InitiativeLifecyclePhase): boolean {
  return lifecyclePhase === "archived";
}
