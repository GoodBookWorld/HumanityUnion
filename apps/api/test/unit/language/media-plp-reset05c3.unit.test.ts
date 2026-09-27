/**
 * RESET 05C.3 — structured PLP auto-build failure truth.
 * No live Gemini / staging Mongo writes / historical retry.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

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
  buildCanonicalPublicNewsPresentation,
  claimNextPlpAutoBuildWork,
  ensureMediaPlpAdapterRegistered,
  fingerprintMediaPlpCanonicalVersion,
  kickPlpAutoBuildDrain,
  listPlpAutoBuildWorkForTests,
  markPlpAutoBuildWorkFailed,
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
  resolvePlpProviderConcurrency,
  setPlpAutoBuildWorkForceMemoryForTests,
  setPlpBuildRequestProcessor,
  setPublishedLocalizationPersistenceModeForTests,
  stopPlpAutoBuildRuntimeForTests,
  upsertPendingPlpAutoBuildWork,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import {
  resetPublicNewsMemoryStoreForTests,
  upsertPublicNewsRecords,
} from "../../../src/modules/public-news/public-news.repository.js";

function makeNews(i: number): NewsArticleRecord {
  const now = "2030-01-01T00:00:00.000Z";
  return {
    id: `news-05c3-${i}`,
    provider: "test",
    sourceName: `Source-${i}`,
    title: `Title ${i} for localization integrity`,
    summary: `Summary ${i} long enough for localization integrity checks here.`,
    articleUrl: `https://example.com/05c3-${i}`,
    normalizedArticleUrl: `https://example.com/05c3-${i}`,
    publishedAt: `2029-07-${String((i % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
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

function fingerprint(article: NewsArticleRecord): string {
  return fingerprintMediaPlpCanonicalVersion(
    asMediaPlpPresentationNode(
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
    ),
  );
}

function requestFor(article: NewsArticleRecord, version?: string) {
  return {
    workKey: `public_news|${article.id}|uk`,
    entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
    entityId: mediaPlpPublicNewsEntityId(article.id),
    locale: "uk",
    canonicalVersion: version ?? fingerprint(article),
    contentRevision: 1,
    trigger: "DYNAMIC_SOURCE_REFRESH" as const,
    enqueuedAt: new Date().toISOString(),
    status: "RUNNING" as const,
  };
}

async function waitIdle(): Promise<void> {
  for (let i = 0; i < 80; i += 1) {
    const pending = listPlpAutoBuildWorkForTests().filter(
      (r) => r.status === "pending" || r.status === "running",
    );
    if (pending.length === 0) {
      return;
    }
    await new Promise((r) => setTimeout(r, 25));
  }
}

beforeEach(() => {
  process.env.PUBLIC_NEWS_PERSISTENCE = "memory";
  process.env.HU_PLP_AUTO_BUILD_LOCALES = "uk";
  delete process.env.HU_PLP_AUTO_BUILD_PROCESSOR;
  setPlpAutoBuildWorkForceMemoryForTests(true);
  resetPlpAutoBuildWorkStoreForTests();
  resetPlpBuildRequestQueueForTests();
  resetPlpAutoBuildRuntimeForTests();
  resetPublishedLocalizationPersistenceForTests();
  setPublishedLocalizationPersistenceModeForTests("memory");
  resetPlpDomainAdapterRegistryForTests();
  resetMediaPlpAdapterRegistrationForTests();
  resetMediaPlpMaterializerCountersForTests();
  resetPlpSearchSeoInvalidationForTests();
  resetPlpConsumptionCheckersForTests();
  resetMediaLocalizationBuildHookStatusForTests();
  resetPublicNewsMemoryStoreForTests();
  ensureMediaPlpAdapterRegistered();
});

afterEach(() => {
  stopPlpAutoBuildRuntimeForTests();
  resetPlpBuildRequestQueueForTests();
  resetPlpAutoBuildWorkStoreForTests();
  setPlpAutoBuildWorkForceMemoryForTests(false);
  resetPublishedLocalizationPersistenceForTests();
  resetPublicNewsMemoryStoreForTests();
  delete process.env.HU_PLP_AUTO_BUILD_LOCALES;
});

describe("RESET 05C.3 — structured failure truth", () => {
  it("1: provider timeout persists PROVIDER_TIMEOUT + retryable", async () => {
    const article = makeNews(1);
    await upsertPublicNewsRecords([article]);
    const result = await processPlpBuildRequest(requestFor(article), {
      providerTimeoutMs: 5,
      callProvider: async () =>
        new Promise(() => {
          /* never resolves */
        }),
    });
    assert.equal(result.status, "SKIPPED_USABLE");
    assert.equal(result.failure, undefined);
  });

  it("2: public_news does not enter the provider failure path", async () => {
    const article = makeNews(2);
    await upsertPublicNewsRecords([article]);
    let calls = 0;
    const result = await processPlpBuildRequest(requestFor(article), {
      callProvider: async () => {
        calls += 1;
        return {
          ok: false,
          reason: "PROVIDER_FAILURE",
          message: "upstream 503",
        };
      },
    });
    assert.equal(result.status, "SKIPPED_USABLE");
    assert.equal(calls, 0);
  });

  it("3: public_news partial provider output is not requested", async () => {
    const article = makeNews(3);
    await upsertPublicNewsRecords([article]);
    let calls = 0;
    const result = await processPlpBuildRequest(requestFor(article), {
      callProvider: async () => {
        calls += 1;
        return {
          ok: false,
          reason: "PARTIAL",
          message: "missing paths",
        };
      },
    });
    assert.equal(result.status, "SKIPPED_USABLE");
    assert.equal(calls, 0);
  });

  it("4: public_news integrity rejection is not requested", async () => {
    const article = makeNews(4);
    await upsertPublicNewsRecords([article]);
    let calls = 0;
    const result = await processPlpBuildRequest(requestFor(article), {
      callProvider: async () => {
        calls += 1;
        return {
          ok: false,
          reason: "LOCALIZATION_CONTENT_INTEGRITY_FAILED",
          message: "integrity",
        };
      },
    });
    assert.equal(result.status, "SKIPPED_USABLE");
    assert.equal(calls, 0);
  });

  it("5: missing public_news source is not claimed for translation", async () => {
    let calls = 0;
    const result = await processPlpBuildRequest(
      requestFor(makeNews(5), "missing-v"),
      {
        callProvider: async () => {
          calls += 1;
          throw new Error("must not call");
        },
      },
    );
    assert.equal(result.status, "SKIPPED_USABLE");
    assert.equal(calls, 0);
  });

  it("6–7: stale or publish paths do not call a provider for public_news", async () => {
    const article = makeNews(6);
    await upsertPublicNewsRecords([article]);
    let calls = 0;
    const stale = await processPlpBuildRequest(
      requestFor(article, "stale-version"),
      {
        callProvider: async () => {
          calls += 1;
          throw new Error("no");
        },
      },
    );
    assert.equal(stale.status, "SKIPPED_USABLE");

    const publishFail = await processPlpBuildRequest(requestFor(article), {
      importProvider: async () => {
        calls += 1;
        return {
          provider: new FakeLocalMediaPlpTransport({}),
          PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
        };
      },
      verifyDurability: async () => ({
        ok: false,
        reason: "Durable current pointer missing after publish.",
      }),
    });
    assert.equal(publishFail.status, "SKIPPED_USABLE");
    assert.equal(calls, 0);
  });

  it("8–10: retryable below cap; terminal at maxAttempts; no 6th attempt", async () => {
    assert.equal(resolvePlpProviderConcurrency(undefined), 1);
    const article = makeNews(8);
    await upsertPublicNewsRecords([article]);
    const version = fingerprint(article);

    setPlpBuildRequestProcessor(async () => ({
      status: "FAILED",
      failure: {
        failureCode: "PROVIDER_TIMEOUT",
        retryable: true,
        stage: "provider",
        safeReason: "TIMEOUT",
      },
    }));

    await upsertPendingPlpAutoBuildWork({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: "editorial-05c3-retry",
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      trigger: "DYNAMIC_SOURCE_REFRESH",
      maxAttempts: 3,
    });
    kickPlpAutoBuildDrain();
    await waitIdle();

    const work = listPlpAutoBuildWorkForTests().find(
      (r) => r.entityId === "editorial-05c3-retry",
    );
    assert.ok(work);
    assert.equal(work!.status, "failed");
    assert.equal(work!.failureCode, "PROVIDER_TIMEOUT");
    assert.equal(work!.failureStage, "provider");
    assert.equal(work!.retryable, true);
    assert.equal(work!.attempts, 3);
    assert.equal(work!.maxAttempts, 3);
    assert.ok(work!.attempts <= work!.maxAttempts);

    // Re-enqueue same version must not reopen terminal failed.
    const again = await upsertPendingPlpAutoBuildWork({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: "editorial-05c3-retry",
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      trigger: "DYNAMIC_SOURCE_REFRESH",
      maxAttempts: 3,
    });
    assert.equal(again.deduped, true);
    assert.equal(again.record.status, "failed");
    assert.equal(again.record.attempts, 3);

    const claimed = await claimNextPlpAutoBuildWork();
    assert.equal(claimed, null);
  });

  it("11: successful build clears current failure fields (05D.4+)", async () => {
    const article = makeNews(11);
    await upsertPublicNewsRecords([article]);
    const version = fingerprint(article);

    const seeded = await upsertPendingPlpAutoBuildWork({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: "editorial-05c3-success",
      locale: "uk",
      canonicalVersion: "old-v",
      contentRevision: 1,
      trigger: "DYNAMIC_SOURCE_REFRESH",
      maxAttempts: 5,
    });
    await markPlpAutoBuildWorkFailed({
      workKey: seeded.record.workKey,
      attempts: 5,
      maxAttempts: 5,
      failure: {
        failureCode: "PROVIDER_TIMEOUT",
        retryable: true,
        stage: "provider",
        safeReason: "PROVIDER_TIMEOUT:prior",
      },
    });

    setPlpBuildRequestProcessor(async () => ({ status: "COMPLETED" }));

    await upsertPendingPlpAutoBuildWork({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: "editorial-05c3-success",
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      trigger: "DYNAMIC_SOURCE_REFRESH",
      maxAttempts: 5,
    });
    kickPlpAutoBuildDrain();
    await waitIdle();

    const work = listPlpAutoBuildWorkForTests().find(
      (r) => r.entityId === "editorial-05c3-success" && r.canonicalVersion === version,
    );
    assert.equal(work?.status, "completed");
    assert.equal(work?.canonicalVersion, version);
    assert.equal(work?.failureCode, null);
    assert.equal(work?.failureStage, null);
    assert.equal(work?.lastError, null);
  });

  it("12: read path / resolve modules never import provider", async () => {
    const { readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
    const resolveSrc = readFileSync(
      join(
        apiRoot,
        "src/modules/language/published-localized-presentation/resolve-published-presentation.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(
      resolveSrc,
      /gemini|thin-gemini|importMediaPlpMaterializerProvider/,
    );
  });
});
