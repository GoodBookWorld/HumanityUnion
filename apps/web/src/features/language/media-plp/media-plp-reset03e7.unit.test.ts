/**
 * Reset 03E.7 — Web live truth probe + real response-contract composition.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";

import type { CivicMediaCenterPublic } from "@hu/types";
import { MEDIA_PLP_ENTITY_TYPE } from "@hu/types";

import { CivicMediaCenterPageContent } from "../../civic-media-center/components/CivicMediaCenterPageContent.js";
import { applyMediaPlpPresentationsToEditorial } from "./apply-media-plp-editorial.js";
import { composeMediaPageLocalization } from "./compose-media-page-localization.js";
import { setMediaPlpWebEnabledForTests } from "./feature-flag.js";
import {
  beginMediaPlpLiveTruthProbe,
  decodeMediaPlpLiveTruthProbeAttr,
  evaluateEditorialPathLineage,
  finalizeMediaPlpLiveTruthProbeAttrFromApplied,
  fingerprintProbeValue,
  MEDIA_PLP_LIVE_TRUTH_PROBE_STATUS,
  resetMediaPlpLiveTruthProbeForTests,
  setMediaPlpLiveTruthProbeEnabledForTests,
} from "./media-plp-live-truth-probe.js";
import type { MediaPlpResolvedPresentation } from "./presentation.js";
import { loadUiMessagesForLocale } from "../../i18n/load-ui-messages.js";

(globalThis as { React?: typeof React }).React = React;

afterEach(() => {
  setMediaPlpWebEnabledForTests(null);
  setMediaPlpLiveTruthProbeEnabledForTests(null);
  resetMediaPlpLiveTruthProbeForTests();
});

const CANONICAL_SUMMARY = "__CANONICAL_OVERVIEW_SUMMARY__";
const LOCALIZED_SUMMARY = "__LOCALIZED_OVERVIEW_SUMMARY__";
const CANONICAL_Q = "__CANONICAL_FAQ_Q0__";
const LOCALIZED_Q = "__LOCALIZED_FAQ_Q0__";
const CANONICAL_A = "__CANONICAL_FAQ_A0__";
const LOCALIZED_A = "__LOCALIZED_FAQ_A0__";

function media(): CivicMediaCenterPublic {
  return {
    overview: {
      title: "Overview title EN",
      summary: CANONICAL_SUMMARY,
      points: [{ id: "p1", heading: "H", body: "B" }],
    },
    selectionPrinciples: [
      {
        id: "editorial-transparency",
        title: "T",
        description: "D",
        whyItMatters: "W",
        sortOrder: 1,
      },
    ],
    trustedMediaCategories: [
      { id: "international-wire-service", title: "Wire", description: "W", sortOrder: 1 },
    ],
    trustedMedia: [
      {
        id: "reuters",
        name: "Reuters",
        logoLabel: "R",
        country: "International",
        categoryId: "international-wire-service",
        explanation: "E",
        websiteUrl: "https://www.reuters.com/",
        sortOrder: 1,
      },
    ],
    factChecking: [],
    propagandaAnalysis: [],
    faq: [{ id: "faq-1", question: CANONICAL_Q, answer: CANONICAL_A, sortOrder: 1 }],
    initiativeFlow: { title: "F", summary: "S", diagramSvg: "", stages: ["A"] },
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function localizedEditorial(): MediaPlpResolvedPresentation {
  return {
    mode: "PUBLISHED_LOCALIZED",
    entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
    entityId: "civic-media-center",
    locale: "uk",
    canonicalVersion: "v-live",
    presentation: {
      overviewTitle: "Огляд",
      overviewSummary: LOCALIZED_SUMMARY,
      overviewPoints: [{ id: "p1", heading: "H", body: "B" }],
      faq: [{ id: "faq-1", question: LOCALIZED_Q, answer: LOCALIZED_A }],
    },
  };
}

describe("Reset 03E.7 — live truth probe + payload contract", () => {
  it("fingerprint lineage detects PROJECTION_GAP when resolved localized but projected canonical", () => {
    const row = evaluateEditorialPathLineage({
      path: "overviewSummary",
      canonical: CANONICAL_SUMMARY,
      resolved: LOCALIZED_SUMMARY,
      projected: CANONICAL_SUMMARY,
      ssr: CANONICAL_SUMMARY,
    });
    assert.equal(row.firstLoss, "PROJECTION_GAP");
    assert.notEqual(row.RESOLVED_FINGERPRINT, row.CANONICAL_FINGERPRINT);
    assert.equal(row.PROJECTED_FINGERPRINT, row.CANONICAL_FINGERPRINT);
  });

  it("real JSON round-trip presentation still applies localized editorial", () => {
    // Prior fixtures injected in-memory objects; staging goes through JSON wire.
    const wire = JSON.parse(JSON.stringify(localizedEditorial())) as MediaPlpResolvedPresentation;
    const applied = applyMediaPlpPresentationsToEditorial({
      media: media(),
      trustedById: {},
      principlesById: {},
      editorialPresentation: wire,
      requestedLocale: "uk",
    });
    assert.equal(applied.overview.summary, LOCALIZED_SUMMARY);
    assert.equal(applied.faq[0]?.question, LOCALIZED_Q);
    assert.equal(applied.faq[0]?.answer, LOCALIZED_A);
  });

  it("reproduces live contradiction: API CANONICAL_FALLBACK → SSR canonical firstLoss", async () => {
    // Staging-shaped: PLP branch + exact editorial identity + API returned
    // CANONICAL_FALLBACK (e.g. CANONICAL_VERSION_MISMATCH) with canonical presentation.
    setMediaPlpWebEnabledForTests(true);
    beginMediaPlpLiveTruthProbe({ REQUESTED_LOCALE: "uk" });
    const m = media();
    const fallbackEditorial: MediaPlpResolvedPresentation = {
      mode: "CANONICAL_FALLBACK",
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: "civic-media-center",
      locale: "uk",
      canonicalVersion: "v-skew",
      presentation: {
        overviewTitle: m.overview.title,
        overviewSummary: CANONICAL_SUMMARY,
        overviewPoints: m.overview.points.map((p) => ({
          id: p.id,
          heading: p.heading,
          body: p.body,
        })),
        faq: m.faq.map((f) => ({
          id: f.id,
          question: f.question,
          answer: f.answer,
        })),
      },
    };

    const composition = await composeMediaPageLocalization({
      media: m,
      locale: "uk",
      isPlpEnabled: () => true,
      fetchNewsArticles: async () => [],
      loadPlp: async () => ({
        trustedById: {},
        principlesById: {},
        factCheckById: {},
        propagandaById: {},
        newsById: {},
        editorial: fallbackEditorial,
      }),
    });

    assert.equal(composition.runtimeBranch, "PLP");
    assert.equal(composition.plpEditorialPresentation?.mode, "CANONICAL_FALLBACK");

    const applied = applyMediaPlpPresentationsToEditorial({
      media: m,
      trustedById: {},
      principlesById: {},
      editorialPresentation: composition.plpEditorialPresentation,
      requestedLocale: "uk",
    });
    const probeAttr = finalizeMediaPlpLiveTruthProbeAttrFromApplied({
      overviewSummary: applied.overview.summary,
      faq0Question: applied.faq[0]?.question ?? "",
      faq0Answer: applied.faq[0]?.answer ?? "",
    });

    const loaded = await loadUiMessagesForLocale("uk");
    const html = renderToStaticMarkup(
      createElement(NextIntlClientProvider, {
        locale: "uk",
        messages: loaded.messages,
        timeZone: "UTC",
        children: createElement(
          CivicMediaCenterPageContent as React.ComponentType<Record<string, unknown>>,
          {
            initialMedia: m,
            plpTrustedById: {},
            plpPrinciplesById: {},
            plpEditorialPresentation: composition.plpEditorialPresentation,
            mediaLocalizationRuntimeBranch: composition.runtimeBranch,
            mediaLocalizationRequestedLocale: "uk",
            mediaLocalizationBatchLocale: "uk",
            mediaPlpLiveTruthProbeStatus: MEDIA_PLP_LIVE_TRUTH_PROBE_STATUS.ENABLED,
            mediaPlpLiveTruthProbeAttr: probeAttr,
          },
        ),
      } as React.ComponentProps<typeof NextIntlClientProvider>),
    );

    assert.match(html, new RegExp(CANONICAL_SUMMARY));
    assert.doesNotMatch(html, new RegExp(LOCALIZED_SUMMARY));
    assert.match(
      html,
      /data-hu-media-plp-live-truth-probe-status="ENABLED"/,
    );
    const attr = html.match(/data-hu-media-plp-live-truth="([^"]+)"/)?.[1];
    assert.ok(attr);
    const parsed = decodeMediaPlpLiveTruthProbeAttr(attr);
    assert.equal(parsed.API_RESULT_MODE, "CANONICAL_FALLBACK");
    const overview = parsed.paths.find((p) => p.path === "overviewSummary");
    assert.ok(overview);
    assert.equal(overview!.firstLoss, "RESOLVED_EQUALS_CANONICAL");
    assert.equal(overview!.RESOLVED_FINGERPRINT, overview!.CANONICAL_FINGERPRINT);
    assert.equal(overview!.SSR_FINGERPRINT, overview!.CANONICAL_FINGERPRINT);
  });

  it("PLP composition + probe: localized SSR fingerprints after real apply", async () => {
    setMediaPlpWebEnabledForTests(true);
    beginMediaPlpLiveTruthProbe({ REQUESTED_LOCALE: "uk" });
    const m = media();
    const editorial = localizedEditorial();
    const composition = await composeMediaPageLocalization({
      media: m,
      locale: "uk",
      isPlpEnabled: () => true,
      fetchNewsArticles: async () => [],
      loadPlp: async () => ({
        trustedById: {
          reuters: {
            mode: "PUBLISHED_LOCALIZED",
            entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
            entityId: "reuters",
            locale: "uk",
            canonicalVersion: "v1",
            presentation: { explanation: "L" },
          },
        },
        principlesById: {
          "editorial-transparency": {
            mode: "PUBLISHED_LOCALIZED",
            entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
            entityId: "editorial-transparency",
            locale: "uk",
            canonicalVersion: "v1",
            presentation: { title: "T", description: "D", whyItMatters: "W" },
          },
        },
        factCheckById: {},
        propagandaById: {},
        newsById: {},
        editorial,
      }),
    });

    const applied = applyMediaPlpPresentationsToEditorial({
      media: m,
      trustedById: composition.plpTrustedById ?? {},
      principlesById: composition.plpPrinciplesById ?? {},
      editorialPresentation: composition.plpEditorialPresentation,
      requestedLocale: "uk",
    });
    const probeAttr = finalizeMediaPlpLiveTruthProbeAttrFromApplied({
      overviewSummary: applied.overview.summary,
      faq0Question: applied.faq[0]?.question ?? "",
      faq0Answer: applied.faq[0]?.answer ?? "",
    });

    const loaded = await loadUiMessagesForLocale("uk");
    const html = renderToStaticMarkup(
      createElement(NextIntlClientProvider, {
        locale: "uk",
        messages: loaded.messages,
        timeZone: "UTC",
        children: createElement(
          CivicMediaCenterPageContent as React.ComponentType<Record<string, unknown>>,
          {
            initialMedia: m,
            plpTrustedById: composition.plpTrustedById,
            plpPrinciplesById: composition.plpPrinciplesById,
            plpEditorialPresentation: composition.plpEditorialPresentation,
            mediaLocalizationRuntimeBranch: composition.runtimeBranch,
            mediaLocalizationRequestedLocale: "uk",
            mediaLocalizationBatchLocale: "uk",
            mediaPlpLiveTruthProbeStatus: MEDIA_PLP_LIVE_TRUTH_PROBE_STATUS.ENABLED,
            mediaPlpLiveTruthProbeAttr: probeAttr,
          },
        ),
      } as React.ComponentProps<typeof NextIntlClientProvider>),
    );

    assert.match(html, new RegExp(LOCALIZED_SUMMARY));
    assert.match(html, new RegExp(LOCALIZED_Q));
    assert.doesNotMatch(html, new RegExp(CANONICAL_SUMMARY));
    assert.match(
      html,
      /data-hu-media-plp-live-truth-probe-status="ENABLED"/,
    );
    assert.match(html, /data-hu-media-plp-live-truth=/);

    const attr = html.match(/data-hu-media-plp-live-truth="([^"]+)"/)?.[1];
    assert.ok(attr);
    const parsed = decodeMediaPlpLiveTruthProbeAttr(attr);
    const overview = parsed.paths.find((p) => p.path === "overviewSummary");
    assert.ok(overview);
    assert.equal(overview!.firstLoss, "NONE");
    assert.equal(overview!.SSR_FINGERPRINT, fingerprintProbeValue(LOCALIZED_SUMMARY));
  });
});
