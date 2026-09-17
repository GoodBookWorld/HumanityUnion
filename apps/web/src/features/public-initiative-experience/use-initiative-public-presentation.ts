/**
 * Ordinary Initiative public presentation.
 *
 * Version 5.0 / Pack 1 WEB: canonical title/description only (browser-native).
 * Version 5.0 installed PWA: owner === hu-persisted → SSR seed (locale-matched)
 * + cache-only CURRENT CT resolve → hero/overview presentation object.
 *
 * Do not restore persisted ordinary presentation on normal Web.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";

import type { LanguageCode } from "@hu/types";

import { useOrdinaryReadingOwner } from "../language/use-ordinary-reading-owner";
import { usePublicContentReadingContext } from "../language/use-public-content-reading-context";
import {
  isDistinctInitiativePresentationSeed,
  selectBrowserNativeInitiativePresentation,
  selectHuPersistedInitiativeLocaleInterim,
  selectHuPersistedInitiativeResolvedPresentation,
  selectHuPersistedInitiativeSeedPresentation,
} from "./initiative-ordinary-presentation-selection";
import { resolveInitiativeDetailPresentation } from "./resolve-initiative-detail-presentation";
import {
  mergeInitiativePublicPresentationUpdate,
  resolveInitiativePublicDisplayLanguage,
  type InitiativePublicPresentation,
  type InitiativePublicPresentationCanonical,
} from "./initiative-public-presentation";

export function useInitiativePublicPresentation(input: {
  readonly initiativeId: string;
  readonly canonical: InitiativePublicPresentationCanonical;
  readonly initialPresentation?: InitiativePublicPresentationCanonical;
}): InitiativePublicPresentation {
  const interfaceLocale = useLocale();
  const readingContext = usePublicContentReadingContext();
  const displayLanguage = resolveInitiativePublicDisplayLanguage(interfaceLocale);
  const { owner, ownershipReady } = useOrdinaryReadingOwner({ sourceKind: "initiative" });
  const requestGeneration = useRef(0);
  /**
   * SSR seed is bound to the Preferred Reading / interface locale at the moment
   * ownership first becomes hu-persisted. After a PWA locale switch, seed must
   * not reintroduce another language's translated bag.
   */
  const seedLocaleRef = useRef<LanguageCode | null>(null);

  // Hydration-safe: SSR + first client paint stay canonical (WEB invariant).
  const [presentation, setPresentation] = useState<InitiativePublicPresentation>(() =>
    selectBrowserNativeInitiativePresentation(input.canonical),
  );

  // Pack 08I.14B / Version 5.0 — drop prior-locale translation immediately.
  useEffect(() => {
    if (!ownershipReady || owner !== "hu-persisted") {
      return;
    }
    setPresentation((previous) => {
      if (previous.activeLanguage === displayLanguage) {
        return previous;
      }
      return selectHuPersistedInitiativeLocaleInterim({
        canonical: {
          title: previous.originalTitle,
          description: previous.originalDescription,
        },
        displayLanguage,
        originalLanguage: previous.originalLanguage,
      });
    });
  }, [displayLanguage, ownershipReady, owner]);

  useEffect(() => {
    // WEB / ownership not ready: visible ordinary reading stays canonical.
    // Do not consume persisted seed as normal-Web presentation.
    if (!ownershipReady || owner !== "hu-persisted") {
      seedLocaleRef.current = null;
      setPresentation(selectBrowserNativeInitiativePresentation(input.canonical));
      return;
    }

    if (seedLocaleRef.current === null) {
      seedLocaleRef.current = displayLanguage;
    }

    const seedLocale = seedLocaleRef.current;
    const seedUsable =
      seedLocale === displayLanguage &&
      isDistinctInitiativePresentationSeed(input.canonical, input.initialPresentation);

    if (!readingContext.ready) {
      // Keep / apply locale-matched seed while capability settles — do not
      // permanently destroy seed needed once resolve can run.
      if (seedUsable && input.initialPresentation) {
        setPresentation(
          selectHuPersistedInitiativeSeedPresentation({
            canonical: input.canonical,
            seed: input.initialPresentation,
            displayLanguage,
          }),
        );
      } else {
        setPresentation(
          selectHuPersistedInitiativeLocaleInterim({
            canonical: input.canonical,
            displayLanguage,
          }),
        );
      }
      return;
    }

    const generation = ++requestGeneration.current;
    let cancelled = false;

    // Settling paint: seed when locale-matched; otherwise interim canonical.
    if (seedUsable && input.initialPresentation) {
      setPresentation(
        selectHuPersistedInitiativeSeedPresentation({
          canonical: input.canonical,
          seed: input.initialPresentation,
          displayLanguage,
        }),
      );
    }

    void resolveInitiativeDetailPresentation({
      initiativeId: input.initiativeId,
      canonical: input.canonical,
      readingContext: {
        ready: readingContext.ready,
        readingLanguage: displayLanguage,
        translationPreference: readingContext.translationPreference,
      },
    }).then((resolved) => {
      if (cancelled || generation !== requestGeneration.current) {
        return;
      }
      if (resolved.activeLanguage !== displayLanguage) {
        return;
      }
      const next = selectHuPersistedInitiativeResolvedPresentation(resolved);
      setPresentation((previous) =>
        mergeInitiativePublicPresentationUpdate({ previous, next }),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [
    ownershipReady,
    owner,
    displayLanguage,
    input.canonical.description,
    input.canonical.title,
    input.initialPresentation,
    input.initiativeId,
    readingContext.ready,
    readingContext.translationPreference,
  ]);

  return presentation;
}

/** Compact cards — title only; description intentionally unused in DOM. */
export function useInitiativeCardTitlePresentation(input: {
  readonly initiativeId: string;
  readonly canonicalTitle: string;
  readonly canonicalSummary?: string;
}): string {
  const interfaceLocale = useLocale();
  const readingContext = usePublicContentReadingContext();
  const displayLanguage = resolveInitiativePublicDisplayLanguage(interfaceLocale);
  const { owner, ownershipReady } = useOrdinaryReadingOwner({ sourceKind: "initiative" });
  const [title, setTitle] = useState(input.canonicalTitle);
  const requestGeneration = useRef(0);

  useEffect(() => {
    setTitle(input.canonicalTitle);
  }, [input.initiativeId, input.canonicalTitle, displayLanguage, owner]);

  useEffect(() => {
    if (!ownershipReady || owner !== "hu-persisted" || !readingContext.ready) {
      setTitle(input.canonicalTitle);
      return;
    }

    const generation = ++requestGeneration.current;
    let cancelled = false;
    void resolveInitiativeDetailPresentation({
      initiativeId: input.initiativeId,
      canonical: {
        title: input.canonicalTitle,
        description: input.canonicalSummary ?? "",
      },
      readingContext: {
        ready: readingContext.ready,
        readingLanguage: displayLanguage,
        translationPreference: readingContext.translationPreference,
      },
    }).then((resolved) => {
      if (cancelled || generation !== requestGeneration.current) {
        return;
      }
      if (resolved.activeLanguage !== displayLanguage) {
        return;
      }
      setTitle(
        resolved.presentationMode === "translated" && resolved.title.trim()
          ? resolved.title
          : input.canonicalTitle,
      );
    });

    return () => {
      cancelled = true;
    };
  }, [
    ownershipReady,
    owner,
    displayLanguage,
    input.initiativeId,
    input.canonicalTitle,
    input.canonicalSummary,
    readingContext.ready,
    readingContext.translationPreference,
  ]);

  return title;
}
