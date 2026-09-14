/**
 * public_news.category ownership — CONTROLLED_VOCABULARY (not Gemini AUTO).
 * Reset 01 — title/summary are MACHINE_CONTENT AUTO paths via PLP.
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
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.title, "MACHINE_CONTENT");
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.summary, "MACHINE_CONTENT");
    assert.ok(isMediaRegistryCategory(stagingCategoryShape));
    assert.deepEqual([...PUBLIC_NEWS_MACHINE_CONTENT_PATHS], ["title", "summary"]);
    assert.deepEqual([...CONTENT_TRANSLATION_FIELD_ALLOWLIST.public_news], []);
  });

  it("canonical tree: category controlled; title/summary plain MACHINE AUTO strings", () => {
    const tree = buildCanonicalPublicNewsPresentation(sampleArticle());
    assert.ok(isPublicProtectedValue(tree.category));
    assert.equal(tree.category.category, "controlled_terminology");
    assert.equal(tree.category.value, stagingCategoryShape);
    assert.equal(typeof tree.title, "string");
    assert.equal(typeof tree.summary, "string");
    assert.equal(isPublicProtectedValue(tree.title), false);
    assert.equal(isPublicProtectedValue(tree.summary), false);
    const auto = collectAutoPaths(asMediaPlpPresentationNode(tree));
    const paths = auto.map((n) => n.path).sort();
    assert.deepEqual(paths, ["summary", "title"]);
  });

  it("category is not a provider AUTO path; title/summary are", () => {
    const tree = buildCanonicalPublicNewsPresentation(sampleArticle());
    const auto = collectAutoPaths(asMediaPlpPresentationNode(tree));
    const autoValues = Object.fromEntries(auto.map((n) => [n.path, n.value]));
    assert.equal(autoValues.category, undefined);
    assert.equal(autoValues.title, sampleArticle().title);
    assert.equal(autoValues.summary, sampleArticle().summary);
  });
});
