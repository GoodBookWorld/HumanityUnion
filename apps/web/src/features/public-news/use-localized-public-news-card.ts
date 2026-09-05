/**
 * Pack 08K.3 — client resolve for public-news-card presentation.
 * Interface locale is authoritative. Never use reading-language preference as render locale.
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

export function resolveLocalizedPublicNewsCardView(input: {
  readonly article: PublicNewsArticleItem;
  readonly locale: string;
  readonly translations?: Readonly<Record<string, string>>;
}): LocalizedPublicNewsCardView {
  const injected = fixtureTranslationsByArticleId.get(input.article.id);
  const localized = localizePublicNewsArticlePresentation({
    article: input.article,
    targetLanguage: input.locale,
    translations: input.translations ?? injected,
  });
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

/**
 * Hook: localize shared public-news-card presentation for the interface locale.
 */
export function useLocalizedPublicNewsCard(
  article: PublicNewsArticleItem,
): LocalizedPublicNewsCardView {
  const locale = useLocale();
  return useMemo(
    () => resolveLocalizedPublicNewsCardView({ article, locale }),
    [article, locale],
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
