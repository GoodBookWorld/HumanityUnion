/**
 * Pack 02G Task 07B — map a single preferences probe onto content reading context.
 * Pure helper (no React / auth hooks).
 */

import type { LanguageCode, MemberPreferences } from "@hu/types";
import { DEFAULT_PLATFORM_LANGUAGE } from "@hu/types";

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

const GUEST_FIELDS = {
  ready: true as const,
  isAuthenticated: false as const,
  readingLanguage: DEFAULT_PLATFORM_LANGUAGE,
  translationPreference: "none" as const,
};

/**
 * Prefs success → readingLanguages[0] + translationPreference.
 * Definitive 401 → guest en/none.
 * Non-401 → safe English fallback; do not force guest when auth snapshot is authenticated.
 */
export function resolvePublicContentReadingFromProbe(input: {
  readonly authStatus: ClientAuthStatus;
  readonly outcome: PublicContentReadingProbeOutcome;
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
    return {
      ...GUEST_FIELDS,
      authStatus: input.authStatus,
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
