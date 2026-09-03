/**
 * Pack 08I.5 / 08I.13 — reusable Blog presentation resolver (title / excerpt / HTML content).
 * Uses existing content_translations pipeline only — no second translation engine.
 * Canonical blog fields are never overwritten.
 *
 * Pack 08I.13 — warm GET is not skipped for translationPreference "none".
 */

import type { ResolvedTranslatedDisplay } from "@hu/types";

import { resolvePublicContentTranslationDisplay } from "../language/resolve-public-content-translation-display";
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

  if (!readingContext.ready) {
    return {
      ...canonical,
      presentationMode: "original",
      isStale: false,
    };
  }

  const resolved = await resolvePublicContentTranslationDisplay({
    sourceKind: "blog_post",
    sourceRecordId: input.postId,
    readingContext,
    deps,
  });

  if (!resolved || resolved.presentationMode === "original") {
    return {
      ...canonical,
      presentationMode: "original",
      isStale: Boolean(resolved?.isStale),
    };
  }

  return {
    title: pickTranslatedField(resolved, "title", canonical.title),
    excerpt: pickTranslatedField(resolved, "excerpt", canonical.excerpt),
    contentHtml: pickTranslatedField(resolved, "content", canonical.contentHtml),
    presentationMode: "translated",
    isStale: Boolean(resolved.isStale),
  };
}
