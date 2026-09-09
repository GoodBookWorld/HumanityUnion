/**
 * RESET 05C.1 — durable PLP auto-build work + restart-safe drain.
 * fake_local / injected processor, memory work store. NO live Gemini.
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
} from "@hu/types";

import {
  FakeLocalMediaPlpTransport,
  MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
} from "../../../src/modules/language/media-plp-materializer/thin-gemini-transport.js";
import { resetMediaPlpMaterializerCountersForTests } from "../../../src/modules/language/media-plp-materializer/counters.js";
import {
  asMediaPlpPresentationNode,
  bootstrapPlpAutoBuildRuntime,
  buildCanonicalPublicNewsPresentation,
  enqueueConsumerVisibleNewsPlpBuilds,
  enqueuePlpBuildRequest,
  ensureMediaPlpAdapterRegistered,
  fingerprintMediaPlpCanonicalVersion,
  getPlpAutoBuildRuntimeSnapshot,
  getPlpBuildRequestQueueStats,
  kickPlpAutoBuildDrain,
  listPlpAutoBuildWorkForTests,
  listPlpBuildRequestsCompletedForTests,
  processPlpBuildRequest,
  resetMediaLocalizationBuildHookStatusForTests,
  resetMediaPlpAdapterRegistrationForTests,
  resetPlpAutoBuildRuntimeForTests,
  resetPlpAutoBuildWorkStoreForTests,
  resetPlpBuildRequestQueueForTests,
  resetPlpConsumptionCheckersForTests,
  resetPlpDomainAdapterRegistryForTests,
  resetPlpSearchSeoInvalidationForTests,
  resetPublishedLocalizationPersistenceForTests,
  resolveMediaPlpConsumerItem,
  resolvePlpAutoBuildQueueBackend,
  resolvePlpProviderConcurrency,
  setMediaPlpConsumptionEnabledForTests,
  setPlpAutoBuildWorkForceMemoryForTests,
  setPlpBuildRequestProcessor,
  setPlpBuildRequestProcessorForTests,
  setPublishedLocalizationPersistenceModeForTests,
  stopPlpAutoBuildRuntimeForTests,
  upsertPendingPlpAutoBuildWork,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import {
  resetPublicNewsMemoryStoreForTests,
  upsertPublicNewsRecords,
} from "../../../src/modules/public-news/public-news.repository.js";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const plpRoot = join(
  apiRoot,
  "src/modules/language/published-localized-presentation",
);

function makeNews(i: number, extras?: Partial<NewsArticleRecord>): NewsArticleRecord {
  const now = "2030-01-01T00:00:00.000Z";
  return {
    id: `news-05c1-${i}`,
    provider: "test",
    sourceName: `Source-${i % 5}`,
    title: `Title ${i} for localization`,
    summary: `Summary ${i} long enough for localization integrity checks here.`,
    articleUrl: `https://example.com/05c1-${i}`,
    normalizedArticleUrl: `https://example.com/05c1-${i}`,
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

async function waitForQueueIdle(maxMs = 8_000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const stats = getPlpBuildRequestQueueStats();
    const pendingWork = listPlpAutoBuildWorkForTests().filter(
      (w) => w.status === "pending" || w.status === "running",
    );
    if (stats.running === 0 && pendingWork.length === 0) {
      return;
    }
    await new Promise((r) => setTimeout(r, 15));
  }
  throw new Error("queue did not idle");
}

function wireFakeProcessor(fake = new FakeLocalMediaPlpTransport()): void {
  setPlpBuildRequestProcessor((request) =>
    processPlpBuildRequest(request, {
      importProvider: async () => ({
        provider: fake,
        PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
      }),
    }),
  );
}

beforeEach(() => {
  process.env.PUBLIC_NEWS_PERSISTENCE = "memory";
  process.env.HU_PLP_AUTO_BUILD_LOCALES = "uk";
  delete process.env.HU_PLP_AUTO_BUILD_PROCESSOR;
  delete process.env.HU_PLP_AUTO_BUILD_MAX_ATTEMPTS;
  setPlpAutoBuildWorkForceMemoryForTests(true);
  resetPublicNewsMemoryStoreForTests();
  resetPublishedLocalizationPersistenceForTests();
  setPublishedLocalizationPersistenceModeForTests("memory");
  setMediaPlpConsumptionEnabledForTests(true);
  resetPlpDomainAdapterRegistryForTests();
  resetMediaPlpAdapterRegistrationForTests();
  resetPlpConsumptionCheckersForTests();
  stopPlpAutoBuildRuntimeForTests();
  resetPlpBuildRequestQueueForTests();
  resetPlpAutoBuildWorkStoreForTests();
  resetPlpAutoBuildRuntimeForTests();
  resetPlpSearchSeoInvalidationForTests();
  resetMediaLocalizationBuildHookStatusForTests();
  resetMediaPlpMaterializerCountersForTests();
  setPlpBuildRequestProcessorForTests(null);
});

afterEach(() => {
  stopPlpAutoBuildRuntimeForTests();
  setMediaPlpConsumptionEnabledForTests(null);
  resetPublishedLocalizationPersistenceForTests();
  resetPlpDomainAdapterRegistryForTests();
  resetMediaPlpAdapterRegistrationForTests();
  resetPlpConsumptionCheckersForTests();
  resetPlpBuildRequestQueueForTests();
  resetPlpAutoBuildWorkStoreForTests();
  resetPlpAutoBuildRuntimeForTests();
  resetPlpSearchSeoInvalidationForTests();
  resetMediaLocalizationBuildHookStatusForTests();
  setPlpBuildRequestProcessorForTests(null);
  setPlpAutoBuildWorkForceMemoryForTests(false);
  resetPublicNewsMemoryStoreForTests();
  delete process.env.HU_PLP_AUTO_BUILD_LOCALES;
  delete process.env.HU_PLP_AUTO_BUILD_PROCESSOR;
  delete process.env.HU_PLP_AUTO_BUILD_MAX_ATTEMPTS;
});

describe("RESET 05C.1 — durable automatic localization", () => {
  it("A–F: bootstrap → enqueue → durable work → publish → PUBLISHED_LOCALIZED", async () => {
    const boot = await bootstrapPlpAutoBuildRuntime();
    assert.equal(boot.registered, true);
    assert.equal(boot.localesCount, 1);
    assert.equal(boot.queueBackend, "MEMORY");
    assert.equal(resolvePlpAutoBuildQueueBackend(), "MEMORY");
    // Replace production processor with fake_local before any enqueue.
    wireFakeProcessor();

    const article = makeNews(1);
    await upsertPublicNewsRecords([article]);
    ensureMediaPlpAdapterRegistered();
    const version = fingerprintArticle(article);

    const existingBefore = await resolveMediaPlpConsumerItem({
      locale: "uk",
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: mediaPlpPublicNewsEntityId(article.id),
      canonicalPresentation: asMediaPlpPresentationNode(
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
      ),
    });
    assert.equal(existingBefore.mode, "CANONICAL_FALLBACK");

    const enqueued = await enqueueConsumerVisibleNewsPlpBuilds({
      locales: ["uk"],
      limit: 12,
    });
    assert.equal(enqueued.PROVIDER_CALLS, 0);
    // Final Localization Closure 02 — original-language-only: no PLP enqueue for RSS.
    assert.equal(enqueued.enqueued, 0);

    const durable = listPlpAutoBuildWorkForTests().filter(
      (w) => w.entityId === mediaPlpPublicNewsEntityId(article.id),
    );
    assert.equal(durable.length, 0);

    // Policy: originals remain CANONICAL_FALLBACK (no machine publish path).
    const resolved = await resolveMediaPlpConsumerItem({
      locale: "uk",
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: mediaPlpPublicNewsEntityId(article.id),
      canonicalPresentation: asMediaPlpPresentationNode(
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
      ),
    });
    assert.equal(resolved.mode, "CANONICAL_FALLBACK");
  });

  it("G: residual durable pending public_news work fails closed without provider", async () => {
    const article = makeNews(2);
    await upsertPublicNewsRecords([article]);
    ensureMediaPlpAdapterRegistered();
    const version = fingerprintArticle(article);
    const entityId = mediaPlpPublicNewsEntityId(article.id);

    await upsertPendingPlpAutoBuildWork({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId,
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      trigger: "DYNAMIC_SOURCE_REFRESH",
    });

    const fake = new FakeLocalMediaPlpTransport();
    const status = await processPlpBuildRequest(
      {
        workKey: "residual-news",
        entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
        entityId,
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
    assert.equal(status.status, "FAILED");
    assert.equal(status.failure?.failureCode, "ADAPTER_OR_SOURCE");
    assert.match(String(status.failure?.safeReason ?? ""), /no_machine_auto_paths/);
    assert.equal(fake.getRequestCountForTests(), 0);

    const resolved = await resolveMediaPlpConsumerItem({
      locale: "uk",
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId,
      canonicalPresentation: asMediaPlpPresentationNode(
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
      ),
    });
    assert.equal(resolved.mode, "CANONICAL_FALLBACK");
  });

  it("H: duplicate refresh coalesces / skip usable without provider", async () => {
    const article = makeNews(3);
    await upsertPublicNewsRecords([article]);
    ensureMediaPlpAdapterRegistered();
    await bootstrapPlpAutoBuildRuntime();
    wireFakeProcessor();

    const first = await enqueueConsumerVisibleNewsPlpBuilds({ locales: ["uk"], limit: 12 });
    assert.equal(first.enqueued, 0);

    const snapBefore = await getPlpAutoBuildRuntimeSnapshot();
    const providerBefore = snapBefore.providerCalls;

    const again = await enqueueConsumerVisibleNewsPlpBuilds({
      locales: ["uk"],
      limit: 12,
    });
    assert.equal(again.PROVIDER_CALLS, 0);
    assert.equal(again.enqueued, 0);

    const snapAfter = await getPlpAutoBuildRuntimeSnapshot();
    assert.equal(snapAfter.providerCalls, providerBefore);
  });

  it("I: residual enqueue fails closed before provider; canonical fallback preserved", async () => {
    process.env.HU_PLP_AUTO_BUILD_MAX_ATTEMPTS = "2";
    const article = makeNews(4);
    await upsertPublicNewsRecords([article]);
    ensureMediaPlpAdapterRegistered();
    const version = fingerprintArticle(article);

    const fake = new FakeLocalMediaPlpTransport({
      failWith: new Error("simulated provider failure"),
    });
    const status = await processPlpBuildRequest(
      {
        workKey: "provider-fail",
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
    assert.equal(status.status, "FAILED");
    assert.equal(status.failure?.failureCode, "ADAPTER_OR_SOURCE");
    assert.equal(fake.getRequestCountForTests(), 0);

    const resolved = await resolveMediaPlpConsumerItem({
      locale: "uk",
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: mediaPlpPublicNewsEntityId(article.id),
      canonicalPresentation: asMediaPlpPresentationNode(
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
      ),
    });
    assert.equal(resolved.mode, "CANONICAL_FALLBACK");
  });

  it("concurrency defaults to 1; stale cannot overwrite; read path provider=0", async () => {
    assert.equal(resolvePlpProviderConcurrency(undefined), 1);

    const article = makeNews(5);
    await upsertPublicNewsRecords([article]);
    ensureMediaPlpAdapterRegistered();
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
          throw new Error("provider must not run for stale claim");
        },
      },
    );
    assert.equal(status.status, "FAILED");
    assert.equal(status.failure?.failureCode, "STALE_CANONICAL_VERSION");
    assert.match(status.failure?.safeReason ?? "", /STALE_WORK_VERSION=/);
    assert.match(status.failure?.safeReason ?? "", /STALE_CURRENT_SOURCE_VERSION=/);

    const resolveSrc = readFileSync(
      join(plpRoot, "resolve-published-presentation.ts"),
      "utf8",
    );
    assert.doesNotMatch(resolveSrc, /gemini|thin-gemini|importMediaPlpMaterializerProvider/);
  });

  it("startup path is deterministic in index.ts; event bootstrap has no fire-and-forget PLP", () => {
    const indexSrc = readFileSync(join(apiRoot, "src/index.ts"), "utf8");
    assert.match(indexSrc, /bootstrapPublishedLocalizationPersistence/);
    assert.match(indexSrc, /bootstrapPlpAutoBuildRuntime/);
    assert.match(indexSrc, /startPublicNewsScheduler/);
    const bootIdx = indexSrc.indexOf("bootstrapPlpAutoBuildRuntime");
    const newsIdx = indexSrc.indexOf("startPublicNewsScheduler");
    const plpIdx = indexSrc.indexOf("bootstrapPublishedLocalizationPersistence");
    assert.ok(plpIdx < bootIdx && bootIdx < newsIdx);

    const eventBoot = readFileSync(
      join(apiRoot, "src/infrastructure/events/bootstrap-event-infrastructure.ts"),
      "utf8",
    );
    assert.doesNotMatch(eventBoot, /registerPlpAutoBuildProcessor/);
    assert.doesNotMatch(eventBoot, /plp_auto_build_processor/);

    const newsService = readFileSync(
      join(apiRoot, "src/modules/public-news/public-news.service.ts"),
      "utf8",
    );
    assert.match(newsService, /await enqueueConsumerVisibleNewsPlpBuilds/);

    const routes = readFileSync(
      join(apiRoot, "src/modules/administration/admin-diagnostics-health.routes.ts"),
      "utf8",
    );
    assert.match(routes, /\/plp-auto-build/);
  });

  it("dormant without processor leaves durable pending (no spin)", async () => {
    setPlpBuildRequestProcessorForTests(null);
    await enqueuePlpBuildRequest({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: "news-dormant-05c1",
      locale: "uk",
      canonicalVersion: "v1",
      contentRevision: 1,
      trigger: "DYNAMIC_SOURCE_REFRESH",
    });
    await new Promise((r) => setTimeout(r, 50));
    const pending = listPlpAutoBuildWorkForTests().filter((w) => w.status === "pending");
    assert.equal(pending.length, 1);
    assert.equal(getPlpBuildRequestQueueStats().running, 0);
  });
});
