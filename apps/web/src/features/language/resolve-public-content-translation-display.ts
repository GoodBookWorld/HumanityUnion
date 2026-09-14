/**
 * Pack 08I.13 — shared public content presentation lifecycle.
 *
 * Pack 1.1 — cache-only GET resolve. Never POST /generate on miss/stale/partial.
 * Missing/stale → caller keeps canonical/original fallback.
 */

import type {
  ContentTranslationSourceKind,
  LanguageCode,
  ResolvedTranslatedDisplay,
} from "@hu/types";

import {
  generateContentTranslation,
  resolveTranslatedContent,
} from "./translation-api";
import { emitPublicTranslationDiagnostic } from "./public-translation-presentation-lifecycle";
import type { PublicContentReadingContext } from "./use-public-content-reading-context";

export type PublicContentTranslationSourceKind = Extract<
  ContentTranslationSourceKind,
  "initiative" | "blog_post" | "civic_media" | "discussion_comment" | "public_news"
>;

export interface PublicContentTranslationDeps {
  readonly resolveTranslatedContent: typeof resolveTranslatedContent;
  /** @deprecated Pack 1.1 — unused; retained for injectable test deps shape. */
  readonly generateContentTranslation: typeof generateContentTranslation;
}

const defaultDeps: PublicContentTranslationDeps = {
  resolveTranslatedContent,
  generateContentTranslation,
};

/**
 * Resolve warm CURRENT translation for public civic content (cache-only).
 * Never skips warm GET solely because translationPreference is "none".
 * Never invokes TranslationProvider.
 */
export async function resolvePublicContentTranslationDisplay(input: {
  readonly sourceKind: PublicContentTranslationSourceKind;
  readonly sourceRecordId: string;
  readonly readingContext: Pick<
    PublicContentReadingContext,
    "ready" | "readingLanguage" | "translationPreference"
  >;
  readonly deps?: PublicContentTranslationDeps;
}): Promise<ResolvedTranslatedDisplay<Record<string, string>> | null> {
  const { readingContext } = input;
  const deps = input.deps ?? defaultDeps;

  if (!readingContext.ready) {
    emitPublicTranslationDiagnostic({
      phase: "TRANSLATION_NOT_REQUESTED",
      sourceKind: input.sourceKind,
      sourceRecordId: input.sourceRecordId,
      language: readingContext.readingLanguage,
    });
    return null;
  }

  try {
    const resolved = await deps.resolveTranslatedContent({
      sourceKind: input.sourceKind,
      sourceRecordId: input.sourceRecordId,
      language: readingContext.readingLanguage as LanguageCode,
    });

    if (resolved.presentationMode === "original") {
      emitPublicTranslationDiagnostic({
        phase: resolved.isStale ? "TRANSLATION_STALE" : "TRANSLATION_CACHE_MISS",
        sourceKind: input.sourceKind,
        sourceRecordId: input.sourceRecordId,
        language: readingContext.readingLanguage,
        presentationMode: "original",
      });
    } else {
      emitPublicTranslationDiagnostic({
        phase: "TRANSLATION_DISPLAYED",
        sourceKind: input.sourceKind,
        sourceRecordId: input.sourceRecordId,
        language: readingContext.readingLanguage,
        presentationMode: resolved.presentationMode,
      });
    }

    return resolved;
  } catch {
    return null;
  }
}
