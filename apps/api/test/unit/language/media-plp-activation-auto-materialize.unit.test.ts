/**
 * Language activation — auto-materialize consumer-visible Media PLP families.
 * Product behavior only (≤4). No provider / warm / reconcile.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  LANGUAGE_ACTIVATION_PLP_OWNED_MEDIA_ENTITY_TYPES,
  MEDIA_PLP_ENTITY_TYPE,
  type NewsArticleRecord,
} from "@hu/types";

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

/** Future locale fixture — not a seeded Registry language. */
const FUTURE_LOCALE = "de";

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

describe("Media PLP activation auto-materialization", () => {
  it("1. future locale activation schedules bounded Media localization (PROVIDER_CALLS=0)", async () => {
    await upsertPublicNewsRecords([makeNews("act-news-1"), makeNews("act-news-2")]);

    const result = await enqueueConsumerVisibleMediaPlpBuildsForLocales({
      locales: [FUTURE_LOCALE],
    });

    assert.deepEqual(result.locales, [FUTURE_LOCALE]);
    assert.equal(result.PROVIDER_CALLS, 0);
    assert.ok(result.enqueued > 0);
    assert.ok(result.staticCarouselEnqueued > 0);
    assert.ok(result.editorial.enqueued >= 1);
    assert.ok(result.news.enqueued >= 1);

    const work = listPlpAutoBuildWorkForTests().filter(
      (row) => row.locale === FUTURE_LOCALE,
    );
    assert.ok(work.length >= result.enqueued);
    assert.ok(work.every((row) => row.status === "pending"));
  });

  it("2. all consumer-visible Media PLP families are included", async () => {
    await upsertPublicNewsRecords([makeNews("fam-news-1")]);

    const result = await enqueueConsumerVisibleMediaPlpBuildsForLocales({
      locales: [FUTURE_LOCALE],
    });

    assert.deepEqual(
      [...result.families].sort(),
      [...LANGUAGE_ACTIVATION_PLP_OWNED_MEDIA_ENTITY_TYPES].sort(),
    );

    const types = new Set(
      listPlpAutoBuildWorkForTests()
        .filter((row) => row.locale === FUTURE_LOCALE)
        .map((row) => row.entityType),
    );
    for (const family of [
      MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
      MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_FACT_CHECK,
      MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PROPAGANDA,
      MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
    ]) {
      assert.ok(types.has(family), `missing family ${family}`);
    }
  });

  it("3. repeated activation is idempotent (pending work deduped; CURRENT skip via enqueue)", async () => {
    await upsertPublicNewsRecords([makeNews("idem-news-1")]);

    const first = await enqueueConsumerVisibleMediaPlpBuildsForLocales({
      locales: [FUTURE_LOCALE],
    });
    assert.ok(first.enqueued > 0);

    const pendingAfterFirst = listPlpAutoBuildWorkForTests().filter(
      (row) => row.locale === FUTURE_LOCALE && row.status === "pending",
    ).length;

    const second = await enqueueConsumerVisibleMediaPlpBuildsForLocales({
      locales: [FUTURE_LOCALE],
    });
    assert.equal(second.enqueued, 0);
    assert.ok(second.deduped > 0);
    assert.equal(second.PROVIDER_CALLS, 0);

    const pendingAfterSecond = listPlpAutoBuildWorkForTests().filter(
      (row) => row.locale === FUTURE_LOCALE && row.status === "pending",
    ).length;
    assert.equal(pendingAfterSecond, pendingAfterFirst);

    const queueSrc = readFileSync(
      join(
        apiRoot,
        "src/modules/language/published-localized-presentation/universal/build-request-queue.ts",
      ),
      "utf8",
    );
    assert.match(queueSrc, /skippedUsable/);
    assert.match(queueSrc, /isExistingPlpUsableForEnqueue/);
  });

  it("4. no current-locale hardcoding; Admin/orchestrator use Registry-driven enqueue", () => {
    const activation = readFileSync(
      join(
        apiRoot,
        "src/modules/language/published-localized-presentation/universal/media-consumer-plp-activation-enqueue.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(activation, /\b(?:uk|ar|zh-Hant)\b/);
    assert.doesNotMatch(activation, /\[\s*["']en["']\s*,/);
    assert.match(activation, /DEFAULT_PLATFORM_LANGUAGE/);
    assert.match(activation, /enqueueConsumerVisibleMediaPlpBuildsForLocales/);

    const registry = readFileSync(
      join(apiRoot, "src/modules/language/language-registry/language-registry.service.ts"),
      "utf8",
    );
    assert.match(registry, /enqueueConsumerVisibleMediaPlpBuildsForLocales/);
    assert.match(registry, /becameCtEligible/);
    assert.match(registry, /DEFAULT_PLATFORM_LANGUAGE/);

    const orchestrator = readFileSync(
      join(
        apiRoot,
        "src/modules/language/language-localization-activation/language-activation-orchestrator.ts",
      ),
      "utf8",
    );
    assert.match(orchestrator, /enqueueConsumerVisibleMediaPlpBuildsForLocales/);
    assert.match(orchestrator, /LANGUAGE_ACTIVATION_CT_OWNED_KINDS/);

    // Fixture locale in this file only — engine modules must not enumerate it.
    assert.doesNotMatch(registry, new RegExp(`["']${FUTURE_LOCALE}["']`));
    assert.doesNotMatch(orchestrator, new RegExp(`["']${FUTURE_LOCALE}["']`));
    assert.doesNotMatch(activation, new RegExp(`["']${FUTURE_LOCALE}["']`));
  });
});
