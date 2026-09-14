"use client";

/**
 * Sidebar revision summary — warm CT for initiative_revision when available.
 * Whole-bag: incomplete translation falls back to canonical revisionSummary.
 */

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";

import { resolveLocalizedPresentation } from "../../language/resolve-localized-presentation";
import { usePublicContentReadingContext } from "../../language/use-public-content-reading-context";
import { resolveInitiativePublicDisplayLanguage } from "../initiative-public-presentation";

export function InitiativeRevisionSummaryText({
  revisionId,
  canonicalSummary,
}: {
  readonly revisionId: string;
  readonly canonicalSummary: string;
}) {
  const interfaceLocale = useLocale();
  const readingContext = usePublicContentReadingContext();
  const displayLanguage = resolveInitiativePublicDisplayLanguage(interfaceLocale);
  const [summary, setSummary] = useState(canonicalSummary);

  useEffect(() => {
    setSummary(canonicalSummary);
    if (!readingContext.ready || !canonicalSummary.trim()) {
      return;
    }
    let cancelled = false;
    void resolveLocalizedPresentation({
      request: {
        sourceKind: "initiative_revision",
        sourceRecordId: revisionId,
        displayLanguage,
        ready: readingContext.ready,
        translationPreference: readingContext.translationPreference,
      },
      canonicalFields: {
        revisionSummary: canonicalSummary,
      },
    }).then((resolved) => {
      if (cancelled) {
        return;
      }
      if (resolved.presentationMode === "original") {
        setSummary(canonicalSummary);
        return;
      }
      const localized = resolved.fields.revisionSummary?.trim();
      setSummary(localized || canonicalSummary);
    });
    return () => {
      cancelled = true;
    };
  }, [
    revisionId,
    canonicalSummary,
    readingContext.ready,
    readingContext.translationPreference,
    displayLanguage,
  ]);

  return <>{summary}</>;
}
