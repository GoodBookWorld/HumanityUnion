/**
 * Reset 03E.2 — content integrity × rendered coverage (web; no live ops).
 *
 * Authority remains the real CivicMediaCenterPageContent render tree.
 * A PUBLISHED-looking entity that the resolver would fail-closed to
 * CANONICAL_FALLBACK must not contribute PUBLISHED_LOCALIZED / FULLY_LOCALIZED.
 */

import assert from "node:assert/strict";
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
import { applyMediaPlpPresentationsToEditorial } from "./apply-media-plp-editorial.js";
import {
  collectRenderedMediaSemanticNodes,
  formatMediaRenderedCoverageReport,
  summarizeRenderedMediaCoverage,
} from "./media-rendered-coverage.js";
import type { MediaPlpResolvedPresentation } from "./presentation.js";
import { loadUiMessagesForLocale } from "../../i18n/load-ui-messages.js";

(globalThis as { React?: typeof React }).React = React;

const __dirname = dirname(fileURLToPath(import.meta.url));
const webSrc = join(__dirname, "../../..");
void webSrc;

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
        coverage: "Claims",
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
    summary: "News summary EN",
    category: "World",
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
): MediaPlpResolvedPresentation {
  return {
    mode,
    presentation,
    entityType,
    entityId,
    locale,
    canonicalVersion: mode === "PUBLISHED_LOCALIZED" ? "v-plp2" : "canonical",
  };
}

const ukEditorialPresentation = {
  overviewTitle: "Огляд заголовок",
  overviewSummary: "Огляд резюме",
  overviewPoints: [
    { id: "p1", heading: "Пункт заголовок", body: "Пункт тіло" },
    { id: "p2", heading: "Пункт два", body: "Пункт два тіло" },
  ],
  faq: [{ id: "faq-1", question: "Питання FAQ?", answer: "Відповідь FAQ" }],
};

async function renderMediaPage(input: {
  readonly locale: string;
  readonly media?: CivicMediaCenterPublic;
  readonly plpTrustedById?: Record<string, MediaPlpResolvedPresentation>;
  readonly plpPrinciplesById?: Record<string, MediaPlpResolvedPresentation>;
  readonly plpEditorialPresentation?: MediaPlpResolvedPresentation;
}): Promise<string> {
  const loaded = await loadUiMessagesForLocale(input.locale);
  const media = input.media ?? sampleMedia();
  const tree = createElement(NextIntlClientProvider, {
    locale: input.locale,
    messages: loaded.messages,
    timeZone: "UTC",
    children: createElement(
      CivicMediaCenterPageContent as React.ComponentType<Record<string, unknown>>,
      {
        initialMedia: media,
        plpTrustedById: input.plpTrustedById,
        plpPrinciplesById: input.plpPrinciplesById,
        plpEditorialPresentation: input.plpEditorialPresentation,
        initialNewsArticles: [sampleNews()],
      },
    ),
  } as React.ComponentProps<typeof NextIntlClientProvider>);
  return renderToStaticMarkup(tree);
}

function fullyLocalizedExceptEditorialFallback(locale: string) {
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
        },
        locale,
      ),
    },
  };
}

describe("Reset 03E.2 — content integrity × rendered coverage", () => {
  it("valid uk editorial fixture renders Ukrainian in shared CivicMediaCenterPageContent", async () => {
    const html = await renderMediaPage({
      locale: "uk",
      ...fullyLocalizedExceptEditorialFallback("uk"),
      plpEditorialPresentation: plp(
        MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
        "civic-media-center",
        "PUBLISHED_LOCALIZED",
        ukEditorialPresentation,
        "uk",
      ),
    });
    assert.match(html, /Огляд заголовок/);
    assert.match(html, /Огляд резюме/);
    assert.match(html, /Пункт заголовок/);
    assert.match(html, /Питання FAQ\?/);
    assert.match(html, /Відповідь FAQ/);
    assert.doesNotMatch(html, /Overview title EN/);
    assert.doesNotMatch(html, /FAQ question EN\?/);
  });

  it("integrity-invalid editorial (resolver CANONICAL_FALLBACK) cannot be FULLY_LOCALIZED", async () => {
    // Mimics post-03E.2 resolver: PUBLISHED snapshot with English prose fails closed.
    const html = await renderMediaPage({
      locale: "uk",
      ...fullyLocalizedExceptEditorialFallback("uk"),
      plpEditorialPresentation: plp(
        MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
        "civic-media-center",
        "CANONICAL_FALLBACK",
        {
          overviewTitle: "Overview title EN",
          overviewSummary: "Overview summary EN",
        },
        "uk",
      ),
    });
    assert.match(html, /Overview title EN/);
    const report = summarizeRenderedMediaCoverage(
      collectRenderedMediaSemanticNodes(html),
      "uk",
    );
    assert.notEqual(report.PAGE_STATUS, "FULLY_LOCALIZED");
    assert.ok(report.CANONICAL_FALLBACK_NODES > 0);
    const editorial = report.nodes.filter(
      (n) => n.entityType === "civic_media_editorial" && n.owner === "PLP_ENTITY",
    );
    assert.ok(editorial.length >= 1);
    assert.ok(editorial.every((n) => n.result === "CANONICAL_FALLBACK"));
    assert.match(
      formatMediaRenderedCoverageReport(report),
      /CANONICAL_FALLBACK_NODES=/,
    );
  });

  it("apply path does not mix: fallback mode keeps complete canonical editorial", () => {
    const media = sampleMedia();
    const applied = applyMediaPlpPresentationsToEditorial({
      media,
      principlesById: {},
      trustedById: {},
      editorialPresentation: plp(
        MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
        "civic-media-center",
        "CANONICAL_FALLBACK",
        ukEditorialPresentation,
        "uk",
      ),
      requestedLocale: "uk",
    });
    assert.equal(applied.overview.title, "Overview title EN");
    assert.equal(applied.faq[0]?.question, "FAQ question EN?");
  });

  it("valid PUBLISHED_LOCALIZED editorial applies whole-entity Ukrainian", () => {
    const media = sampleMedia();
    const applied = applyMediaPlpPresentationsToEditorial({
      media,
      principlesById: {},
      trustedById: {},
      editorialPresentation: plp(
        MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
        "civic-media-center",
        "PUBLISHED_LOCALIZED",
        ukEditorialPresentation,
        "uk",
      ),
      requestedLocale: "uk",
    });
    assert.equal(applied.overview.title, "Огляд заголовок");
    assert.equal(applied.overview.summary, "Огляд резюме");
    assert.equal(applied.overview.points[0]?.heading, "Пункт заголовок");
    assert.equal(applied.faq[0]?.question, "Питання FAQ?");
    assert.equal(applied.faq[0]?.answer, "Відповідь FAQ");
  });
});
