/**
 * Reset 03E.11 — DOM → ownership carousel semantic closure.
 * Authority: real rendered MediaSemanticNode leaves on CivicMediaCenterPageContent.
 * No Gemini / materialize / Mongo write / deploy.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";

import {
  MEDIA_PLP_ENTITY_TYPE,
  type CivicMediaCenterPublic,
  type PublicNewsArticleItem,
  type TrustedMediaResource,
} from "@hu/types";

import { CivicMediaCenterPageContent } from "../../civic-media-center/components/CivicMediaCenterPageContent.js";
import { MediaSemanticNode } from "./media-semantic-contract.js";
import {
  assertMediaCarouselFullyLocalized,
  evaluateMediaCarouselSemanticClosure,
  mediaCarouselExpectedLeafContract,
} from "./media-carousel-semantic-closure.js";
import { collectRenderedMediaSemanticNodes } from "./media-rendered-coverage.js";
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

function sampleNews(): PublicNewsArticleItem {
  return {
    id: "news-1",
    title: "News title EN",
    summary: "News summary EN that is long enough for bullet extraction.",
    category: "peace and security",
    sourceName: "Reuters",
    articleUrl: "https://example.com/n1",
    publishedAt: "2026-01-01T00:00:00.000Z",
    verificationStatus: "external-source",
    geographicScope: "global",
    language: "en",
  };
}

function plp(
  entityType: string,
  entityId: string,
  mode: "PUBLISHED_LOCALIZED" | "CANONICAL_FALLBACK",
  presentation: MediaPlpResolvedPresentation["presentation"],
  locale: string,
  reasonCode?: string,
): MediaPlpResolvedPresentation {
  return {
    mode,
    presentation,
    entityType,
    entityId,
    locale,
    canonicalVersion: mode === "PUBLISHED_LOCALIZED" ? "v-plp2" : "canonical",
    ...(reasonCode ? { reasonCode } : {}),
  };
}

function fullySeeded(locale: string) {
  return {
    plpTrustedById: {
      reuters: plp(
        MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
        "reuters",
        "PUBLISHED_LOCALIZED",
        { explanation: `[${locale}] trusted explanation` },
        locale,
      ),
    },
    plpPrinciplesById: {
      "editorial-transparency": plp(
        MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
        "editorial-transparency",
        "PUBLISHED_LOCALIZED",
        {
          title: `[${locale}] principle title`,
          description: `[${locale}] principle description`,
          whyItMatters: `[${locale}] why matters`,
        },
        locale,
      ),
    },
    plpEditorialPresentation: plp(
      MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      "civic-media-center",
      "PUBLISHED_LOCALIZED",
      {
        overviewTitle: `[${locale}] overview title`,
        overviewSummary: `[${locale}] overview summary`,
        overviewPoints: [
          { id: "p1", heading: `[${locale}] point 1`, body: `[${locale}] body 1` },
          { id: "p2", heading: `[${locale}] point 2`, body: `[${locale}] body 2` },
        ],
        faq: [{ id: "faq-1", question: `[${locale}] FAQ?`, answer: `[${locale}] FAQ A` }],
      },
      locale,
    ),
    plpFactCheckById: {
      snopes: plp(
        MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_FACT_CHECK,
        "snopes",
        "PUBLISHED_LOCALIZED",
        { mission: `[${locale}] mission`, coverage: `[${locale}] Claims, Politics` },
        locale,
      ),
    },
    plpPropagandaById: {
      euvsdisinfo: plp(
        MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PROPAGANDA,
        "euvsdisinfo",
        "PUBLISHED_LOCALIZED",
        { focus: `[${locale}] focus`, explanation: `[${locale}] propaganda` },
        locale,
      ),
    },
    plpNewsById: {
      "news-1": plp(
        MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
        "news-1",
        "PUBLISHED_LOCALIZED",
        {
          title: `[${locale}] news title`,
          summary: `[${locale}] news summary that is long enough for bullet extraction.`,
        },
        locale,
      ),
    },
  };
}

async function renderMediaPage(input: {
  readonly locale: string;
  readonly media?: CivicMediaCenterPublic;
  readonly news?: PublicNewsArticleItem[];
  readonly plpTrustedById?: Record<string, MediaPlpResolvedPresentation>;
  readonly plpPrinciplesById?: Record<string, MediaPlpResolvedPresentation>;
  readonly plpEditorialPresentation?: MediaPlpResolvedPresentation;
  readonly plpFactCheckById?: Record<string, MediaPlpResolvedPresentation>;
  readonly plpPropagandaById?: Record<string, MediaPlpResolvedPresentation>;
  readonly plpNewsById?: Record<string, MediaPlpResolvedPresentation>;
  readonly inject?: ReactNode;
}): Promise<string> {
  const loaded = await loadUiMessagesForLocale(input.locale);
  const media = input.media ?? sampleMedia();
  const tree = createElement(
    NextIntlClientProvider,
    {
      locale: input.locale,
      messages: loaded.messages,
      timeZone: "UTC",
      children: createElement(
        "div",
        null,
        createElement(CivicMediaCenterPageContent as React.ComponentType<Record<string, unknown>>, {
          initialMedia: media,
          plpTrustedById: input.plpTrustedById,
          plpPrinciplesById: input.plpPrinciplesById,
          plpEditorialPresentation: input.plpEditorialPresentation,
          plpFactCheckById: input.plpFactCheckById,
          plpPropagandaById: input.plpPropagandaById,
          plpNewsById: input.plpNewsById,
          initialNewsArticles: input.news ?? [sampleNews()],
        }),
        input.inject ?? null,
      ),
    } as React.ComponentProps<typeof NextIntlClientProvider>,
  );
  return renderToStaticMarkup(tree);
}

describe("Reset 03E.11 — rendered carousel semantic closure", () => {
  it("forensic: expected AUTO leaves match policy (2 news / 2 fact / 2 propaganda)", () => {
    const contract = mediaCarouselExpectedLeafContract();
    assert.equal(contract.filter((r) => r.entityType === "public_news").length, 2);
    assert.equal(
      contract.filter((r) => r.entityType === "civic_media_fact_check").length,
      2,
    );
    assert.equal(
      contract.filter((r) => r.entityType === "civic_media_propaganda").length,
      2,
    );
    assert.deepEqual(
      contract
        .filter((r) => r.entityType === "public_news")
        .map((r) => r.semanticPath),
      ["title", "summary"],
    );
    assert.deepEqual(
      contract
        .filter((r) => r.entityType === "civic_media_fact_check")
        .map((r) => r.semanticPath),
      ["mission", "coverage"],
    );
    assert.deepEqual(
      contract
        .filter((r) => r.entityType === "civic_media_propaganda")
        .map((r) => r.semanticPath),
      ["focus", "explanation"],
    );
  });

  it("1: UK + missing public_news PLP → not FULLY_LOCALIZED", async () => {
    const seeded = fullySeeded("uk");
    const html = await renderMediaPage({
      locale: "uk",
      ...seeded,
      plpNewsById: undefined,
    });
    const report = evaluateMediaCarouselSemanticClosure({ html, locale: "uk" });
    assert.notEqual(report.PAGE_STATUS, "FULLY_LOCALIZED");
    assert.ok(report.CAROUSEL_PLP_FALLBACK_LEAVES > 0);
    const newsLeaves = report.leaves.filter((l) => l.entityType === "public_news");
    assert.ok(newsLeaves.every((l) => l.result === "CANONICAL_FALLBACK"));
    assert.ok(
      newsLeaves.some((l) => l.fallbackReason === "NO_PUBLISHED_SNAPSHOT"),
    );
  });

  it("2: UK + missing fact-check PLP → not FULLY_LOCALIZED", async () => {
    const seeded = fullySeeded("uk");
    const html = await renderMediaPage({
      locale: "uk",
      ...seeded,
      plpFactCheckById: undefined,
    });
    const report = evaluateMediaCarouselSemanticClosure({ html, locale: "uk" });
    assert.notEqual(report.PAGE_STATUS, "FULLY_LOCALIZED");
    const fact = report.leaves.filter((l) => l.entityType === "civic_media_fact_check");
    assert.ok(fact.length >= 2);
    assert.ok(fact.every((l) => l.result === "CANONICAL_FALLBACK"));
  });

  it("3: UK + missing propaganda PLP → not FULLY_LOCALIZED", async () => {
    const seeded = fullySeeded("uk");
    const html = await renderMediaPage({
      locale: "uk",
      ...seeded,
      plpPropagandaById: undefined,
    });
    const report = evaluateMediaCarouselSemanticClosure({ html, locale: "uk" });
    assert.notEqual(report.PAGE_STATUS, "FULLY_LOCALIZED");
    const prop = report.leaves.filter((l) => l.entityType === "civic_media_propaganda");
    assert.ok(prop.length >= 2);
    assert.ok(prop.every((l) => l.result === "CANONICAL_FALLBACK"));
  });

  it("4: raw English verification __body → INVALID_COVERAGE / not FULLY", async () => {
    const seeded = fullySeeded("uk");
    const html = await renderMediaPage({
      locale: "uk",
      ...seeded,
      inject: createElement(
        "article",
        {
          className:
            "hu-card civic-media-resource-card civic-media-resource-card--verification",
        },
        createElement(
          "p",
          { className: "civic-media-resource-card__body" },
          "Raw English body without owner marker",
        ),
      ),
    });
    const report = evaluateMediaCarouselSemanticClosure({ html, locale: "uk" });
    assert.notEqual(report.PAGE_STATUS, "FULLY_LOCALIZED");
    assert.ok(
      report.PAGE_STATUS === "INVALID_COVERAGE" || report.UNOWNED_CARD_TEXT_CANDIDATES > 0,
    );
  });

  it("5: raw English chip without owner → INVALID_COVERAGE", async () => {
    const seeded = fullySeeded("uk");
    const html = await renderMediaPage({
      locale: "uk",
      ...seeded,
      inject: createElement(
        "div",
        {
          className:
            "hu-card civic-media-resource-card civic-media-resource-card--verification",
        },
        createElement(
          "div",
          { className: "civic-media-resource-card__chips" },
          createElement("span", { className: "civic-media-chip" }, "Orphan chip EN"),
        ),
      ),
    });
    const report = evaluateMediaCarouselSemanticClosure({ html, locale: "uk" });
    assert.equal(report.PAGE_STATUS, "INVALID_COVERAGE");
    assert.ok(report.UNOWNED_CARD_TEXT_CANDIDATES > 0);
  });

  it("6: parent card localized + nested raw canonical body fails closure", async () => {
    const seeded = fullySeeded("uk");
    const html = await renderMediaPage({
      locale: "uk",
      ...seeded,
      inject: createElement(
        "article",
        {
          className:
            "hu-card civic-media-resource-card civic-media-resource-card--verification",
          "data-hu-plp-mode": "PUBLISHED_LOCALIZED",
        },
        createElement(
          MediaSemanticNode,
          {
            as: "p",
            owner: "PLP_ENTITY",
            result: "PUBLISHED_LOCALIZED",
            entityType: "civic_media_fact_check",
            entityId: "snopes",
            semanticPath: "mission",
          },
          "[uk] parent mission",
        ),
        createElement(
          "p",
          { className: "civic-media-resource-card__body" },
          "Nested raw canonical English body",
        ),
      ),
    });
    const report = evaluateMediaCarouselSemanticClosure({ html, locale: "uk" });
    assert.notEqual(report.FULLY_LOCALIZED, true);
    assert.ok(report.UNOWNED_CARD_TEXT_CANDIDATES > 0 || report.PAGE_STATUS === "INVALID_COVERAGE");
  });

  it("7: parent localized + nested raw chip fails closure", async () => {
    const seeded = fullySeeded("uk");
    const html = await renderMediaPage({
      locale: "uk",
      ...seeded,
      inject: createElement(
        "article",
        {
          className:
            "hu-card civic-media-resource-card civic-media-resource-card--verification",
        },
        createElement(
          MediaSemanticNode,
          {
            as: "p",
            owner: "PLP_ENTITY",
            result: "PUBLISHED_LOCALIZED",
            entityType: "civic_media_fact_check",
            entityId: "snopes",
            semanticPath: "mission",
          },
          "[uk] mission",
        ),
        createElement(
          "div",
          { className: "civic-media-resource-card__chips" },
          createElement("span", null, "Raw nested chip EN"),
        ),
      ),
    });
    const report = evaluateMediaCarouselSemanticClosure({ html, locale: "uk" });
    assert.equal(report.PAGE_STATUS, "INVALID_COVERAGE");
  });

  it("8: public_news valid PLP.2 localizes headline/summary via card props; category via UI dictionary", async () => {
    const html = await renderMediaPage({ locale: "uk", ...fullySeeded("uk") });
    assert.match(html, /\[uk\] news title/);
    assert.match(html, /Мир і безпека/);
    assert.match(html, /data-hu-semantic-path="title"/);
    assert.match(html, /data-hu-semantic-path="summary"/);
    assert.match(html, /data-hu-message-key="publicNews\.categories\.peaceAndSecurity"/);
    assert.doesNotMatch(html, /data-hu-semantic-path="category"/);
    assert.doesNotMatch(html, /News title EN/);
  });

  it("9: fact-check valid PLP.2 localizes mission + coverage chips", async () => {
    const html = await renderMediaPage({ locale: "uk", ...fullySeeded("uk") });
    assert.match(html, /\[uk\] mission/);
    assert.match(html, /\[uk\] Claims/);
    assert.match(html, /data-hu-semantic-path="mission"/);
    assert.match(html, /data-hu-semantic-path="coverage"/);
    assert.doesNotMatch(html, />Mission EN</);
  });

  it("10: propaganda valid PLP.2 localizes focus + explanation", async () => {
    const html = await renderMediaPage({ locale: "uk", ...fullySeeded("uk") });
    assert.match(html, /\[uk\] focus/);
    assert.match(html, /\[uk\] propaganda/);
    assert.match(html, /data-hu-semantic-path="focus"/);
    assert.match(html, /data-hu-semantic-path="explanation"/);
  });

  it("11: protected names/URLs do not create mixed-language failures", async () => {
    const html = await renderMediaPage({ locale: "uk", ...fullySeeded("uk") });
    const report = evaluateMediaCarouselSemanticClosure({ html, locale: "uk" });
    assert.equal(report.coverage.MIXED_ENTITY_VIOLATIONS, 0);
    assert.match(html, /Snopes/);
    assert.match(html, /Reuters/);
    assert.equal(report.FULLY_LOCALIZED, true);
  });

  it("12: UI dictionary labels are not counted as machine PLP gaps", async () => {
    const html = await renderMediaPage({ locale: "uk", ...fullySeeded("uk") });
    const report = evaluateMediaCarouselSemanticClosure({ html, locale: "uk" });
    assert.ok(report.coverage.UI_DICTIONARY_NODES > 0);
    assert.equal(report.CAROUSEL_PLP_FALLBACK_LEAVES, 0);
    assert.equal(report.FULLY_LOCALIZED, true);
  });

  it("13: horizontal-rail / fade / preview wrappers do not change localization result", async () => {
    const seeded = fullySeeded("uk");
    const base = await renderMediaPage({ locale: "uk", ...seeded });
    const wrapped = await renderMediaPage({
      locale: "uk",
      ...seeded,
      inject: createElement(
        "div",
        {
          className:
            "horizontal-rail__frame horizontal-rail__frame--fade-end horizontal-rail__frame--preview-next",
        },
        createElement("div", { className: "horizontal-rail__viewport public-news-rail__viewport" }),
      ),
    });
    const a = evaluateMediaCarouselSemanticClosure({ html: base, locale: "uk" });
    const b = evaluateMediaCarouselSemanticClosure({ html: wrapped, locale: "uk" });
    assert.equal(a.PAGE_STATUS, b.PAGE_STATUS);
    assert.equal(a.FULLY_LOCALIZED, b.FULLY_LOCALIZED);
  });

  it("14: no provider/write reachable from render/read path", () => {
    for (const rel of [
      "features/language/media-plp/media-carousel-semantic-closure.ts",
      "features/language/media-plp/media-semantic-contract.tsx",
      "features/civic-media-center/components/CivicMediaCenterPageContent.tsx",
      "features/public-news/components/PublicNewsCard.tsx",
    ]) {
      const text = readFileSync(join(webSrc, rel), "utf8");
      assert.doesNotMatch(
        text,
        /gemini|thin-gemini|media-plp-materializer|GEMINI_API_KEY|generateContentTranslation/,
      );
    }
  });

  for (const locale of ["uk", "zh-Hant", "ar"] as const) {
    it(`15: complete fixtures ${locale} → FULLY_LOCALIZED`, async () => {
      const html = await renderMediaPage({ locale, ...fullySeeded(locale) });
      const report = evaluateMediaCarouselSemanticClosure({ html, locale });
      assertMediaCarouselFullyLocalized(report);
      assert.equal(report.PAGE_STATUS, "FULLY_LOCALIZED");
    });
  }

  it("16: one missing semantic leaf → NOT FULLY_LOCALIZED", async () => {
    const seeded = fullySeeded("uk");
    const html = await renderMediaPage({
      locale: "uk",
      ...seeded,
      plpFactCheckById: {
        snopes: plp(
          MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_FACT_CHECK,
          "snopes",
          "PUBLISHED_LOCALIZED",
          // mission only — coverage remains canonical → consumer bypass / fallback
          { mission: "[uk] mission only", coverage: "Claims, Politics" },
          "uk",
        ),
      },
    });
    const report = evaluateMediaCarouselSemanticClosure({ html, locale: "uk" });
    assert.notEqual(report.FULLY_LOCALIZED, true);
    assert.notEqual(report.PAGE_STATUS, "FULLY_LOCALIZED");
  });

  it("acceptance: new visible English leaf without owner fails real route closure", async () => {
    const seeded = fullySeeded("uk");
    const html = await renderMediaPage({
      locale: "uk",
      ...seeded,
      inject: createElement(
        "article",
        { className: "public-news-card" },
        createElement("p", null, "Developer forgot to register this paragraph"),
      ),
    });
    const report = evaluateMediaCarouselSemanticClosure({ html, locale: "uk" });
    assert.notEqual(report.FULLY_LOCALIZED, true);
    assert.equal(report.PAGE_STATUS, "INVALID_COVERAGE");
  });

  it("category is UI_DICTIONARY controlled vocab; title/summary remain PLP_ENTITY", async () => {
    const html = await renderMediaPage({ locale: "uk", ...fullySeeded("uk") });
    const nodes = collectRenderedMediaSemanticNodes(html);
    const category = nodes.find(
      (n) => n.messageKey === "publicNews.categories.peaceAndSecurity",
    );
    assert.equal(category?.owner, "UI_DICTIONARY");
    assert.equal(category?.result, "LOCALIZED_DICTIONARY");
    const title = nodes.find(
      (n) => n.entityType === "public_news" && n.semanticPath === "title",
    );
    const summary = nodes.find(
      (n) => n.entityType === "public_news" && n.semanticPath === "summary",
    );
    assert.equal(title?.owner, "PLP_ENTITY");
    assert.equal(summary?.owner, "PLP_ENTITY");
    assert.equal(title?.result, "PUBLISHED_LOCALIZED");
  });

  it("cannot be FULLY_LOCALIZED when news title/summary are canonical fallback", async () => {
    const seeded = fullySeeded("uk");
    const html = await renderMediaPage({
      locale: "uk",
      ...seeded,
      plpNewsById: {
        "news-1": plp(
          MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
          "news-1",
          "CANONICAL_FALLBACK",
          {
            title: "News title EN",
            summary: "News summary EN that is long enough for bullet extraction.",
          },
          "uk",
          "NO_PUBLISHED_SNAPSHOT",
        ),
      },
    });
    const report = evaluateMediaCarouselSemanticClosure({ html, locale: "uk" });
    assert.notEqual(report.FULLY_LOCALIZED, true);
    assert.ok(report.CAROUSEL_PLP_FALLBACK_LEAVES > 0);
    assert.match(html, /Мир і безпека/);
  });

  it("chips ownership: coverage splits are PLP_ENTITY coverage (not UI/terminology)", async () => {
    const html = await renderMediaPage({ locale: "uk", ...fullySeeded("uk") });
    const nodes = collectRenderedMediaSemanticNodes(html).filter(
      (n) =>
        n.entityType === "civic_media_fact_check" && n.semanticPath === "coverage",
    );
    assert.ok(nodes.length >= 1);
    assert.ok(nodes.every((n) => n.owner === "PLP_ENTITY"));
    assert.match(html, /civic-media-chip/);
  });

  it("staging-before-materialize shape: missing carousel snapshots → PARTIALLY_LOCALIZED", async () => {
    const seeded = fullySeeded("uk");
    const html = await renderMediaPage({
      locale: "uk",
      ...seeded,
      plpNewsById: {
        "news-1": plp(
          MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
          "news-1",
          "CANONICAL_FALLBACK",
          {
            title: "News title EN",
            summary: "News summary EN that is long enough for bullet extraction.",
            category: "World",
          },
          "uk",
          "NO_PUBLISHED_SNAPSHOT",
        ),
      },
      plpFactCheckById: {
        snopes: plp(
          MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_FACT_CHECK,
          "snopes",
          "CANONICAL_FALLBACK",
          { mission: "Mission EN", coverage: "Claims, Politics" },
          "uk",
          "NO_PUBLISHED_SNAPSHOT",
        ),
      },
      plpPropagandaById: {
        euvsdisinfo: plp(
          MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PROPAGANDA,
          "euvsdisinfo",
          "CANONICAL_FALLBACK",
          { focus: "Disinfo", explanation: "Propaganda explanation EN" },
          "uk",
          "NO_PUBLISHED_SNAPSHOT",
        ),
      },
    });
    const report = evaluateMediaCarouselSemanticClosure({ html, locale: "uk" });
    assert.equal(report.PAGE_STATUS, "PARTIALLY_LOCALIZED");
    assert.ok(report.CAROUSEL_PLP_FALLBACK_LEAVES > 0);
    assert.equal(report.FULLY_LOCALIZED, false);
  });
});
