/**
 * Stable Initiative workspace section ids (hashes / nav).
 * Participant-visible labels come from `workspace.initiativesPage` WEB_UI.
 */
export const INITIATIVE_WORKSPACE_SECTION_IDS = [
  "my-initiatives",
  "start-new-initiative",
] as const;

export type InitiativeWorkspaceSectionId = (typeof INITIATIVE_WORKSPACE_SECTION_IDS)[number];

/** @deprecated Prefer INITIATIVE_WORKSPACE_SECTION_IDS + localized labels. */
export const INITIATIVE_WORKSPACE_SECTIONS = ["My Initiatives", "Start New Initiative"] as const;

export type InitiativeWorkspaceSection = (typeof INITIATIVE_WORKSPACE_SECTIONS)[number];
