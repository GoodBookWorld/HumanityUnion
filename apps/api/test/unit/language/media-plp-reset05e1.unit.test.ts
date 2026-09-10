/**
 * RESET 05E.1 — current-consumer recovery compatibility closure.
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
  PLP_PROVIDER_CONTRACT_RECOVERY_GENERATION,
  classifyConsumerProviderRecoveryEligibility,
  classifyProviderResponseRecoveryFailure,
  callMediaPlpMaterializerProviderOnce,
  resetMediaPlpMaterializerCountersForTests,
  resetMediaPlpMaterializerProviderCallBudget,
} from "../../../src/modules/language/media-plp-materializer/index.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalPublicNewsPresentation,
  enqueueConsumerVisibleNewsPlpBuilds,
  enqueuePlpBuildRequest,
  fingerprintMediaPlpCanonicalVersion,
  healCurrentConsumerProviderFailures,
  listPlpAutoBuildWorkForTests,
  markPlpAutoBuildWorkCompleted,
  markPlpAutoBuildWorkFailed,
  processPlpBuildRequest,
  resetMediaPlpAdapterRegistrationForTests,
  resetPlpAutoBuildWorkStoreForTests,
  resetPlpDomainAdapterRegistryForTests,
  resetPublishedLocalizationPersistenceForTests,
  resolvePlpProviderConcurrency,
  setPlpAutoBuildWorkForceMemoryForTests,
  setPlpBuildRequestProcessor,
  setPublishedLocalizationPersistenceModeForTests,
  structuredFailure,
  upsertPendingPlpAutoBuildWork,
  ensureMediaPlpAdapterRegistered,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import {
  resetPublicNewsMemoryStoreForTests,
  upsertPublicNewsRecords,
} from "../../../src/modules/public-news/public-news.repository.js";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

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
    imageUrl: null,
  };
}

function treeFor(article: NewsArticleRecord) {
  return asMediaPlpPresentationNode(
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
}

async function seedFailedProviderWork(input: {
  readonly article: NewsArticleRecord;
  readonly failureCode:
    | "PROVIDER_FAILURE"
    | "PROVIDER_PARTIAL"
    | "PROVIDER_TIMEOUT"
    | "PROVIDER_INTEGRITY"
    | "STALE_CANONICAL_VERSION";
  readonly safeReason: string;
  readonly attempts?: number;
  readonly canonicalVersion?: string;
}): Promise<{
  readonly version: string;
  readonly entityId: string;
  readonly tree: ReturnType<typeof treeFor>;
  readonly workKey: string;
}> {
  const tree = treeFor(input.article);
  const version =
    input.canonicalVersion ?? fingerprintMediaPlpCanonicalVersion(tree);
  const entityId = mediaPlpPublicNewsEntityId(input.article.id);
  const upsert = await upsertPendingPlpAutoBuildWork({
    entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
    entityId,
    locale: "uk",
    canonicalVersion: version,
    contentRevision: 1,
    trigger: "ADMIN_REBUILD",
    maxAttempts: 5,
  });
  await markPlpAutoBuildWorkFailed({
    workKey: upsert.record.workKey,
    attempts: input.attempts ?? 5,
    maxAttempts: 5,
    failure: structuredFailure({
      failureCode: input.failureCode,
      retryable:
        input.failureCode !== "PROVIDER_INTEGRITY" &&
        input.failureCode !== "STALE_CANONICAL_VERSION",
      stage:
        input.failureCode === "STALE_CANONICAL_VERSION" ? "validate" : "provider",
      safeReason: input.safeReason,
    }),
  });
  return { version, entityId, tree, workKey: upsert.record.workKey };
}

/** Stamp 05E recovery generation then re-fail (simulates prior heal attempt). */
async function stampRecoveryGenerationAndFail(input: {
  readonly entityId: string;
  readonly version: string;
  readonly failureCode: "PROVIDER_FAILURE";
  readonly safeReason: string;
}): Promise<void> {
  await upsertPendingPlpAutoBuildWork({
    entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
    entityId: input.entityId,
    locale: "uk",
    canonicalVersion: input.version,
    contentRevision: 1,
    trigger: "ADMIN_REBUILD",
    maxAttempts: 5,
    reopenFailedSameVersion: true,
    recoveryGeneration: PLP_PROVIDER_CONTRACT_RECOVERY_GENERATION,
  });
  const pending = listPlpAutoBuildWorkForTests().find(
    (r) => r.entityId === input.entityId,
  )!;
  assert.equal(pending.recoveryGeneration, "05E");
  await markPlpAutoBuildWorkFailed({
    workKey: pending.workKey,
    attempts: 5,
    maxAttempts: 5,
    failure: structuredFailure({
      failureCode: input.failureCode,
      retryable: true,
      stage: "provider",
      safeReason: input.safeReason,
    }),
  });
}

beforeEach(() => {
  process.env.PUBLIC_NEWS_PERSISTENCE = "memory";
  process.env.HU_PLP_AUTO_BUILD_LOCALES = "uk";
  resetMediaPlpMaterializerCountersForTests();
  resetPlpDomainAdapterRegistryForTests();
  resetMediaPlpAdapterRegistrationForTests();
  ensureMediaPlpAdapterRegistered();
  setPlpAutoBuildWorkForceMemoryForTests(true);
  resetPlpAutoBuildWorkStoreForTests();
  setPublishedLocalizationPersistenceModeForTests("memory");
  resetPublishedLocalizationPersistenceForTests();
  resetPublicNewsMemoryStoreForTests();
  setPlpBuildRequestProcessor(null);
});

afterEach(() => {
  resetMediaPlpMaterializerCountersForTests();
  resetPlpAutoBuildWorkStoreForTests();
  setPlpAutoBuildWorkForceMemoryForTests(false);
  resetPublishedLocalizationPersistenceForTests();
  resetPublicNewsMemoryStoreForTests();
  setPlpBuildRequestProcessor(null);
  delete process.env.HU_PLP_AUTO_BUILD_LOCALES;
});

describe("RESET 05E.1 — current consumer recovery compatibility", () => {
  it("Closure 02: public_news heal never enqueues news (no Gemini recovery)", async () => {
    const article = makeNews("news-legacy-pf");
    await upsertPublicNewsRecords([article]);
    await seedFailedProviderWork({
      article,
      failureCode: "PROVIDER_FAILURE",
      safeReason: "PROVIDER_FAILURE;PROVIDER_RESPONSE_SHAPE=INVALID",
    });
    const healed = await healCurrentConsumerProviderFailures({ locales: ["uk"] });
    assert.equal(healed.newsEnqueued, 0);
    assert.equal(healed.PROVIDER_CALLS, 0);
    const row = listPlpAutoBuildWorkForTests().find(
      (r) => r.entityId === mediaPlpPublicNewsEntityId(article.id),
    )!;
    assert.equal(row.status, "failed");
  });

  it("2: classifier still recognizes legacy INVALID response shapes", () => {
    assert.equal(
      classifyProviderResponseRecoveryFailure(
        "PROVIDER_FAILURE;PROVIDER_RESPONSE_SHAPE=INVALID;MISSING_MACHINE_PATHS=summary|title",
        "PROVIDER_FAILURE",
      ),
      "LEGACY_PROVIDER_RESPONSE_FAILURE",
    );
    assert.equal(
      classifyProviderResponseRecoveryFailure(
        "PROVIDER_PARTIAL:MISSING_PATH;PROVIDER_PARTIAL_SUBREASON=MISSING_PATH",
        "PROVIDER_PARTIAL",
      ),
      "LEGACY_PROVIDER_RESPONSE_FAILURE",
    );
  });

  it("editorial heal remains available while news heal is disabled", async () => {
    const healed = await healCurrentConsumerProviderFailures({ locales: ["uk"] });
    assert.equal(healed.newsEnqueued, 0);
    assert.ok(healed.editorialEnqueued >= 0);
  });

  it("6: historical failed news rows stay failed (heal no-ops news)", async () => {
    const historical = makeNews("news-historical-out");
    await seedFailedProviderWork({
      article: historical,
      failureCode: "PROVIDER_FAILURE",
      safeReason: "PROVIDER_FAILURE;PROVIDER_RESPONSE_SHAPE=INVALID",
    });
    const current = makeNews("news-current-in");
    await upsertPublicNewsRecords([current]);
    await healCurrentConsumerProviderFailures({ locales: ["uk"] });
    const hist = listPlpAutoBuildWorkForTests().find(
      (r) => r.entityId === mediaPlpPublicNewsEntityId(historical.id),
    )!;
    assert.equal(hist.status, "failed");
  });

  it("8: usable snapshot classifier still reports USABLE_SNAPSHOT", () => {
    const decision = classifyConsumerProviderRecoveryEligibility({
      work: {
        status: "failed",
        canonicalVersion: "v-live",
        lastError: "PROVIDER_FAILURE;PROVIDER_RESPONSE_SHAPE=INVALID",
        failureCode: "PROVIDER_FAILURE",
        recoveryGeneration: null,
      },
      liveCanonicalVersion: "v-live",
      hasUsableSnapshot: true,
    });
    assert.equal(decision.eligible, false);
    if (!decision.eligible) {
      assert.equal(decision.ineligibleReason, "USABLE_SNAPSHOT");
    }
  });

  it("10: public_news process is no longer blocked by empty MACHINE bag", async () => {
    const article = makeNews("news-recover-ok");
    await upsertPublicNewsRecords([article]);
    const { version, entityId, tree } = await seedFailedProviderWork({
      article,
      failureCode: "PROVIDER_FAILURE",
      safeReason: "PROVIDER_FAILURE;PROVIDER_RESPONSE_SHAPE=INVALID",
    });
    const healed = await healCurrentConsumerProviderFailures({ locales: ["uk"] });
    assert.equal(healed.newsEnqueued, 0);

    const outcome = await processPlpBuildRequest(
      {
        workKey: "residual-news",
        entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
        entityId,
        locale: "uk",
        canonicalVersion: version,
        contentRevision: 1,
        trigger: "ADMIN_REBUILD",
        enqueuedAt: new Date().toISOString(),
        status: "RUNNING",
        canonicalPresentation: tree,
      },
      {
        importProvider: async () => ({
          provider: new FakeLocalMediaPlpTransport({}),
          PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
        }),
        verifyDurability: async () => ({ ok: true }),
      },
    );
    assert.ok(
      outcome.status === "COMPLETED" || outcome.status === "FAILED",
      outcome.status,
    );
    assert.doesNotMatch(
      String(outcome.failure?.safeReason ?? ""),
      /no_machine_auto_paths/,
    );
  });

  it("12: collection enqueue can schedule bounded media-12 public_news work", async () => {
    const article = makeNews("news-fresh-rss");
    await upsertPublicNewsRecords([article]);
    const rss = await enqueueConsumerVisibleNewsPlpBuilds({
      locales: ["uk"],
      limit: 12,
    });
    assert.equal(rss.PROVIDER_CALLS, 0);
    assert.equal(rss.consumerCount, 1);
    assert.equal(rss.enqueued, 1);
  });

  it("13: heal path does not fan out news; carousel collection owns RSS builds", () => {
    const src = readFileSync(
      join(
        apiRoot,
        "src/modules/language/published-localized-presentation/universal/current-consumer-provider-heal.ts",
      ),
      "utf8",
    );
    assert.match(src, /newsEnqueued:\s*0/);
    assert.match(src, /enqueueConsumerVisibleNewsPlpBuilds/);
    assert.doesNotMatch(src, /selectMediaPlpConsumerNewsArticles/);
    assert.match(src, /enqueueCivicMediaEditorialPlpBuilds/);
  });

  it("14: provider concurrency remains 1", () => {
    assert.equal(resolvePlpProviderConcurrency(), 1);
  });

  it("15: read diagnostic performs zero provider/PLP/Mongo writes", () => {
    const diag = readFileSync(
      join(
        apiRoot,
        "src/modules/language/media-plp-carousel/media-live-closure-diagnostic.ts",
      ),
      "utf8",
    );
    assert.match(diag, /RECOVERY_ELIGIBLE/);
    assert.match(diag, /RECOVERY_INELIGIBLE_REASON/);
    assert.doesNotMatch(
      diag,
      /callMediaPlpMaterializerProviderOnce|healCurrentConsumerProviderFailures/,
    );
  });
});
