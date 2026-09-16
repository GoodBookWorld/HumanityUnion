"use client";

/**
 * Sidebar revision summary — ordinary reading uses canonical text only.
 * Do not asynchronously resolve or apply CT into visible DOM.
 */

import { DEFAULT_PLATFORM_LANGUAGE } from "@hu/types";

export function InitiativeRevisionSummaryText({
  revisionId,
  canonicalSummary,
}: {
  readonly revisionId: string;
  readonly canonicalSummary: string;
}) {
  void revisionId;

  return (
    <span
      lang={DEFAULT_PLATFORM_LANGUAGE}
      data-hu-content-lang={DEFAULT_PLATFORM_LANGUAGE}
      data-hu-reading-owner="browser-native"
    >
      {canonicalSummary}
    </span>
  );
}
