/**
 * Version 5.0 — new-language activation excludes Public News / RSS PLP.
 * Civic Media PLP and civic CT residual stay. No locale allowlist.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { MEDIA_PLP_ENTITY_TYPE, type NewsArticleRecord } from "@hu/types";

import { resolveCanonicalResidualTranslationState } from "../../../src/modules/language/content-translation-residual-state-core.js";
import {
  enqueueConsumerVisibleMediaPlpBuildsForLocales,
  listPlpAutoBuildWorkForTests,
  resetMediaPlpAdapterRegistrationForTests,
  resetPlpAutoBuildRuntimeForTests,
  resetPlpAutoBuildWorkStoreForTests,
  resetPlpBuildRequestQueueForTests,
  resetPlpDomainAdapterRegistryForTests,
  resetPublishedLocalizationPersistenceForTests,
  setPlpAutoBuildWorkForceMemoryForTests,
  setPublishedLocalizationPersistenceModeForTests,
  stopPlpAutoBuildRuntimeForTests,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import {
  resetPublicNewsMemoryStoreForTests,
  upsertPublicNewsRecords,
} from "../../../src/modules/public-news/public-news.repository.js";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const repoRoot = join(apiRoot, "../..");
const FUTURE_LOCALE = "ka";

function read(relativeFromApi: string): string {
  return readFileSync(join(apiRoot, relativeFromApi), "utf8");
}

function makeNews(id: string): NewsArticleRecord {
  const now = "2030-01-01T00:00:00.000Z";
  return {
    id,
    provider: "test",
    sourceName: "BBC World",
    title: `Title ${id} long enough for localization integrity checks.`,
    summary: `Summary ${id} long enough for localization integrity checks here.`,
    articleUrl: `https://example.com/${id}`,
    normalizedArticleUrl: `https://example.com/${id}`,
    publishedAt: "2030-02-01T00:00:00.000Z",
    fetchedAt: now,
    expiresAt: "2030-12-31T00:00:00.000Z",
    language: "en",
    category: "peace and security",
    geographicScope: "global",
    status: "active",
    verificationStatus: "external-source",
    createdAt: now,
    updatedAt: now,
  };
}

beforeEach(() => {
  process.env.PUBLIC_NEWS_PERSISTENCE = "memory";
  delete process.env.HU_PLP_AUTO_BUILD_PROCESSOR;
  setPlpAutoBuildWorkForceMemoryForTests(true);
  resetPlpAutoBuildWorkStoreForTests();
  resetPlpBuildRequestQueueForTests();
  resetPlpAutoBuildRuntimeForTests();
  resetPublishedLocalizationPersistenceForTests();
  setPublishedLocalizationPersistenceModeForTests("memory");
  resetPlpDomainAdapterRegistryForTests();
  resetMediaPlpAdapterRegistrationForTests();
  resetPublicNewsMemoryStoreForTests();
});

afterEach(() => {
  stopPlpAutoBuildRuntimeForTests();
  resetPlpAutoBuildWorkStoreForTests();
  resetPlpBuildRequestQueueForTests();
  resetPlpAutoBuildRuntimeForTests();
  resetPublicNewsMemoryStoreForTests();
  resetMediaPlpAdapterRegistrationForTests();
  resetPlpDomainAdapterRegistryForTests();
});

describe("language activation excludes public news", () => {
  it("does not enqueue Public News PLP and still enqueues Civic Media PLP", async () => {
    await upsertPublicNewsRecords([makeNews("act-news-ka")]);

    const result = await enqueueConsumerVisibleMediaPlpBuildsForLocales({
      locales: [FUTURE_LOCALE],
    });

    assert.equal(result.news.enqueued, 0);
    assert.equal(result.PROVIDER_CALLS, 0);
    assert.ok(result.editorial.enqueued >= 1);
    assert.ok(result.staticCarouselEnqueued > 0);

    const types = new Set(
      listPlpAutoBuildWorkForTests()
        .filter((row) => row.locale === FUTURE_LOCALE)
        .map((row) => row.entityType),
    );
    assert.equal(types.has(MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS), false);
    assert.equal(types.has(MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL), true);
    assert.equal(types.has(MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_FACT_CHECK), true);
    assert.equal(types.has(MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PROPAGANDA), true);
    assert.equal(types.has(MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED), true);
    assert.equal(types.has(MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE), true);
  });

  it("keeps civic CT residual, CURRENT skip, visible news, and readiness exclusion", () => {
    const orchestrator = read(
      "src/modules/language/language-localization-activation/language-activation-orchestrator.ts",
    );
    const activationEnqueue = read(
      "src/modules/language/published-localized-presentation/universal/media-consumer-plp-activation-enqueue.ts",
    );
    const newsService = read("src/modules/public-news/public-news.service.ts");
    const residual = read("src/modules/language/content-translation-residual-state-core.ts");
    const coverage = read(
      "src/modules/language/language-localization-activation/bounded-pwa-civic-coverage.ts",
    );
    const card = readFileSync(
      join(repoRoot, "apps/web/src/features/public-news/use-localized-public-news-card.ts"),
      "utf8",
    );
    const ownership = readFileSync(
      join(repoRoot, "apps/web/src/features/language/ordinary-reading-ownership.ts"),
      "utf8",
    );

    assert.match(orchestrator, /LANGUAGE_ACTIVATION_CT_OWNED_KINDS/);
    assert.match(orchestrator, /runPublicLocalizationResidualRetry/);
    assert.doesNotMatch(orchestrator, /enqueueConsumerVisibleNewsPlpBuilds/);
    assert.doesNotMatch(activationEnqueue, /news-consumer-build-trigger/);
    assert.doesNotMatch(activationEnqueue, /await enqueueConsumerVisibleNewsPlpBuilds/);
    assert.match(newsService, /await enqueueConsumerVisibleNewsPlpBuilds/);

    assert.match(residual, /freshness === "current" && row.stale !== true/);
    assert.equal(
      resolveCanonicalResidualTranslationState({
        translationRow: { freshness: "current", stale: false },
        liveSourceVersion: "v1",
        outboxDisposition: "none",
      }),
      "CURRENT",
    );

    assert.match(card, /plpPresentation:\s*null/);
    assert.match(ownership, /sourceKind === "public_news"/);
    assert.match(coverage, /public_news is permanently excluded/);
    assert.doesNotMatch(activationEnqueue, /locale === ["']ka["']/);
    assert.doesNotMatch(orchestrator, /locale === ["']ka["']/);
  });
});
