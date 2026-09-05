/**
 * Pack 08K.3.1 — client resolve for public-news-card presentation.
 * Interface locale is authoritative. Never use reading-language preference as render locale.
 * Translations load via resolveLocalizedPresentation (generate-on-miss when preferred).
 */

"use client";

import type { PublicNewsArticleItem, PublicLocalizedPresentation } from "@hu/types";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { usePublicContentReadingContext } from "../language/use-public-content-reading-context";
import { resolvePublicNewsLocalizedPresentation } from "./resolve-public-news-presentation";

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
  const injected = fixtureTranslationsByArticleId.get(input.article.id);
  const localized = localizePublicNewsArticlePresentation({
    article: input.article,
    targetLanguage: input.locale,
    translations: input.translations ?? injected,
  });
  return viewFromLocalized(localized);
}

/**
 * Hook: localize shared public-news-card presentation for the interface locale.
 * Sync fixture path for tests; async resolve/generate for runtime.
 */
export function useLocalizedPublicNewsCard(
  article: PublicNewsArticleItem,
): LocalizedPublicNewsCardView {
  const locale = useLocale();
  const displayLanguage = resolvePublicContentDisplayLanguage(locale);
  const readingContext = usePublicContentReadingContext();
  const requestGenerationRef = useRef(0);

  const seed = useMemo(
    () => resolveLocalizedPublicNewsCardView({ article, locale: displayLanguage }),
    [article, displayLanguage],
  );

  const [view, setView] = useState(seed);

  useEffect(() => {
    setView(seed);
    const injected = fixtureTranslationsByArticleId.get(article.id);
    if (injected) {
      setView(
        resolveLocalizedPublicNewsCardView({
          article,
          locale: displayLanguage,
          translations: injected,
        }),
      );
      return;
    }

    if (!readingContext.ready) {
      return;
    }

    const requestGeneration = ++requestGenerationRef.current;
    let cancelled = false;

    void (async () => {
      try {
        const localized = await resolvePublicNewsLocalizedPresentation({
          article,
          displayLanguage,
          ready: readingContext.ready,
          translationPreference: readingContext.translationPreference,
          requestGeneration,
        });
        if (cancelled || requestGeneration !== requestGenerationRef.current) {
          return;
        }
        setView(viewFromLocalized(localized));
      } catch {
        // keep seed / canonical fallback
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    article,
    displayLanguage,
    readingContext.ready,
    readingContext.translationPreference,
    seed,
  ]);

  return view;
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
