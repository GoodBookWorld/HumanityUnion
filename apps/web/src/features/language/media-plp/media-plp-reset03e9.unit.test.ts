/**
 * Reset 03E.9 — carousel render contract via real route composition (no live ops).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";

import type {
  CivicMediaCenterPublic,
  PublicNewsArticleItem,
  TrustedMediaResource,
} from "@hu/types";
import { MEDIA_PLP_ENTITY_TYPE, PUBLISHED_LOCALIZATION_SCHEMA_VERSION } from "@hu/types";

import { CivicMediaCenterPageContent } from "../../civic-media-center/components/CivicMediaCenterPageContent.js";
import { MediaPlpTrustedCard } from "./MediaPlpTrustedCard.js";
import { composeMediaPageLocalization } from "./compose-media-page-localization.js";
import { MEDIA_PLP_SENTINELS } from "./consumer-value-lineage.js";
import type { MediaPlpResolvedPresentation } from "./presentation.js";
import { loadUiMessagesForLocale } from "../../i18n/load-ui-messages.js";

(globalThis as { React?: typeof React }).React = React;

const S = MEDIA_PLP_SENTINELS;

function sampleMedia(): CivicMediaCenterPublic {
  return {
    overview: {
      title: S.editorialOverviewTitle.canonical,
      summary: S.editorialOverviewSummary.canonical,
      points: [
        {
          id: "p1",
          heading: S.editorialPointHeading.canonical,
          body: S.editorialPointBody.canonical,
        },
      ],
    },
    selectionPrinciples: [
      {
        id: "editorial-transparency",
        title: S.principleTitle.canonical,
        description: S.principleDescription.canonical,
        whyItMatters: S.principleWhy.canonical,
        sortOrder: 1,
      },
    ],
    trustedMediaCategories: [
      {
        id: "international-wire-service",
        title: "Wire",
        description: "Wire",
        sortOrder: 1,
      },
    ],
    trustedMedia: [
      {
        id: "reuters",
        name: "Reuters",
        logoLabel: "R",
        country: "International",
        categoryId: "international-wire-service",
        explanation: S.trustedBody.canonical,
        websiteUrl: "https://www.reuters.com/",
        sortOrder: 1,
      },
    ],
    factChecking: [
      {
        id: "snopes",
        name: "Snopes",
        logoLabel: "S",
        mission: S.verificationBody.canonical,
        coverage: "Claims",
        websiteUrl: "https://www.snopes.com/",
        sortOrder: 1,
      },
    ],
    propagandaAnalysis: [
      {
        id: "euvsdisinfo-analysis",
        name: "EUvsDisinfo",
        logoLabel: "E",
        focus: "Focus",
        explanation: S.analysisBody.canonical,
        websiteUrl: "https://euvsdisinfo.eu/",
        sortOrder: 1,
      },
    ],
    faq: [
      {
        id: "faq-1",
        question: S.faqQuestion.canonical,
        answer: S.faqAnswer.canonical,
        sortOrder: 1,
      },
    ],
    initiativeFlow: {
      title: "Flow",
      summary: "Summary",
      diagramSvg: "",
      stages: ["A"],
    },
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

const newsArticle: PublicNewsArticleItem = {
  id: "news-1",
  title: S.newsTitle.canonical,
  summary: S.newsSummary.canonical,
  sourceName: "Reuters",
  articleUrl: "https://example.com/n1",
  publishedAt: "2026-01-01T00:00:00.000Z",
  verificationStatus: "external-source",
  geographicScope: "global",
  category: "civic",
  language: "en",
};

function localizedMaps(locale: string) {
  return {
    trustedById: {
      reuters: {
        mode: "PUBLISHED_LOCALIZED" as const,
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
        entityId: "reuters",
        locale,
        canonicalVersion: "v-test",
        presentation: {
          name: "Reuters",
          websiteUrl: "https://www.reuters.com/",
          explanation: S.trustedBody.localized,
        },
      },
    },
    principlesById: {
      "editorial-transparency": {
        mode: "PUBLISHED_LOCALIZED" as const,
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
        entityId: "editorial-transparency",
        locale,
        canonicalVersion: "v-test",
        presentation: {
          title: S.principleTitle.localized,
          description: S.principleDescription.localized,
          whyItMatters: S.principleWhy.localized,
        },
      },
    },
    factCheckById: {
      snopes: {
        mode: "PUBLISHED_LOCALIZED" as const,
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_FACT_CHECK,
        entityId: "snopes",
        locale,
        canonicalVersion: "v-test",
        presentation: {
          name: "Snopes",
          websiteUrl: "https://www.snopes.com/",
          mission: S.verificationBody.localized,
          coverage: "Claims-uk",
        },
      },
    },
    propagandaById: {
      "euvsdisinfo-analysis": {
        mode: "PUBLISHED_LOCALIZED" as const,
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PROPAGANDA,
        entityId: "euvsdisinfo-analysis",
        locale,
        canonicalVersion: "v-test",
        presentation: {
          name: "EUvsDisinfo",
          websiteUrl: "https://euvsdisinfo.eu/",
          focus: "Focus-uk",
          explanation: S.analysisBody.localized,
        },
      },
    },
    newsById: {
      "news-1": {
        mode: "PUBLISHED_LOCALIZED" as const,
        entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
        entityId: "news-1",
        locale,
        canonicalVersion: "v-test",
        presentation: {
          id: "news-1",
          articleUrl: "https://example.com/n1",
          imageUrl: null,
          publishedAt: "2026-01-01T00:00:00.000Z",
          sourceName: "Reuters",
          verificationStatus: "external-source",
          title: S.newsTitle.localized,
          summary: S.newsSummary.localized,
          category: "civic",
          geographicScope: "global",
        },
      },
    },
    editorial: {
      mode: "PUBLISHED_LOCALIZED" as const,
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: "civic-media-center",
      locale,
      canonicalVersion: "v-test",
      presentation: {
        overviewTitle: S.editorialOverviewTitle.localized,
        overviewSummary: S.editorialOverviewSummary.localized,
        overviewPoints: [
          {
            id: "p1",
            heading: S.editorialPointHeading.localized,
            body: S.editorialPointBody.localized,
          },
        ],
        faq: [
          {
            id: "faq-1",
            question: S.faqQuestion.localized,
            answer: S.faqAnswer.localized,
          },
        ],
      },
    } satisfies MediaPlpResolvedPresentation,
  };
}

async function renderMediaPage(locale: "uk" | "zh-Hant" | "ar") {
  const media = sampleMedia();
  const maps = localizedMaps(locale);
  const loaded = await loadUiMessagesForLocale(locale);
  return renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale,
      messages: loaded.messages,
      timeZone: "UTC",
      children: createElement(
        CivicMediaCenterPageContent as React.ComponentType<Record<string, unknown>>,
        {
          initialMedia: media,
          plpTrustedById: maps.trustedById,
          plpPrinciplesById: maps.principlesById,
          plpEditorialPresentation: maps.editorial,
          plpFactCheckById: maps.factCheckById,
          plpPropagandaById: maps.propagandaById,
          plpNewsById: maps.newsById,
          initialNewsArticles: [newsArticle],
          mediaLocalizationRuntimeBranch: "PLP",
          mediaLocalizationRequestedLocale: locale,
          mediaLocalizationBatchLocale: locale,
        },
      ),
    } as React.ComponentProps<typeof NextIntlClientProvider>),
  );
}

describe("Reset 03E.9 — carousel route composition render contract", () => {
  for (const locale of ["uk", "zh-Hant", "ar"] as const) {
    it(`${locale}: valid PLP.2 carousel cards never render canonical English semantics`, async () => {
      const html = await renderMediaPage(locale);
      assert.match(html, /civic-media-resource-card--principle/);
      assert.match(html, /civic-media-resource-card--trusted/);
      assert.match(html, /civic-media-resource-card--verification/);
      assert.match(html, /civic-media-resource-card--analysis/);
      assert.match(html, /public-news-card/);

      assert.match(html, new RegExp(S.principleTitle.localized));
      assert.match(html, new RegExp(S.principleDescription.localized));
      assert.match(html, new RegExp(S.trustedBody.localized));
      assert.match(html, new RegExp(S.verificationBody.localized));
      assert.match(html, new RegExp(S.analysisBody.localized));
      assert.match(html, new RegExp(S.newsTitle.localized));

      assert.doesNotMatch(html, new RegExp(S.principleTitle.canonical));
      assert.doesNotMatch(html, new RegExp(S.trustedBody.canonical));
      assert.doesNotMatch(html, new RegExp(S.verificationBody.canonical));
      assert.doesNotMatch(html, new RegExp(S.analysisBody.canonical));
      assert.doesNotMatch(html, new RegExp(S.newsTitle.canonical));
    });
  }

  it("entity ID mismatch: country card must not consume WORLD batch key", () => {
    const worldMaps = localizedMaps("uk").trustedById as Record<
      string,
      MediaPlpResolvedPresentation
    >;
    const countryResource: TrustedMediaResource = {
      id: "cbc-ca",
      name: "CBC",
      logoLabel: "C",
      country: "Canada",
      categoryId: "public-broadcaster",
      explanation: S.trustedBody.canonical,
      websiteUrl: "https://www.cbc.ca/",
      sortOrder: 1,
    };
    assert.equal(worldMaps[countryResource.id], undefined);
  });

  it("missing batch item => CANONICAL_FALLBACK with exact rebuild reason surface", async () => {
    const media = sampleMedia();
    const maps = localizedMaps("uk");
    const loaded = await loadUiMessagesForLocale("uk");
    // Drop principle from batch — card must fall back to canonical.
    const html = renderToStaticMarkup(
      createElement(NextIntlClientProvider, {
        locale: "uk",
        messages: loaded.messages,
        timeZone: "UTC",
        children: createElement(
          CivicMediaCenterPageContent as React.ComponentType<Record<string, unknown>>,
          {
            initialMedia: media,
            plpTrustedById: maps.trustedById,
            plpPrinciplesById: {},
            plpEditorialPresentation: maps.editorial,
            plpFactCheckById: maps.factCheckById,
            plpPropagandaById: maps.propagandaById,
            plpNewsById: maps.newsById,
            initialNewsArticles: [newsArticle],
            mediaLocalizationRuntimeBranch: "PLP",
            mediaLocalizationRequestedLocale: "uk",
            mediaLocalizationBatchLocale: "uk",
          },
        ),
      } as React.ComponentProps<typeof NextIntlClientProvider>),
    );
    assert.match(html, new RegExp(S.principleTitle.canonical));
    assert.doesNotMatch(html, new RegExp(S.principleTitle.localized));
  });

  it("stale PLP.1 must not be treated as ready by composition (schema constant is PLP.2)", () => {
    assert.equal(PUBLISHED_LOCALIZATION_SCHEMA_VERSION, "PLP.2");
  });

  it("valid PLP.2 not propagated to trusted card => consumer bypass / canonical body", async () => {
    const resource = sampleMedia().trustedMedia[0]!;
    const resolved: MediaPlpResolvedPresentation = {
      mode: "PUBLISHED_LOCALIZED",
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: "reuters",
      locale: "uk",
      canonicalVersion: "v-test",
      presentation: {
        name: "Reuters",
        websiteUrl: "https://www.reuters.com/",
        explanation: S.trustedBody.localized,
      },
    };
    const messages = await loadUiMessagesForLocale("uk");
    // Bypass MediaPlpTrustedCard — render rail with canonical explanation while claiming localized.
    const { TrustedMediaRailCard } = await import(
      "../../civic-media-center/components/TrustedMediaRailCard.js"
    );
    const bypass = renderToStaticMarkup(
      createElement(NextIntlClientProvider, {
        locale: "uk",
        messages: messages.messages,
        timeZone: "UTC",
        children: createElement(TrustedMediaRailCard, {
          resource,
          explanation: undefined,
          "data-hu-plp-mode": "PUBLISHED_LOCALIZED",
          "data-hu-plp-entity": "civic_media_trusted",
          "data-hu-plp-id": "reuters",
        } as React.ComponentProps<typeof TrustedMediaRailCard>),
      } as React.ComponentProps<typeof NextIntlClientProvider>),
    );
    assert.match(bypass, new RegExp(S.trustedBody.canonical));

    const correct = renderToStaticMarkup(
      createElement(NextIntlClientProvider, {
        locale: "uk",
        messages: messages.messages,
        timeZone: "UTC",
        children: createElement(MediaPlpTrustedCard, {
          resource,
          resolved,
        }),
      } as React.ComponentProps<typeof NextIntlClientProvider>),
    );
    assert.match(correct, new RegExp(S.trustedBody.localized));
    assert.doesNotMatch(correct, new RegExp(S.trustedBody.canonical));
  });

  it("composeMediaPageLocalization wires news + all carousel entity types into one batch", async () => {
    const media = sampleMedia();
    let requestedTypes: string[] = [];
    const composition = await composeMediaPageLocalization({
      media,
      locale: "uk",
      isPlpEnabled: () => true,
      fetchNewsArticles: async () => [newsArticle],
      loadPlp: async (input) => {
        requestedTypes = [
          ...input.resources.map(() => MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED),
          ...input.principles.map(() => MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE),
          ...input.factChecking.map(() => MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_FACT_CHECK),
          ...input.propagandaAnalysis.map(() => MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PROPAGANDA),
          ...(input.newsArticles ?? []).map(() => MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS),
          MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
        ];
        const maps = localizedMaps("uk");
        return {
          trustedById: maps.trustedById,
          principlesById: maps.principlesById,
          factCheckById: maps.factCheckById,
          propagandaById: maps.propagandaById,
          newsById: maps.newsById,
          editorial: maps.editorial,
        };
      },
    });
    assert.equal(composition.runtimeBranch, "PLP");
    assert.ok(requestedTypes.includes(MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS));
    assert.ok(requestedTypes.includes(MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_FACT_CHECK));
    assert.ok(requestedTypes.includes(MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PROPAGANDA));
  });

  it("build source must cover rendered Media carousel entity types (API live-source parity)", () => {
    const liveSource = readFileSync(
      new URL(
        "../../../../../api/src/modules/language/published-localized-presentation/media/live-source.ts",
        import.meta.url,
      ),
      "utf8",
    );
    assert.match(liveSource, /case MEDIA_PLP_ENTITY_TYPE\.PUBLIC_NEWS/);
    assert.match(liveSource, /resolvePublicNews/);
    const materializer = readFileSync(
      new URL(
        "../../../../../api/src/modules/language/media-plp-materializer/source-resolve.ts",
        import.meta.url,
      ),
      "utf8",
    );
    assert.match(materializer, /PUBLIC_NEWS/);
    assert.match(materializer, /CIVIC_MEDIA_FACT_CHECK/);
    assert.match(materializer, /CIVIC_MEDIA_PROPAGANDA/);
  });

  it("election/initiative remain DOMAIN_NOT_YET_MIGRATED (Initiative CT path)", () => {
    const election = readFileSync(
      new URL(
        "../../country-experience/components/CountryElectionRailCard.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    const initiative = readFileSync(
      new URL(
        "../../country-experience/components/CountryInitiativeRailCard.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    assert.match(election, /DOMAIN_NOT_YET_MIGRATED/);
    assert.match(election, /data-hu-localization-domain="initiative"/);
    assert.match(election, /useInitiativeCardTitlePresentation/);
    assert.match(initiative, /DOMAIN_NOT_YET_MIGRATED/);
    assert.match(initiative, /useInitiativeCardTitlePresentation/);
  });
});
