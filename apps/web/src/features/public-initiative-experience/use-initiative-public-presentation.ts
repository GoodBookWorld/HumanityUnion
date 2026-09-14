/**
 * Pack 08I.14A / 08I.14B — shared Initiative public presentation lifecycle.
 *
 * Live break (08I.14A): SSR seeded Ukrainian via interface locale, then client
 * resolve used authenticated readingLanguages[0]=en and overwrote titles.
 *
 * Live break (08I.14B): locale switch UK→EN retained UK presentation until reload
 * because mergeInitiativePublicPresentationUpdate blocked translated→original
 * for the same canonical identity without considering activeLanguage.
 *
 * Contract:
 * - display language = active interface locale
 * - translationPreference gates GENERATION only (never warm display)
 * - keep SSR seed until reading context is ready
 * - locale changes apply immediately; stale async responses are cancelled
 * - never blindly reset display state to canonical after a translated value
 *   applies *for the same display language*
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";

import { resolveInitiativeDetailPresentation } from "./resolve-initiative-detail-presentation";
import {
  mergeInitiativePublicPresentationUpdate,
  resolveInitiativePublicDisplayLanguage,
  selectInitiativePublicPresentation,
  type InitiativePublicPresentation,
  type InitiativePublicPresentationCanonical,
} from "./initiative-public-presentation";
import { usePublicContentReadingContext } from "../language/use-public-content-reading-context";

export function useInitiativePublicPresentation(input: {
  readonly initiativeId: string;
  readonly canonical: InitiativePublicPresentationCanonical;
  readonly initialPresentation?: InitiativePublicPresentationCanonical;
}): InitiativePublicPresentation {
  const interfaceLocale = useLocale();
  const readingContext = usePublicContentReadingContext();
  const displayLanguage = resolveInitiativePublicDisplayLanguage(interfaceLocale);
  const requestGeneration = useRef(0);

  const [presentation, setPresentation] = useState<InitiativePublicPresentation>(() =>
    selectInitiativePublicPresentation({
      canonical: input.canonical,
      translated: input.initialPresentation,
      presentationMode:
        input.initialPresentation &&
        (input.initialPresentation.title !== input.canonical.title ||
          input.initialPresentation.description !== input.canonical.description)
          ? "translated"
          : "original",
      activeLanguage: displayLanguage,
      canViewOriginal: Boolean(input.initialPresentation),
      canViewTranslation: Boolean(input.initialPresentation),
      isMachineTranslated: Boolean(input.initialPresentation),
    }),
  );

  // Pack 08I.14B — react to locale immediately (no remount / reload).
  useEffect(() => {
    setPresentation((previous) => {
      if (previous.activeLanguage === displayLanguage) {
        return previous;
      }
      // Switching toward a new language: drop prior translated fields until resolve.
      // If the new language matches source, show canonical immediately.
      return selectInitiativePublicPresentation({
        canonical: {
          title: previous.originalTitle,
          description: previous.originalDescription,
        },
        presentationMode: "original",
        activeLanguage: displayLanguage,
        originalLanguage: previous.originalLanguage,
        canViewOriginal: false,
        canViewTranslation: false,
        isMachineTranslated: false,
      });
    });
  }, [displayLanguage]);

  useEffect(() => {
    if (!readingContext.ready) {
      if (!input.initialPresentation) {
        setPresentation(
          selectInitiativePublicPresentation({
            canonical: input.canonical,
            activeLanguage: displayLanguage,
          }),
        );
      }
      return;
    }

    const generation = ++requestGeneration.current;
    let cancelled = false;
    void resolveInitiativeDetailPresentation({
      initiativeId: input.initiativeId,
      canonical: input.canonical,
      readingContext: {
        ready: readingContext.ready,
        // Pack 08I.14A/B — request warm translation for the UI locale.
        readingLanguage: displayLanguage,
        translationPreference: readingContext.translationPreference,
      },
    }).then((resolved) => {
      if (cancelled || generation !== requestGeneration.current) {
        return;
      }
      // Reject stale responses whose resolve language no longer matches UI locale.
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
  const [title, setTitle] = useState(input.canonicalTitle);
  const requestGeneration = useRef(0);

  useEffect(() => {
    // Locale change or canonical change: start from canonical until resolve lands.
    setTitle(input.canonicalTitle);
  }, [input.initiativeId, input.canonicalTitle, displayLanguage]);

  useEffect(() => {
    if (!readingContext.ready) {
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
    displayLanguage,
    input.canonicalSummary,
    input.canonicalTitle,
    input.initiativeId,
    readingContext.ready,
    readingContext.translationPreference,
  ]);

  return title;
}
