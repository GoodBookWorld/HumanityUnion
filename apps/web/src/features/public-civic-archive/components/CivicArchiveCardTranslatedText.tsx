"use client";

import { useEffect, useState } from "react";

import type { LanguageCode } from "@hu/types";
import { DEFAULT_PLATFORM_LANGUAGE } from "@hu/types";

import { isAuthenticationRequiredError } from "../../../lib/api-client";
import { getMyPreferences } from "../../preferences/preferences-api";
import { resolveTranslatedContent } from "../../language/translation-api";

interface CivicArchiveCardTranslatedTextProps {
  readonly archiveRecordId: string;
  readonly title: string;
  readonly summary: string;
  readonly titleClassName?: string;
  readonly summaryClassName?: string;
}

/**
 * Compact cache-first title/summary for Civic Archive cards.
 * No on-demand generate; no per-field chrome (Task 06 can harden layout).
 */
export function CivicArchiveCardTranslatedText({
  archiveRecordId,
  title,
  summary,
  titleClassName,
  summaryClassName,
}: CivicArchiveCardTranslatedTextProps) {
  const [displayTitle, setDisplayTitle] = useState(title);
  const [displaySummary, setDisplaySummary] = useState(summary);

  useEffect(() => {
    let cancelled = false;
    setDisplayTitle(title);
    setDisplaySummary(summary);

    void (async () => {
      let readingLanguage: LanguageCode = DEFAULT_PLATFORM_LANGUAGE;
      try {
        const prefs = await getMyPreferences();
        readingLanguage =
          (prefs.experiencePreferences.readingLanguages[0] as LanguageCode) ||
          (prefs.experiencePreferences.interfaceLanguage as LanguageCode) ||
          DEFAULT_PLATFORM_LANGUAGE;
        const preference = prefs.experiencePreferences.translationPreference || "preferred";
        if (preference === "none") {
          return;
        }
      } catch (error) {
        if (!isAuthenticationRequiredError(error)) {
          // keep defaults
        }
      }

      try {
        const resolved = await resolveTranslatedContent({
          sourceKind: "civic_archive",
          sourceRecordId: archiveRecordId,
          language: readingLanguage,
        });
        if (cancelled) {
          return;
        }
        if (resolved.presentationMode === "original") {
          return;
        }
        setDisplayTitle(resolved.content.title?.trim() || title);
        setDisplaySummary(resolved.content.summary?.trim() || summary);
      } catch {
        // keep canonical fallback
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [archiveRecordId, title, summary]);

  return (
    <div className="civic-archive-card-translated-text">
      <h3 className={titleClassName}>{displayTitle}</h3>
      <p className={summaryClassName}>{displaySummary}</p>
    </div>
  );
}
