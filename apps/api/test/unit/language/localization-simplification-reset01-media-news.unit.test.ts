/**
 * Localization Simplification Reset 01 — Media carousel / public_news correction
 * + RSS boundedness fix.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, beforeEach, afterEach } from "node:test";
import { fileURLToPath } from "node:url";

import {
  LANGUAGE_ACTIVATION_PLP_OWNED_MEDIA_ENTITY_TYPES,
  LANGUAGE_ACTIVATION_PROTECTED_EXCLUDED_KINDS,
  MEDIA_PLP_ENTITY_TYPE,
  mediaPlpPublicNewsEntityId,
  PUBLIC_NEWS_FIELD_OWNERSHIP,
  PUBLIC_NEWS_MACHINE_CONTENT_PATHS,
} from "@hu/types";

import {
  asMediaPlpPresentationNode,
  buildCanonicalPublicNewsPresentation,
  fingerprintMediaPlpCanonicalVersion,
} from "../../../src/modules/language/published-localized-presentation/media/canonical-trees.js";
import { buildMediaPlpCandidate } from "../../../src/modules/language/published-localized-presentation/media/build-adapter.js";
import {
  notifyMediaCanonicalPublishedForLocalizationBuild,
} from "../../../src/modules/language/published-localized-presentation/media/publication-hook.js";
import {
  resetPlpBuildRequestQueueForTests,
  getPlpBuildRequestQueueStats,
} from "../../../src/modules/language/published-localized-presentation/universal/build-request-queue.js";
import { setPlpAutoBuildWorkForceMemoryForTests } from "../../../src/modules/language/published-localized-presentation/universal/plp-auto-build-work.repository.js";
import { enqueueConsumerVisibleNewsPlpBuilds } from "../../../src/modules/language/published-localized-presentation/universal/news-consumer-build-trigger.js";
import { ensureMediaPlpAdapterRegistered } from "../../../src/modules/language/published-localized-presentation/universal/register-defaults.js";
import { MEDIA_PLP_CAROUSEL_NEWS_LIMIT } from "../../../src/modules/language/media-plp-carousel/constants.js";
import {
  resetPublicNewsMemoryStoreForTests,
  upsertPublicNewsRecords,
} from "../../../src/modules/public-news/public-news.repository.js";
import type { NewsArticleRecord } from "@hu/types";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");
const webRoot = path.resolve(here, "../../../../web");

const sampleArticle = {
  id: "news-reset01-1",
  title: "Civic shoreline restoration expands",
  summary: "Communities restore wetlands after flooding.",
  category: "climate resilience",
  sourceName: "Example Outlet",
  articleUrl: "https://example.org/a",
  imageUrl: undefined,
  publishedAt: "2026-01-01T00:00:00.000Z",
  verificationStatus: "verified" as const,
  geographicScope: "WORLD",
  language: "en",
};

function makeNews(i: number): NewsArticleRecord {
  const now = "2030-06-01T00:00:00.000Z";
  const expiresAt = "2031-06-01T00:00:00.000Z";
  return {
    id: `news-bound-${String(i).padStart(2, "0")}`,
    provider: "test",
    title: `Title ${i}`,
    summary: `Summary ${i}`,
    sourceName: `Source-${i % 8}`,
    articleUrl: `https://example.org/n/${i}`,
    normalizedArticleUrl: `https://example.org/n/${i}`,
    publishedAt: `2030-05-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
    fetchedAt: now,
    expiresAt,
    language: "en",
    category: "peace and security",
    geographicScope: "global",
    status: "active",
    verificationStatus: "external-source",
    createdAt: now,
    updatedAt: now,
  };
}

describe("Reset 01 Media correction — public_news carousel PLP", () => {
  beforeEach(() => {
    process.env.PUBLIC_NEWS_PERSISTENCE = "memory";
    setPlpAutoBuildWorkForceMemoryForTests(true);
    resetPlpBuildRequestQueueForTests();
    resetPublicNewsMemoryStoreForTests();
    ensureMediaPlpAdapterRegistered();
  });
  afterEach(() => {
    resetPlpBuildRequestQueueForTests();
    resetPublicNewsMemoryStoreForTests();
    setPlpAutoBuildWorkForceMemoryForTests(false);
    delete process.env.PUBLIC_NEWS_PERSISTENCE;
  });

  it("1. Media carousel belongs to Reset 01 visible boundary", () => {
    const groups = readFileSync(
      path.join(webRoot, "src/features/language/media-plp/media-browser-visible-prose.ts"),
      "utf8",
    );
    assert.match(groups, /"news-carousel"/);
    assert.match(groups, /"public_news"/);
    assert.ok(
      (LANGUAGE_ACTIVATION_PLP_OWNED_MEDIA_ENTITY_TYPES as readonly string[]).includes(
        "public_news",
      ),
    );
  });

  it("2. public_news title+summary are PLP MACHINE paths", () => {
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.title, "MACHINE_CONTENT");
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.summary, "MACHINE_CONTENT");
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.sourceName, "PROTECTED_SOURCE_VALUE");
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.articleUrl, "PROTECTED_SOURCE_VALUE");
    assert.deepEqual([...PUBLIC_NEWS_MACHINE_CONTENT_PATHS], ["title", "summary"]);
    assert.equal(LANGUAGE_ACTIVATION_PROTECTED_EXCLUDED_KINDS.length, 0);

    const tree = buildCanonicalPublicNewsPresentation(sampleArticle);
    assert.equal(typeof tree.title, "string");
    assert.equal(typeof tree.summary, "string");
    assert.equal(tree.title, sampleArticle.title);
  });

  it("3. incomplete localized RSS card is NOT_READY (whole-entity title+summary)", () => {
    const newsTree = asMediaPlpPresentationNode(
      buildCanonicalPublicNewsPresentation(sampleArticle),
    );
    const v1 = fingerprintMediaPlpCanonicalVersion(newsTree);
    const partial = buildMediaPlpCandidate({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: mediaPlpPublicNewsEntityId(sampleArticle.id),
      locale: "uk",
      canonicalVersion: v1,
      canonicalPresentation: newsTree,
      includeDeterministicMachine: false,
      layers: [{ source: "MACHINE", values: { title: "[uk] Civic shoreline restoration expands" } }],
    });
    assert.equal(partial.validation.status, "NOT_READY");
    assert.ok(partial.validation.missingPaths.includes("summary"));
  });

  it("4. complete title+summary MACHINE bag is READY_TO_PUBLISH", () => {
    const newsTree = asMediaPlpPresentationNode(
      buildCanonicalPublicNewsPresentation(sampleArticle),
    );
    const v1 = fingerprintMediaPlpCanonicalVersion(newsTree);
    const complete = buildMediaPlpCandidate({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: mediaPlpPublicNewsEntityId(sampleArticle.id),
      locale: "uk",
      canonicalVersion: v1,
      canonicalPresentation: newsTree,
      includeDeterministicMachine: false,
      layers: [
        {
          source: "MACHINE",
          values: {
            title: "[uk] Civic shoreline restoration expands",
            summary: "[uk] Communities restore wetlands after flooding.",
          },
        },
      ],
    });
    assert.equal(complete.validation.status, "READY_TO_PUBLISH");
  });

  it("5. public read path has zero provider calls; unchanged fingerprint reuses CURRENT", () => {
    for (const rel of [
      "apps/web/src/features/public-news/use-localized-public-news-card.ts",
      "apps/web/src/features/public-news/components/PublicNewsCard.tsx",
      "apps/web/src/features/language/media-plp/compose-media-page-localization.ts",
    ]) {
      const src = readFileSync(path.join(repoRoot, rel), "utf8");
      assert.doesNotMatch(src, /\bTranslationProvider\b/);
      assert.doesNotMatch(src, /generateContentTranslation/);
      assert.doesNotMatch(src, /\/translations\/generate/);
    }

    const cardHook = readFileSync(
      path.join(webRoot, "src/features/public-news/use-localized-public-news-card.ts"),
      "utf8",
    );
    assert.match(cardHook, /resolvePublicNewsCardFieldsFromPlp/);
    assert.match(cardHook, /Whole-entity RSS card/);

    const treeA = asMediaPlpPresentationNode(
      buildCanonicalPublicNewsPresentation(sampleArticle),
    );
    const treeB = asMediaPlpPresentationNode(
      buildCanonicalPublicNewsPresentation(sampleArticle),
    );
    assert.equal(
      fingerprintMediaPlpCanonicalVersion(treeA),
      fingerprintMediaPlpCanonicalVersion(treeB),
    );
  });

  it("6. web consumer applies coherent PLP card or canonical fallback", () => {
    const hook = readFileSync(
      path.join(webRoot, "src/features/public-news/use-localized-public-news-card.ts"),
      "utf8",
    );
    assert.match(hook, /presentationMode: "canonical"/);
    assert.match(hook, /!title \|\| !summary/);
    assert.doesNotMatch(hook, /original-language-only/);

    const inventory = readFileSync(
      path.join(webRoot, "src/features/language/media-plp/media-semantic-inventory.ts"),
      "utf8",
    );
    assert.match(inventory, /news\.card\.title[\s\S]*PLP_ENTITY/);
    assert.match(inventory, /news\.card\.summary[\s\S]*PLP_ENTITY/);
    assert.doesNotMatch(inventory, /original-language-only/);
  });

  it("7. generic publication of arbitrary public_news does not locale-fan-out", () => {
    const n = notifyMediaCanonicalPublishedForLocalizationBuild({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: "news-arbitrary-archive-item",
      canonicalVersion: "v1",
      contentRevision: 1,
      locales: ["uk", "ar", "zh-Hant", "en"],
    });
    assert.equal(n, 0);
    assert.equal(getPlpBuildRequestQueueStats().pending, 0);

    const hookSrc = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/language/published-localized-presentation/media/publication-hook.ts",
      ),
      "utf8",
    );
    assert.match(hookSrc, /PUBLIC_NEWS/);
    assert.match(hookSrc, /return 0/);
  });

  it("8. bounded /media carousel selection enqueues selected cards only", async () => {
    assert.equal(MEDIA_PLP_CAROUSEL_NEWS_LIMIT, 12);
    ensureMediaPlpAdapterRegistered();
    const records = Array.from({ length: 30 }, (_, i) => makeNews(i));
    await upsertPublicNewsRecords(records);

    const result = await enqueueConsumerVisibleNewsPlpBuilds({
      locales: ["uk", "en"],
    });
    assert.equal(result.PROVIDER_CALLS, 0);
    assert.equal(result.consumerCount, MEDIA_PLP_CAROUSEL_NEWS_LIMIT);
    // uk only (en skipped) × 12 selected cards
    assert.equal(result.enqueued, MEDIA_PLP_CAROUSEL_NEWS_LIMIT);
    assert.ok(result.enqueued < records.length);

    const triggerSrc = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/language/published-localized-presentation/universal/news-consumer-build-trigger.ts",
      ),
      "utf8",
    );
    assert.match(triggerSrc, /selectMediaPlpConsumerNewsArticles/);
    assert.match(triggerSrc, /MEDIA_PLP_CAROUSEL_NEWS_LIMIT/);
    assert.doesNotMatch(triggerSrc, /selectConsumerVisibleNewsArticlesForAutoBuild/);
  });
});
