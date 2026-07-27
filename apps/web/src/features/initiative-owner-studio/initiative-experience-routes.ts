export function buildInitiativeExperienceHref(initiativeId: string): string {
  return `/initiatives/${encodeURIComponent(initiativeId)}`;
}

export function buildInitiativeExperienceManageHref(initiativeId: string): string {
  return `${buildInitiativeExperienceHref(initiativeId)}#manage`;
}

export function buildWorkspaceInitiativesHref(): string {
  return "/workspace/initiatives";
}
