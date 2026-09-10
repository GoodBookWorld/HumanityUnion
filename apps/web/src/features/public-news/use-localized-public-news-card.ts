/**
 * Pack 08K.3.1 — client resolve for public-news-card presentation.
 * Interface locale is authoritative. Never use reading-language preference as render locale.
 *
 * Reset 01 / Implementation 01 — RSS title/summary use persisted PLP CURRENT when
 * complete AND locale-matched; otherwise coherent canonical card.
 * Never provider-on-read. Never apply wrong-locale PLP (e.g. uk under ar).
 */

"use client";

import type { PublicNewsArticleItem, PublicLocalizedPresentation } from "@hu/types";
import { useMemo } from "react";
import { useLocale } from "next-intl";

import {
  buildCompletePublicNewsFixtureTranslations,
  localizePublicNewsArticlePresentation,
  readPublicNewsPresentationCategory,
  readPublicNewsProtectedArticleUrl,
  readPublicNewsProtectedId,
  readPublicNewsProtectedImageUrl,
  readPublicNewsProtectedPublishedAt,
  readPublicNewsProtectedSourceName,
} from "../language/adapters/public-news-article-presentation.js";
import { resolvePublicContentDisplayLanguage } from "../language/resolve-public-content-display-language";
import {
  resolvePublicNewsCardFieldsFromPlp,
  type PublicNewsPlpPresentationInput,
} from "./resolve-public-news-card-fields-from-plp.js";

export {
  resolvePublicNewsCardFieldsFromPlp,
  type PublicNewsPlpPresentationInput,
} from "./resolve-public-news-card-fields-from-plp.js";

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
  readonly presentationMode: "localized" | "canonical";
  readonly plpResult: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK";
};

function viewFromLocalized(
  localized: PublicLocalizedPresentation,
  card: {
    readonly title: string;
    readonly summary: string;
    readonly presentationMode: "localized" | "canonical";
    readonly plpResult: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK";
  },
): LocalizedPublicNewsCardView {
  const presentation = localized.presentation;
  return {
    id: readPublicNewsProtectedId(presentation),
    title: card.title,
    summary: card.summary,
    category: readPublicNewsPresentationCategory(presentation),
    sourceName: readPublicNewsProtectedSourceName(presentation),
    articleUrl: readPublicNewsProtectedArticleUrl(presentation),
    imageUrl: readPublicNewsProtectedImageUrl(presentation),
    publishedAt: readPublicNewsProtectedPublishedAt(presentation),
    coverage: localized.coverage,
    localized,
    presentationMode: card.presentationMode,
    plpResult: card.plpResult,
  };
}

export function resolveLocalizedPublicNewsCardView(input: {
  readonly article: PublicNewsArticleItem;
  readonly locale: string;
  readonly translations?: Readonly<Record<string, string>>;
  readonly plpPresentation?: PublicNewsPlpPresentationInput | null;
}): LocalizedPublicNewsCardView {
  const card = resolvePublicNewsCardFieldsFromPlp({
    article: input.article,
    requestedLocale: input.locale,
    plpPresentation: input.plpPresentation,
  });

  const injected = fixtureTranslationsByArticleId.get(input.article.id);
  const raw = input.translations ?? injected;
  const translations =
    card.presentationMode === "localized"
      ? { title: card.title, summary: card.summary }
      : raw && Object.keys(raw).length > 0
        ? {
            ...(typeof raw.title === "string" ? { title: raw.title } : {}),
            ...(typeof raw.summary === "string" ? { summary: raw.summary } : {}),
            ...(typeof raw.category === "string" ? { category: raw.category } : {}),
          }
        : undefined;

  const localized = localizePublicNewsArticlePresentation({
    article: input.article,
    targetLanguage: input.locale,
    translations,
  });
  return viewFromLocalized(localized, card);
}

/**
 * Hook: render public-news-card from persisted PLP or coherent canonical.
 * Never resolve/generate content_translations on read.
 */
export function useLocalizedPublicNewsCard(
  article: PublicNewsArticleItem,
  options?: {
    /** @deprecated Kept for call-site compatibility; CT is never used for RSS. */
    readonly skipClientTranslation?: boolean;
    readonly plpPresentation?: PublicNewsPlpPresentationInput;
  },
): LocalizedPublicNewsCardView {
  void options?.skipClientTranslation;
  const locale = useLocale();
  const displayLanguage = resolvePublicContentDisplayLanguage(locale);
  const plpPresentation = options?.plpPresentation ?? null;

  return useMemo(
    () =>
      resolveLocalizedPublicNewsCardView({
        article,
        locale: displayLanguage,
        plpPresentation,
      }),
    [article, displayLanguage, plpPresentation],
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
