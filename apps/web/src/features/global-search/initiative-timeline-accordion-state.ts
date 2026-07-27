const STORAGE_KEY = "hu-search-timeline-accordion:v1";

export function buildTimelineAccordionKey(initiativeId: string, stageId: string): string {
  return `${initiativeId}::${stageId}`;
}

export function readTimelineAccordionState(): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return new Set();
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return new Set();
    }

    return new Set(parsed.filter((entry): entry is string => typeof entry === "string"));
  } catch {
    return new Set();
  }
}

export function writeTimelineAccordionState(expandedKeys: Set<string>): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...expandedKeys]));
}

export function readInitiativeExpandedStageIds(
  initiativeId: string,
  stageIds: string[],
): Set<string> {
  const stored = readTimelineAccordionState();
  const expanded = new Set<string>();

  for (const stageId of stageIds) {
    if (stored.has(buildTimelineAccordionKey(initiativeId, stageId))) {
      expanded.add(stageId);
    }
  }

  return expanded;
}

export function persistInitiativeExpandedStageIds(
  initiativeId: string,
  expandedStageIds: Set<string>,
  allStageIds: string[],
): void {
  const stored = readTimelineAccordionState();

  for (const stageId of allStageIds) {
    stored.delete(buildTimelineAccordionKey(initiativeId, stageId));
  }

  for (const stageId of expandedStageIds) {
    stored.add(buildTimelineAccordionKey(initiativeId, stageId));
  }

  writeTimelineAccordionState(stored);
}
