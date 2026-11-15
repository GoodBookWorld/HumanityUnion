/**
 * HU-LC-05C.4C.7F.7N / 7N.1 — ICC initiative title presentation.
 *
 * Prefer the page-owned Initiative presentation title (same effective value
 * as PublicExperienceHero). Only when that is absent (e.g. Group Chat) fall
 * back to cache-only CT resolve — never a second translation lifecycle on
 * the Initiative experience page.
 */

"use client";

import { useEffect, useState } from "react";

import { usePublicContentReadingContext } from "../language/use-public-content-reading-context";

import { resolveIccInitiativeDisplayTitle } from "./resolve-icc-initiative-display-title";

export function useIccInitiativeDisplayTitle(input: {
  readonly initiativeId: string;
  readonly canonicalTitle: string;
  /**
   * Effective title already resolved for the Initiative page hero
   * (`useInitiativePublicPresentation().title`). When provided (including
   * canonical-during-hydration), ICC must not open a separate CT resolve.
   */
  readonly pagePresentationTitle?: string | null;
}): string {
  const { initiativeId, canonicalTitle, pagePresentationTitle } = input;
  const readingContext = usePublicContentReadingContext();
  const [fallbackTitle, setFallbackTitle] = useState(canonicalTitle);
  const usesPagePresentation = pagePresentationTitle != null;

  useEffect(() => {
    if (usesPagePresentation) {
      return;
    }

    setFallbackTitle(canonicalTitle);

    let cancelled = false;
    void resolveIccInitiativeDisplayTitle({
      initiativeId,
      canonicalTitle,
      readingContext,
    }).then((title) => {
      if (!cancelled) {
        setFallbackTitle(title);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    usesPagePresentation,
    initiativeId,
    canonicalTitle,
    readingContext.ready,
    readingContext.readingLanguage,
    readingContext.translationPreference,
  ]);

  if (usesPagePresentation) {
    const fromPage = (pagePresentationTitle ?? "").trim();
    return fromPage || canonicalTitle;
  }

  return fallbackTitle.trim() ? fallbackTitle : canonicalTitle;
}
