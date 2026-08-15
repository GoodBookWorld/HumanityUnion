import type { MyInitiativeGroupSummary } from "@hu/types";

/**
 * Communication UX Pack 03.9 Part 4 — the "My Initiative Groups" search
 * filter. Pure and client-side only: the list is already scoped to the
 * signed-in Participant's own Initiatives by the backend, so this only
 * narrows an already-loaded list and never issues a request. Extracted
 * here (rather than left inline in the sidebar component) so it can be
 * exercised by a plain unit test independent of any React rendering
 * harness, mirroring `filterActiveAlliesByName`.
 */
export function filterInitiativeGroupsByTitle<T extends { title: string }>(
  groups: readonly T[],
  searchTerm: string,
): T[] {
  const normalized = searchTerm.trim().toLowerCase();

  if (!normalized) {
    return [...groups];
  }

  return groups.filter((group) => group.title.toLowerCase().includes(normalized));
}

/**
 * Communication UX Pack 03.9 Part 6 — an Author may schedule a
 * Collaboration Session for a group they lead; an active Ally may only
 * attend one. Pure role check so the sidebar's conditional "Schedule a
 * Session" quick-form never depends on trusting the client alone (the
 * backend's `requireAuthorAccess` remains the real authorization boundary
 * — this only controls whether the UI affordance is offered at all).
 */
export function canScheduleSessionsForGroup(group: MyInitiativeGroupSummary | null): boolean {
  return group?.role === "author";
}
