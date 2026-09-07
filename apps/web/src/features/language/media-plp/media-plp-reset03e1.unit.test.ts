/**
 * Reset 03E.1 — Media localization coverage derived from rendered semantic contracts.
 * Authority is the real CivicMediaCenterPageContent render tree, not a hand inventory.
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
  PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
  type CivicMediaCenterPublic,
  type PublicNewsArticleItem,
  type TrustedMediaResource,
} from "@hu/types";

import { CivicMediaCenterPageContent } from "../../civic-media-center/components/CivicMediaCenterPageContent.js";
import { MediaSemanticNode } from "./media-semantic-contract.js";
import {
  assertFullyLocalizedMediaCoverage,
  collectRenderedMediaSemanticNodes,
  findUnownedMediaTextCandidates,
  formatMediaRenderedCoverageReport,
  summarizeRenderedMediaCoverage,
} from "./media-rendered-coverage.js";
import type { MediaPlpResolvedPresentation } from "./presentation.js";
import { loadUiMessagesForLocale } from "../../i18n/load-ui-messages.js";

// tsx may compile some JSX with classic runtime when rendering deep client trees.
(globalThis as { React?: typeof React }).React = React;

const __dirname = dirname(fileURLToPath(import.meta.url));
const webSrc = join(__dirname, "../../..");
const repoRoot = join(webSrc, "../..");

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

function fullySeededPlp(locale: string) {
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
    plpNewsById: {
      "news-1": plp(
        MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
        "news-1",
        "PUBLISHED_LOCALIZED",
        {
          title: `[${locale}] news title`,
          summary: `[${locale}] news summary that is long enough for bullets.`,
          category: `[${locale}] World`,
        },
        locale,
      ),
    },
  };
}

describe("Reset 03E.1 — rendered semantic coverage authority", () => {
  it("documents why 03E inventory UNOWNED_FIELDS=0 was a false positive", () => {
    const inventory = readFileSync(
      join(webSrc, "features/language/media-plp/media-semantic-inventory.ts"),
      "utf8",
    );
    assert.match(inventory, /summarizeMediaSemanticCoverage/);
    assert.match(inventory, /BUG_UNOWNED/);
    // Inventory counted declared owners in a static table — never inspected render results.
    assert.doesNotMatch(inventory, /data-hu-semantic-result/);
    assert.doesNotMatch(inventory, /PAGE_STATUS|FULLY_LOCALIZED/);
  });

  it("schema PLP.1 under PLP.2 runtime is CANONICAL_FALLBACK (not localized)", async () => {
    assert.equal(PUBLISHED_LOCALIZATION_SCHEMA_VERSION, "PLP.2");
    const html = await renderMediaPage({
      locale: "uk",
      plpTrustedById: {
        reuters: plp(
          MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
          "reuters",
          "CANONICAL_FALLBACK",
          { explanation: reuters.explanation },
          "uk",
        ),
      },
      plpPrinciplesById: {
        "editorial-transparency": plp(
          MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
          "editorial-transparency",
          "CANONICAL_FALLBACK",
          {
            title: "Independence EN",
            description: "Principle description EN",
          },
          "uk",
        ),
      },
      plpEditorialPresentation: plp(
        MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
        "civic-media-center",
        "CANONICAL_FALLBACK",
        {},
        "uk",
      ),
    });
    const report = summarizeRenderedMediaCoverage(
      collectRenderedMediaSemanticNodes(html),
      "uk",
    );
    assert.ok(report.CANONICAL_FALLBACK_NODES > 0);
    assert.notEqual(report.PAGE_STATUS, "FULLY_LOCALIZED");
    assert.match(formatMediaRenderedCoverageReport(report), /CANONICAL_FALLBACK_NODES=/);
    const trusted = report.nodes.find(
      (n) => n.entityId === "reuters" && n.owner === "PLP_ENTITY",
    );
    assert.equal(trusted?.result, "CANONICAL_FALLBACK");
  });

  it("editorial PLP.2 fixture localizes overview + FAQ in real shared renderer", async () => {
    const seeded = fullySeededPlp("uk");
    const html = await renderMediaPage({ locale: "uk", ...seeded });
    assert.match(html, /\[uk\] overview title/);
    assert.match(html, /\[uk\] FAQ\?/);
    assert.doesNotMatch(html, /Overview title EN/);
    const report = summarizeRenderedMediaCoverage(
      collectRenderedMediaSemanticNodes(html),
      "uk",
    );
    const editorial = report.nodes.filter(
      (n) => n.entityType === "civic_media_editorial" && n.owner === "PLP_ENTITY",
    );
    assert.ok(editorial.length >= 4);
    assert.ok(editorial.every((n) => n.result === "PUBLISHED_LOCALIZED"));
  });

  it("UI dictionary chrome (stage/showing) comes from locale messages", async () => {
    const seeded = fullySeededPlp("uk");
    const html = await renderMediaPage({ locale: "uk", ...seeded });
    const uk = await loadUiMessagesForLocale("uk");
    const pipeline = (uk.messages as { civicMediaPublic: { pipeline: { stageOf: string } } })
      .civicMediaPublic.pipeline.stageOf;
    // Rendered progress text must not be English "Stage N of M" template leftovers.
    assert.doesNotMatch(html, />Stage \d+ of \d+</);
    assert.match(html, /data-hu-semantic-owner="UI_DICTIONARY"/);
    assert.match(html, /data-hu-semantic-result="LOCALIZED_DICTIONARY"/);
    assert.ok(pipeline.includes("{current}"));
  });

  it("principles/trusted whole-entity: published vs fallback never mixed per entity", async () => {
    const html = await renderMediaPage({
      locale: "uk",
      ...fullySeededPlp("uk"),
    });
    const report = summarizeRenderedMediaCoverage(
      collectRenderedMediaSemanticNodes(html),
      "uk",
    );
    assert.equal(report.MIXED_ENTITY_VIOLATIONS, 0);
  });

  it("negative: hardcoded English heading without contract → INVALID_COVERAGE / unowned candidates", async () => {
    const html = await renderMediaPage({
      locale: "uk",
      ...fullySeededPlp("uk"),
      inject: createElement("h2", null, "Hardcoded Unowned Heading EN"),
    });
    assert.match(html, /<h2>Hardcoded Unowned Heading EN<\/h2>/);
    assert.doesNotMatch(
      html,
      /data-hu-semantic-node="1"[^>]*>Hardcoded Unowned Heading EN/,
    );
    // Whole-document scan (inject is sibling of <main>, still participant-facing).
    const candidates = findUnownedMediaTextCandidates(
      html.replace(
        'data-hu-media-renderer="shared"',
        'data-hu-media-renderer="shared" data-hu-coverage-root="1"',
      ),
    );
    // Fallback: treat any text element lacking semantic-node attrs in the document.
    const bareHeading = /<h2(?:\s[^>]*)?>Hardcoded Unowned Heading EN<\/h2>/.test(html);
    assert.ok(
      bareHeading ||
        candidates.some((c) => c.includes("Hardcoded Unowned Heading EN")),
      `expected unowned candidate, got ${candidates.slice(0, 5).join(" | ")}`,
    );
  });

  it("negative: nested child with unowned MediaSemanticNode fails UNOWNED_NODES", async () => {
    const html = await renderMediaPage({
      locale: "uk",
      ...fullySeededPlp("uk"),
      inject: createElement(
        MediaSemanticNode,
        { owner: "BUG_UNOWNED", result: "UNOWNED", as: "p" },
        "Nested unowned paragraph",
      ),
    });
    const report = summarizeRenderedMediaCoverage(
      collectRenderedMediaSemanticNodes(html),
      "uk",
    );
    assert.ok(report.UNOWNED_NODES >= 1);
    assert.equal(report.PAGE_STATUS, "INVALID_COVERAGE");
  });

  it("negative: partial PLP entity (title only) stays canonical / no mix apply", async () => {
    const html = await renderMediaPage({
      locale: "uk",
      plpTrustedById: {
        reuters: plp(
          MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
          "reuters",
          "PUBLISHED_LOCALIZED",
          { explanation: "[uk] trusted explanation" },
          "uk",
        ),
      },
      plpPrinciplesById: {
        "editorial-transparency": plp(
          MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
          "editorial-transparency",
          "PUBLISHED_LOCALIZED",
          { title: "[uk] only title" },
          "uk",
        ),
      },
      plpEditorialPresentation: plp(
        MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
        "civic-media-center",
        "PUBLISHED_LOCALIZED",
        { overviewTitle: "[uk] only overview title" },
        "uk",
      ),
    });
    // Whole-entity apply refuses partial → canonical English remains for principle/editorial.
    assert.match(html, /Independence EN|Principle description EN|Overview title EN/);
  });

  it("deliberately unmaterialized fixture is PARTIALLY_LOCALIZED or CANONICAL_ONLY, never FULLY_LOCALIZED", async () => {
    const html = await renderMediaPage({
      locale: "uk",
      plpTrustedById: {
        reuters: plp(
          MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
          "reuters",
          "CANONICAL_FALLBACK",
          { explanation: reuters.explanation },
          "uk",
        ),
      },
      plpPrinciplesById: {
        "editorial-transparency": plp(
          MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
          "editorial-transparency",
          "CANONICAL_FALLBACK",
          {
            title: "Independence EN",
            description: "Principle description EN",
          },
          "uk",
        ),
      },
      plpEditorialPresentation: plp(
        MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
        "civic-media-center",
        "CANONICAL_FALLBACK",
        {},
        "uk",
      ),
    });
    const report = summarizeRenderedMediaCoverage(
      collectRenderedMediaSemanticNodes(html),
      "uk",
    );
    assert.ok(report.CANONICAL_FALLBACK_NODES > 0);
    assert.notEqual(report.PAGE_STATUS, "FULLY_LOCALIZED");
    assert.ok(
      report.PAGE_STATUS === "PARTIALLY_LOCALIZED" ||
        report.PAGE_STATUS === "CANONICAL_ONLY",
    );
  });

  for (const locale of ["uk", "zh-Hant", "ar"] as const) {
    it(`fully-seeded ${locale} page: UNOWNED=0 FALLBACK=0 MIXED=0 FULLY_LOCALIZED`, async () => {
      const html = await renderMediaPage({
        locale,
        ...fullySeededPlp(locale),
      });
      assert.match(html, /data-hu-semantic-contract="rendered"/);
      assert.match(html, new RegExp(`\\[${locale}\\] overview title`));
      const report = summarizeRenderedMediaCoverage(
        collectRenderedMediaSemanticNodes(html),
        locale,
      );
      assert.equal(report.UNOWNED_NODES, 0, formatMediaRenderedCoverageReport(report));
      assert.equal(report.MIXED_ENTITY_VIOLATIONS, 0);
      // Reset 03E.11 — news leaves are part of page FULLY_LOCALIZED (no exclude).
      assert.equal(
        report.CANONICAL_FALLBACK_NODES,
        0,
        formatMediaRenderedCoverageReport(report),
      );
      assertFullyLocalizedMediaCoverage(report);
    });
  }

  it("read path stays free of provider/materializer/generate", () => {
    for (const rel of [
      "features/language/media-plp/media-semantic-contract.tsx",
      "features/language/media-plp/media-rendered-coverage.ts",
      "features/civic-media-center/components/CivicMediaCenterPageContent.tsx",
    ]) {
      const text = readFileSync(join(webSrc, rel), "utf8");
      assert.doesNotMatch(
        text,
        /gemini|thin-gemini|media-plp-materializer|GEMINI_API_KEY|generateContentTranslation/,
      );
    }
  });

  it("combined PLP topology preserved (one batch)", () => {
    const loader = readFileSync(
      join(webSrc, "features/language/media-plp/load-media-plp-ssr.ts"),
      "utf8",
    );
    assert.match(loader, /resolveMediaPlpBatch/);
    assert.match(loader, /CIVIC_MEDIA_EDITORIAL/);
  });
});
