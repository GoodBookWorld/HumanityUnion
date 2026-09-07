/**
 * public_news.category ownership — CONTROLLED_VOCABULARY (not Gemini AUTO).
 * Staging failure: Provider left 1 translatable path(s) canonical-identical (e.g. category).
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MEDIA_PLP_ENTITY_TYPE,
  PUBLIC_NEWS_FIELD_OWNERSHIP,
  PUBLIC_NEWS_MACHINE_CONTENT_PATHS,
  isMediaRegistryCategory,
  isPublicProtectedValue,
  type PublicNewsArticleItem,
} from "@hu/types";

import { CONTENT_TRANSLATION_FIELD_ALLOWLIST } from "../../../src/modules/language/content-translation-eligibility.js";
import { validateMediaPlpProviderLocalizationValues } from "../../../src/modules/language/media-plp-materializer/provider-boundary.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalPublicNewsPresentation,
  fingerprintMediaPlpCanonicalVersion,
} from "../../../src/modules/language/published-localized-presentation/media/index.js";
import { collectAutoPaths } from "../../../src/modules/language/published-localized-presentation/presentation-paths.js";
import { publishMediaPlpEntity } from "../../../src/modules/language/published-localized-presentation/media/publisher.js";
import { LOCALIZATION_CONTENT_INTEGRITY_VERSION } from "../../../src/modules/language/published-localized-presentation/content-integrity.js";

const stagingCategoryShape = "peace and security";

function sampleArticle(
  overrides: Partial<PublicNewsArticleItem> = {},
): PublicNewsArticleItem {
  return {
    id: "news-4c0845c63428b53625ac",
    title: "Civic shoreline restoration expands",
    summary:
      "Communities organize local stewardship programs along the coastline with verified reporting.",
    category: stagingCategoryShape,
    sourceName: "BBC News",
    articleUrl: "https://www.bbc.com/news/example",
    publishedAt: "2026-01-01T00:00:00.000Z",
    verificationStatus: "external-source",
    geographicScope: "global",
    language: "en",
    ...overrides,
  };
}

describe("public_news category CONTROLLED_VOCABULARY policy", () => {
  it("classifies staging category shape as MediaRegistryCategory controlled vocab", () => {
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.category, "CONTROLLED_VOCABULARY");
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.title, "MACHINE_CONTENT");
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.summary, "MACHINE_CONTENT");
    assert.ok(isMediaRegistryCategory(stagingCategoryShape));
    assert.deepEqual([...PUBLIC_NEWS_MACHINE_CONTENT_PATHS], ["title", "summary"]);
    assert.deepEqual([...CONTENT_TRANSLATION_FIELD_ALLOWLIST.public_news], [
      "title",
      "summary",
    ]);
  });

  it("canonical tree wraps category; AUTO paths are title+summary only (node count 2)", () => {
    const tree = buildCanonicalPublicNewsPresentation(sampleArticle());
    assert.ok(isPublicProtectedValue(tree.category));
    assert.equal(tree.category.category, "controlled_terminology");
    assert.equal(tree.category.value, stagingCategoryShape);
    const auto = collectAutoPaths(asMediaPlpPresentationNode(tree));
    assert.deepEqual(
      auto.map((n) => n.path).sort(),
      ["summary", "title"],
    );
    assert.equal(auto.length, 2);
    assert.ok(!auto.some((n) => n.path === "category"));
  });

  it("provider payload without category publishes when title+summary localized", async () => {
    const tree = asMediaPlpPresentationNode(
      buildCanonicalPublicNewsPresentation(sampleArticle()),
    );
    const version = fingerprintMediaPlpCanonicalVersion(tree);
    const published = await publishMediaPlpEntity({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: "news-4c0845c63428b53625ac",
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      canonicalPresentation: tree,
      layers: [
        {
          source: "MACHINE",
          values: {
            title: "Громадянське відновлення берегової лінії розширюється",
            summary:
              "Громади організовують місцеві програми опіки узбережжя з перевіреними повідомленнями.",
          },
        },
      ],
      includeDeterministicMachine: false,
    });
    assert.equal(published.ok, true);
    if (!published.ok) return;
    assert.equal(published.record.contentIntegrity?.version, LOCALIZATION_CONTENT_INTEGRITY_VERSION);
    assert.equal(published.record.contentIntegrity?.status, "PASSED");
    assert.equal(published.record.contentIntegrity?.CANONICAL_IDENTICAL_NODE_COUNT, 0);
  });

  it("canonical-identical title is still rejected", () => {
    const result = validateMediaPlpProviderLocalizationValues({
      locale: "uk",
      autoValues: {
        title: "Civic shoreline restoration expands",
        summary: "Communities organize local stewardship programs.",
      },
      translated: {
        title: "Civic shoreline restoration expands",
        summary: "Громади організовують місцеві програми опіки.",
      },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "LOCALIZATION_CONTENT_INTEGRITY_FAILED");
      assert.match(result.message, /title/);
    }
  });

  it("canonical-identical summary is still rejected", () => {
    const result = validateMediaPlpProviderLocalizationValues({
      locale: "uk",
      autoValues: {
        title: "Civic shoreline restoration expands",
        summary: "Communities organize local stewardship programs.",
      },
      translated: {
        title: "Громадянське відновлення берегової лінії розширюється",
        summary: "Communities organize local stewardship programs.",
      },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "LOCALIZATION_CONTENT_INTEGRITY_FAILED");
      assert.match(result.message, /summary/);
    }
  });

  it("category-identical alone is not a provider AUTO path under the new contract", () => {
    const tree = buildCanonicalPublicNewsPresentation(sampleArticle());
    const auto = collectAutoPaths(asMediaPlpPresentationNode(tree));
    const autoValues = Object.fromEntries(auto.map((n) => [n.path, n.value]));
    assert.equal(autoValues.category, undefined);
    const result = validateMediaPlpProviderLocalizationValues({
      locale: "uk",
      autoValues,
      translated: {
        title: "Громадянське відновлення берегової лінії розширюється",
        summary:
          "Громади організовують місцеві програми опіки узбережжя з перевіреними повідомленнями.",
      },
    });
    assert.equal(result.ok, true);
  });
});
