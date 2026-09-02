/**
 * Communication UX Pack 03.5 — an independent copy of Direct Messaging's
 * timestamp formatting (`direct-messaging-format.ts`). Duplicated on
 * purpose (Part 1: "completely independent from Personal Direct
 * Messaging") rather than imported, so the Channel never depends on
 * Direct Messaging internals for something as small as date formatting.
 */
export function formatCollaborationChannelTimestamp(isoDate: string, locale: string): string {
  return new Date(isoDate).toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
