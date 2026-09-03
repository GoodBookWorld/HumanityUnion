/**
 * Pack 08I.4 — Contact subject identity.
 * Mailto subject strings and UI labels come from `contactPublic` catalogs.
 * Stable ids preserve routing contracts across locales.
 */

export const CONTACT_SUBJECT_IDS = [
  "general",
  "partnerships",
  "media",
  "technical",
] as const;

export type ContactSubjectId = (typeof CONTACT_SUBJECT_IDS)[number];

/** English mailto subject values kept as operational defaults / documentation. */
export const CONTACT_SUBJECT_ENGLISH_DEFAULTS = {
  general: "General inquiry",
  partnerships: "Partnerships and collaboration",
  media: "Media and press",
  technical: "Technical support",
} as const satisfies Record<ContactSubjectId, string>;
