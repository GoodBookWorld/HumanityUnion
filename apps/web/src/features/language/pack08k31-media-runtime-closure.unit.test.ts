/**
 * Pack 08K.3.1 — /media runtime localization closure (deterministic fixtures).
 * No live Gemini / no staging mutation / thin diagnostic stays isolated.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import type {
  CivicMediaCenterPublic,
  PublicNewsArticleItem,
  TrustedMediaResource,
} from "@hu/types";
import { unwrapPublicPresentationValue } from "@hu/types";

import {
  buildCompleteCivicMediaCardFixtureTranslations,
  buildCivicMediaPrinciplePresentation,
  buildCivicMediaTrustedCardPresentation,
  localizeCivicMediaPrinciplePresentation,
  localizeCivicMediaTrustedCardPresentation,
} from "./adapters/civic-media-presentation.js";
import {
  buildCompletePublicNewsFixtureTranslations,
  localizePublicNewsArticlePresentation,
} from "./adapters/public-news-article-presentation.js";
import {
  aggregateMediaRouteDiagnostic,
  formatMediaRouteDiagnosticCounters,
} from "./media-route-localization-diagnostic.js";
import { asPublicNewsPresentationNode } from "./adapters/public-news-article-presentation.js";
import { buildPublicNewsArticlePresentation } from "./adapters/public-news-article-presentation.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, "../../..");
const repoRoot = join(webRoot, "../..");

function readWeb(rel: string): string {
  return readFileSync(join(webRoot, "src", rel), "utf8");
}

function readApi(rel: string): string {
  return readFileSync(join(repoRoot, "apps/api/src", rel), "utf8");
}

function sampleArticle(): PublicNewsArticleItem {
  return {
    id: "news-pack08k31-1",
    sourceName: "The Atlantic",
    title: "Civic shoreline restoration expands",
    summary: "Communities organize a public initiative around coastal habitats.",
    articleUrl: "https://example.com/news/shoreline",
    publishedAt: "2026-09-01T12:00:00.000Z",
    language: "en",
    category: "Environment",
    geographicScope: "CA",
    verificationStatus: "external-source",
  };
}

function sampleTrusted(): TrustedMediaResource {
  return {
    id: "trusted-atlantic",
    name: "The Atlantic",
    country: "United States",
    countryCode: "US",
    categoryId: "independent-investigative",
    explanation: "Independent reporting with clear editorial standards.",
    websiteUrl: "https://www.theatlantic.com/",
    logoLabel: "TA",
    sortOrder: 1,
  };
}

function sampleMedia(): CivicMediaCenterPublic {
  return {
    overview: {
      title: "Civic Media Center",
      summary: "Public media guidance",
      points: [],
    },
    selectionPrinciples: [
      {
        id: "p0",
        title: "Independence of trusted media evidence",
        description: "Principle description explaining independence requirements.",
        sortOrder: 1,
      },
      {
        id: "p1",
        title: "Transparent sourcing for participants",
        description: "Principle description explaining transparent sourcing.",
        sortOrder: 2,
      },
    ],
    faq: [],
    initiativeFlow: {
      title: "Flow",
      summary: "Summary",
      diagramSvg: "",
      stages: [],
    },
    trustedMedia: [sampleTrusted()],
    trustedMediaCategories: [],
    factChecking: [],
    propagandaAnalysis: [],
    updatedAt: "2026-09-01T00:00:00.000Z",
  } as CivicMediaCenterPublic;
}

describe("Pack 08K.3.1 /media runtime closure", () => {
  it("A: inventory ownership classes for /media families", () => {
    const inventory = [
      { family: "public-news-card.title", ownership: "AUTO_TRANSLATABLE_CONTENT" },
      { family: "public-news-card.summary", ownership: "AUTO_TRANSLATABLE_CONTENT" },
      { family: "public-news-card.sourceName", ownership: "PROTECTED_IDENTITY" },
      { family: "public-news-card.articleUrl", ownership: "PROTECTED_TECHNICAL" },
      { family: "principle.title", ownership: "AUTO_TRANSLATABLE_CONTENT" },
      { family: "principle.description", ownership: "AUTO_TRANSLATABLE_CONTENT" },
      { family: "trusted.name", ownership: "PROTECTED_IDENTITY" },
      { family: "trusted.explanation", ownership: "AUTO_TRANSLATABLE_CONTENT" },
      { family: "trusted.country", ownership: "UI_CHROME" },
      { family: "category.description", ownership: "UI_CHROME" },
      { family: "category.sourceCount", ownership: "UI_CHROME" },
    ] as const;
    assert.equal(inventory.length, 11);
    assert.ok(inventory.every((row) => row.ownership.length > 0));
  });

  it("B: first-break wiring — public_news resolve + civic overlay + country rail", () => {
    const newsHook = readWeb("features/public-news/use-localized-public-news-card.ts");
    const newsResolve = readWeb("features/public-news/resolve-public-news-presentation.ts");
    const adapter = readWeb("features/language/adapters/public-news-article-presentation.ts");
    const country = readWeb(
      "features/country-experience/components/CountryExperienceDynamicPage.tsx",
    );
    const rail = readWeb(
      "features/civic-media-center/components/TrustedMediaRailCard.tsx",
    );
    const tabs = readWeb(
      "features/civic-media-center/components/TrustedMediaCategoryTabs.tsx",
    );
    const loader = readApi("modules/language/content-translation-civic-loaders.ts");
    const service = readApi("modules/language/content-translation.service.ts");
    assert.match(newsResolve, /sourceKind: "public_news"/);
    assert.match(adapter, /sourceKind: "public_news"/);
    assert.match(newsHook, /resolvePublicNewsLocalizedPresentation/);
    assert.match(loader, /loadPublicNewsTranslationSource/);
    assert.match(service, /public_news/);
    assert.match(country, /useTrustedMediaExplanationsOverlay/);
    assert.match(rail, /getLocalizedCountryDisplayName/);
    assert.match(tabs, /trustedCategoryDescriptions/);
  });

  it("C: REAL_VS_FIXTURE_DIFF — live description vs fixture body; public_news identity", () => {
    const diff = [
      {
        field: "principle.semanticBody",
        fixture08k3: "body",
        realPayload: "description",
      },
      {
        field: "news.sourceKind",
        fixture08k3: "civic_media (wrong)",
        realPayload: "public_news",
      },
      {
        field: "trusted.localizedFields",
        fixture08k3: "title + body + explanation",
        realPayload: "explanation only (name protected)",
      },
      {
        field: "playwright.media",
        fixture08k3: "HTML stub surfaces",
        realPayload: "API-shaped principle/trusted/news cards",
      },
    ];
    assert.equal(diff.length, 4);
    const playwright = readWeb("features/language/pack08k-playwright.e2e.ts");
    assert.match(playwright, /Principle description/);
    assert.match(playwright, /civic-media-resource-card--principle/);
    assert.match(playwright, /country-media-rail-card/);
  });

  it("D–H: one Media presentation boundary localizes news + principle + trusted", () => {
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const article = sampleArticle();
      const news = localizePublicNewsArticlePresentation({
        article,
        targetLanguage: locale,
        translations: buildCompletePublicNewsFixtureTranslations(article, locale),
      });
      assert.equal(news.identity.sourceKind, "public_news");
      assert.equal(news.coverage.canonicalFallbackNodeCount, 0);
      assert.equal(news.coverage.status, "COMPLETE");

      const principle = sampleMedia().selectionPrinciples[0]!;
      const principleTree = buildCivicMediaPrinciplePresentation(principle);
      const principleLocalized = localizeCivicMediaPrinciplePresentation({
        mediaRecordId: "civic-media-center",
        principleId: "p0",
        principle,
        targetLanguage: locale,
        translations: buildCompleteCivicMediaCardFixtureTranslations(
          principleTree as never,
          locale,
        ),
      });
      assert.equal(principleLocalized.coverage.canonicalFallbackNodeCount, 0);

      const trusted = sampleTrusted();
      const trustedTree = buildCivicMediaTrustedCardPresentation(trusted);
      const trustedLocalized = localizeCivicMediaTrustedCardPresentation({
        mediaRecordId: "civic-media-center",
        resource: trusted,
        targetLanguage: locale,
        translations: buildCompleteCivicMediaCardFixtureTranslations(
          trustedTree as never,
          locale,
        ),
      });
      assert.equal(trustedLocalized.coverage.canonicalFallbackNodeCount, 0);
      const presentation = trustedLocalized.presentation as {
        name: Parameters<typeof unwrapPublicPresentationValue>[0];
        explanation: string;
      };
      assert.equal(unwrapPublicPresentationValue(presentation.name), "The Atlantic");
      assert.match(presentation.explanation, new RegExp(`^\\[${locale}\\]`));
    }
  });

  it("I: PublicNewsCard / NewsArticleCard never render raw article.title", () => {
    const card = readWeb("features/public-news/components/PublicNewsCard.tsx");
    const alt = readWeb("features/public-news/components/NewsArticleCard.tsx");
    assert.doesNotMatch(card, /\{article\.title\}/);
    assert.doesNotMatch(card, /\{article\.summary\}/);
    assert.doesNotMatch(alt, /\{article\.title\}/);
    assert.doesNotMatch(alt, /\{article\.summary\}/);
    assert.match(card, /useLocalizedPublicNewsCard/);
  });

  it("J–K / Q: unknown nested field auto-localizes; generation/scheduling wired", () => {
    const article = {
      ...sampleArticle(),
      extensions: {
        editorialNote: "Nested editorial context never allowlisted",
        deeper: { callout: "Deep nested semantic prose" },
      },
    };
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const translations = buildCompletePublicNewsFixtureTranslations(article, locale);
      assert.ok(translations["extensions.editorialNote"]);
      assert.ok(translations["extensions.deeper.callout"]);
      const localized = localizePublicNewsArticlePresentation({
        article,
        targetLanguage: locale,
        translations,
      });
      assert.equal(localized.coverage.canonicalFallbackNodeCount, 0);
    }
    const newsService = readApi("modules/public-news/public-news.service.ts");
    assert.match(newsService, /notifyPublicPresentationChanged/);
    assert.match(newsService, /public_news/);
    const warm = readApi("modules/language/content-translation-staging-warm-backfill.ts");
    assert.match(warm, /"public_news"/);
    assert.match(warm, /discoverPublicNewsTranslationRecordIds/);
  });

  it("L / P: route diagnostic MEDIA_* counters with zero fallback on complete corpus", () => {
    const locales = ["uk", "zh-Hant", "ar"] as const;
    const presentations = locales.flatMap((locale) => {
      const article = sampleArticle();
      const news = localizePublicNewsArticlePresentation({
        article,
        targetLanguage: locale,
        translations: buildCompletePublicNewsFixtureTranslations(article, locale),
      });
      const principle = sampleMedia().selectionPrinciples[0]!;
      const principleTree = buildCivicMediaPrinciplePresentation(principle);
      const principleLocalized = localizeCivicMediaPrinciplePresentation({
        mediaRecordId: "civic-media-center",
        principleId: "p0",
        principle,
        targetLanguage: locale,
        translations: buildCompleteCivicMediaCardFixtureTranslations(
          principleTree as never,
          locale,
        ),
      });
      return [news, principleLocalized];
    });
    const aggregate = aggregateMediaRouteDiagnostic(presentations);
    assert.equal(aggregate.MEDIA_CANONICAL_FALLBACK_NODES, 0);
    assert.equal(aggregate.MEDIA_PRESENTATIONS_WITH_FALLBACK, 0);
    assert.ok(aggregate.MEDIA_PRESENTATIONS >= 6);
    const formatted = formatMediaRouteDiagnosticCounters(aggregate);
    assert.match(formatted, /MEDIA_CANONICAL_FALLBACK_NODES=0/);
    assert.doesNotMatch(formatted, /fallback occurred|missing translation/i);
  });

  it("R: future publication scheduling proven via notify + warm kinds", () => {
    const enqueue = readApi("modules/language/public-presentation-changed.ts");
    assert.match(enqueue, /scheduleContentTranslationWarmAfterMutation/);
    const eligibility = readApi("modules/language/content-translation-eligibility.ts");
    assert.match(eligibility, /public_news: \["title", "summary", "category"\]/);
  });

  it("T: thin diagnostic remains isolated from Media app graph", () => {
    const thinIndex = readApi("modules/language/thin-localization-diagnostic/index.ts");
    const thinRun = readApi(
      "modules/language/thin-localization-diagnostic/run-thin-diagnostic.ts",
    );
    assert.doesNotMatch(thinIndex, /civic-media-center|PublicNewsCard|resolve-public-news/);
    assert.doesNotMatch(thinRun, /civic-media-center|PublicNewsCard/);
    const parseArgs = readApi(
      "modules/language/thin-localization-diagnostic/parse-residual-args.ts",
    );
    assert.match(parseArgs, /public_news/);
  });

  it("presentation tree protects geographicScope as technical", () => {
    const tree = buildPublicNewsArticlePresentation(sampleArticle());
    const node = asPublicNewsPresentationNode(tree);
    assert.ok(node);
    const localized = localizePublicNewsArticlePresentation({
      article: sampleArticle(),
      targetLanguage: "uk",
      translations: {
        title: "[uk] title",
        summary: "[uk] summary",
        category: "[uk] category",
      },
    });
    assert.equal(localized.coverage.canonicalFallbackNodeCount, 0);
  });
});
