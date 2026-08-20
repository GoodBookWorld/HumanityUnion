export function buildInitiativeExperienceHref(initiativeId: string): string {
  return `/initiatives/public/${encodeURIComponent(initiativeId)}`;
}

export function buildInitiativeExperienceManageHref(initiativeId: string): string {
  return `${buildInitiativeExperienceHref(initiativeId)}#manage`;
}

/** Pack 02D — canonical Participant candidate submission entry on the election page. */
/** Pack 03 — candidate intake lives on Initiative Overview, not the results page. */
export function buildPublicChoiceCandidateSubmitHref(initiativeId: string): string {
  return `${buildInitiativeExperienceHref(initiativeId)}#add-candidate`;
}

export function buildWorkspaceInitiativesHref(): string {
  return "/workspace/initiatives";
}
