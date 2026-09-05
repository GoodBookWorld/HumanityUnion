/**
 * Pack 08J.1 / 08K — reusable Blog presentation via the generic localized boundary.
 *
 * After field resolve, builds a PublicPresentationNode and runs
 * localizePublicPresentation so coverage is computed on every resolve.
 * Canonical fields are never mutated.
 */

import type {
  LanguageCode,
  PublicLocalizedPresentationCoverage,
  PublicPresentationNode,
} from "@hu/types";
import {
  PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
  protectedIdentity,
} from "@hu/types";

import {
  resolveLocalizedPresentation,
  type LocalizedPresentationDeps,
} from "../language/resolve-localized-presentation";
import {
  localizePublicPresentation,
} from "../language/public-localized-presentation";
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
  /** Pack 08K — PublicLocalizedPresentation coverage for title/excerpt/content. */
  readonly coverage: PublicLocalizedPresentationCoverage;
}

export interface BlogPresentationDeps extends LocalizedPresentationDeps {}

const defaultDeps: BlogPresentationDeps = {
  resolveTranslatedContent,
  generateContentTranslation,
};

function buildBlogPresentationTree(input: {
  readonly canonical: BlogPresentationFields;
  readonly authorDisplayName?: string | null;
}): PublicPresentationNode {
  const tree: Record<string, PublicPresentationNode> = {
    title: input.canonical.title,
    excerpt: input.canonical.excerpt,
    content: input.canonical.contentHtml,
  };
  if (input.authorDisplayName && input.authorDisplayName.trim()) {
    tree.authorName = protectedIdentity(input.authorDisplayName.trim());
  }
  return tree;
}

/**
 * Resolve eligible Blog presentation fields for the interface locale.
 * Bridges resolveLocalizedPresentation → localizePublicPresentation coverage.
 */
export async function resolveBlogPostPresentation(
  input: {
    readonly postId: string;
    readonly canonical: BlogPresentationFields;
    readonly displayLanguage?: LanguageCode | string;
    readonly ready?: boolean;
    readonly translationPreference?: string;
    readonly requestGeneration?: number;
    readonly authorDisplayName?: string | null;
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

  const presentationTree = buildBlogPresentationTree({
    canonical: input.canonical,
    authorDisplayName: input.authorDisplayName,
  });

  const sourceLanguage = "en";
  const targetLanguage = resolved.activeLanguage || displayLanguage;

  const translations: Record<string, string> =
    resolved.presentationMode === "original"
      ? {}
      : {
          title: resolved.fields.title?.trim() || input.canonical.title,
          excerpt: resolved.fields.excerpt?.trim() || input.canonical.excerpt,
          content: resolved.fields.content?.trim() || input.canonical.contentHtml,
        };

  const localized = localizePublicPresentation({
    identity: {
      sourceKind: "blog_post",
      sourceRecordId: input.postId,
      presentationSchemaVersion: PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
    },
    sourceLanguage,
    targetLanguage,
    presentation: presentationTree,
    translations,
    stalePaths: resolved.isStale
      ? (["title", "excerpt", "content"] as const)
      : undefined,
    isMachineTranslated: resolved.presentationMode !== "original",
  });

  if (resolved.presentationMode === "original") {
    return {
      ...input.canonical,
      presentationMode: "original",
      isStale: resolved.isStale,
      activeLanguage: resolved.activeLanguage,
      coverage: localized.coverage,
    };
  }

  return {
    title: resolved.fields.title?.trim() || input.canonical.title,
    excerpt: resolved.fields.excerpt?.trim() || input.canonical.excerpt,
    contentHtml: resolved.fields.content?.trim() || input.canonical.contentHtml,
    presentationMode: "translated",
    isStale: resolved.isStale,
    activeLanguage: resolved.activeLanguage,
    coverage: localized.coverage,
  };
}
