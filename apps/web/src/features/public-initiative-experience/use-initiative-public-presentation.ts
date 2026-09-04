/**
 * Pack 08I.14A — shared Initiative public presentation lifecycle (title + description).
 *
 * Live break: SSR seeded Ukrainian via interface locale, then client resolve used
 * authenticated readingLanguages[0]=en and overwrote Hero/Overview/card titles
 * with canonical English (SEED_OK_CLIENT_RESET).
 *
 * Contract:
 * - display language = active interface locale
 * - translationPreference gates GENERATION only (never warm display)
 * - keep SSR seed until reading context is ready
 * - never blindly reset display state to canonical after a translated value applies
 */

"use client";

import { useEffect, useState } from "react";
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

    let cancelled = false;
    void resolveInitiativeDetailPresentation({
      initiativeId: input.initiativeId,
      canonical: input.canonical,
      readingContext: {
        ready: readingContext.ready,
        // Pack 08I.14A — request warm translation for the UI locale, not stale readingLanguages[0].
        readingLanguage: displayLanguage,
        translationPreference: readingContext.translationPreference,
      },
    }).then((resolved) => {
      if (cancelled) {
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

  useEffect(() => {
    setTitle(input.canonicalTitle);
  }, [input.initiativeId, input.canonicalTitle]);

  useEffect(() => {
    if (!readingContext.ready) {
      return;
    }

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
      if (cancelled) {
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
