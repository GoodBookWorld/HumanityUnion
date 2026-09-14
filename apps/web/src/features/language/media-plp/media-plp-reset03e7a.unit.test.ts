/**
 * Reset 03E.7A — live truth probe activation status (no translation changes).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
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
  finalizeMediaPlpLiveTruthProbeAttrFromApplied,
  MEDIA_PLP_LIVE_TRUTH_PROBE_STATUS,
  resetMediaPlpLiveTruthProbeForTests,
  resolveMediaPlpLiveTruthProbeStatus,
  setMediaPlpLiveTruthProbeEnabledForTests,
} from "./media-plp-live-truth-probe.js";
import type { MediaPlpResolvedPresentation } from "./presentation.js";
import { loadUiMessagesForLocale } from "../../i18n/load-ui-messages.js";

(globalThis as { React?: typeof React }).React = React;

const here = path.dirname(fileURLToPath(import.meta.url));

afterEach(() => {
  setMediaPlpWebEnabledForTests(null);
  setMediaPlpLiveTruthProbeEnabledForTests(null);
  resetMediaPlpLiveTruthProbeForTests();
});

const CANONICAL_SUMMARY = "__CANONICAL_OVERVIEW_SUMMARY__";
const LOCALIZED_SUMMARY = "__LOCALIZED_OVERVIEW_SUMMARY__";

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
    faq: [{ id: "faq-1", question: "Q", answer: "A", sortOrder: 1 }],
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
      faq: [{ id: "faq-1", question: "Q-uk", answer: "A-uk" }],
    },
  };
}

async function renderMediaWithProbe(input: {
  readonly status: "ENABLED" | "DISABLED" | "ENV_UNAVAILABLE" | "NOT_WIRED" | undefined;
  readonly probeAttr?: string;
}): Promise<string> {
  const m = media();
  const loaded = await loadUiMessagesForLocale("uk");
  return renderToStaticMarkup(
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
          plpEditorialPresentation: localizedEditorial(),
          mediaLocalizationRuntimeBranch: "PLP",
          mediaLocalizationRequestedLocale: "uk",
          mediaLocalizationBatchLocale: "uk",
          ...(input.status !== undefined
            ? { mediaPlpLiveTruthProbeStatus: input.status }
            : {}),
          ...(input.probeAttr
            ? { mediaPlpLiveTruthProbeAttr: input.probeAttr }
            : {}),
        },
      ),
    } as React.ComponentProps<typeof NextIntlClientProvider>),
  );
}

describe("Reset 03E.7A — live truth probe activation", () => {
  it("env true → status ENABLED + live-truth attr present", async () => {
    setMediaPlpLiveTruthProbeEnabledForTests(true);
    assert.equal(
      resolveMediaPlpLiveTruthProbeStatus(),
      MEDIA_PLP_LIVE_TRUTH_PROBE_STATUS.ENABLED,
    );

    setMediaPlpWebEnabledForTests(true);
    beginMediaPlpLiveTruthProbe({ REQUESTED_LOCALE: "uk" });
    const m = media();
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
        editorial: localizedEditorial(),
      }),
    });
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
    assert.ok(probeAttr);

    const html = await renderMediaWithProbe({
      status: MEDIA_PLP_LIVE_TRUTH_PROBE_STATUS.ENABLED,
      probeAttr,
    });
    assert.match(
      html,
      /data-hu-media-plp-live-truth-probe-status="ENABLED"/,
    );
    assert.match(html, /data-hu-media-plp-live-truth="/);
  });

  it("env false/unset override → status DISABLED + live-truth attr absent", async () => {
    setMediaPlpLiveTruthProbeEnabledForTests(false);
    assert.equal(
      resolveMediaPlpLiveTruthProbeStatus(),
      MEDIA_PLP_LIVE_TRUTH_PROBE_STATUS.DISABLED,
    );

    const html = await renderMediaWithProbe({
      status: MEDIA_PLP_LIVE_TRUTH_PROBE_STATUS.DISABLED,
      probeAttr: "should-not-render",
    });
    assert.match(
      html,
      /data-hu-media-plp-live-truth-probe-status="DISABLED"/,
    );
    assert.doesNotMatch(html, /data-hu-media-plp-live-truth="/);
  });

  it("missing status prop → NOT_WIRED (proves route wiring gap)", async () => {
    const html = await renderMediaWithProbe({ status: undefined });
    assert.match(
      html,
      /data-hu-media-plp-live-truth-probe-status="NOT_WIRED"/,
    );
  });

  it("real /media page.tsx wires status from resolveMediaPlpLiveTruthProbeStatus", () => {
    const pagePath = path.resolve(here, "../../../app/media/page.tsx");
    const source = readFileSync(pagePath, "utf8");
    assert.match(source, /resolveMediaPlpLiveTruthProbeStatus/);
    assert.match(source, /mediaPlpLiveTruthProbeStatus=\{mediaPlpLiveTruthProbeStatus\}/);
    assert.match(source, /finalizeMediaPlpLiveTruthProbeAttrFromApplied/);
    assert.match(source, /MEDIA_PLP_LIVE_TRUTH_PROBE_STATUS\.ENABLED/);
  });

  it("probe module retains static process.env.HU_MEDIA_PLP_LIVE_TRUTH_PROBE read", () => {
    const probePath = path.resolve(here, "./media-plp-live-truth-probe.ts");
    const source = readFileSync(probePath, "utf8");
    assert.match(source, /process\.env\.HU_MEDIA_PLP_LIVE_TRUTH_PROBE/);
  });
});
