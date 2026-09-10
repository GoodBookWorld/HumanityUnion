/**
 * Pack 08K.3.1 — client resolve for public-news-card presentation.
 * Interface locale is authoritative. Never use reading-language preference as render locale.
 *
 * Reset 01 — RSS title/summary use persisted PLP CURRENT when complete;
 * otherwise coherent canonical card. Never provider-on-read.
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
  readonly presentationMode: "localized" | "canonical";
  readonly plpResult: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK";
};

function readPlpStringField(presentation: unknown, key: string): string {
  if (!presentation || typeof presentation !== "object" || Array.isArray(presentation)) {
    return "";
  }
  const raw = (presentation as Record<string, unknown>)[key];
  if (typeof raw === "string") {
    return raw.trim();
  }
  if (
    raw &&
    typeof raw === "object" &&
    "value" in raw &&
    typeof (raw as { value: unknown }).value === "string"
  ) {
    return String((raw as { value: string }).value).trim();
  }
  return "";
}

/**
 * Whole-entity RSS card: title+summary both required for localized presentation.
 */
export function resolvePublicNewsCardFieldsFromPlp(input: {
  readonly article: PublicNewsArticleItem;
  readonly plpPresentation?: {
    readonly mode: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK";
    readonly presentation: unknown;
  } | null;
}): {
  readonly title: string;
  readonly summary: string;
  readonly presentationMode: "localized" | "canonical";
  readonly plpResult: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK";
} {
  const canonicalTitle = input.article.title;
  const canonicalSummary = input.article.summary;
  const plp = input.plpPresentation;
  if (!plp || plp.mode !== "PUBLISHED_LOCALIZED") {
    return {
      title: canonicalTitle,
      summary: canonicalSummary,
      presentationMode: "canonical",
      plpResult: "CANONICAL_FALLBACK",
    };
  }
  const title = readPlpStringField(plp.presentation, "title");
  const summary = readPlpStringField(plp.presentation, "summary");
  if (!title || !summary) {
    return {
      title: canonicalTitle,
      summary: canonicalSummary,
      presentationMode: "canonical",
      plpResult: "CANONICAL_FALLBACK",
    };
  }
  return {
    title,
    summary,
    presentationMode: "localized",
    plpResult: "PUBLISHED_LOCALIZED",
  };
}

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
  readonly plpPresentation?: {
    readonly mode: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK";
    readonly presentation: unknown;
  } | null;
}): LocalizedPublicNewsCardView {
  const card = resolvePublicNewsCardFieldsFromPlp({
    article: input.article,
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
    readonly plpPresentation?: {
      readonly mode: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK";
      readonly presentation: unknown;
    };
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
