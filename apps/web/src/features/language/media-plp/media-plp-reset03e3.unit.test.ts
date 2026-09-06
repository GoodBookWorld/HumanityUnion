/**
 * Reset 03E.3 — Media structural completeness (web; no live ops).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
import { MediaSemanticNode } from "./media-semantic-contract.js";
import {
  collectRenderedMediaSemanticNodes,
  summarizeRenderedMediaCoverage,
} from "./media-rendered-coverage.js";
import {
  collectPresentationStringPaths,
  evaluateMediaEntityStructuralParity,
  evaluateMediaPageStructuralIntegrity,
  formatMediaStructuralIntegrityReport,
} from "./media-structural-integrity.js";
import type { MediaPlpResolvedPresentation } from "./presentation.js";
import { loadUiMessagesForLocale } from "../../i18n/load-ui-messages.js";

(globalThis as { React?: typeof React }).React = React;

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

async function renderMediaPage(input: {
  readonly locale: string;
  readonly media?: CivicMediaCenterPublic;
  readonly plpTrustedById?: Record<string, MediaPlpResolvedPresentation>;
  readonly plpPrinciplesById?: Record<string, MediaPlpResolvedPresentation>;
  readonly plpEditorialPresentation?: MediaPlpResolvedPresentation;
  readonly plpFactCheckById?: Record<string, MediaPlpResolvedPresentation>;
  readonly plpPropagandaById?: Record<string, MediaPlpResolvedPresentation>;
  readonly inject?: React.ReactNode;
}): Promise<string> {
  const loaded = await loadUiMessagesForLocale(input.locale);
  const media = input.media ?? sampleMedia();
  const tree = createElement(NextIntlClientProvider, {
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
        initialNewsArticles: [sampleNews()],
      }),
      input.inject ?? null,
    ),
  } as React.ComponentProps<typeof NextIntlClientProvider>);
  return renderToStaticMarkup(tree);
}

function fullyLocalizedPlp(locale: string) {
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
        { mission: `[${locale}] mission`, coverage: `[${locale}] coverage` },
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
  };
}

describe("Reset 03E.3 — Media structural completeness", () => {
  it("entity parity: rendered path missing from canonical source fails", () => {
    const parity = evaluateMediaEntityStructuralParity({
      renderedPaths: ["title", "ghost.path"],
      shape: {
        entityType: "civic_media_principle",
        entityId: "x",
        canonicalSourcePaths: ["title", "description"],
        buildInputPaths: ["title", "description"],
        localizedOutputPaths: ["title", "description"],
        appliedPresentationPaths: ["title", "description"],
      },
    });
    assert.ok(parity.counts.RENDERED_WITHOUT_SOURCE >= 1);
    assert.ok(
      parity.mismatches.includes("RENDERED_PATH_NOT_IN_CANONICAL_LOCALIZATION_SOURCE"),
    );
  });

  it("entity parity: build path missing from presentation fails", () => {
    const parity = evaluateMediaEntityStructuralParity({
      renderedPaths: ["title"],
      shape: {
        entityType: "civic_media_principle",
        entityId: "x",
        canonicalSourcePaths: ["title", "description"],
        buildInputPaths: ["title", "description"],
        localizedOutputPaths: ["title"],
        appliedPresentationPaths: ["title"],
      },
    });
    assert.ok(parity.counts.BUILD_WITHOUT_OUTPUT >= 1);
    assert.ok(parity.mismatches.includes("BUILD_WITHOUT_OUTPUT"));
  });

  it("entity parity: presentation not applied fails", () => {
    const parity = evaluateMediaEntityStructuralParity({
      renderedPaths: ["explanation"],
      shape: {
        entityType: "civic_media_trusted",
        entityId: "reuters",
        canonicalSourcePaths: ["explanation"],
        buildInputPaths: ["explanation"],
        localizedOutputPaths: ["explanation"],
        appliedPresentationPaths: [],
      },
    });
    assert.ok(parity.counts.OUTPUT_WITHOUT_APPLY >= 1);
    assert.ok(parity.mismatches.includes("PRESENTATION_PATH_NOT_APPLIED"));
  });

  it("unowned nested paragraph fails structural gate", async () => {
    const seeded = fullyLocalizedPlp("uk");
    const html = await renderMediaPage({
      locale: "uk",
      ...seeded,
      inject: createElement(
        MediaSemanticNode,
        { owner: "BUG_UNOWNED", result: "UNOWNED", as: "p" },
        "Orphan English paragraph",
      ),
    });
    const structural = evaluateMediaPageStructuralIntegrity({
      html,
      entities: [],
      strictPlpSemanticPaths: false,
    });
    assert.equal(structural.STRUCTURAL_INTEGRITY_STATUS, "FAILED");
    assert.ok(structural.reasons.includes("UNOWNED_RENDERED_SEMANTIC_NODE"));
  });

  it("UI dictionary missing key (strict) fails", () => {
    const html = renderToStaticMarkup(
      createElement(
        MediaSemanticNode,
        { owner: "UI_DICTIONARY", result: "LOCALIZED_DICTIONARY", as: "span" },
        "Label",
      ),
    );
    const structural = evaluateMediaPageStructuralIntegrity({
      html,
      entities: [],
      strictUiDictionaryKeys: true,
      strictPlpSemanticPaths: false,
    });
    assert.ok(structural.reasons.includes("UI_DICTIONARY_KEY_MISSING"));
  });

  it("UI dictionary locale fallback fails when key absent from locale set", () => {
    const html = renderToStaticMarkup(
      createElement(
        MediaSemanticNode,
        {
          owner: "UI_DICTIONARY",
          result: "LOCALIZED_DICTIONARY",
          messageKey: "civicMediaPublic.missingKey",
          as: "span",
        },
        "English fallback",
      ),
    );
    const structural = evaluateMediaPageStructuralIntegrity({
      html,
      entities: [],
      uiDictionaryKeysPresent: new Set(["civicMediaPublic.other"]),
      strictPlpSemanticPaths: false,
    });
    assert.ok(structural.reasons.includes("UI_DICTIONARY_LOCALE_FALLBACK"));
  });

  it("valid uk fixture: semantic paths on editorial + principles + fact/propaganda", async () => {
    const seeded = fullyLocalizedPlp("uk");
    const html = await renderMediaPage({ locale: "uk", ...seeded });
    assert.match(html, /data-hu-semantic-path="overviewTitle"/);
    assert.match(html, /data-hu-semantic-path="whyItMatters"/);
    assert.match(html, /data-hu-semantic-path="mission"/);
    assert.match(html, /data-hu-plp-entity="civic_media_fact_check"/);
    assert.match(html, /data-hu-plp-entity="civic_media_propaganda"/);
    assert.match(html, /\[uk\] overview title/);
    assert.match(html, /\[uk\] why matters/);
    assert.match(html, /\[uk\] mission/);
    assert.doesNotMatch(html, /Why matters EN/);

    const coverage = summarizeRenderedMediaCoverage(
      collectRenderedMediaSemanticNodes(html),
      "uk",
    );
    assert.equal(coverage.UNOWNED_NODES, 0);
    // News may still contribute CANONICAL_FALLBACK when not in PLP fixture — acceptable for this pack's editorial focus.
    // Structural editorial entity must be fully wired:
    const editorialPaths = collectPresentationStringPaths(
      (seeded.plpEditorialPresentation.presentation as object) ?? {},
    ).filter((p) => !p.endsWith(".id"));
    const parity = evaluateMediaEntityStructuralParity({
      renderedPaths: collectRenderedMediaSemanticNodes(html)
        .filter(
          (n) =>
            n.entityType === "civic_media_editorial" &&
            n.owner === "PLP_ENTITY" &&
            n.semanticPath,
        )
        .map((n) => n.semanticPath!),
      shape: {
        entityType: "civic_media_editorial",
        entityId: "civic-media-center",
        canonicalSourcePaths: editorialPaths,
        buildInputPaths: editorialPaths,
        localizedOutputPaths: editorialPaths,
        appliedPresentationPaths: editorialPaths,
      },
    });
    assert.equal(parity.counts.STRUCTURAL_MISMATCH_COUNT, 0, formatMediaStructuralIntegrityReport({
      ...parity.counts,
      STRUCTURAL_INTEGRITY_STATUS: "PASSED",
      STRUCTURAL_INTEGRITY_VERSION: "LSI.1",
      reasons: parity.mismatches,
      failingPaths: parity.failingPaths,
    }));
  });

  it("fact-checking bodies are PLP_ENTITY not UI_DICTIONARY", async () => {
    const seeded = fullyLocalizedPlp("uk");
    const html = await renderMediaPage({ locale: "uk", ...seeded });
    const nodes = collectRenderedMediaSemanticNodes(html).filter(
      (n) => n.entityType === "civic_media_fact_check" && n.semanticPath === "mission",
    );
    assert.ok(nodes.length >= 1);
    assert.ok(nodes.every((n) => n.owner === "PLP_ENTITY"));
  });
});
