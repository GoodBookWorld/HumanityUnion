/**
 * Pack 02G Task 07B — map a single preferences probe onto content reading context.
 * Pure helper (no React / auth hooks).
 *
 * Pack 08I.7 — definitive guests follow the active interface locale with
 * `translationPreference: "preferred"` so published warm translations display on
 * public surfaces. Authenticated paths still use readingLanguages[0] only.
 */

import type { LanguageCode, MemberPreferences } from "@hu/types";
import { DEFAULT_PLATFORM_LANGUAGE, normalizeLanguageCode } from "@hu/types";

import type { ClientAuthStatus } from "../auth/use-client-auth-status";
import { deriveAuthenticatedReadingLanguage } from "./public-content-reading-language";

export interface PublicContentReadingContextFields {
  readonly ready: boolean;
  readonly authStatus: ClientAuthStatus;
  readonly isAuthenticated: boolean;
  readonly readingLanguage: LanguageCode;
  readonly translationPreference: string;
}

export type PublicContentReadingProbeOutcome =
  | { readonly kind: "success"; readonly preferences: MemberPreferences }
  | { readonly kind: "unauthorized" }
  | { readonly kind: "unavailable" };

/** Align guest UI tags with Registry aliases used by translation resolve. */
function canonicalizeGuestInterfaceLocale(value: string | null | undefined): LanguageCode {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    return DEFAULT_PLATFORM_LANGUAGE;
  }
  const lower = trimmed.toLowerCase();
  if (lower === "zh-hant" || lower === "zh-tw" || lower === "zh-hk") {
    return "zh-Hant";
  }
  if (lower === "zh-hans" || lower === "zh-cn") {
    return "zh";
  }
  return normalizeLanguageCode(trimmed, DEFAULT_PLATFORM_LANGUAGE);
}

/**
 * Prefs success → readingLanguages[0] + translationPreference.
 * Definitive 401 → guest: interface locale + preferred (Pack 08I.7).
 * Non-401 → safe English fallback; do not force guest when auth snapshot is authenticated.
 */
export function resolvePublicContentReadingFromProbe(input: {
  readonly authStatus: ClientAuthStatus;
  readonly outcome: PublicContentReadingProbeOutcome;
  /** Active next-intl / UI locale — used for definitive guests only. */
  readonly interfaceLocale?: string | null;
}): PublicContentReadingContextFields {
  if (input.outcome.kind === "success") {
    const experience = input.outcome.preferences.experiencePreferences;
    return {
      authStatus: input.authStatus,
      ready: true,
      isAuthenticated: true,
      readingLanguage: deriveAuthenticatedReadingLanguage(experience.readingLanguages),
      translationPreference: experience.translationPreference || "none",
    };
  }

  if (input.outcome.kind === "unauthorized") {
    const guestLanguage = canonicalizeGuestInterfaceLocale(input.interfaceLocale);
    return {
      authStatus: input.authStatus,
      ready: true,
      isAuthenticated: false,
      readingLanguage: guestLanguage,
      translationPreference: "preferred",
    };
  }

  return {
    authStatus: input.authStatus,
    ready: true,
    isAuthenticated: input.authStatus === "authenticated",
    readingLanguage: DEFAULT_PLATFORM_LANGUAGE,
    translationPreference: "none",
  };
}
