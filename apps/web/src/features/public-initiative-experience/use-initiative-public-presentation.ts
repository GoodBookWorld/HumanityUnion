/**
 * Ordinary Initiative public presentation.
 *
 * Pack 1 WEB: canonical title/description only (browser-native).
 * PWA Pack 01: standalone + uk|ar|zh-Hant → cache-only CURRENT persisted fields.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";

import { DEFAULT_PLATFORM_LANGUAGE } from "@hu/types";

import { useOrdinaryReadingOwner } from "../language/use-ordinary-reading-owner";
import { usePublicContentReadingContext } from "../language/use-public-content-reading-context";
import { resolveInitiativeDetailPresentation } from "./resolve-initiative-detail-presentation";
import {
  mergeInitiativePublicPresentationUpdate,
  resolveInitiativePublicDisplayLanguage,
  selectInitiativePublicPresentation,
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

  const [presentation, setPresentation] = useState<InitiativePublicPresentation>(() =>
    selectInitiativePublicPresentation({
      canonical: input.canonical,
      presentationMode: "original",
      activeLanguage: DEFAULT_PLATFORM_LANGUAGE,
      originalLanguage: DEFAULT_PLATFORM_LANGUAGE,
      canViewOriginal: false,
      canViewTranslation: false,
      isMachineTranslated: false,
    }),
  );

  useEffect(() => {
    // WEB / English / ownership not ready: stay canonical.
    if (!ownershipReady || owner !== "hu-persisted") {
      setPresentation(
        selectInitiativePublicPresentation({
          canonical: input.canonical,
          presentationMode: "original",
          activeLanguage: DEFAULT_PLATFORM_LANGUAGE,
          originalLanguage: DEFAULT_PLATFORM_LANGUAGE,
          canViewOriginal: false,
          canViewTranslation: false,
          isMachineTranslated: false,
        }),
      );
      return;
    }

    if (!readingContext.ready) {
      setPresentation(
        selectInitiativePublicPresentation({
          canonical: input.canonical,
          activeLanguage: displayLanguage,
        }),
      );
      return;
    }

    const generation = ++requestGeneration.current;
    let cancelled = false;
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
      const next = selectInitiativePublicPresentation({
        canonical: {
          title: resolved.originalTitle,
          description: resolved.originalDescription,
        },
        translated:
          resolved.presentationMode === "translated"
            ? { title: resolved.title, description: resolved.description }
            : null,
        presentationMode: resolved.presentationMode,
        activeLanguage: resolved.activeLanguage,
        originalLanguage: resolved.originalLanguage,
        isMachineTranslated: resolved.isMachineTranslated,
        isStale: resolved.isStale,
        canViewOriginal: resolved.canViewOriginal,
        canViewTranslation: resolved.canViewTranslation,
      });
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
