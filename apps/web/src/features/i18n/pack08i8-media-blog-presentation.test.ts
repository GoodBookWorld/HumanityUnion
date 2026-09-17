/**
 * Pack 08I.8 — Media structured + Blog presentation integrity.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  compareCatalogParityToEnglish,
  verifyBundledVerificationCatalogParity,
} from "../i18n/catalog-parity.js";
import { loadUiMessagesForLocale } from "../i18n/load-ui-messages.js";
import { resolveBlogPostPresentation } from "../blog/resolve-blog-post-presentation.js";
import {
  overlayCivicMediaEditorialFromFields,
  buildCanonicalCivicMediaEditorial,
} from "../civic-media-center/components/CivicMediaTranslatedEditorial.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

const SAMPLE_MEDIA = {
  overview: {
    title: "Canonical overview",
    summary: "Canonical summary",
    points: [
      { id: "trust", heading: "One", body: "A" },
      { id: "verify", heading: "Two", body: "B" },
    ],
  },
  selectionPrinciples: [
    { id: "editorial-transparency", title: "P1", description: "D1", whyItMatters: "W1" },
  ],
  faq: [{ id: "q1", question: "Q?", answer: "A." }],
  initiativeFlow: {
    title: "Flow",
    summary: "Flow summary",
    stages: ["News", "Verification"],
  },
  factChecking: [],
  propagandaAnalysis: [],
  trustedMedia: [
    {
      id: "bbc",
      name: "BBC",
      logoLabel: "BBC",
      country: "UK",
      categoryId: "public-broadcaster",
      explanation: "Canonical BBC explanation",
      websiteUrl: "https://www.bbc.com",
      sortOrder: 1,
    },
  ],
  trustedMediaCategories: [],
} as const;

describe("Pack 08I.8 — Media + Blog runtime presentation", () => {
  it("EXISTING structured uk media fields overlay editorial/principles/faq", () => {
    const overlay = overlayCivicMediaEditorialFromFields(
      SAMPLE_MEDIA as never,
      {
        overviewTitle: "Огляд",
        overviewSummary: "Підсумок",
        overviewPoints: JSON.stringify([{ heading: "Довіра", body: "Текст" }]),
        selectionPrinciples: JSON.stringify([
          { title: "Прозорість", description: "Опис" },
        ]),
        faq: JSON.stringify([{ question: "Питання?", answer: "Відповідь." }]),
        initiativeFlowTitle: "Потік",
        initiativeFlowSummary: "Опис потоку",
        initiativeFlowStages: "Новини\nПеревірка",
        trustedMediaExplanations: JSON.stringify([
          { id: "bbc", explanation: "Пояснення BBC" },
        ]),
      },
      buildCanonicalCivicMediaEditorial(SAMPLE_MEDIA as never).translationChrome,
    );

    assert.equal(overlay.overview.title, "Огляд");
    assert.equal(overlay.overview.points[0]?.heading, "Довіра");
    assert.equal(overlay.selectionPrinciples[0]?.title, "Прозорість");
    assert.equal(overlay.faq[0]?.question, "Питання?");
    assert.deepEqual(overlay.initiativeFlow.stages, ["Новини", "Перевірка"]);
    assert.equal(overlay.trustedExplanationsById.bbc, "Пояснення BBC");
  });

  it("Media verification/propaganda cards use ownership-gated ordinary reading", () => {
    const page = readWeb(
      "features/civic-media-center/components/CivicMediaCenterPageContent.tsx",
    );
    assert.match(page, /selectCivicMediaFactCheckOrdinaryPresentation/);
    assert.match(page, /selectCivicMediaPropagandaOrdinaryPresentation/);
    assert.match(page, /mission=\{presentation\.mission\}/);
    assert.match(page, /explanation=\{presentation\.explanation\}/);
    assert.match(page, /editorial\.overview\.title/);
    assert.match(page, /editorial\.faq\.map/);
    assert.match(page, /editorial\.trustedExplanationsById\[resource\.id\]/);
    assert.match(page, /useOrdinaryReadingOwner/);
    assert.match(page, /data-hu-reading-owner=\{civicMediaOwner\}/);
    assert.doesNotMatch(page, /void factCheckMaps/);
    assert.doesNotMatch(page, /factChecking\.resources\.\$\{resource\.id\}\.mission/);
    assert.doesNotMatch(page, /Badge status=\{resource\.focus\}/);
  });

  it("fact-check / propaganda catalogs exist across locales", async () => {
    const report = await verifyBundledVerificationCatalogParity();
    assert.equal(report.ok, true, JSON.stringify(report.reports, null, 2));

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      const civic = loaded.messages.civicMediaPublic as {
        factChecking: { resources: Record<string, { mission: string }> };
        propaganda: {
          resources: Record<string, { explanation: string; focusCode: string }>;
          focus: Record<string, string>;
        };
      };
      assert.ok(civic.factChecking.resources.snopes?.mission);
      assert.ok(civic.propaganda.resources.dfrlab?.explanation);
      assert.ok(civic.propaganda.focus["information-warfare"]);
    }

    const en = await loadUiMessagesForLocale("en");
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      const other = await loadUiMessagesForLocale(locale);
      const parity = compareCatalogParityToEnglish(en.messages, other.messages, locale);
      assert.equal(parity.ok, true, JSON.stringify(parity, null, 2));
    }
  });

  it("EXISTING Blog HTML translation reaches presentation contentHtml", async () => {
    const ukHtml = "<p>Український <strong>текст</strong></p>";
    const presented = await resolveBlogPostPresentation(
      {
        postId: "post-1",
        canonical: {
          title: "English",
          excerpt: "Excerpt",
          contentHtml: "<p>English</p>",
        },
        readingContext: {
          ready: true,
          readingLanguage: "uk",
          translationPreference: "preferred",
        },
      },
      {
        resolveTranslatedContent: async () => ({
          presentationMode: "preferred_translation",
          content: {
            title: "Українська",
            excerpt: "Уривок",
            content: ukHtml,
          },
          activeLanguage: "uk",
          originalLanguage: "en",
          originalContent: {},
          translation: null,
          isMachineTranslated: true,
          isStale: false,
          canViewOriginal: true,
          canViewTranslation: true,
        }),
        generateContentTranslation: async () => {
          throw new Error("no generate");
        },
      },
    );
    assert.equal(presented.title, "Українська");
    assert.equal(presented.contentHtml, ukHtml);
  });

  it("Blog article and feed cards use ownership-gated ordinary reading", () => {
    const article = readWeb("features/blog/components/BlogArticlePageContent.tsx");
    const authors = readWeb("features/blog/components/BlogAuthorsSidebar.tsx");
    const card = readWeb("features/blog/components/BlogPostCard.tsx");
    const latest = readWeb("features/blog/components/BlogLatestMiniCards.tsx");

    assert.doesNotMatch(article, /resolveBlogPostPresentation/);
    assert.doesNotMatch(article, /setDisplayContentHtml/);
    assert.match(article, /useHuPersistedOrdinaryFields/);
    assert.match(article, /data-hu-reading-owner=\{readingOwner\}/);
    assert.match(article, /post\.content/);
    assert.match(article, /initialPresentation/);
    assert.match(
      readWeb("app/blog/[slug]/page.tsx"),
      /loadBlogArticlePresentationSeed/,
    );
    assert.doesNotMatch(authors, /resolveBlogPostPresentation/);
    assert.doesNotMatch(card, /resolveBlogPostPresentation/);
    assert.doesNotMatch(latest, /resolveBlogPostPresentation/);
    assert.match(card, /useHuPersistedOrdinaryFields/);
    assert.doesNotMatch(article, /generateContentTranslation/);
  });
});
