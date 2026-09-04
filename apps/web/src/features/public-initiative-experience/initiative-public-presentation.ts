/**
 * Pack 08I.14A / 08I.14B — single public Initiative presentation owner for title/description.
 *
 * Canonical Initiative domain data stays canonical.
 * Mounted card / PIE Hero / Overview consume these presentation values only.
 */

import type { LanguageCode } from "@hu/types";
import { DEFAULT_PLATFORM_LANGUAGE } from "@hu/types";

import { resolvePublicContentDisplayLanguage } from "../language/resolve-public-content-display-language";

export interface InitiativePublicPresentation {
  readonly title: string;
  readonly description: string;
  readonly presentationMode: "translated" | "original";
  readonly originalTitle: string;
  readonly originalDescription: string;
  readonly activeLanguage: LanguageCode;
  readonly originalLanguage: LanguageCode;
  readonly isMachineTranslated: boolean;
  readonly isStale: boolean;
  readonly canViewOriginal: boolean;
  readonly canViewTranslation: boolean;
}

export interface InitiativePublicPresentationCanonical {
  readonly title: string;
  readonly description: string;
}

/** Pack 08I.14A/B — alias of the shared public content display-language helper. */
export function resolveInitiativePublicDisplayLanguage(
  interfaceLocale: string | null | undefined,
): LanguageCode {
  return resolvePublicContentDisplayLanguage(interfaceLocale);
}

/**
 * Pure presentation selection for tests and SSR-seeded first paint.
 * Prefer warm/current translation fields; never mutate canonical.
 */
export function selectInitiativePublicPresentation(input: {
  readonly canonical: InitiativePublicPresentationCanonical;
  readonly translated?: Partial<InitiativePublicPresentationCanonical> | null;
  readonly presentationMode?: "translated" | "original";
  readonly activeLanguage?: LanguageCode;
  readonly originalLanguage?: LanguageCode;
  readonly isMachineTranslated?: boolean;
  readonly isStale?: boolean;
  readonly canViewOriginal?: boolean;
  readonly canViewTranslation?: boolean;
}): InitiativePublicPresentation {
  const mode = input.presentationMode ?? (input.translated ? "translated" : "original");
  const title =
    mode === "translated" && input.translated?.title?.trim()
      ? input.translated.title.trim()
      : input.canonical.title;
  const description =
    mode === "translated" && input.translated?.description?.trim()
      ? input.translated.description.trim()
      : input.canonical.description;

  return {
    title,
    description,
    presentationMode: mode,
    originalTitle: input.canonical.title,
    originalDescription: input.canonical.description,
    activeLanguage: input.activeLanguage ?? DEFAULT_PLATFORM_LANGUAGE,
    originalLanguage: input.originalLanguage ?? DEFAULT_PLATFORM_LANGUAGE,
    isMachineTranslated: Boolean(input.isMachineTranslated),
    isStale: Boolean(input.isStale),
    canViewOriginal: Boolean(input.canViewOriginal),
    canViewTranslation: Boolean(input.canViewTranslation),
  };
}

/**
 * Hydration/update contract:
 * - locale switches always apply (`activeLanguage` change wins)
 * - once translated presentation is applied for the *same* display language,
 *   a later canonical-only tick must not revert participant-visible fields
 *   (guards against auth reading-language / race overwrites within one locale)
 */
export function mergeInitiativePublicPresentationUpdate(input: {
  readonly previous: InitiativePublicPresentation;
  readonly next: InitiativePublicPresentation;
}): InitiativePublicPresentation {
  // Pack 08I.14B — UK→EN (and any locale change) must not be blocked by the
  // same-locale anti-reversion guard. Stale async responses for a prior locale
  // are cancelled in the hook; this additionally rejects language mismatches.
  if (input.previous.activeLanguage !== input.next.activeLanguage) {
    return input.next;
  }
  if (
    input.previous.presentationMode === "translated" &&
    input.next.presentationMode === "original" &&
    !input.next.isStale &&
    input.previous.originalTitle === input.next.originalTitle &&
    input.previous.originalDescription === input.next.originalDescription
  ) {
    // Ignore a transient canonical overwrite for the same source identity + locale.
    return input.previous;
  }
  return input.next;
}
