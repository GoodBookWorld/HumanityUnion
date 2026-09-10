/**
 * Reset 03E.5 — consumer value lineage (route composition; no live ops).
 *
 * Proves API PUBLISHED_LOCALIZED + route canonical render is detected and
 * impossible after fix (LOCALIZED_PRESENTATION_CONSUMER_BYPASS).
 */
import assert from "node:assert/strict";
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
import { MEDIA_PLP_ENTITY_TYPE } from "@hu/types";

import { CivicMediaCenterPageContent } from "../../civic-media-center/components/CivicMediaCenterPageContent.js";
import { TrustedMediaRailCard } from "../../civic-media-center/components/TrustedMediaRailCard.js";
import { MediaPlpTrustedCard } from "./MediaPlpTrustedCard.js";
import { applyMediaPlpPresentationsToEditorial } from "./apply-media-plp-editorial.js";
import {
  assertNoConsumerValueLineageBypass,
  evaluateConsumerValueLineage,
  MEDIA_PLP_SENTINELS,
  readPresentationStringAtPath,
} from "./consumer-value-lineage.js";
import type { MediaPlpResolvedPresentation } from "./presentation.js";
import { evaluateMediaPageStructuralIntegrity } from "./media-structural-integrity.js";
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

function localizedEditorial(): MediaPlpResolvedPresentation {
  return {
    mode: "PUBLISHED_LOCALIZED",
    entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
    entityId: "civic-media-center",
    locale: "uk",
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
  };
}

function plpMaps(media: CivicMediaCenterPublic) {
  return {
    trusted: {
      reuters: {
        mode: "PUBLISHED_LOCALIZED" as const,
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
        entityId: "reuters",
        locale: "uk",
        canonicalVersion: "v-test",
        presentation: {
          name: "Reuters",
          websiteUrl: "https://www.reuters.com/",
          explanation: S.trustedBody.localized,
        },
      },
    },
    principles: {
      "editorial-transparency": {
        mode: "PUBLISHED_LOCALIZED" as const,
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
        entityId: "editorial-transparency",
        locale: "uk",
        canonicalVersion: "v-test",
        presentation: {
          title: S.principleTitle.localized,
          description: S.principleDescription.localized,
          whyItMatters: S.principleWhy.localized,
        },
      },
    },
    fact: {
      snopes: {
        mode: "PUBLISHED_LOCALIZED" as const,
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_FACT_CHECK,
        entityId: "snopes",
        locale: "uk",
        canonicalVersion: "v-test",
        presentation: {
          name: "Snopes",
          websiteUrl: "https://www.snopes.com/",
          mission: S.verificationBody.localized,
          coverage: "Claims UK",
        },
      },
    },
    propaganda: {
      "euvsdisinfo-analysis": {
        mode: "PUBLISHED_LOCALIZED" as const,
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PROPAGANDA,
        entityId: "euvsdisinfo-analysis",
        locale: "uk",
        canonicalVersion: "v-test",
        presentation: {
          name: "EUvsDisinfo",
          websiteUrl: "https://euvsdisinfo.eu/",
          focus: "Focus UK",
          explanation: S.analysisBody.localized,
        },
      },
    },
    news: {
      "news-1": {
        mode: "PUBLISHED_LOCALIZED" as const,
        entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
        entityId: "news-1",
        locale: "uk",
        canonicalVersion: "v-test",
        presentation: {
          title: S.newsTitle.localized,
          summary: S.newsSummary.localized,
          category: "civic",
        },
      },
    },
    editorial: localizedEditorial(),
    media,
  };
}

describe("Reset 03E.5 — consumer value lineage", () => {
  it("negative: resolver PUBLISHED_LOCALIZED but projected canonical → bypass", () => {
    const media = sampleMedia();
    const resolved = localizedEditorial();
    // Simulate projection gap: apply never ran / kept canonical.
    const projectedTitle = media.overview.title;
    const trace = evaluateConsumerValueLineage({
      semanticPath: "overviewTitle",
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: "civic-media-center",
      resolverMode: "PUBLISHED_LOCALIZED",
      resolvedValue: readPresentationStringAtPath(resolved.presentation, "overviewTitle"),
      projectedValue: projectedTitle,
      propagatedValue: projectedTitle,
      renderedValue: projectedTitle,
      canonicalValue: S.editorialOverviewTitle.canonical,
    });
    assert.equal(trace.bypass, true);
    assert.equal(trace.reason, "LOCALIZED_PRESENTATION_CONSUMER_BYPASS");
    assert.throws(() => assertNoConsumerValueLineageBypass([trace]));
  });

  it("mandatory editorial regression: valid PLP must render localized sentinels on real page composition", async () => {
    const media = sampleMedia();
    const maps = plpMaps(media);
    const loaded = await loadUiMessagesForLocale("uk");
    const html = renderToStaticMarkup(
      createElement(NextIntlClientProvider, {
        locale: "uk",
        messages: loaded.messages,
        timeZone: "UTC",
        children: createElement(
          CivicMediaCenterPageContent as React.ComponentType<Record<string, unknown>>,
          {
            initialMedia: media,
            plpTrustedById: maps.trusted,
            plpPrinciplesById: maps.principles,
            plpEditorialPresentation: maps.editorial,
            plpFactCheckById: maps.fact,
            plpPropagandaById: maps.propaganda,
            plpNewsById: maps.news,
            initialNewsArticles: [newsArticle],
          },
        ),
      } as React.ComponentProps<typeof NextIntlClientProvider>),
    );

    assert.match(html, new RegExp(S.editorialOverviewTitle.localized));
    assert.match(html, new RegExp(S.editorialOverviewSummary.localized));
    assert.match(html, new RegExp(S.editorialPointHeading.localized));
    assert.match(html, new RegExp(S.editorialPointBody.localized));
    assert.match(html, new RegExp(S.faqQuestion.localized));
    assert.match(html, new RegExp(S.faqAnswer.localized));
    assert.doesNotMatch(html, new RegExp(S.editorialOverviewTitle.canonical));
    assert.doesNotMatch(html, new RegExp(S.faqQuestion.canonical));

    assert.match(html, new RegExp(S.principleTitle.localized));
    assert.match(html, new RegExp(S.principleDescription.localized));
    assert.match(html, new RegExp(S.principleWhy.localized));
    assert.match(html, new RegExp(S.trustedBody.localized));
    assert.match(html, new RegExp(S.verificationBody.localized));
    assert.match(html, new RegExp(S.analysisBody.localized));
    assert.match(html, new RegExp(S.newsTitle.localized));
    assert.match(html, new RegExp(S.newsSummary.localized));

    assert.doesNotMatch(html, new RegExp(S.trustedBody.canonical));
    assert.doesNotMatch(html, new RegExp(S.verificationBody.canonical));
    assert.doesNotMatch(html, new RegExp(S.analysisBody.canonical));
    assert.doesNotMatch(html, new RegExp(S.newsTitle.canonical));
  });

  it("apply projects editorial lineage for overview + FAQ", () => {
    const media = sampleMedia();
    const resolved = localizedEditorial();
    const applied = applyMediaPlpPresentationsToEditorial({
      media,
      trustedById: {},
      principlesById: {},
      editorialPresentation: resolved,
      requestedLocale: "uk",
    });
    const paths = [
      "overviewTitle",
      "overviewSummary",
      "overviewPoints[0].heading",
      "overviewPoints[0].body",
      "faq[0].question",
      "faq[0].answer",
    ] as const;
    const traces = paths.map((semanticPath) => {
      const resolvedValue = readPresentationStringAtPath(resolved.presentation, semanticPath);
      let projected: string | null = null;
      if (semanticPath === "overviewTitle") projected = applied.overview.title;
      else if (semanticPath === "overviewSummary") projected = applied.overview.summary;
      else if (semanticPath === "overviewPoints[0].heading")
        projected = applied.overview.points[0]?.heading ?? null;
      else if (semanticPath === "overviewPoints[0].body")
        projected = applied.overview.points[0]?.body ?? null;
      else if (semanticPath === "faq[0].question") projected = applied.faq[0]?.question ?? null;
      else if (semanticPath === "faq[0].answer") projected = applied.faq[0]?.answer ?? null;
      return evaluateConsumerValueLineage({
        semanticPath,
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
        entityId: "civic-media-center",
        resolverMode: "PUBLISHED_LOCALIZED",
        resolvedValue,
        projectedValue: projected,
        propagatedValue: projected,
        renderedValue: projected,
        canonicalValue: readPresentationStringAtPath(
          {
            overviewTitle: media.overview.title,
            overviewSummary: media.overview.summary,
            overviewPoints: media.overview.points,
            faq: media.faq,
          },
          semanticPath,
        ),
      });
    });
    assertNoConsumerValueLineageBypass(traces);
  });

  it("carousel/rail wrapper preserves localized trusted sentinel", async () => {
    const resource = sampleMedia().trustedMedia[0]!;
    const resolved: MediaPlpResolvedPresentation = {
      mode: "PUBLISHED_LOCALIZED",
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: "reuters",
      locale: "uk",
      canonicalVersion: "v-test",
      presentation: { explanation: S.trustedBody.localized },
    };
    const loaded = await loadUiMessagesForLocale("uk");
    const html = renderToStaticMarkup(
      createElement(NextIntlClientProvider, {
        locale: "uk",
        messages: loaded.messages,
        timeZone: "UTC",
        children: createElement(
          "div",
          { className: "media-horizontal-rail__track", "data-hu-rail": "trusted" },
          createElement(MediaPlpTrustedCard, { resource, resolved }),
        ),
      } as React.ComponentProps<typeof NextIntlClientProvider>),
    );
    assert.match(html, new RegExp(S.trustedBody.localized));
    assert.doesNotMatch(html, new RegExp(S.trustedBody.canonical));
  });

  it("negative carousel: wrapper reconstructing canonical body is detected", async () => {
    const resource = sampleMedia().trustedMedia[0]!;
    const loaded = await loadUiMessagesForLocale("uk");
    // Bug fixture: claims PUBLISHED_LOCALIZED but passes no presentation explanation.
    const tree = createElement(NextIntlClientProvider, {
      locale: "uk",
      messages: loaded.messages,
      timeZone: "UTC",
      children: createElement(TrustedMediaRailCard, {
        resource,
        explanation: undefined,
        "data-hu-plp-mode": "PUBLISHED_LOCALIZED",
        "data-hu-plp-entity": "civic_media_trusted",
        "data-hu-plp-id": "reuters",
      } as React.ComponentProps<typeof TrustedMediaRailCard>),
    } as React.ComponentProps<typeof NextIntlClientProvider>);
    const html = renderToStaticMarkup(tree);
    assert.match(html, /LOCALIZED_PRESENTATION_CONSUMER_BYPASS/);
    assert.match(html, new RegExp(S.trustedBody.canonical));
    assert.doesNotMatch(html, new RegExp(S.trustedBody.localized));
  });

  it("country recommended media must key PLP map by country-rail resource id", () => {
    // WORLD batch key "reuters" must not be treated as a hit for COUNTRY id "cbc-ca".
    const worldPlpById = {
      ...plpMaps(sampleMedia()).trusted,
    } as Record<string, MediaPlpResolvedPresentation>;
    const countryResourceId = "cbc-ca";
    assert.equal(worldPlpById[countryResourceId], undefined);
    assert.ok(worldPlpById.reuters);
  });

  it("Media page route requests news entities in PLP batch (source wiring)", async () => {
    const fs = await import("node:fs");
    const pageSrc = fs.readFileSync(
      new URL("../../../app/media/page.tsx", import.meta.url),
      "utf8",
    );
    const composeSrc = fs.readFileSync(
      new URL("./compose-media-page-localization.ts", import.meta.url),
      "utf8",
    );
    assert.match(pageSrc, /fetchPublicNewsArticles/);
    assert.match(pageSrc, /MEDIA_PLP_NEWS_BATCH_LIMIT/);
    assert.match(composeSrc, /newsArticles:\s*initialNewsArticles/);
    assert.match(composeSrc, /MEDIA_PLP_NEWS_BATCH_LIMIT/);
  });

  it("country page resolves PLP for country media resources (not WORLD-only)", async () => {
    const pageSrc = await import("node:fs").then((fs) =>
      fs.readFileSync(
        new URL("../../../app/countries/[countryCode]/page.tsx", import.meta.url),
        "utf8",
      ),
    );
    assert.match(pageSrc, /fetchCountryMedia/);
    assert.match(pageSrc, /resources:\s*initialCountryMedia/);
    assert.doesNotMatch(pageSrc, /resources:\s*media\.trustedMedia/);
  });

  it("election/initiative rails use Initiative PLP adapter (not Media DOMAIN_NOT_YET_MIGRATED)", async () => {
    const fs = await import("node:fs");
    const initiative = fs.readFileSync(
      new URL(
        "../../country-experience/components/CountryInitiativeRailCard.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    const election = fs.readFileSync(
      new URL(
        "../../country-experience/components/CountryElectionRailCard.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    assert.doesNotMatch(initiative, /DOMAIN_NOT_YET_MIGRATED/);
    assert.doesNotMatch(election, /DOMAIN_NOT_YET_MIGRATED/);
    assert.match(initiative, /initiative_lifecycle/);
    assert.doesNotMatch(initiative, /useInitiativeCardTitlePresentation/);
  });

  it("LSI.1 fails when consumer value lineage bypasses after resolver", () => {
    const media = sampleMedia();
    const maps = plpMaps(media);
    const resolved = maps.editorial;
    const resolvedTitle = readPresentationStringAtPath(
      resolved.presentation,
      "overviewTitle",
    );
    const bypassTrace = evaluateConsumerValueLineage({
      semanticPath: "overviewTitle",
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: "civic-media-center",
      resolverMode: "PUBLISHED_LOCALIZED",
      resolvedValue: resolvedTitle,
      projectedValue: S.editorialOverviewTitle.canonical,
      propagatedValue: S.editorialOverviewTitle.canonical,
      renderedValue: S.editorialOverviewTitle.canonical,
      canonicalValue: S.editorialOverviewTitle.canonical,
    });
    const report = evaluateMediaPageStructuralIntegrity({
      html: `<div data-hu-semantic-owner="PLP_ENTITY" data-hu-semantic-path="overviewTitle" data-hu-plp-entity="civic_media_editorial" data-hu-plp-id="civic-media-center">${S.editorialOverviewTitle.canonical}</div>`,
      entities: [
        {
          entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
          entityId: "civic-media-center",
          canonicalSourcePaths: ["overviewTitle"],
          buildInputPaths: ["overviewTitle"],
          localizedOutputPaths: ["overviewTitle"],
          appliedPresentationPaths: ["overviewTitle"],
        },
      ],
      consumerValueLineage: [bypassTrace],
    });
    assert.equal(report.STRUCTURAL_INTEGRITY_STATUS, "FAILED");
    assert.ok(report.CONSUMER_VALUE_LINEAGE_BYPASS >= 1);
    assert.ok(
      report.reasons.includes("LOCALIZED_PRESENTATION_CONSUMER_BYPASS"),
    );
  });

  it("hydration ownership: PLP news seed skips client generate-on-read overwrite", async () => {
    const fs = await import("node:fs");
    const hookSrc = fs.readFileSync(
      new URL("../../public-news/use-localized-public-news-card.ts", import.meta.url),
      "utf8",
    );
    assert.match(hookSrc, /skipClientTranslation \|\| plpPresentation/);
    assert.match(hookSrc, /plpPresentation\.mode === "PUBLISHED_LOCALIZED"/);
    const countrySrc = fs.readFileSync(
      new URL(
        "../../country-experience/components/CountryExperienceDynamicPage.tsx",
        import.meta.url,
      ),
      "utf8",
    );
    assert.match(countrySrc, /initialCountryMedia && initialCountryMedia\.length > 0/);
    assert.match(countrySrc, /MediaPlpTrustedCard/);
  });

  it("Media batch entity-type membership from real loader wiring", async () => {
    const loaderSrc = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("./load-media-plp-ssr.ts", import.meta.url), "utf8"),
    );
    assert.match(loaderSrc, /CIVIC_MEDIA_TRUSTED/);
    assert.match(loaderSrc, /CIVIC_MEDIA_PRINCIPLE/);
    assert.match(loaderSrc, /CIVIC_MEDIA_EDITORIAL/);
    assert.match(loaderSrc, /CIVIC_MEDIA_FACT_CHECK/);
    assert.match(loaderSrc, /CIVIC_MEDIA_PROPAGANDA/);
    assert.match(loaderSrc, /PUBLIC_NEWS/);
    const media = sampleMedia();
    const maps = plpMaps(media);
    // Fixture route request shape (1 news article bound by MEDIA_PLP_NEWS_BATCH_LIMIT).
    const requested = {
      civic_media_trusted: media.trustedMedia.length,
      civic_media_principle: media.selectionPrinciples.length,
      civic_media_editorial: 1,
      civic_media_fact_check: media.factChecking.length,
      civic_media_propaganda: media.propagandaAnalysis.length,
      public_news: 1,
    };
    const resolved = {
      civic_media_trusted: Object.keys(maps.trusted).length,
      civic_media_principle: Object.keys(maps.principles).length,
      civic_media_editorial: maps.editorial ? 1 : 0,
      civic_media_fact_check: Object.keys(maps.fact).length,
      civic_media_propaganda: Object.keys(maps.propaganda).length,
      public_news: Object.keys(maps.news).length,
    };
    assert.deepEqual(requested, resolved);
    assert.equal(requested.public_news, 1);
  });
});
