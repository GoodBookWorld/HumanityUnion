/**
 * Pack 08K.3.1 — public_news → PublicLocalizedPresentation via resolveLocalizedPresentation.
 * Interface display language owns resolve; readingContext supplies ready + preference only.
 */

import type {
  LanguageCode,
  PublicLocalizedPresentation,
  PublicNewsArticleItem,
  PublicPresentationNode,
} from "@hu/types";
import { PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION } from "@hu/types";

import {
  resolveLocalizedPresentation,
  type LocalizedPresentationDeps,
} from "../language/resolve-localized-presentation";
import {
  generateContentTranslation,
  resolveTranslatedContent,
} from "../language/translation-api";
import {
  buildPublicNewsArticlePresentation,
  asPublicNewsPresentationNode,
} from "../language/adapters/public-news-article-presentation";
import { localizePublicPresentation } from "../language/public-localized-presentation";

export interface PublicNewsPresentationDeps extends LocalizedPresentationDeps {}

const defaultDeps: PublicNewsPresentationDeps = {
  resolveTranslatedContent,
  generateContentTranslation,
};

/**
 * Resolve CURRENT/MISSING/STALE for a public news article and build PLP.
 * Canonical article fields are never mutated.
 */
export async function resolvePublicNewsLocalizedPresentation(
  input: {
    readonly article: PublicNewsArticleItem & {
      readonly extensions?: Record<string, PublicPresentationNode>;
    };
    readonly displayLanguage: LanguageCode | string;
    readonly ready: boolean;
    readonly translationPreference: string;
    readonly requestGeneration?: number;
  },
  deps: PublicNewsPresentationDeps = defaultDeps,
): Promise<PublicLocalizedPresentation> {
  const canonicalFields: Record<string, string> = {
    title: input.article.title,
    summary: input.article.summary,
    category: input.article.category ?? "",
  };

  const resolved = await resolveLocalizedPresentation({
    request: {
      sourceKind: "public_news",
      sourceRecordId: input.article.id,
      displayLanguage: input.displayLanguage,
      ready: input.ready,
      translationPreference: input.translationPreference,
      requestGeneration: input.requestGeneration,
      enableOnDemandGenerate: true,
    },
    canonicalFields,
    deps,
  });

  const presentation = asPublicNewsPresentationNode(
    buildPublicNewsArticlePresentation(input.article),
  );
  const sourceLanguage = input.article.language?.trim() || "en";
  const targetLanguage = resolved.activeLanguage || input.displayLanguage;

  const translations: Record<string, string> =
    resolved.presentationMode === "original"
      ? {}
      : {
          title: resolved.fields.title?.trim() || input.article.title,
          summary: resolved.fields.summary?.trim() || input.article.summary,
          category: resolved.fields.category?.trim() || input.article.category || "",
        };

  return localizePublicPresentation({
    identity: {
      sourceKind: "public_news",
      sourceRecordId: input.article.id,
      presentationSchemaVersion: PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
    },
    sourceLanguage,
    targetLanguage,
    presentation,
    translations,
    stalePaths: resolved.isStale ? (["title", "summary", "category"] as const) : undefined,
    isMachineTranslated: resolved.presentationMode !== "original",
  });
}
