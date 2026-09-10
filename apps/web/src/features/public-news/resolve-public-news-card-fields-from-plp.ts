/**
 * Pure RSS PLP card field resolve — locale-isolated, no React.
 */

import type { PublicNewsArticleItem } from "@hu/types";
import { mayApplyPersistedLocalizedPresentation } from "@hu/types";

export type PublicNewsPlpPresentationInput = {
  readonly mode: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK";
  readonly presentation: unknown;
  /** Required for locale isolation — must match requested locale to apply. */
  readonly locale?: string;
};

function readPlpStringField(presentation: unknown, key: string): string {
  if (!presentation || typeof presentation !== "object" || Array.isArray(presentation)) {
    return "";
  }
  const raw = (presentation as Record<string, unknown>)[key];
  if (typeof raw === "string") {
    return raw.trim();
  }
  if (
    raw &&
    typeof raw === "object" &&
    "value" in raw &&
    typeof (raw as { value: unknown }).value === "string"
  ) {
    return String((raw as { value: string }).value).trim();
  }
  return "";
}

/**
 * Whole-entity RSS card: title+summary both required for localized presentation.
 * Wrong-locale PLP is rejected even when mode is PUBLISHED_LOCALIZED.
 */
export function resolvePublicNewsCardFieldsFromPlp(input: {
  readonly article: PublicNewsArticleItem;
  readonly requestedLocale: string;
  readonly plpPresentation?: PublicNewsPlpPresentationInput | null;
}): {
  readonly title: string;
  readonly summary: string;
  readonly presentationMode: "localized" | "canonical";
  readonly plpResult: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK";
} {
  const canonicalTitle = input.article.title;
  const canonicalSummary = input.article.summary;
  const plp = input.plpPresentation;
  const localeOk = mayApplyPersistedLocalizedPresentation({
    presentationLocale: plp?.locale,
    requestedLocale: input.requestedLocale,
    mode: plp?.mode,
  });
  if (!plp || !localeOk) {
    return {
      title: canonicalTitle,
      summary: canonicalSummary,
      presentationMode: "canonical",
      plpResult: "CANONICAL_FALLBACK",
    };
  }
  const title = readPlpStringField(plp.presentation, "title");
  const summary = readPlpStringField(plp.presentation, "summary");
  if (!title || !summary) {
    return {
      title: canonicalTitle,
      summary: canonicalSummary,
      presentationMode: "canonical",
      plpResult: "CANONICAL_FALLBACK",
    };
  }
  return {
    title,
    summary,
    presentationMode: "localized",
    plpResult: "PUBLISHED_LOCALIZED",
  };
}
