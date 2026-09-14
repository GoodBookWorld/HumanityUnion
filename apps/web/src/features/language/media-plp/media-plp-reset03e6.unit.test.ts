/**
 * Reset 03E.6 — live runtime truth forensics (staging-shaped; no live ops).
 *
 * Proves API PUBLISHED_LOCALIZED + Web LEGACY branch is detected (ROUTE_BRANCH_GAP)
 * and that real /media composition with PLP ON renders localized editorial sentinels.
 */
import assert from "node:assert/strict";
import { describe, it, afterEach } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";

import type { CivicMediaCenterPublic } from "@hu/types";
import { MEDIA_PLP_ENTITY_TYPE } from "@hu/types";

import { CivicMediaCenterPageContent } from "../../civic-media-center/components/CivicMediaCenterPageContent.js";
import { applyMediaPlpPresentationsToEditorial } from "./apply-media-plp-editorial.js";
import { composeMediaPageLocalization } from "./compose-media-page-localization.js";
import {
  setMediaPlpWebEnabledForTests,
  isMediaPlpWebEnabled,
} from "./feature-flag.js";
import {
  classifyRuntimeContradiction,
  evaluateMediaRuntimeTruth,
  MEDIA_LOCALIZATION_RUNTIME_BRANCH_LEGACY,
  MEDIA_LOCALIZATION_RUNTIME_BRANCH_PLP,
  ROUTE_BRANCH_GAP,
  LOCALE_PROPAGATION_GAP,
  RUNTIME_TRUTH_SENTINELS,
} from "./media-localization-runtime-truth.js";
import type { MediaPlpResolvedPresentation } from "./presentation.js";
import { readMediaPlpStringField } from "./presentation.js";
import { loadUiMessagesForLocale } from "../../i18n/load-ui-messages.js";

(globalThis as { React?: typeof React }).React = React;

const S = RUNTIME_TRUTH_SENTINELS;

afterEach(() => {
  setMediaPlpWebEnabledForTests(null);
});

function stagingShapedMedia(): CivicMediaCenterPublic {
  return {
    overview: {
      title: "Overview title EN",
      summary: S.overviewSummary.canonical,
      points: [
        {
          id: "p1",
          heading: "Point heading EN",
          body: "Point body EN",
        },
      ],
    },
    selectionPrinciples: [
      {
        id: "editorial-transparency",
        title: "Principle title EN",
        description: "Principle description EN",
        whyItMatters: "Why EN",
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
        explanation: "Trusted body EN",
        websiteUrl: "https://www.reuters.com/",
        sortOrder: 1,
      },
    ],
    factChecking: [
      {
        id: "snopes",
        name: "Snopes",
        logoLabel: "S",
        mission: "Mission EN",
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
        explanation: "Analysis EN",
        websiteUrl: "https://euvsdisinfo.eu/",
        sortOrder: 1,
      },
    ],
    faq: [
      {
        id: "faq-1",
        question: S.faqQ0.canonical,
        answer: S.faqA0.canonical,
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

function localizedEditorialPresentation(): MediaPlpResolvedPresentation {
  return {
    mode: "PUBLISHED_LOCALIZED",
    entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
    entityId: "civic-media-center",
    locale: "uk",
    canonicalVersion: "v-staging",
    presentation: {
      overviewTitle: "Огляд",
      overviewSummary: S.overviewSummary.localized,
      overviewPoints: [
        { id: "p1", heading: "H", body: "B" },
      ],
      faq: [
        {
          id: "faq-1",
          question: S.faqQ0.localized,
          answer: S.faqA0.localized,
        },
      ],
    },
  };
}

function plpMaps(media: CivicMediaCenterPublic) {
  const editorial = localizedEditorialPresentation();
  const trusted: Record<string, MediaPlpResolvedPresentation> = {
    reuters: {
      mode: "PUBLISHED_LOCALIZED",
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: "reuters",
      locale: "uk",
      canonicalVersion: "v1",
      presentation: {
        explanation: "__LOCALIZED_TRUSTED_BODY__",
      },
    },
  };
  const principles: Record<string, MediaPlpResolvedPresentation> = {
    "editorial-transparency": {
      mode: "PUBLISHED_LOCALIZED",
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
      entityId: "editorial-transparency",
      locale: "uk",
      canonicalVersion: "v1",
      presentation: {
        title: "__LOCALIZED_PRINCIPLE_TITLE__",
        description: "__LOCALIZED_PRINCIPLE_DESC__",
        whyItMatters: "__LOCALIZED_PRINCIPLE_WHY__",
      },
    },
  };
  const fact: Record<string, MediaPlpResolvedPresentation> = {
    snopes: {
      mode: "PUBLISHED_LOCALIZED",
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_FACT_CHECK,
      entityId: "snopes",
      locale: "uk",
      canonicalVersion: "v1",
      presentation: {
        mission: "__LOCALIZED_VERIFICATION_BODY__",
        coverage: "Claims",
      },
    },
  };
  const propaganda: Record<string, MediaPlpResolvedPresentation> = {
    "euvsdisinfo-analysis": {
      mode: "PUBLISHED_LOCALIZED",
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PROPAGANDA,
      entityId: "euvsdisinfo-analysis",
      locale: "uk",
      canonicalVersion: "v1",
      presentation: {
        focus: "Focus",
        explanation: "__LOCALIZED_ANALYSIS_BODY__",
      },
    },
  };
  return { editorial, trusted, principles, fact, propaganda, media };
}

describe("Reset 03E.6 — live runtime truth", () => {
  it("FIRST LOSS: API PUBLISHED_LOCALIZED + Web LEGACY → ROUTE_BRANCH_GAP", async () => {
    setMediaPlpWebEnabledForTests(false);
    assert.equal(isMediaPlpWebEnabled(), false);

    const media = stagingShapedMedia();
    const apiEditorial = localizedEditorialPresentation();
    assert.equal(apiEditorial.mode, "PUBLISHED_LOCALIZED");
    assert.equal(
      readMediaPlpStringField(apiEditorial.presentation, "overviewSummary"),
      S.overviewSummary.localized,
    );

    const composition = await composeMediaPageLocalization({
      media,
      locale: "uk",
      isPlpEnabled: () => false,
      loadLegacyEditorial: async () => {
        // Legacy CT miss → canonical English (staging-shaped).
        const { buildCanonicalCivicMediaEditorial } = await import(
          "../../civic-media-center/components/CivicMediaTranslatedEditorial.js"
        );
        return buildCanonicalCivicMediaEditorial(media);
      },
    });

    assert.equal(composition.runtimeBranch, MEDIA_LOCALIZATION_RUNTIME_BRANCH_LEGACY);
    assert.equal(composition.batchLocale, null);
    assert.equal(composition.plpEditorialPresentation, undefined);

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
            initialEditorial: composition.initialEditorial,
            mediaLocalizationRuntimeBranch: composition.runtimeBranch,
            mediaLocalizationRequestedLocale: "uk",
            mediaLocalizationBatchLocale: composition.batchLocale ?? undefined,
          },
        ),
      } as React.ComponentProps<typeof NextIntlClientProvider>),
    );

    assert.match(html, /data-hu-media-localization-runtime-branch="LEGACY"/);
    assert.match(html, new RegExp(S.overviewSummary.canonical));
    assert.match(html, new RegExp(S.faqQ0.canonical));
    assert.match(html, new RegExp(S.faqA0.canonical));
    assert.doesNotMatch(html, new RegExp(S.overviewSummary.localized));
    assert.doesNotMatch(html, new RegExp(S.faqQ0.localized));

    const gap = classifyRuntimeContradiction({
      runtimeBranch: composition.runtimeBranch,
      apiResolverMode: "PUBLISHED_LOCALIZED",
      htmlLang: "uk",
      batchLocale: composition.batchLocale,
      ssrContainsCanonical: html.includes(S.overviewSummary.canonical),
      ssrContainsLocalized: html.includes(S.overviewSummary.localized),
    });
    assert.equal(gap, ROUTE_BRANCH_GAP);
  });

  it("mandatory false-positive repair: PLP branch renders localized editorial sentinels", async () => {
    setMediaPlpWebEnabledForTests(true);
    const media = stagingShapedMedia();
    const maps = plpMaps(media);

    const composition = await composeMediaPageLocalization({
      media,
      locale: "uk",
      isPlpEnabled: () => true,
      fetchNewsArticles: async () => [],
      loadPlp: async () => ({
        trustedById: maps.trusted,
        principlesById: maps.principles,
        factCheckById: maps.fact,
        propagandaById: maps.propaganda,
        newsById: {},
        editorial: maps.editorial,
      }),
    });

    assert.equal(composition.runtimeBranch, MEDIA_LOCALIZATION_RUNTIME_BRANCH_PLP);
    assert.equal(composition.batchLocale, "uk");
    assert.equal(composition.requestedLocale, "uk");

    const applied = applyMediaPlpPresentationsToEditorial({
      media,
      trustedById: maps.trusted,
      principlesById: maps.principles,
      editorialPresentation: maps.editorial,
      requestedLocale: "uk",
    });
    assert.equal(applied.overview.summary, S.overviewSummary.localized);
    assert.equal(applied.faq[0]?.question, S.faqQ0.localized);
    assert.equal(applied.faq[0]?.answer, S.faqA0.localized);

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
            plpTrustedById: composition.plpTrustedById,
            plpPrinciplesById: composition.plpPrinciplesById,
            plpEditorialPresentation: composition.plpEditorialPresentation,
            plpFactCheckById: composition.plpFactCheckById,
            plpPropagandaById: composition.plpPropagandaById,
            mediaLocalizationRuntimeBranch: composition.runtimeBranch,
            mediaLocalizationRequestedLocale: composition.requestedLocale ?? "uk",
            mediaLocalizationBatchLocale: composition.batchLocale ?? undefined,
          },
        ),
      } as React.ComponentProps<typeof NextIntlClientProvider>),
    );

    assert.match(html, /data-hu-media-localization-runtime-branch="PLP"/);
    assert.match(html, /data-hu-media-localization-batch-locale="uk"/);
    assert.match(html, new RegExp(S.overviewSummary.localized));
    assert.match(html, new RegExp(S.faqQ0.localized));
    assert.match(html, new RegExp(S.faqA0.localized));
    assert.doesNotMatch(html, new RegExp(S.overviewSummary.canonical));
    assert.doesNotMatch(html, new RegExp(S.faqQ0.canonical));
    assert.doesNotMatch(html, new RegExp(S.faqA0.canonical));

    for (const path of ["overviewSummary", "faq[0].question", "faq[0].answer"] as const) {
      const resolved =
        path === "overviewSummary"
          ? S.overviewSummary.localized
          : path === "faq[0].question"
            ? S.faqQ0.localized
            : S.faqA0.localized;
      const canonical =
        path === "overviewSummary"
          ? S.overviewSummary.canonical
          : path === "faq[0].question"
            ? S.faqQ0.canonical
            : S.faqA0.canonical;
      const truth = evaluateMediaRuntimeTruth({
        semanticPath: path,
        requestedLocale: "uk",
        resolvedLocale: "uk",
        entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
        entityId: "civic-media-center",
        canonicalVersion: "v-staging",
        resolverResult: "PUBLISHED_LOCALIZED",
        runtimeBranch: MEDIA_LOCALIZATION_RUNTIME_BRANCH_PLP,
        resolvedValue: resolved,
        projectedValue: resolved,
        routePropValue: resolved,
        ssrValue: resolved,
        hydratedValue: resolved,
        canonicalValue: canonical,
      });
      assert.equal(truth.SSR_LOCALIZED, true);
      assert.equal(truth.HYDRATED_LOCALIZED, true);
    }

    assert.equal(
      classifyRuntimeContradiction({
        runtimeBranch: MEDIA_LOCALIZATION_RUNTIME_BRANCH_PLP,
        apiResolverMode: "PUBLISHED_LOCALIZED",
        htmlLang: "uk",
        batchLocale: "uk",
        ssrContainsCanonical: false,
        ssrContainsLocalized: true,
      }),
      null,
    );
  });

  it("locale propagation: html lang uk with batch locale en is LOCALE_PROPAGATION_GAP", () => {
    const gap = classifyRuntimeContradiction({
      runtimeBranch: MEDIA_LOCALIZATION_RUNTIME_BRANCH_PLP,
      apiResolverMode: "PUBLISHED_LOCALIZED",
      htmlLang: "uk",
      batchLocale: "en",
      ssrContainsCanonical: false,
      ssrContainsLocalized: true,
    });
    assert.equal(gap, LOCALE_PROPAGATION_GAP);
  });

  it("real /media page uses composeMediaPageLocalization (not fixture-only)", async () => {
    const fs = await import("node:fs");
    const page = fs.readFileSync(
      new URL("../../../app/media/page.tsx", import.meta.url),
      "utf8",
    );
    assert.match(page, /composeMediaPageLocalization/);
    assert.match(page, /mediaLocalizationRuntimeBranch/);
    assert.match(page, /MEDIA_PLP_NEWS_BATCH_LIMIT/);
  });

  it("readMediaPlpStringField unwraps plain {value} overviewSummary (projection harden)", () => {
    const summary = readMediaPlpStringField(
      {
        overviewTitle: "T",
        overviewSummary: { value: S.overviewSummary.localized },
      } as never,
      "overviewSummary",
    );
    assert.equal(summary, S.overviewSummary.localized);
  });

  it("Playwright cold-cache fixture is not the real /media composition", async () => {
    const fs = await import("node:fs");
    const pw = fs.readFileSync(
      new URL("./media-plp-cold-cache.playwright.e2e.ts", import.meta.url),
      "utf8",
    );
    // Forensic: structural fixture HTML ≠ composeMediaPageLocalization route.
    assert.match(pw, /buildRealisticMediaFixtureHtml/);
    assert.doesNotMatch(pw, /composeMediaPageLocalization/);
  });
});
