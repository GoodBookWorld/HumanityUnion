const LANDING_SECTION_KEY = "hu_workspace_landing_section";
const COLLAPSED_GROUPS_KEY = "hu_workspace_collapsed_groups";
const ASSISTANT_OPEN_KEY = "hu_workspace_assistant_open";

export function getPreferredLandingSection(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(LANDING_SECTION_KEY);
}

export function setPreferredLandingSection(sectionId: string): void {
  window.localStorage.setItem(LANDING_SECTION_KEY, sectionId);
}

export function getCollapsedNavigationGroups(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(COLLAPSED_GROUPS_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function setCollapsedNavigationGroups(groupIds: string[]): void {
  window.localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(groupIds));
}

export function isAssistantOpenPreference(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  const raw = window.localStorage.getItem(ASSISTANT_OPEN_KEY);
  return raw !== "false";
}

export function setAssistantOpenPreference(open: boolean): void {
  window.localStorage.setItem(ASSISTANT_OPEN_KEY, open ? "true" : "false");
}
