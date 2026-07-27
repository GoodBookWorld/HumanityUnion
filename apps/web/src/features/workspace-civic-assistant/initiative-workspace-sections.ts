export const INITIATIVE_WORKSPACE_SECTIONS = ["My Initiatives", "Start New Initiative"] as const;

export type InitiativeWorkspaceSection = (typeof INITIATIVE_WORKSPACE_SECTIONS)[number];
