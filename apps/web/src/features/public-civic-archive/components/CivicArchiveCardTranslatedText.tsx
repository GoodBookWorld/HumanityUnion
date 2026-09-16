"use client";

import { DEFAULT_PLATFORM_LANGUAGE } from "@hu/types";

interface CivicArchiveCardTranslatedTextProps {
  readonly archiveRecordId: string;
  readonly title: string;
  readonly summary: string;
  readonly titleClassName?: string;
  readonly summaryClassName?: string;
}

/**
 * Ordinary Civic Archive card reading — canonical title/summary only.
 * Do not asynchronously resolve or apply CT into visible DOM.
 * `archiveRecordId` remains for callers/diagnostics.
 */
export function CivicArchiveCardTranslatedText({
  archiveRecordId,
  title,
  summary,
  titleClassName,
  summaryClassName,
}: CivicArchiveCardTranslatedTextProps) {
  void archiveRecordId;

  return (
    <div
      className="civic-archive-card-translated-text"
      lang={DEFAULT_PLATFORM_LANGUAGE}
      data-hu-content-lang={DEFAULT_PLATFORM_LANGUAGE}
      data-hu-reading-owner="browser-native"
    >
      <h3 className={titleClassName}>{title}</h3>
      <p className={summaryClassName}>{summary}</p>
    </div>
  );
}
