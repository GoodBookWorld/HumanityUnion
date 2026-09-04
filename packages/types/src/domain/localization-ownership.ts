/**
 * Pack 08I.15 — universal localization ownership classes.
 *
 * Participant-facing semantic text is localizable by default.
 * Canonical-language rendering without ownership is an explicit exception.
 */

/** Authoritative ownership class for any participant-facing textual value. */
export type LocalizationOwnershipClass =
  | "WEB_UI"
  | "CIVIC_CONTENT"
  | "BRAND_LOCALIZATION"
  | "LEGAL_LOCALIZATION"
  | "CONTROLLED_TERMINOLOGY"
  | "NON_TRANSLATABLE";

/**
 * Resolution priority for participant-facing text (highest first).
 * Admin Brand/Legal must never be overwritten by machine translation.
 */
export const LOCALIZATION_RESOLUTION_PRIORITY = [
  "BRAND_LOCALIZATION",
  "LEGAL_LOCALIZATION",
  "CONTROLLED_TERMINOLOGY",
  "CIVIC_CONTENT_MANUAL_OVERRIDE",
  "CIVIC_CONTENT_CURRENT_MACHINE",
  "CANONICAL_ENGLISH_FALLBACK",
] as const;

export type LocalizationResolutionPriorityStep =
  (typeof LOCALIZATION_RESOLUTION_PRIORITY)[number];

/** Machine-readable note for coverage gates and docs. */
export const DEFAULT_LOCALIZABLE_RULE =
  "Participant-facing semantic text is localizable by default. Canonical-language rendering without localization ownership is an explicit exception, not the default.";
