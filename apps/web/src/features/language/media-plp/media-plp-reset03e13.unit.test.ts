/**
 * Reset 03E.13 — Web Media PLP batch identity join + 12-card News closure.
 * No Gemini / materialize / Mongo write / deploy.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";

import {
  MEDIA_PLP_ENTITY_TYPE,
  type CivicMediaCenterPublic,
  type PublicNewsArticleItem,
  type TrustedMediaResource,
} from "@hu/types";

import { CivicMediaCenterPageContent } from "../../civic-media-center/components/CivicMediaCenterPageContent.js";
import {
  evaluateMediaCarouselSemanticClosure,
  MEDIA_PUBLIC_NEWS_CAROUSEL_EXPECTED_COUNT,
} from "./media-carousel-semantic-closure.js";
import {
  attachMediaPlpBatchByIdentity,
  indexMediaPlpBatchResultsByIdentity,
} from "./media-plp-batch-identity-join.js";
import { MEDIA_PLP_NEWS_BATCH_LIMIT } from "./compose-media-page-localization.js";
import type { MediaPlpResolvedPresentation } from "./presentation.js";
import { loadUiMessagesForLocale } from "../../i18n/load-ui-messages.js";

(globalThis as { React?: typeof React }).React = React;

const __dirname = dirname(fileURLToPath(import.meta.url));
const webSrc = join(__dirname, "../../..");

const reuters: TrustedMediaResource = {
  id: "reuters",
  name: "Reuters",
  logoLabel: "R",
  country: "International",
  categoryId: "international-wire-service",
  explanation: "Independent international news agency with global editorial standards.",
  websiteUrl: "https://www.reuters.com/",
  sortOrder: 1,
};

function sampleMedia(): CivicMediaCenterPublic {
  return {
    overview: {
      title: "Overview title EN",
      summary: "Overview summary EN",
      points: [
        { id: "p1", heading: "Point heading EN", body: "Point body EN" },
        { id: "p2", heading: "Point two EN", body: "Point two body EN" },
      ],
    },
    selectionPrinciples: [
      {
        id: "editorial-transparency",
        title: "Independence EN",
        description: "Principle description EN",
        whyItMatters: "Why matters EN",
        sortOrder: 1,
      },
    ],
    trustedMediaCategories: [
      {
        id: "international-wire-service",
        title: "Wire",
        description: "Wire services",
        sortOrder: 1,
      },
    ],
    trustedMedia: [reuters],
    factChecking: [
      {
        id: "snopes",
        name: "Snopes",
        logoLabel: "S",
        mission: "Mission EN",
        coverage: "Claims, Politics",
        websiteUrl: "https://www.snopes.com/",
        sortOrder: 1,
      },
    ],
    propagandaAnalysis: [
      {
        id: "euvsdisinfo",
        name: "EUvsDisinfo",
        logoLabel: "E",
        focus: "Disinfo",
        explanation: "Propaganda explanation EN",
        websiteUrl: "https://euvsdisinfo.eu/",
        sortOrder: 1,
      },
    ],
    faq: [
      {
        id: "faq-1",
        question: "FAQ question EN?",
        answer: "FAQ answer EN",
        sortOrder: 1,
      },
    ],
    initiativeFlow: {
      title: "Flow",
      summary: "Summary",
      diagramSvg: "",
      stages: ["One", "Two"],
    },
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeNews(i: number): PublicNewsArticleItem {
  const id = `news-${String(i).padStart(2, "0")}`;
  return {
    id,
    title: `News title EN ${id}`,
    summary: `News summary EN ${id} that is long enough for bullet extraction.`,
    category: "peace and security",
    sourceName: "Reuters",
    articleUrl: `https://example.com/${id}`,
    publishedAt: "2026-01-01T00:00:00.000Z",
    verificationStatus: "external-source",
    geographicScope: "global",
    language: "en",
  };
}

function plp(
  entityId: string,
  mode: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK",
  presentation: MediaPlpResolvedPresentation["presentation"],
  reasonCode?: string,
): MediaPlpResolvedPresentation {
  return {
    mode,
    presentation,
    entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
    entityId,
    locale: "uk",
    canonicalVersion: mode === "PUBLISHED_LOCALIZED" ? "v-plp2" : "canonical",
    ...(reasonCode ? { reasonCode } : {}),
  };
}

function carouselPlpSeed(locale: string) {
  return {
    plpTrustedById: {
      reuters: {
        mode: "PUBLISHED_LOCALIZED" as const,
        presentation: { explanation: `[${locale}] trusted explanation` },
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
        entityId: "reuters",
        locale,
        canonicalVersion: "v",
      },
    },
    plpPrinciplesById: {
      "editorial-transparency": {
        mode: "PUBLISHED_LOCALIZED" as const,
        presentation: {
          title: `[${locale}] principle title`,
          description: `[${locale}] principle description`,
          whyItMatters: `[${locale}] why matters`,
        },
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
        entityId: "editorial-transparency",
        locale,
        canonicalVersion: "v",
      },
    },
    plpEditorialPresentation: {
      mode: "PUBLISHED_LOCALIZED" as const,
      presentation: {
        overviewTitle: `[${locale}] overview title`,
        overviewSummary: `[${locale}] overview summary`,
        overviewPoints: [
          { id: "p1", heading: `[${locale}] point 1`, body: `[${locale}] body 1` },
          { id: "p2", heading: `[${locale}] point 2`, body: `[${locale}] body 2` },
        ],
        faq: [{ id: "faq-1", question: `[${locale}] FAQ?`, answer: `[${locale}] FAQ A` }],
      },
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: "civic-media-center",
      locale,
      canonicalVersion: "v",
    },
    plpFactCheckById: {
      snopes: {
        mode: "PUBLISHED_LOCALIZED" as const,
        presentation: {
          mission: `[${locale}] mission`,
          coverage: `[${locale}] Claims, Politics`,
        },
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_FACT_CHECK,
        entityId: "snopes",
        locale,
        canonicalVersion: "v",
      },
    },
    plpPropagandaById: {
      euvsdisinfo: {
        mode: "PUBLISHED_LOCALIZED" as const,
        presentation: {
          focus: `[${locale}] focus`,
          explanation: `[${locale}] propaganda`,
        },
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PROPAGANDA,
        entityId: "euvsdisinfo",
        locale,
        canonicalVersion: "v",
      },
    },
  };
}

async function renderNewsRail(input: {
  readonly news: PublicNewsArticleItem[];
  readonly plpNewsById: Record<string, MediaPlpResolvedPresentation>;
}): Promise<string> {
  const loaded = await loadUiMessagesForLocale("uk");
  const tree = createElement(
    NextIntlClientProvider,
    {
      locale: "uk",
      messages: loaded.messages,
      timeZone: "UTC",
      children: createElement(
        CivicMediaCenterPageContent as React.ComponentType<Record<string, unknown>>,
        {
          initialMedia: sampleMedia(),
          ...carouselPlpSeed("uk"),
          plpNewsById: input.plpNewsById,
          initialNewsArticles: input.news,
        },
      ),
    } as React.ComponentProps<typeof NextIntlClientProvider>,
  );
  return renderToStaticMarkup(tree);
}

describe("Reset 03E.13 — batch identity join", () => {
  it("limits stay aligned at 12", () => {
    assert.equal(MEDIA_PLP_NEWS_BATCH_LIMIT, 12);
    assert.equal(MEDIA_PUBLIC_NEWS_CAROUSEL_EXPECTED_COUNT, 12);
  });

  it("attaches by identity; response order / sparse rows cannot shift cards", () => {
    const items = [
      {
        entityType: "public_news",
        entityId: "n1",
        key: "n1",
        canonical: "c1",
      },
      {
        entityType: "public_news",
        entityId: "n2",
        key: "n2",
        canonical: "c2",
      },
      {
        entityType: "public_news",
        entityId: "n3",
        key: "n3",
        canonical: "c3",
      },
    ];
    // Response: only n2 localized, plus unknown, reverse order vs request.
    const results = [
      {
        entityType: "public_news",
        entityId: "unknown",
        mode: "PUBLISHED_LOCALIZED" as const,
        title: "SHOULD_NOT_ATTACH",
      },
      {
        entityType: "public_news",
        entityId: "n2",
        mode: "PUBLISHED_LOCALIZED" as const,
        title: "UK n2",
      },
    ];
    const byEntityKey = indexMediaPlpBatchResultsByIdentity(results);
    const attached = attachMediaPlpBatchByIdentity({
      items,
      byEntityKey,
      mapHit: (hit): { mode: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK"; title: string } => ({
        mode: hit.mode,
        title: hit.title,
      }),
      fallback: (item): { mode: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK"; title: string } => ({
        mode: "CANONICAL_FALLBACK",
        title: item.canonical,
      }),
    });

    assert.equal(attached.n1?.mode, "CANONICAL_FALLBACK");
    assert.equal(attached.n1?.title, "c1");
    assert.equal(attached.n2?.mode, "PUBLISHED_LOCALIZED");
    assert.equal(attached.n2?.title, "UK n2");
    assert.equal(attached.n3?.mode, "CANONICAL_FALLBACK");
    assert.equal(attached.n3?.title, "c3");
    assert.equal(Object.keys(attached).includes("unknown"), false);
  });

  it("load-media-plp-ssr uses identity join helpers", () => {
    const src = readFileSync(
      join(webSrc, "features/language/media-plp/load-media-plp-ssr.ts"),
      "utf8",
    );
    assert.match(src, /indexMediaPlpBatchResultsByIdentity/);
    assert.match(src, /attachMediaPlpBatchByIdentity/);
  });
});

describe("Reset 03E.13 — 12-card News semantic closure", () => {
  it("12 original-language news cards → FULLY_LOCALIZED", async () => {
    const news = Array.from({ length: 12 }, (_, i) => makeNews(i));
    const plpNewsById: Record<string, MediaPlpResolvedPresentation> = {};
    for (const article of news) {
      plpNewsById[article.id] = plp(
        article.id,
        "PUBLISHED_LOCALIZED",
        {
          title: `[uk] ${article.title}`,
          summary: `[uk] ${article.summary}`,
        },
      );
    }
    const html = await renderNewsRail({ news, plpNewsById });
    const report = evaluateMediaCarouselSemanticClosure({ html, locale: "uk" });
    assert.equal(report.PUBLIC_NEWS_CARD_COUNT, 12);
    assert.equal(report.PUBLIC_NEWS_LOCALIZED_CARD_COUNT, 12);
    assert.equal(report.PUBLIC_NEWS_FALLBACK_CARD_COUNT, 0);
    assert.equal(report.FULLY_LOCALIZED, true);
    assert.match(html, /News title EN news-00/);
    assert.doesNotMatch(html, /\[uk\] News title EN/);
  });

  it("missing PLP for one card still FULLY_LOCALIZED (original-language policy)", async () => {
    const news = Array.from({ length: 12 }, (_, i) => makeNews(i));
    const plpNewsById: Record<string, MediaPlpResolvedPresentation> = {};
    for (const article of news) {
      if (article.id === "news-07") {
        plpNewsById[article.id] = plp(
          article.id,
          "CANONICAL_FALLBACK",
          { title: article.title, summary: article.summary },
          "NO_PUBLISHED_SNAPSHOT",
        );
        continue;
      }
      plpNewsById[article.id] = plp(
        article.id,
        "PUBLISHED_LOCALIZED",
        {
          title: `[uk] ${article.title}`,
          summary: `[uk] ${article.summary}`,
        },
      );
    }
    const html = await renderNewsRail({ news, plpNewsById });
    const report = evaluateMediaCarouselSemanticClosure({ html, locale: "uk" });
    assert.equal(report.PUBLIC_NEWS_CARD_COUNT, 12);
    assert.equal(report.PUBLIC_NEWS_LOCALIZED_CARD_COUNT, 12);
    assert.equal(report.PUBLIC_NEWS_FALLBACK_CARD_COUNT, 0);
    assert.equal(report.FULLY_LOCALIZED, true);
  });

  it("silent batch omission still FULLY_LOCALIZED via original RSS fields", async () => {
    const news = Array.from({ length: 12 }, (_, i) => makeNews(i));
    const plpNewsById: Record<string, MediaPlpResolvedPresentation> = {};
    for (const article of news) {
      if (article.id === "news-03") {
        continue; // omitted from batch map
      }
      plpNewsById[article.id] = plp(
        article.id,
        "PUBLISHED_LOCALIZED",
        {
          title: `[uk] ${article.title}`,
          summary: `[uk] ${article.summary}`,
        },
      );
    }
    const html = await renderNewsRail({ news, plpNewsById });
    const report = evaluateMediaCarouselSemanticClosure({ html, locale: "uk" });
    assert.equal(report.PUBLIC_NEWS_CARD_COUNT, 12);
    assert.equal(report.PUBLIC_NEWS_FALLBACK_CARD_COUNT, 0);
    assert.equal(report.FULLY_LOCALIZED, true);
    assert.match(html, /News title EN news-03/);
  });
});
