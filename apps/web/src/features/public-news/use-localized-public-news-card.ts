/**
 * Pack 08K.3.1 — client resolve for public-news-card presentation.
 * Interface locale is authoritative. Never use reading-language preference as render locale.
 *
 * Final Localization Closure 02 — RSS title/summary are original-language-only.
 * Never apply PLP machine overlays or CT generate-on-miss for those fields.
 * Category / UI chrome remain localized via dictionary elsewhere.
 */

"use client";

import type { PublicNewsArticleItem, PublicLocalizedPresentation } from "@hu/types";
import { useMemo } from "react";
import { useLocale } from "next-intl";

import {
  buildCompletePublicNewsFixtureTranslations,
  localizePublicNewsArticlePresentation,
  readPublicNewsPresentationCategory,
  readPublicNewsPresentationSummary,
  readPublicNewsPresentationTitle,
  readPublicNewsProtectedArticleUrl,
  readPublicNewsProtectedId,
  readPublicNewsProtectedImageUrl,
  readPublicNewsProtectedPublishedAt,
  readPublicNewsProtectedSourceName,
} from "../language/adapters/public-news-article-presentation.js";
import { resolvePublicContentDisplayLanguage } from "../language/resolve-public-content-display-language";

/** Test-only injection: complete translation maps keyed by article id. */
const fixtureTranslationsByArticleId = new Map<string, Record<string, string>>();

export function setPublicNewsFixtureTranslationsForTests(
  articleId: string,
  translations: Record<string, string> | null,
): void {
  if (!translations) {
    fixtureTranslationsByArticleId.delete(articleId);
    return;
  }
  fixtureTranslationsByArticleId.set(articleId, translations);
}

export function resetPublicNewsFixtureTranslationsForTests(): void {
  fixtureTranslationsByArticleId.clear();
}

export type LocalizedPublicNewsCardView = {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly category: string;
  readonly sourceName: string;
  readonly articleUrl: string;
  readonly imageUrl: string | undefined;
  readonly publishedAt: string;
  readonly coverage: PublicLocalizedPresentation["coverage"];
  readonly localized: PublicLocalizedPresentation;
};

function viewFromLocalized(
  localized: PublicLocalizedPresentation,
): LocalizedPublicNewsCardView {
  const presentation = localized.presentation;
  return {
    id: readPublicNewsProtectedId(presentation),
    title: readPublicNewsPresentationTitle(presentation),
    summary: readPublicNewsPresentationSummary(presentation),
    category: readPublicNewsPresentationCategory(presentation),
    sourceName: readPublicNewsProtectedSourceName(presentation),
    articleUrl: readPublicNewsProtectedArticleUrl(presentation),
    imageUrl: readPublicNewsProtectedImageUrl(presentation),
    publishedAt: readPublicNewsProtectedPublishedAt(presentation),
    coverage: localized.coverage,
    localized,
  };
}

export function resolveLocalizedPublicNewsCardView(input: {
  readonly article: PublicNewsArticleItem;
  readonly locale: string;
  readonly translations?: Readonly<Record<string, string>>;
}): LocalizedPublicNewsCardView {
  // Original-language-only: ignore injected machine translations for title/summary.
  // Fixtures may still set category-only maps; title/summary always stay canonical.
  const injected = fixtureTranslationsByArticleId.get(input.article.id);
  const raw = input.translations ?? injected;
  const translations =
    raw && Object.keys(raw).length > 0
      ? {
          // Never overlay RSS prose from CT/PLP fixtures in runtime policy path.
          // Tests that need translated fixtures must use localize helper directly.
          ...(typeof raw.category === "string" ? { category: raw.category } : {}),
        }
      : undefined;
  const localized = localizePublicNewsArticlePresentation({
    article: input.article,
    targetLanguage: input.locale,
    translations,
  });
  return viewFromLocalized(localized);
}

/**
 * Hook: render public-news-card from stored original title/summary.
 * Never resolve/generate content_translations; never apply PLP machine overlays.
 */
export function useLocalizedPublicNewsCard(
  article: PublicNewsArticleItem,
  options?: {
    /** @deprecated Kept for call-site compatibility; CT is never used for RSS. */
    readonly skipClientTranslation?: boolean;
    /**
     * Accepted for call-site compatibility. Historical PUBLISHED_LOCALIZED
     * overlays are ignored for title/summary (original-language-only policy).
     */
    readonly plpPresentation?: {
      readonly mode: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK";
      readonly presentation: unknown;
    };
  },
): LocalizedPublicNewsCardView {
  void options;
  const locale = useLocale();
  const displayLanguage = resolvePublicContentDisplayLanguage(locale);

  return useMemo(
    () => resolveLocalizedPublicNewsCardView({ article, locale: displayLanguage }),
    [article, displayLanguage],
  );
}

/** Helper for complete fixture coverage in tests. */
export function seedCompletePublicNewsFixtureForTests(
  article: PublicNewsArticleItem,
  locale: string,
): void {
  setPublicNewsFixtureTranslationsForTests(
    article.id,
    buildCompletePublicNewsFixtureTranslations(article, locale),
  );
}
