/**
 * Pack 08I.5 — reusable Blog presentation resolver (title / excerpt / HTML content).
 * Uses existing content_translations pipeline only — no second translation engine.
 * Canonical blog fields are never overwritten.
 */

import type { ResolvedTranslatedDisplay } from "@hu/types";

import {
  generateContentTranslation,
  resolveTranslatedContent,
} from "../language/translation-api";
import {
  emitPublicTranslationDiagnostic,
  shouldAttemptOnDemandContentTranslation,
} from "../language/public-translation-presentation-lifecycle";
import type { PublicContentReadingContext } from "../language/use-public-content-reading-context";

export interface BlogPresentationFields {
  readonly title: string;
  readonly excerpt: string;
  readonly contentHtml: string;
}

export interface ResolvedBlogPresentation extends BlogPresentationFields {
  readonly presentationMode: "translated" | "original";
  readonly isStale: boolean;
}

export interface BlogPresentationDeps {
  readonly resolveTranslatedContent: typeof resolveTranslatedContent;
  readonly generateContentTranslation: typeof generateContentTranslation;
}

const defaultDeps: BlogPresentationDeps = {
  resolveTranslatedContent,
  generateContentTranslation,
};

function pickTranslatedField(
  resolved: ResolvedTranslatedDisplay<Record<string, string>>,
  key: string,
  fallback: string,
): string {
  const value = resolved.content[key];
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  return fallback;
}

/**
 * Resolve eligible Blog presentation fields for the current reading context.
 * Missing/stale translation → canonical fallbacks.
 *
 * `deps` is injectable for fixture tests that prove an existing translation reaches presentation.
 */
export async function resolveBlogPostPresentation(
  input: {
    readonly postId: string;
    readonly canonical: BlogPresentationFields;
    readonly readingContext: Pick<
      PublicContentReadingContext,
      "ready" | "readingLanguage" | "translationPreference"
    >;
  },
  deps: BlogPresentationDeps = defaultDeps,
): Promise<ResolvedBlogPresentation> {
  const { canonical, readingContext } = input;

  if (!readingContext.ready || readingContext.translationPreference === "none") {
    return {
      ...canonical,
      presentationMode: "original",
      isStale: false,
    };
  }

  try {
    let resolved = await deps.resolveTranslatedContent({
      sourceKind: "blog_post",
      sourceRecordId: input.postId,
      language: readingContext.readingLanguage,
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
        sourceKind: "blog_post",
        sourceRecordId: input.postId,
        language: readingContext.readingLanguage,
        presentationMode: resolved.presentationMode,
      });
      try {
        const generated = await deps.generateContentTranslation({
          sourceKind: "blog_post",
          sourceRecordId: input.postId,
          targetLanguage: readingContext.readingLanguage,
        });
        resolved = generated.display;
      } catch {
        emitPublicTranslationDiagnostic({
          phase: "TRANSLATION_GENERATION_FAILED",
          sourceKind: "blog_post",
          sourceRecordId: input.postId,
          language: readingContext.readingLanguage,
        });
      }
    }

    if (resolved.presentationMode === "original") {
      emitPublicTranslationDiagnostic({
        phase: "TRANSLATION_CACHE_MISS",
        sourceKind: "blog_post",
        sourceRecordId: input.postId,
        language: readingContext.readingLanguage,
        presentationMode: "original",
      });
      return {
        ...canonical,
        presentationMode: "original",
        isStale: Boolean(resolved.isStale),
      };
    }

    emitPublicTranslationDiagnostic({
      phase: "TRANSLATION_DISPLAYED",
      sourceKind: "blog_post",
      sourceRecordId: input.postId,
      language: readingContext.readingLanguage,
      presentationMode: resolved.presentationMode,
    });

    return {
      title: pickTranslatedField(resolved, "title", canonical.title),
      excerpt: pickTranslatedField(resolved, "excerpt", canonical.excerpt),
      contentHtml: pickTranslatedField(resolved, "content", canonical.contentHtml),
      presentationMode: "translated",
      isStale: Boolean(resolved.isStale),
    };
  } catch {
    return {
      ...canonical,
      presentationMode: "original",
      isStale: false,
    };
  }
}
