/**
 * Ordinary Initiative public presentation — canonical title/description only.
 *
 * Unify Ordinary Public Reading:
 * Do not asynchronously resolve or apply CT into visible reading DOM.
 * CT remains for Search/SEO/warm outside this path.
 */

"use client";

import { DEFAULT_PLATFORM_LANGUAGE } from "@hu/types";

import {
  selectInitiativePublicPresentation,
  type InitiativePublicPresentation,
  type InitiativePublicPresentationCanonical,
} from "./initiative-public-presentation";

export function useInitiativePublicPresentation(input: {
  readonly initiativeId: string;
  readonly canonical: InitiativePublicPresentationCanonical;
  readonly initialPresentation?: InitiativePublicPresentationCanonical;
}): InitiativePublicPresentation {
  void input.initiativeId;
  void input.initialPresentation;

  return selectInitiativePublicPresentation({
    canonical: input.canonical,
    presentationMode: "original",
    activeLanguage: DEFAULT_PLATFORM_LANGUAGE,
    originalLanguage: DEFAULT_PLATFORM_LANGUAGE,
    canViewOriginal: false,
    canViewTranslation: false,
    isMachineTranslated: false,
  });
}

/** Compact cards — title only; description intentionally unused in DOM. */
export function useInitiativeCardTitlePresentation(input: {
  readonly initiativeId: string;
  readonly canonicalTitle: string;
  readonly canonicalSummary?: string;
}): string {
  void input.initiativeId;
  void input.canonicalSummary;
  return input.canonicalTitle;
}
