/**
 * PWA Full Translation Pack 01 — cache-only HU persisted field bag for ordinary reading.
 *
 * Only resolves when ordinary-reading owner is hu-persisted.
 * Never POST /generate. Missing/stale/incomplete → canonical fallbackFields.
 */

"use client";

import { useEffect, useState } from "react";

import type { ContentTranslationSourceKind, LanguageCode } from "@hu/types";
import {
  COLLABORATIVE_ANALYSIS_BROWSER_VISIBLE_PROSE_FIELDS,
  DEFAULT_PLATFORM_LANGUAGE,
  IMPROVEMENT_PROPOSAL_BROWSER_VISIBLE_PROSE_FIELDS,
  isCompleteLocalizedProseBag,
} from "@hu/types";

import { resolveTranslatedContent } from "./translation-api";
import { useOrdinaryReadingOwner } from "./use-ordinary-reading-owner";
import { usePublicContentReadingContext } from "./use-public-content-reading-context";

export interface HuPersistedOrdinaryFieldsState {
  readonly fields: Record<string, string>;
  readonly originalFields: Record<string, string>;
  readonly owner: "browser-native" | "hu-persisted";
  readonly presentationMode: "original" | "localized";
  readonly activeLanguage: LanguageCode;
  readonly originalLanguage: LanguageCode;
  readonly isMachineTranslated: boolean;
  readonly isStale: boolean;
  readonly canViewOriginal: boolean;
  readonly canViewTranslation: boolean;
}

export function useHuPersistedOrdinaryFields(input: {
  readonly sourceKind: ContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly fallbackFields: Record<string, string>;
  readonly fieldOrder?: readonly string[];
}): HuPersistedOrdinaryFieldsState {
  const readingContext = usePublicContentReadingContext();
  const { owner, preferredReadingLanguage, ownershipReady } = useOrdinaryReadingOwner({
    sourceKind: input.sourceKind,
  });

  const [fields, setFields] = useState(input.fallbackFields);
  const [originalFields, setOriginalFields] = useState(input.fallbackFields);
  const [presentationMode, setPresentationMode] = useState<"original" | "localized">(
    "original",
  );
  const [activeLanguage, setActiveLanguage] = useState<LanguageCode>(DEFAULT_PLATFORM_LANGUAGE);
  const [originalLanguage, setOriginalLanguage] =
    useState<LanguageCode>(DEFAULT_PLATFORM_LANGUAGE);
  const [isMachineTranslated, setIsMachineTranslated] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [canViewOriginal, setCanViewOriginal] = useState(false);
  const [canViewTranslation, setCanViewTranslation] = useState(false);

  const fallbackSignature = JSON.stringify(input.fallbackFields);
  const fieldOrderKey = (input.fieldOrder ?? Object.keys(input.fallbackFields)).join("|");

  useEffect(() => {
    const fallback = JSON.parse(fallbackSignature) as Record<string, string>;
    setFields(fallback);
    setOriginalFields(fallback);
    setPresentationMode("original");
    setActiveLanguage(DEFAULT_PLATFORM_LANGUAGE);
    setOriginalLanguage(DEFAULT_PLATFORM_LANGUAGE);
    setIsMachineTranslated(false);
    setIsStale(false);
    setCanViewOriginal(false);
    setCanViewTranslation(false);

    if (
      !ownershipReady ||
      owner !== "hu-persisted" ||
      !readingContext.ready ||
      !input.sourceRecordId.trim()
    ) {
      return;
    }

    let cancelled = false;
    const fieldOrder = fieldOrderKey ? fieldOrderKey.split("|") : Object.keys(fallback);

    void (async () => {
      try {
        const resolved = await resolveTranslatedContent({
          sourceKind: input.sourceKind,
          sourceRecordId: input.sourceRecordId,
          language: preferredReadingLanguage,
        });
        if (cancelled) {
          return;
        }

        const original = resolved.originalContent;
        const localized = resolved.content;
        const requiredFields =
          input.sourceKind === "collaborative_analysis"
            ? COLLABORATIVE_ANALYSIS_BROWSER_VISIBLE_PROSE_FIELDS
            : input.sourceKind === "improvement_proposal"
              ? IMPROVEMENT_PROPOSAL_BROWSER_VISIBLE_PROSE_FIELDS
              : fieldOrder;

        const complete =
          resolved.presentationMode !== "original" &&
          resolved.activeLanguage === preferredReadingLanguage &&
          isCompleteLocalizedProseBag({
            originalFields: original,
            localizedFields: localized,
            requiredFields,
          });

        if (!complete) {
          setFields(original);
          setOriginalFields(original);
          setActiveLanguage(resolved.originalLanguage);
          setOriginalLanguage(resolved.originalLanguage);
          setPresentationMode("original");
          setIsMachineTranslated(false);
          setIsStale(resolved.isStale);
          setCanViewOriginal(false);
          setCanViewTranslation(false);
          return;
        }

        setFields(localized);
        setOriginalFields(original);
        setActiveLanguage(resolved.activeLanguage);
        setOriginalLanguage(resolved.originalLanguage);
        setPresentationMode("localized");
        setIsMachineTranslated(resolved.isMachineTranslated);
        setIsStale(resolved.isStale);
        setCanViewOriginal(resolved.canViewOriginal);
        setCanViewTranslation(resolved.canViewTranslation);
      } catch {
        if (!cancelled) {
          setFields(fallback);
          setOriginalFields(fallback);
          setPresentationMode("original");
          setIsMachineTranslated(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    ownershipReady,
    owner,
    readingContext.ready,
    preferredReadingLanguage,
    input.sourceKind,
    input.sourceRecordId,
    fallbackSignature,
    fieldOrderKey,
  ]);

  return {
    fields,
    originalFields,
    owner,
    presentationMode,
    activeLanguage,
    originalLanguage,
    isMachineTranslated,
    isStale,
    canViewOriginal,
    canViewTranslation,
  };
}
