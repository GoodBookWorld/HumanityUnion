/**
 * Final Localization Closure 02 — web presentation + semantic closure for RSS originals.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PublicNewsArticleItem } from "@hu/types";

import { evaluateMediaCarouselSemanticClosure } from "./media-carousel-semantic-closure.js";
import { resolveLocalizedPublicNewsCardView } from "../../public-news/use-localized-public-news-card.js";
import { resolvePublicNewsLocalizedPresentation } from "../../public-news/resolve-public-news-presentation.js";

function sampleArticle(): PublicNewsArticleItem {
  return {
    id: "news-web-closure02",
    title: "Original English RSS headline",
    summary: "Original English RSS summary stays source-language.",
    category: "democracy",
    sourceName: "Reuters",
    articleUrl: "https://example.com/article",
    publishedAt: "2026-01-01T00:00:00.000Z",
    verificationStatus: "external-source",
    geographicScope: "global",
    language: "en",
  };
}

describe("Final Localization Closure 02 — web public_news originals", () => {
  it("non-English UI locale still renders original RSS title/summary", () => {
    const article = sampleArticle();
    const view = resolveLocalizedPublicNewsCardView({
      article,
      locale: "uk",
      translations: {
        title: "Перекладений заголовок",
        summary: "Перекладений короткий виклад",
      },
    });
    assert.equal(view.title, article.title);
    assert.equal(view.summary, article.summary);
  });

  it("resolvePublicNewsLocalizedPresentation never machine-translates RSS prose", async () => {
    const article = sampleArticle();
    const localized = await resolvePublicNewsLocalizedPresentation({
      article,
      displayLanguage: "uk",
      ready: true,
      translationPreference: "preferred",
    });
    assert.equal(localized.isMachineTranslated, false);
    const presentation = localized.presentation as {
      title?: { value?: string } | string;
      summary?: { value?: string } | string;
    };
    const title =
      typeof presentation.title === "string"
        ? presentation.title
        : presentation.title?.value;
    const summary =
      typeof presentation.summary === "string"
        ? presentation.summary
        : presentation.summary?.value;
    assert.equal(title, article.title);
    assert.equal(summary, article.summary);
  });

  it("semantic closure treats protected original news leaves as policy-success", () => {
    const cards = Array.from({ length: 12 }, (_, i) => {
      const id = `news-card-${i}`;
      return `
<article class="public-news-card">
  <span data-hu-semantic-node="1" data-hu-semantic-owner="PROTECTED_CANONICAL" data-hu-semantic-result="PROTECTED_CANONICAL" data-hu-plp-entity="public_news" data-hu-plp-id="${id}" data-hu-semantic-path="title">Original title ${i}</span>
  <span data-hu-semantic-node="1" data-hu-semantic-owner="PROTECTED_CANONICAL" data-hu-semantic-result="PROTECTED_CANONICAL" data-hu-plp-entity="public_news" data-hu-plp-id="${id}" data-hu-semantic-path="summary">Original summary ${i}</span>
  <span data-hu-semantic-node="1" data-hu-semantic-owner="UI_DICTIONARY" data-hu-semantic-result="LOCALIZED_DICTIONARY">Новини</span>
</article>`;
    }).join("\n");
    const html = `<main>${cards}</main>`;
    const report = evaluateMediaCarouselSemanticClosure({ html, locale: "uk" });
    assert.equal(report.PUBLIC_NEWS_CARD_COUNT, 12);
    assert.equal(report.PUBLIC_NEWS_FALLBACK_CARD_COUNT, 0);
    assert.equal(report.PUBLIC_NEWS_OMITTED_CARD_COUNT, 0);
    assert.equal(report.PUBLIC_NEWS_LOCALIZED_CARD_COUNT, 12);
    assert.equal(report.CAROUSEL_PLP_FALLBACK_LEAVES, 0);
  });
});
