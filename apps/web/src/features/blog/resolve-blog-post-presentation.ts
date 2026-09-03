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
 */
export async function resolveBlogPostPresentation(input: {
  readonly postId: string;
  readonly canonical: BlogPresentationFields;
  readonly readingContext: Pick<
    PublicContentReadingContext,
    "ready" | "readingLanguage" | "translationPreference"
  >;
}): Promise<ResolvedBlogPresentation> {
  const { canonical, readingContext } = input;

  if (!readingContext.ready || readingContext.translationPreference === "none") {
    return {
      ...canonical,
      presentationMode: "original",
      isStale: false,
    };
  }

  try {
    let resolved = await resolveTranslatedContent({
      sourceKind: "blog_post",
      sourceRecordId: input.postId,
      language: readingContext.readingLanguage,
    });

    if (
      readingContext.translationPreference === "preferred" &&
      resolved.presentationMode === "original" &&
      readingContext.readingLanguage !== resolved.originalLanguage &&
      !resolved.isStale
    ) {
      try {
        const generated = await generateContentTranslation({
          sourceKind: "blog_post",
          sourceRecordId: input.postId,
          targetLanguage: readingContext.readingLanguage,
        });
        resolved = generated.display;
      } catch {
        // keep resolve result
      }
    }

    if (resolved.presentationMode === "original") {
      return {
        ...canonical,
        presentationMode: "original",
        isStale: Boolean(resolved.isStale),
      };
    }

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
