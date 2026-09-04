/**
 * Pack 08J.1 — reusable Blog presentation via the generic localized boundary.
 * Uses UI/document locale for resolve language. Canonical fields never mutated.
 */

import type { LanguageCode } from "@hu/types";

import {
  resolveLocalizedPresentation,
  type LocalizedPresentationDeps,
} from "../language/resolve-localized-presentation";
import {
  generateContentTranslation,
  resolveTranslatedContent,
} from "../language/translation-api";

export interface BlogPresentationFields {
  readonly title: string;
  readonly excerpt: string;
  readonly contentHtml: string;
}

export interface ResolvedBlogPresentation extends BlogPresentationFields {
  readonly presentationMode: "translated" | "original";
  readonly isStale: boolean;
  readonly activeLanguage: LanguageCode | string;
}

export interface BlogPresentationDeps extends LocalizedPresentationDeps {}

const defaultDeps: BlogPresentationDeps = {
  resolveTranslatedContent,
  generateContentTranslation,
};

/**
 * Resolve eligible Blog presentation fields for the interface locale.
 */
export async function resolveBlogPostPresentation(
  input: {
    readonly postId: string;
    readonly canonical: BlogPresentationFields;
    readonly displayLanguage?: LanguageCode | string;
    readonly ready?: boolean;
    readonly translationPreference?: string;
    readonly requestGeneration?: number;
    /**
     * @deprecated Prefer displayLanguage + ready + translationPreference.
     * Kept for transitional call sites that still pass readingContext.
     */
    readonly readingContext?: {
      readonly ready: boolean;
      readonly readingLanguage: string;
      readonly translationPreference: string;
    };
  },
  deps: BlogPresentationDeps = defaultDeps,
): Promise<ResolvedBlogPresentation> {
  const ready = input.ready ?? input.readingContext?.ready ?? false;
  const translationPreference =
    input.translationPreference ??
    input.readingContext?.translationPreference ??
    "preferred";
  const displayLanguage =
    input.displayLanguage ?? input.readingContext?.readingLanguage ?? "en";

  const canonicalFields = {
    title: input.canonical.title,
    excerpt: input.canonical.excerpt,
    content: input.canonical.contentHtml,
  };

  const resolved = await resolveLocalizedPresentation({
    request: {
      sourceKind: "blog_post",
      sourceRecordId: input.postId,
      displayLanguage,
      ready,
      translationPreference,
      requestGeneration: input.requestGeneration,
      enableOnDemandGenerate: true,
    },
    canonicalFields,
    deps,
  });

  if (resolved.presentationMode === "original") {
    return {
      ...input.canonical,
      presentationMode: "original",
      isStale: resolved.isStale,
      activeLanguage: resolved.activeLanguage,
    };
  }

  return {
    title: resolved.fields.title?.trim() || input.canonical.title,
    excerpt: resolved.fields.excerpt?.trim() || input.canonical.excerpt,
    contentHtml: resolved.fields.content?.trim() || input.canonical.contentHtml,
    presentationMode: "translated",
    isStale: resolved.isStale,
    activeLanguage: resolved.activeLanguage,
  };
}
