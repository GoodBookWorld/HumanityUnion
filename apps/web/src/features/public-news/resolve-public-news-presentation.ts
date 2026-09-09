/**
 * Pack 08K.3.1 — public_news → PublicLocalizedPresentation via resolveLocalizedPresentation.
 * Interface display language owns resolve; readingContext supplies ready + preference only.
 *
 * Final Localization Closure 02 — RSS title/summary stay original-language-only.
 * Never enable CT generate-on-miss; never apply machine translation overlays.
 */

import type {
  LanguageCode,
  PublicLocalizedPresentation,
  PublicNewsArticleItem,
  PublicPresentationNode,
} from "@hu/types";
import { PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION } from "@hu/types";

import {
  buildPublicNewsArticlePresentation,
  asPublicNewsPresentationNode,
} from "../language/adapters/public-news-article-presentation";
import { localizePublicPresentation } from "../language/public-localized-presentation";

export interface PublicNewsPresentationDeps {
  readonly resolveTranslatedContent?: unknown;
  readonly generateContentTranslation?: unknown;
}

/**
 * Resolve presentation for a public news article.
 * Canonical article fields are never mutated; title/summary always original.
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
  _deps: PublicNewsPresentationDeps = {},
): Promise<PublicLocalizedPresentation> {
  void input.ready;
  void input.translationPreference;
  void input.requestGeneration;
  void _deps;

  const presentation = asPublicNewsPresentationNode(
    buildPublicNewsArticlePresentation(input.article),
  );
  const sourceLanguage = input.article.language?.trim() || "en";
  const targetLanguage = input.displayLanguage;

  return localizePublicPresentation({
    identity: {
      sourceKind: "public_news",
      sourceRecordId: input.article.id,
      presentationSchemaVersion: PUBLIC_LOCALIZED_PRESENTATION_SCHEMA_VERSION,
    },
    sourceLanguage,
    targetLanguage,
    presentation,
    translations: {},
    isMachineTranslated: false,
  });
}
