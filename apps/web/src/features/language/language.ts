/**
 * Web language helpers.
 * Selectable language lists must come from registry-backed `listPriorityLanguages()`.
 */
import {
  DEFAULT_PLATFORM_LANGUAGE,
  RTL_LANGUAGE_CODES,
  isRtlLanguageCode,
  normalizeLanguageCode,
  type LanguageCode,
  type PriorityLanguageCode,
} from "@hu/types";

export {
  DEFAULT_PLATFORM_LANGUAGE,
  RTL_LANGUAGE_CODES,
  isRtlLanguageCode,
  normalizeLanguageCode,
};

export type { LanguageCode, PriorityLanguageCode };

export function documentDirectionForLanguage(language: LanguageCode | null | undefined): "ltr" | "rtl" {
  return isRtlLanguageCode(language) ? "rtl" : "ltr";
}

/**
 * Routing decision (Pack 01): locale stays in profile preference (hybrid later).
 * Do not introduce `/en/`, `/fr/` URL prefixes in this pack.
 */
export const LANGUAGE_ROUTING_STRATEGY = "profile_preference" as const;
