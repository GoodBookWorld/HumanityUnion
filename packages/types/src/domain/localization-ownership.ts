/**
 * Pack 08I.15 / 08J — universal localization ownership classes.
 *
 * Participant-facing semantic text is AUTO_TRANSLATABLE by default.
 * Canonical-language rendering without ownership is an explicit exception.
 *
 * Normative synonyms (stable enum values preserved for compatibility):
 * - WEB_UI ≡ UI_CHROME
 * - CIVIC_CONTENT ≡ AUTO_TRANSLATABLE_CONTENT
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
 * Pack 08J — human-facing category names (map onto LocalizationOwnershipClass).
 * Prefer these in docs and new code comments; enum strings remain stable.
 */
export const LOCALIZATION_OWNERSHIP_SYNONYMS = {
  UI_CHROME: "WEB_UI",
  AUTO_TRANSLATABLE_CONTENT: "CIVIC_CONTENT",
} as const satisfies Record<string, LocalizationOwnershipClass>;

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

/**
 * Pack 08J — unknown participant-facing semantic text → AUTO_TRANSLATABLE
 * (CIVIC_CONTENT). Never NON_TRANSLATABLE by omission.
 */
export const DEFAULT_LOCALIZABLE_RULE =
  "Participant-facing semantic text is AUTO_TRANSLATABLE_CONTENT (CIVIC_CONTENT) by default. Unknown semantic prose inherits automatic translation. Canonical-language rendering without localization ownership is an explicit exception, not the default. NON_TRANSLATABLE requires explicit policy, not missing enrollment.";
