/**
 * Pack 08I.13 — shared public content presentation lifecycle.
 *
 * Live staging root cause: authenticated members with stored
 * `translationPreference: "none"` (the historical default) caused Web resolvers
 * to short-circuit to canonical English and never GET warm content_translations,
 * while SSR metadata/seed could still show Ukrainian. Warm rows existed; Web wiped them.
 *
 * Contract:
 * - ready=false → keep caller seed/canonical (do not resolve yet)
 * - always GET resolve when ready (warm display)
 * - POST generate only when preference === "preferred" (and miss / not stale)
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
import {
  emitPublicTranslationDiagnostic,
  shouldAttemptOnDemandContentTranslation,
} from "./public-translation-presentation-lifecycle";
import type { PublicContentReadingContext } from "./use-public-content-reading-context";

export type PublicContentTranslationSourceKind = Extract<
  ContentTranslationSourceKind,
  "initiative" | "blog_post" | "civic_media" | "discussion_comment" | "public_news"
>;

export interface PublicContentTranslationDeps {
  readonly resolveTranslatedContent: typeof resolveTranslatedContent;
  readonly generateContentTranslation: typeof generateContentTranslation;
}

const defaultDeps: PublicContentTranslationDeps = {
  resolveTranslatedContent,
  generateContentTranslation,
};

/**
 * Resolve (+ optional generate) for public civic content.
 * Never skips warm GET solely because translationPreference is "none".
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
    let resolved = await deps.resolveTranslatedContent({
      sourceKind: input.sourceKind,
      sourceRecordId: input.sourceRecordId,
      language: readingContext.readingLanguage as LanguageCode,
    });

    if (
      shouldAttemptOnDemandContentTranslation({
        ready: readingContext.ready,
        translationPreference: readingContext.translationPreference,
        readingLanguage: readingContext.readingLanguage,
        resolvePresentationMode: resolved.presentationMode,
        originalLanguage: resolved.originalLanguage,
        isStale: resolved.isStale,
      })
    ) {
      emitPublicTranslationDiagnostic({
        phase: "TRANSLATION_GENERATION_STARTED",
        sourceKind: input.sourceKind,
        sourceRecordId: input.sourceRecordId,
        language: readingContext.readingLanguage,
        presentationMode: resolved.presentationMode,
      });
      try {
        const generated = await deps.generateContentTranslation({
          sourceKind: input.sourceKind,
          targetLanguage: readingContext.readingLanguage as LanguageCode,
          sourceRecordId: input.sourceRecordId,
        });
        resolved = generated.display;
      } catch {
        emitPublicTranslationDiagnostic({
          phase: "TRANSLATION_GENERATION_FAILED",
          sourceKind: input.sourceKind,
          sourceRecordId: input.sourceRecordId,
          language: readingContext.readingLanguage,
        });
      }
    }

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
