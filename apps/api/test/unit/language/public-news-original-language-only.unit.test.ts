/**
 * Final Localization Closure 02 — public_news original-language-only policy.
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
import {
  asMediaPlpPresentationNode,
  buildCanonicalPublicNewsPresentation,
} from "../../../src/modules/language/published-localized-presentation/media/index.js";
import { collectAutoPaths } from "../../../src/modules/language/published-localized-presentation/presentation-paths.js";
import { resolveFieldPolicyForEntityType } from "../../../src/modules/language/published-localized-presentation/universal/resolve-field-policy.js";
import { isCollectedPathMachineEligible } from "../../../src/modules/language/published-localized-presentation/universal/field-authority.js";
import { ensureMediaPlpAdapterRegistered } from "../../../src/modules/language/published-localized-presentation/universal/register-defaults.js";
import {
  enqueueConsumerVisibleNewsPlpBuilds,
  enqueuePublicNewsArticlePlpBuild,
} from "../../../src/modules/language/published-localized-presentation/universal/news-consumer-build-trigger.js";

const stagingCategoryShape = "peace and security";

function sampleArticle(
  overrides: Partial<PublicNewsArticleItem> = {},
): PublicNewsArticleItem {
  return {
    id: "news-closure02-sample",
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

describe("Final Localization Closure 02 — public_news original-language-only", () => {
  it("classifies title/summary as protected; AUTO bag empty; category remains controlled", () => {
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.title, "PROTECTED_SOURCE_VALUE");
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.summary, "PROTECTED_SOURCE_VALUE");
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.category, "CONTROLLED_VOCABULARY");
    assert.ok(isMediaRegistryCategory(stagingCategoryShape));
    assert.deepEqual([...PUBLIC_NEWS_MACHINE_CONTENT_PATHS], []);
    assert.deepEqual([...CONTENT_TRANSLATION_FIELD_ALLOWLIST.public_news], []);
  });

  it("canonical tree wraps title/summary as protected; collectAutoPaths is empty", () => {
    const tree = buildCanonicalPublicNewsPresentation(sampleArticle());
    assert.ok(isPublicProtectedValue(tree.title));
    assert.ok(isPublicProtectedValue(tree.summary));
    assert.ok(isPublicProtectedValue(tree.category));
    assert.equal(tree.title.value, "Civic shoreline restoration expands");
    assert.equal(tree.summary.value.includes("Communities organize"), true);
    const auto = collectAutoPaths(asMediaPlpPresentationNode(tree));
    assert.deepEqual(auto, []);
  });

  it("Media PLP adapter marks title/summary non-machine-eligible", () => {
    ensureMediaPlpAdapterRegistered();
    const policy = resolveFieldPolicyForEntityType(MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS);
    assert.equal(policy.title, "PROTECTED_CANONICAL");
    assert.equal(policy.summary, "PROTECTED_CANONICAL");
    assert.equal(policy.category, "CONTROLLED_VOCABULARY");
    assert.equal(isCollectedPathMachineEligible("title", policy), false);
    assert.equal(isCollectedPathMachineEligible("summary", policy), false);
  });

  it("HU-owned civic_media_trusted remains machine-eligible", () => {
    ensureMediaPlpAdapterRegistered();
    const policy = resolveFieldPolicyForEntityType(
      MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
    );
    assert.equal(policy.explanation, "MACHINE_CONTENT");
    assert.equal(isCollectedPathMachineEligible("explanation", policy), true);
  });

  it("public_news PLP enqueue entry points accept no work", async () => {
    const previous = process.env.HU_PLP_AUTO_BUILD_LOCALES;
    process.env.HU_PLP_AUTO_BUILD_LOCALES = "uk,ar";
    try {
      const consumer = await enqueueConsumerVisibleNewsPlpBuilds({
        locales: ["uk", "ar"],
        limit: 12,
      });
      assert.equal(consumer.enqueued, 0);
      assert.equal(consumer.PROVIDER_CALLS, 0);
      const single = await enqueuePublicNewsArticlePlpBuild({
        articleId: "news-closure02-sample",
        canonicalVersion: "v-test",
        locales: ["uk", "ar"],
      });
      assert.equal(single, 0);
    } finally {
      if (previous === undefined) {
        delete process.env.HU_PLP_AUTO_BUILD_LOCALES;
      } else {
        process.env.HU_PLP_AUTO_BUILD_LOCALES = previous;
      }
    }
  });
});
