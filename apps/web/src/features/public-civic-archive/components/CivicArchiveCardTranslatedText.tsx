"use client";

import { useEffect, useState } from "react";

import { resolveTranslatedContent } from "../../language/translation-api";
import { usePublicContentReadingContext } from "../../language/use-public-content-reading-context";

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
  const readingContext = usePublicContentReadingContext();
  const [displayTitle, setDisplayTitle] = useState(title);
  const [displaySummary, setDisplaySummary] = useState(summary);

  useEffect(() => {
    setDisplayTitle(title);
    setDisplaySummary(summary);

    if (!readingContext.ready) {
      return;
    }

    if (readingContext.translationPreference === "none") {
      return;
    }

    let cancelled = false;
    const readingLanguage = readingContext.readingLanguage;

    void (async () => {
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
  }, [
    archiveRecordId,
    title,
    summary,
    readingContext.ready,
    readingContext.readingLanguage,
    readingContext.translationPreference,
  ]);

  return (
    <div className="civic-archive-card-translated-text">
      <h3 className={titleClassName}>{displayTitle}</h3>
      <p className={summaryClassName}>{displaySummary}</p>
    </div>
  );
}
