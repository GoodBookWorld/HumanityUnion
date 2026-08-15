/** Part 9/10 — conversation-list and message timestamps share one relative/absolute format. */
export function formatDirectMessageTimestamp(isoDate: string): string {
  return new Date(isoDate).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Communication UX Pack 03.8 Part 8/15 — the Active Allies directory's
 * "Search Allies by name" filter. Pure and client-side only: it never
 * issues a request, it only narrows an already-loaded list, so it is
 * extracted here (rather than left inline in the panel component) to be
 * exercised by a plain unit test independent of any React rendering
 * harness.
 */
export function filterActiveAlliesByName<T extends { displayName: string }>(
  allies: readonly T[],
  searchTerm: string,
): T[] {
  const normalized = searchTerm.trim().toLowerCase();

  if (!normalized) {
    return [...allies];
  }

  return allies.filter((ally) => ally.displayName.toLowerCase().includes(normalized));
}

export type CommunicationMode = "personal" | "initiative";

/**
 * Communication UX Pack 03.9 Part 2 — Workspace Messages has exactly two
 * modes, always driven by the `?mode=` URL param rather than local-only
 * state (so a direct link, refresh, or notification deep-link lands on
 * the right screen). Any value other than the literal `"initiative"`
 * (including an absent param) resolves to the default, Personal Chat.
 * Pure and exported so the URL-parsing rule itself — not just the
 * component that uses it — can be unit tested.
 */
export function resolveCommunicationMode(searchParams: URLSearchParams): CommunicationMode {
  return searchParams.get("mode") === "initiative" ? "initiative" : "personal";
}

export type CollaborationSection = "channel" | "sessions";

/**
 * Communication UX Pack 03.9 Part 11 — a Collaboration Session/Shared
 * Document notification deep-links into Group mode with `&section=`.
 * Any value other than the literal `"sessions"` (including an absent
 * param) resolves to the default, Channel.
 */
export function resolveCollaborationSection(searchParams: URLSearchParams): CollaborationSection {
  return searchParams.get("section") === "sessions" ? "sessions" : "channel";
}

export function formatDirectConversationActivity(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const isSameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isSameDay) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
