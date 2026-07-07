export const INITIATIVE_WORKSPACE_SECTIONS = [
  "My Initiatives",
  "Overview",
  "Lifecycle Timeline",
  "Manage Initiative",
  "Collaborative Analysis",
  "Improvement Proposal Decisions",
  "Initiative Revision",
  "Decision Result",
  "Civic Delivery",
  "Official Responses",
  "Civic Accountability",
  "Implementation Commitment",
  "Implementation Tracking",
  "Public Impact",
  "Public Civic Archive",
  "Civic Integration",
  "Decision Session",
  "Civic Compatibility Review",
] as const;

export type InitiativeWorkspaceSection = (typeof INITIATIVE_WORKSPACE_SECTIONS)[number];
