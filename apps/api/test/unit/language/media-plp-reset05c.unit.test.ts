/**
 * RESET 05C — RSS automatic PLP publication lifecycle regressions.
 * fake_local / injected processor, memory persistence. NO live Gemini.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  MEDIA_PLP_ENTITY_TYPE,
  mediaPlpPublicNewsEntityId,
  type NewsArticleRecord,
  type PlpBuildRequestStatus,
} from "@hu/types";

import {
  MEDIA_PLP_AUTO_BUILD_NEWS_LIMIT,
  MEDIA_PLP_CAROUSEL_NEWS_LIMIT,
  selectConsumerVisibleNewsArticlesForAutoBuild,
  selectMediaPlpConsumerNewsArticles,
} from "../../../src/modules/language/media-plp-carousel/index.js";
import {
  FakeLocalMediaPlpTransport,
  MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
} from "../../../src/modules/language/media-plp-materializer/thin-gemini-transport.js";
import { resetMediaPlpMaterializerCountersForTests } from "../../../src/modules/language/media-plp-materializer/counters.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalPublicNewsPresentation,
  enqueueConsumerVisibleNewsPlpBuilds,
  enqueuePlpBuildRequest,
  ensureMediaPlpAdapterRegistered,
  fingerprintMediaPlpCanonicalVersion,
  getMediaLocalizationBuildHookStatus,
  getPlpBuildRequestQueueStats,
  getPlpSearchSeoInvalidationStatsForTests,
  listPlpBuildRequestsCompletedForTests,
  listPlpBuildRequestsPendingForTests,
  MEDIA_LOCALIZATION_BUILD_HOOK_STATUS,
  notifyPlpPublicSourceMutation,
  processPlpBuildRequest,
  QUEUE_ACTIVE_PROVIDER_ACTIVE,
  QUEUE_ACTIVE_PROVIDER_DORMANT,
  registerPlpAutoBuildProcessor,
  registerPlpSearchSeoInvalidationListener,
  resetMediaLocalizationBuildHookStatusForTests,
  resetMediaPlpAdapterRegistrationForTests,
  resetPlpBuildRequestQueueForTests,
  resetPlpConsumptionCheckersForTests,
  resetPlpDomainAdapterRegistryForTests,
  resetPlpSearchSeoInvalidationForTests,
  resetPublishedLocalizationPersistenceForTests,
  resolveMediaPlpConsumerItem,
  resolvePlpAutoBuildLocales,
  resolvePlpProviderConcurrency,
  setMediaPlpConsumptionEnabledForTests,
  setPlpBuildRequestProcessor,
  setPlpBuildRequestProcessorForTests,
  setPublishedLocalizationPersistenceModeForTests,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import { notifyPublicPresentationChanged } from "../../../src/modules/language/public-presentation-changed.js";
import {
  resetPublicNewsMemoryStoreForTests,
  upsertPublicNewsRecords,
} from "../../../src/modules/public-news/public-news.repository.js";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const plpRoot = join(
  apiRoot,
  "src/modules/language/published-localized-presentation",
);
const webRoot = join(apiRoot, "../web/src");

function makeNews(i: number, extras?: Partial<NewsArticleRecord>): NewsArticleRecord {
  const now = "2030-01-01T00:00:00.000Z";
  return {
    id: `news-05c-${i}`,
    provider: "test",
    sourceName: `Source-${i % 5}`,
    title: `Title ${i} for localization`,
    summary: `Summary ${i} long enough for localization integrity checks here.`,
    articleUrl: `https://example.com/05c-${i}`,
    normalizedArticleUrl: `https://example.com/05c-${i}`,
    publishedAt: `2029-06-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
    fetchedAt: now,
    expiresAt: "2030-12-31T00:00:00.000Z",
    language: "en",
    category: "peace and security",
    geographicScope: "global",
    status: "active",
    verificationStatus: "external-source",
    createdAt: now,
    updatedAt: now,
    ...extras,
  };
}

function fingerprintArticle(article: NewsArticleRecord): string {
  const tree = asMediaPlpPresentationNode(
    buildCanonicalPublicNewsPresentation({
      id: article.id,
      title: article.title,
      summary: article.summary,
      category: article.category,
      sourceName: article.sourceName,
      articleUrl: article.articleUrl,
      publishedAt: article.publishedAt,
      verificationStatus: article.verificationStatus,
      geographicScope: article.geographicScope,
      language: article.language,
      imageUrl: article.imageUrl,
    }),
  );
  return fingerprintMediaPlpCanonicalVersion(tree);
}

async function waitForQueueIdle(maxMs = 5_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const stats = getPlpBuildRequestQueueStats();
    if (stats.pending === 0 && stats.running === 0) {
      return;
    }
    await new Promise((r) => setTimeout(r, 10));
  }
}

beforeEach(() => {
  process.env.PUBLIC_NEWS_PERSISTENCE = "memory";
  delete process.env.HU_PLP_AUTO_BUILD_LOCALES;
  delete process.env.HU_PLP_AUTO_BUILD_PROCESSOR;
  resetPublicNewsMemoryStoreForTests();
  resetPublishedLocalizationPersistenceForTests();
  setPublishedLocalizationPersistenceModeForTests("memory");
  setMediaPlpConsumptionEnabledForTests(true);
  resetPlpDomainAdapterRegistryForTests();
  resetMediaPlpAdapterRegistrationForTests();
  resetPlpConsumptionCheckersForTests();
  resetPlpBuildRequestQueueForTests();
  resetPlpSearchSeoInvalidationForTests();
  resetMediaLocalizationBuildHookStatusForTests();
  resetMediaPlpMaterializerCountersForTests();
  setPlpBuildRequestProcessorForTests(null);
});

afterEach(() => {
  setMediaPlpConsumptionEnabledForTests(null);
  resetPublishedLocalizationPersistenceForTests();
  resetPlpDomainAdapterRegistryForTests();
  resetMediaPlpAdapterRegistrationForTests();
  resetPlpConsumptionCheckersForTests();
  resetPlpBuildRequestQueueForTests();
  resetPlpSearchSeoInvalidationForTests();
  resetMediaLocalizationBuildHookStatusForTests();
  setPlpBuildRequestProcessorForTests(null);
  resetPublicNewsMemoryStoreForTests();
  delete process.env.HU_PLP_AUTO_BUILD_LOCALES;
  delete process.env.HU_PLP_AUTO_BUILD_PROCESSOR;
});

describe("RESET 05C — RSS automatic PLP publication lifecycle", () => {
  it("1: newly consumer-visible RSS News becomes build-eligible with canonicalVersion", async () => {
    process.env.HU_PLP_AUTO_BUILD_LOCALES = "uk";
    const article = makeNews(1);
    await upsertPublicNewsRecords([article]);
    const version = fingerprintArticle(article);

    notifyPublicPresentationChanged({
      sourceKind: "public_news",
      sourceRecordId: article.id,
      reason: "public_mutation",
      canonicalVersion: version,
    });

    assert.equal(getPlpBuildRequestQueueStats().pending, 1);
    const pending = listPlpBuildRequestsPendingForTests();
    assert.equal(pending[0]?.entityId, mediaPlpPublicNewsEntityId(article.id));
    assert.equal(pending[0]?.canonicalVersion, version);
    assert.equal(pending[0]?.locale, "uk");
  });

  it("1b: mutation without canonicalVersion does not enqueue (forensic gate)", () => {
    process.env.HU_PLP_AUTO_BUILD_LOCALES = "uk";
    notifyPlpPublicSourceMutation({
      sourceKind: "public_news",
      sourceRecordId: "news-no-version",
    });
    assert.equal(getPlpBuildRequestQueueStats().pending, 0);
  });

  it("2: no manual materializer required — processor publishes", async () => {
    const article = makeNews(2);
    await upsertPublicNewsRecords([article]);
    ensureMediaPlpAdapterRegistered();
    const version = fingerprintArticle(article);

    const fake = new FakeLocalMediaPlpTransport();
    setPlpBuildRequestProcessor((request) =>
      processPlpBuildRequest(request, {
        importProvider: async () => ({
          provider: fake,
          PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
        }),
      }),
    );

    enqueuePlpBuildRequest({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: mediaPlpPublicNewsEntityId(article.id),
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      trigger: "DYNAMIC_SOURCE_REFRESH",
    });

    await waitForQueueIdle();
    const completed = listPlpBuildRequestsCompletedForTests();
    assert.ok(completed.some((r) => r.status === "COMPLETED"));

    const tree = asMediaPlpPresentationNode(
      buildCanonicalPublicNewsPresentation({
        id: article.id,
        title: article.title,
        summary: article.summary,
        category: article.category,
        sourceName: article.sourceName,
        articleUrl: article.articleUrl,
        publishedAt: article.publishedAt,
        verificationStatus: article.verificationStatus,
        geographicScope: article.geographicScope,
        language: article.language,
      }),
    );
    const resolved = await resolveMediaPlpConsumerItem({
      locale: "uk",
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: mediaPlpPublicNewsEntityId(article.id),
      canonicalPresentation: tree,
    });
    assert.equal(resolved.mode, "PUBLISHED_LOCALIZED");
    assert.match(String((resolved.presentation as { title?: string }).title), /\[uk\]/);
  });

  it("3: concurrency defaults to 1", () => {
    assert.equal(resolvePlpProviderConcurrency(undefined), 1);
    assert.equal(getPlpBuildRequestQueueStats().PROVIDER_CONCURRENCY, 1);
  });

  it("4: duplicate build events coalesce", () => {
    enqueuePlpBuildRequest({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: "news-dup",
      locale: "uk",
      canonicalVersion: "v1",
      contentRevision: 1,
      trigger: "DYNAMIC_SOURCE_REFRESH",
    });
    enqueuePlpBuildRequest({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: "news-dup",
      locale: "uk",
      canonicalVersion: "v2",
      contentRevision: 2,
      trigger: "CONSUMER_VISIBLE_COLLECTION_REFRESH",
    });
    assert.equal(getPlpBuildRequestQueueStats().pending, 1);
    assert.equal(listPlpBuildRequestsPendingForTests()[0]?.canonicalVersion, "v2");
  });

  it("5: stale build cannot overwrite newer version", async () => {
    const article = makeNews(5);
    await upsertPublicNewsRecords([article]);
    ensureMediaPlpAdapterRegistered();
    const liveVersion = fingerprintArticle(article);

    const status = await processPlpBuildRequest(
      {
        workKey: "stale",
        entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
        entityId: mediaPlpPublicNewsEntityId(article.id),
        locale: "uk",
        canonicalVersion: "stale-old-version",
        contentRevision: 1,
        trigger: "ADMIN_REBUILD",
        enqueuedAt: new Date().toISOString(),
        status: "RUNNING",
      },
      {
        importProvider: async () => {
          throw new Error("provider must not run for SUPERSEDED");
        },
      },
    );
    assert.equal(status.status, "SUPERSEDED");
    assert.notEqual(liveVersion, "stale-old-version");
  });

  it("6: read path provider calls = 0", () => {
    const resolveSrc = readFileSync(
      join(plpRoot, "resolve-published-presentation.ts"),
      "utf8",
    );
    const consumerSrc = readFileSync(
      join(plpRoot, "media/resolve-consumer.ts"),
      "utf8",
    );
    assert.doesNotMatch(resolveSrc, /gemini|thin-gemini|importMediaPlpMaterializerProvider/);
    assert.doesNotMatch(
      consumerSrc,
      /gemini|thin-gemini|importMediaPlpMaterializerProvider|processPlpBuildRequest/,
    );
  });

  it("7: /media and country surfaces share PLP identity for same article", () => {
    const articleId = "news-shared-identity";
    assert.equal(mediaPlpPublicNewsEntityId(articleId), articleId);
    assert.equal(MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS, "public_news");

    const countryFetch = readFileSync(
      join(webRoot, "features/public-news/fetch-country-public-news-plp.ts"),
      "utf8",
    );
    const section = readFileSync(
      join(webRoot, "features/public-news/components/PublicNewsSection.tsx"),
      "utf8",
    );
    assert.match(countryFetch, /MEDIA_PLP_ENTITY_TYPE\.PUBLIC_NEWS/);
    assert.match(countryFetch, /mediaPlpPublicNewsEntityId/);
    assert.match(countryFetch, /resolveMediaPlpBatch/);
    assert.match(section, /fetchCountryPublicNewsPlpById/);
    assert.doesNotMatch(countryFetch, /gemini|materialize|processPlpBuildRequest/);
  });

  it("8: union auto-build covers limit 24 (media 12 ⊂ union)", async () => {
    assert.equal(MEDIA_PLP_AUTO_BUILD_NEWS_LIMIT, 24);
    assert.equal(MEDIA_PLP_CAROUSEL_NEWS_LIMIT, 12);

    const records = Array.from({ length: 30 }, (_, i) => makeNews(i));
    await upsertPublicNewsRecords(records);

    const media = await selectMediaPlpConsumerNewsArticles();
    const union = await selectConsumerVisibleNewsArticlesForAutoBuild();
    assert.equal(media.length, 12);
    assert.equal(union.length, 24);

    const unionIds = new Set(union.map((a) => a.id));
    for (const article of media) {
      assert.ok(unionIds.has(article.id), `media id ${article.id} missing from union`);
    }

    const enqueued = await enqueueConsumerVisibleNewsPlpBuilds({ locales: ["uk"] });
    assert.equal(enqueued.consumerCount, 24);
    assert.equal(enqueued.enqueued, 24);
    assert.equal(enqueued.PROVIDER_CALLS, 0);
  });

  it("9: provider failure leaves canonical fallback coherent", async () => {
    const article = makeNews(9);
    await upsertPublicNewsRecords([article]);
    ensureMediaPlpAdapterRegistered();
    const version = fingerprintArticle(article);

    const status = await processPlpBuildRequest(
      {
        workKey: "fail",
        entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
        entityId: mediaPlpPublicNewsEntityId(article.id),
        locale: "uk",
        canonicalVersion: version,
        contentRevision: 1,
        trigger: "DYNAMIC_SOURCE_REFRESH",
        enqueuedAt: new Date().toISOString(),
        status: "RUNNING",
      },
      {
        importProvider: async () => ({
          provider: new FakeLocalMediaPlpTransport({
            failWith: new Error("simulated provider failure"),
          }),
          PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
        }),
      },
    );
    assert.equal(status.status, "FAILED");

    const tree = asMediaPlpPresentationNode(
      buildCanonicalPublicNewsPresentation({
        id: article.id,
        title: article.title,
        summary: article.summary,
        category: article.category,
        sourceName: article.sourceName,
        articleUrl: article.articleUrl,
        publishedAt: article.publishedAt,
        verificationStatus: article.verificationStatus,
        geographicScope: article.geographicScope,
        language: article.language,
      }),
    );
    const resolved = await resolveMediaPlpConsumerItem({
      locale: "uk",
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: mediaPlpPublicNewsEntityId(article.id),
      canonicalPresentation: tree,
    });
    assert.equal(resolved.mode, "CANONICAL_FALLBACK");
    assert.equal(
      (resolved.presentation as { title?: string }).title,
      article.title,
    );
  });

  it("10: successful publish invalidates search/SEO", async () => {
    const article = makeNews(10);
    await upsertPublicNewsRecords([article]);
    ensureMediaPlpAdapterRegistered();
    const version = fingerprintArticle(article);

    let hooked = 0;
    registerPlpSearchSeoInvalidationListener(() => {
      hooked += 1;
    });

    const fake = new FakeLocalMediaPlpTransport();
    const status = await processPlpBuildRequest(
      {
        workKey: "seo",
        entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
        entityId: mediaPlpPublicNewsEntityId(article.id),
        locale: "uk",
        canonicalVersion: version,
        contentRevision: 1,
        trigger: "DYNAMIC_SOURCE_REFRESH",
        enqueuedAt: new Date().toISOString(),
        status: "RUNNING",
      },
      {
        importProvider: async () => ({
          provider: fake,
          PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
        }),
      },
    );
    assert.equal(status.status, "COMPLETED");
    assert.equal(hooked, 1);
    assert.equal(getPlpSearchSeoInvalidationStatsForTests().count, 1);
  });

  it("processor registration respects locales allowlist + env kill switch", () => {
    assert.deepEqual(resolvePlpAutoBuildLocales(), []);
    assert.equal(
      MEDIA_LOCALIZATION_BUILD_HOOK_STATUS,
      QUEUE_ACTIVE_PROVIDER_DORMANT,
    );

    process.env.HU_PLP_AUTO_BUILD_LOCALES = "uk, ar";
    const active = registerPlpAutoBuildProcessor();
    assert.equal(active.registered, true);
    assert.equal(active.status, QUEUE_ACTIVE_PROVIDER_ACTIVE);
    assert.equal(getMediaLocalizationBuildHookStatus(), QUEUE_ACTIVE_PROVIDER_ACTIVE);
    assert.deepEqual([...active.locales], ["uk", "ar"]);

    process.env.HU_PLP_AUTO_BUILD_PROCESSOR = "0";
    const disabled = registerPlpAutoBuildProcessor();
    assert.equal(disabled.registered, false);
    assert.equal(disabled.reason, "disabled_by_env");
    assert.equal(getMediaLocalizationBuildHookStatus(), QUEUE_ACTIVE_PROVIDER_DORMANT);
  });

  it("refreshPublicNews source wires canonicalVersion + awaited collection enqueue", () => {
    const newsService = readFileSync(
      join(apiRoot, "src/modules/public-news/public-news.service.ts"),
      "utf8",
    );
    assert.match(newsService, /canonicalVersion/);
    assert.match(newsService, /fingerprintMediaPlpCanonicalVersion/);
    assert.match(newsService, /await enqueueConsumerVisibleNewsPlpBuilds/);
    assert.match(newsService, /resolvePlpAutoBuildLocales/);
  });

  it("05C.1: processor boots from index after PLP persistence (not event fire-and-forget)", () => {
    const indexSrc = readFileSync(join(apiRoot, "src/index.ts"), "utf8");
    assert.match(indexSrc, /bootstrapPlpAutoBuildRuntime/);
    const eventBoot = readFileSync(
      join(apiRoot, "src/infrastructure/events/bootstrap-event-infrastructure.ts"),
      "utf8",
    );
    assert.doesNotMatch(eventBoot, /registerPlpAutoBuildProcessor/);
  });

  it("build-pipeline stays provider-free; processor owns dynamic materializer import", () => {
    const pipeline = readFileSync(join(plpRoot, "universal/build-pipeline.ts"), "utf8");
    const processor = readFileSync(
      join(plpRoot, "universal/process-plp-build-request.ts"),
      "utf8",
    );
    assert.doesNotMatch(pipeline, /media-plp-materializer|gemini/);
    assert.match(processor, /media-plp-materializer\/provider-boundary/);
    assert.match(processor, /lookupExistingMediaPlpTranslation|translation-reuse/);
  });

  it("setPlpBuildRequestProcessor kicks drain of dormant work", async () => {
    enqueuePlpBuildRequest({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: "news-dormant",
      locale: "uk",
      canonicalVersion: "v1",
      contentRevision: 1,
      trigger: "DYNAMIC_SOURCE_REFRESH",
    });
    assert.equal(getPlpBuildRequestQueueStats().pending, 1);

    const statuses: PlpBuildRequestStatus[] = [];
    setPlpBuildRequestProcessor(async () => {
      statuses.push("COMPLETED");
      return "COMPLETED";
    });
    await waitForQueueIdle();
    assert.equal(statuses.length, 1);
    assert.equal(getPlpBuildRequestQueueStats().pending, 0);
  });
});
