/**
 * Web language helpers.
 * Selectable language lists must come from registry-backed `listPriorityLanguages()`.
 * Document html lang/dir uses `resolveDocumentHtmlLocale` (Registry catalog) — not
 * `normalizeLanguageCode` / hardcoded RTL base-tag lists.
 */
import {
  DEFAULT_PLATFORM_LANGUAGE,
  RTL_LANGUAGE_CODES,
  isRtlLanguageCode,
  normalizeLanguageCode,
  type LanguageCode,
  type LanguageTextDirection,
  type PriorityLanguageCode,
  type ResolvedRuntimeLocale,
} from "@hu/types";

export {
  DEFAULT_PLATFORM_LANGUAGE,
  RTL_LANGUAGE_CODES,
  isRtlLanguageCode,
  normalizeLanguageCode,
};

export type { LanguageCode, PriorityLanguageCode };

/**
 * @deprecated Prefer `ResolvedRuntimeLocale.textDirection` from the catalog resolver
 * for document language. Kept for legacy content helpers that still pass language codes.
 */
export function documentDirectionForLanguage(language: LanguageCode | null | undefined): "ltr" | "rtl" {
  return isRtlLanguageCode(language) ? "rtl" : "ltr";
}

/** Document attributes from a resolved runtime locale (no base-tag collapse). */
export function documentAttributesFromRuntimeLocale(resolved: ResolvedRuntimeLocale): {
  readonly lang: string;
  readonly dir: LanguageTextDirection;
} {
  return {
    lang: resolved.locale,
    dir: resolved.textDirection,
  };
}

/**
 * Routing decision (Pack 01): locale stays in profile preference (hybrid later).
 * Do not introduce `/en/`, `/fr/` URL prefixes in this pack.
 */
export const LANGUAGE_ROUTING_STRATEGY = "profile_preference" as const;
