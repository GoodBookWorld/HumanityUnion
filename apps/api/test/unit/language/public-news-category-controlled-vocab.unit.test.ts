/**
 * public_news.category ownership — CONTROLLED_VOCABULARY (not Gemini AUTO).
 * Final Localization Closure 02 — title/summary are original-language protected.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PUBLIC_NEWS_FIELD_OWNERSHIP,
  PUBLIC_NEWS_MACHINE_CONTENT_PATHS,
  isMediaRegistryCategory,
  isPublicProtectedValue,
  type PublicNewsArticleItem,
} from "@hu/types";

import { CONTENT_TRANSLATION_FIELD_ALLOWLIST } from "../../../src/modules/language/content-translation-eligibility.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalPublicNewsPresentation,
} from "../../../src/modules/language/published-localized-presentation/media/index.js";
import { collectAutoPaths } from "../../../src/modules/language/published-localized-presentation/presentation-paths.js";

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
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.title, "PROTECTED_SOURCE_VALUE");
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.summary, "PROTECTED_SOURCE_VALUE");
    assert.ok(isMediaRegistryCategory(stagingCategoryShape));
    assert.deepEqual([...PUBLIC_NEWS_MACHINE_CONTENT_PATHS], []);
    assert.deepEqual([...CONTENT_TRANSLATION_FIELD_ALLOWLIST.public_news], []);
  });

  it("canonical tree wraps category + title/summary; AUTO bag empty", () => {
    const tree = buildCanonicalPublicNewsPresentation(sampleArticle());
    assert.ok(isPublicProtectedValue(tree.category));
    assert.equal(tree.category.category, "controlled_terminology");
    assert.equal(tree.category.value, stagingCategoryShape);
    assert.ok(isPublicProtectedValue(tree.title));
    assert.ok(isPublicProtectedValue(tree.summary));
    const auto = collectAutoPaths(asMediaPlpPresentationNode(tree));
    assert.deepEqual(auto, []);
  });

  it("category-identical alone is not a provider AUTO path under the new contract", () => {
    const tree = buildCanonicalPublicNewsPresentation(sampleArticle());
    const auto = collectAutoPaths(asMediaPlpPresentationNode(tree));
    const autoValues = Object.fromEntries(auto.map((n) => [n.path, n.value]));
    assert.equal(autoValues.category, undefined);
    assert.equal(autoValues.title, undefined);
    assert.equal(autoValues.summary, undefined);
  });
});
