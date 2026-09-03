/**
 * Pack 08I residual — Civic Media Center structured editorial + public chrome i18n.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { CivicMediaCenterPublic } from "@hu/types";

import {
  compareCatalogParityToEnglish,
  verifyBundledVerificationCatalogParity,
} from "../i18n/catalog-parity.js";
import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import {
  buildCanonicalCivicMediaEditorial,
  overlayCivicMediaEditorialFromFields,
  parseCivicMediaJsonArray,
  parseInitiativeFlowStages,
} from "./components/CivicMediaTranslatedEditorial.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

function readNested(messages: Record<string, unknown>, dottedPath: string): string {
  const parts = dottedPath.split(".");
  let cursor: unknown = messages;
  for (const part of parts) {
    assert.ok(cursor && typeof cursor === "object" && !Array.isArray(cursor), dottedPath);
    cursor = (cursor as Record<string, unknown>)[part];
  }
  assert.equal(typeof cursor, "string", dottedPath);
  return cursor as string;
}

const CIVIC_MEDIA_PUBLIC_KEYS = [
  "civicMediaPublic.eyebrow",
  "civicMediaPublic.pageTitle",
  "civicMediaPublic.loading",
  "civicMediaPublic.unavailable",
  "civicMediaPublic.selectionPrinciples.eyebrow",
  "civicMediaPublic.selectionPrinciples.title",
  "civicMediaPublic.selectionPrinciples.description",
  "civicMediaPublic.selectionPrinciples.readFaq",
  "civicMediaPublic.selectionPrinciples.ariaLabel",
  "civicMediaPublic.trustedMedia.eyebrow",
  "civicMediaPublic.trustedMedia.title",
  "civicMediaPublic.trustedMedia.description",
  "civicMediaPublic.factChecking.eyebrow",
  "civicMediaPublic.factChecking.title",
  "civicMediaPublic.factChecking.description",
  "civicMediaPublic.factChecking.ariaLabel",
  "civicMediaPublic.propaganda.eyebrow",
  "civicMediaPublic.propaganda.title",
  "civicMediaPublic.propaganda.description",
  "civicMediaPublic.propaganda.ariaLabel",
  "civicMediaPublic.faq.heading",
  "civicMediaPublic.knowledgeLink",
  "civicMediaPublic.visitKnowledge",
  "civicMediaPublic.whyItMatters",
  "civicMediaPublic.mission",
  "civicMediaPublic.officialWebsite",
  "civicMediaPublic.learnMore",
  "civicMediaPublic.coverageAria",
] as const;

const SAMPLE_MEDIA: CivicMediaCenterPublic = {
  overview: {
    title: "Canonical overview",
    summary: "Canonical summary",
    points: [
      { id: "trust", heading: "Canonical heading", body: "Canonical body" },
      { id: "misinformation", heading: "Second heading", body: "Second body" },
    ],
  },
  trustedMediaCategories: [],
  trustedMedia: [],
  factChecking: [],
  propagandaAnalysis: [],
  initiativeFlow: {
    title: "Canonical flow",
    summary: "Canonical flow summary",
    diagramSvg: "<svg></svg>",
    stages: ["News", "Verification", "Discussion"],
  },
  selectionPrinciples: [
    {
      id: "editorial-transparency",
      title: "Canonical principle",
      description: "Canonical description",
      sortOrder: 1,
    },
  ],
  faq: [
    {
      id: "why-not-every-media",
      question: "Canonical question?",
      answer: "Canonical answer.",
      sortOrder: 1,
    },
  ],
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("Pack 08I — Civic Media structured editorial + chrome", () => {
  it("source must not call stableJsonForDisplay / JSON.stringify of points in TranslatedEditorial UI", () => {
    const editorial = readWeb(
      "features/civic-media-center/components/CivicMediaTranslatedEditorial.tsx",
    );
    const page = readWeb(
      "features/civic-media-center/components/CivicMediaCenterPageContent.tsx",
    );

    assert.match(editorial, /useCivicMediaResolvedEditorial/);
    assert.match(editorial, /resolveTranslatedContent/);
    assert.match(editorial, /enableOnDemandGenerate|presentationMode === "original"|sourceKind:\s*"civic_media"/);
    assert.doesNotMatch(editorial, /stableJsonForDisplay/);
    assert.doesNotMatch(editorial, /CivicPublicTranslatedSection/);
    assert.doesNotMatch(editorial, /JSON\.stringify/);
    assert.doesNotMatch(page, /stableJsonForDisplay/);
    assert.doesNotMatch(page, /CivicMediaTranslatedEditorial\s*\//);
    assert.doesNotMatch(page, /JSON\.stringify/);
    assert.match(page, /useCivicMediaResolvedEditorial/);
  });

  it("hero restores Card grid (civic-media-page__hero-grid) and never dumps JSON", () => {
    const page = readWeb(
      "features/civic-media-center/components/CivicMediaCenterPageContent.tsx",
    );
    assert.match(page, /civic-media-page__hero-grid/);
    assert.match(page, /civic-media-resource-card civic-media-resource-card--hero/);
    assert.match(page, /<Card[\s\S]*civic-media-resource-card--hero/);
    assert.doesNotMatch(page, /civic-media-page__points/);
    assert.doesNotMatch(page, /stableJsonForDisplay/);
  });

  it("page uses useTranslations civicMediaPublic", () => {
    const page = readWeb(
      "features/civic-media-center/components/CivicMediaCenterPageContent.tsx",
    );
    assert.match(page, /useTranslations\("civicMediaPublic"\)/);
    assert.match(page, /t\("pageTitle"\)/);
    assert.match(page, /t\("selectionPrinciples\.title"\)/);
    assert.match(page, /t\("selectionPrinciples\.ariaLabel"\)/);
    assert.match(page, /t\("factChecking\.ariaLabel"\)/);
    assert.match(page, /t\("propaganda\.ariaLabel"\)/);
    assert.match(page, /t\("faq\.heading"\)/);
    assert.match(page, /t\("whyItMatters"\)/);
  });

  it("parse helper recovers arrays; invalid JSON falls back", () => {
    const points = parseCivicMediaJsonArray(
      JSON.stringify([
        { body: "A", heading: "One" },
        { body: "B", heading: "Two" },
      ]),
      (value): value is { heading: string; body: string } =>
        value != null &&
        typeof value === "object" &&
        typeof (value as { heading?: unknown }).heading === "string" &&
        typeof (value as { body?: unknown }).body === "string",
    );
    assert.ok(points);
    assert.equal(points.length, 2);
    assert.equal(points[0]?.heading, "One");

    assert.equal(
      parseCivicMediaJsonArray("{not-json", (_value): _value is unknown => true),
      null,
    );
    assert.equal(
      parseCivicMediaJsonArray('"string"', (_value): _value is unknown => true),
      null,
    );
    assert.equal(
      parseCivicMediaJsonArray('{"a":1}', (_value): _value is unknown => true),
      null,
    );
    assert.equal(
      parseCivicMediaJsonArray("[1,2,3]", (_value): _value is unknown => false),
      null,
    );

    const stages = parseInitiativeFlowStages("News\nVerification\nDiscussion");
    assert.deepEqual(stages, ["News", "Verification", "Discussion"]);
    assert.equal(parseInitiativeFlowStages("   \n  "), null);

    const overlay = overlayCivicMediaEditorialFromFields(
      SAMPLE_MEDIA,
      {
        overviewTitle: "Translated overview",
        overviewSummary: "Translated summary",
        overviewPoints: JSON.stringify([
          { heading: "Translated heading", body: "Translated body" },
        ]),
        selectionPrinciples: JSON.stringify([
          { title: "Translated principle", description: "Translated description" },
        ]),
        faq: JSON.stringify([
          { question: "Translated question?", answer: "Translated answer." },
        ]),
        initiativeFlowTitle: "Translated flow",
        initiativeFlowSummary: "Translated flow summary",
        initiativeFlowStages: "Новини\nПеревірка\nОбговорення",
      },
      buildCanonicalCivicMediaEditorial(SAMPLE_MEDIA).translationChrome,
    );
    assert.equal(overlay.overview.title, "Translated overview");
    assert.equal(overlay.overview.points[0]?.heading, "Translated heading");
    assert.equal(overlay.overview.points[0]?.id, "trust");
    assert.equal(overlay.overview.points[1]?.heading, "Second heading");
    assert.equal(overlay.selectionPrinciples[0]?.title, "Translated principle");
    assert.equal(overlay.faq[0]?.question, "Translated question?");
    assert.deepEqual(overlay.initiativeFlow.stages, ["Новини", "Перевірка", "Обговорення"]);

    const invalidOverlay = overlayCivicMediaEditorialFromFields(
      SAMPLE_MEDIA,
      {
        overviewTitle: "Keep title",
        overviewPoints: "{bad",
        selectionPrinciples: '"nope"',
        faq: "[1]",
        initiativeFlowStages: "",
      },
      buildCanonicalCivicMediaEditorial(SAMPLE_MEDIA).translationChrome,
    );
    assert.equal(invalidOverlay.overview.title, "Keep title");
    assert.equal(invalidOverlay.overview.points[0]?.heading, "Canonical heading");
    assert.equal(invalidOverlay.selectionPrinciples[0]?.title, "Canonical principle");
    assert.equal(invalidOverlay.faq[0]?.question, "Canonical question?");
    assert.deepEqual(invalidOverlay.initiativeFlow.stages, [
      "News",
      "Verification",
      "Discussion",
    ]);
  });

  it("catalog keys present in all 4 locales with parity", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      for (const key of CIVIC_MEDIA_PUBLIC_KEYS) {
        assert.equal(typeof readNested(loaded.messages, key), "string", `${locale}:${key}`);
      }
    }

    const en = await loadUiMessagesForLocale("en");
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const other = await loadUiMessagesForLocale(locale);
      const parity = compareCatalogParityToEnglish(en.messages, other.messages, locale);
      assert.equal(parity.ok, true, JSON.stringify(parity, null, 2));
    }
  });
});
