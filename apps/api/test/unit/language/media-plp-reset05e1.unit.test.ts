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
  it("1: exhausted legacy PROVIDER_FAILURE current consumer row is reopened once", async () => {
    const article = makeNews("news-legacy-pf");
    await upsertPublicNewsRecords([article]);
    await seedFailedProviderWork({
      article,
      failureCode: "PROVIDER_FAILURE",
      safeReason: "PROVIDER_FAILURE;PROVIDER_RESPONSE_SHAPE=INVALID",
    });
    const healed = await healCurrentConsumerProviderFailures({ locales: ["uk"] });
    assert.ok(healed.newsEnqueued >= 1);
    const row = listPlpAutoBuildWorkForTests().find(
      (r) => r.entityId === mediaPlpPublicNewsEntityId(article.id),
    )!;
    assert.equal(row.status, "pending");
    assert.equal(row.attempts, 0);
    assert.equal(row.recoveryGeneration, PLP_PROVIDER_CONTRACT_RECOVERY_GENERATION);
  });

  it("2: legacy INVALID response row reopened once", async () => {
    assert.equal(
      classifyProviderResponseRecoveryFailure(
        "PROVIDER_FAILURE;PROVIDER_RESPONSE_SHAPE=INVALID;MISSING_MACHINE_PATHS=summary|title",
        "PROVIDER_FAILURE",
      ),
      "LEGACY_PROVIDER_RESPONSE_FAILURE",
    );
    const article = makeNews("news-legacy-invalid");
    await upsertPublicNewsRecords([article]);
    await seedFailedProviderWork({
      article,
      failureCode: "PROVIDER_FAILURE",
      safeReason:
        "PROVIDER_FAILURE;PROVIDER_RESPONSE_SHAPE=INVALID;MISSING_MACHINE_PATHS=summary|title",
    });
    const healed = await healCurrentConsumerProviderFailures({ locales: ["uk"] });
    assert.ok(healed.newsEnqueued >= 1);
    const row = listPlpAutoBuildWorkForTests().find(
      (r) => r.entityId === mediaPlpPublicNewsEntityId(article.id),
    )!;
    assert.equal(row.recoveryGeneration, "05E");
    assert.equal(row.attempts, 0);
  });

  it("3: legacy retryable PROVIDER_PARTIAL reopened when eligible", async () => {
    assert.equal(
      classifyProviderResponseRecoveryFailure(
        "PROVIDER_PARTIAL:MISSING_PATH;PROVIDER_PARTIAL_SUBREASON=MISSING_PATH",
        "PROVIDER_PARTIAL",
      ),
      "LEGACY_PROVIDER_RESPONSE_FAILURE",
    );
    const article = makeNews("news-legacy-partial");
    await upsertPublicNewsRecords([article]);
    await seedFailedProviderWork({
      article,
      failureCode: "PROVIDER_PARTIAL",
      safeReason:
        "PROVIDER_PARTIAL:MISSING_PATH;PROVIDER_PARTIAL_SUBREASON=MISSING_PATH;MISSING_MACHINE_PATHS=summary",
    });
    const healed = await healCurrentConsumerProviderFailures({ locales: ["uk"] });
    assert.ok(healed.newsEnqueued >= 1);
  });

  it("4: stale failure not reopened", async () => {
    const article = makeNews("news-stale");
    await upsertPublicNewsRecords([article]);
    await seedFailedProviderWork({
      article,
      failureCode: "STALE_CANONICAL_VERSION",
      safeReason:
        "STALE_CANONICAL_VERSION;STALE_REVISION;STALE_ORIGIN_ID=publish_cas;STALE_WORK_VERSION=v-a;STALE_CURRENT_SOURCE_VERSION=v-b;STALE_BOUNDARY=publish;STALE_AUTHORITY=x",
    });
    const before = listPlpAutoBuildWorkForTests().find(
      (r) => r.entityId === mediaPlpPublicNewsEntityId(article.id),
    )!;
    assert.equal(before.status, "failed");
    const healed = await healCurrentConsumerProviderFailures({ locales: ["uk"] });
    assert.ok(healed.newsSkippedNotProviderClass >= 1);
    const after = listPlpAutoBuildWorkForTests().find(
      (r) => r.entityId === mediaPlpPublicNewsEntityId(article.id),
    )!;
    assert.equal(after.status, "failed");
    assert.equal(after.attempts, before.attempts);
  });

  it("5: integrity/Brand failure not reopened", async () => {
    const article = makeNews("news-integrity");
    await upsertPublicNewsRecords([article]);
    await seedFailedProviderWork({
      article,
      failureCode: "PROVIDER_INTEGRITY",
      safeReason: "PROVIDER_INTEGRITY:BRAND_TOKEN_PRESERVATION_FAILED",
    });
    const healed = await healCurrentConsumerProviderFailures({ locales: ["uk"] });
    assert.ok(healed.newsSkippedNotProviderClass >= 1);
    const after = listPlpAutoBuildWorkForTests().find(
      (r) => r.entityId === mediaPlpPublicNewsEntityId(article.id),
    )!;
    assert.equal(after.status, "failed");
  });

  it("6: non-current News not reopened", async () => {
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

  it("7: canonical-version mismatch not reopened", async () => {
    const article = makeNews("news-version-mismatch");
    await upsertPublicNewsRecords([article]);
    const live = fingerprintMediaPlpCanonicalVersion(treeFor(article));
    await seedFailedProviderWork({
      article,
      failureCode: "PROVIDER_FAILURE",
      safeReason: "PROVIDER_FAILURE",
      canonicalVersion: "v-old-not-live",
    });
    const decision = classifyConsumerProviderRecoveryEligibility({
      work: {
        status: "failed",
        canonicalVersion: "v-old-not-live",
        lastError: "PROVIDER_FAILURE",
        failureCode: "PROVIDER_FAILURE",
        recoveryGeneration: null,
      },
      liveCanonicalVersion: live,
      hasUsableSnapshot: false,
    });
    assert.equal(decision.eligible, false);
    if (!decision.eligible) {
      assert.equal(decision.ineligibleReason, "VERSION_MISMATCH");
    }
    const healed = await healCurrentConsumerProviderFailures({ locales: ["uk"] });
    assert.ok(healed.newsSkippedVersionMismatch >= 1);
    const after = listPlpAutoBuildWorkForTests().find(
      (r) => r.entityId === mediaPlpPublicNewsEntityId(article.id),
    )!;
    assert.equal(after.status, "failed");
    assert.equal(after.canonicalVersion, "v-old-not-live");
  });

  it("8: usable snapshot not reopened", () => {
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

  it("9: restart does not repeatedly reset recovery budget", async () => {
    const article = makeNews("news-no-loop");
    await upsertPublicNewsRecords([article]);
    const seeded = await seedFailedProviderWork({
      article,
      failureCode: "PROVIDER_FAILURE",
      safeReason: "PROVIDER_FAILURE;PROVIDER_RESPONSE_SHAPE=INVALID",
    });
    await stampRecoveryGenerationAndFail({
      entityId: seeded.entityId,
      version: seeded.version,
      failureCode: "PROVIDER_FAILURE",
      safeReason: "PROVIDER_FAILURE;PROVIDER_RESPONSE_SHAPE=INVALID",
    });
    const before = listPlpAutoBuildWorkForTests().find(
      (r) => r.entityId === seeded.entityId,
    )!;
    assert.equal(before.recoveryGeneration, "05E");
    assert.equal(before.status, "failed");
    const healed = await healCurrentConsumerProviderFailures({ locales: ["uk"] });
    assert.ok(healed.newsSkippedAlreadyRecovered >= 1);
    const after = listPlpAutoBuildWorkForTests().find(
      (r) => r.entityId === seeded.entityId,
    )!;
    assert.equal(after.status, "failed");
    assert.equal(after.attempts, before.attempts);
  });

  it("10–11: reopened row executes structured provider and success clears failure", async () => {
    const article = makeNews("news-recover-ok");
    await upsertPublicNewsRecords([article]);
    const { version, entityId, tree } = await seedFailedProviderWork({
      article,
      failureCode: "PROVIDER_FAILURE",
      safeReason: "PROVIDER_FAILURE;PROVIDER_RESPONSE_SHAPE=INVALID",
    });
    await healCurrentConsumerProviderFailures({ locales: ["uk"] });
    const pending = listPlpAutoBuildWorkForTests().find((r) => r.entityId === entityId)!;
    assert.equal(pending.status, "pending");
    assert.equal(pending.recoveryGeneration, "05E");

    resetMediaPlpMaterializerProviderCallBudget();
    const providerResult = await callMediaPlpMaterializerProviderOnce({
      provider: new FakeLocalMediaPlpTransport({}),
      locale: "uk",
      autoValues: { title: article.title, summary: article.summary },
      sourceRecordId: entityId,
      sourceVersion: version,
      PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
    });
    assert.equal(providerResult.ok, true);

    const outcome = await processPlpBuildRequest(
      {
        workKey: pending.workKey,
        entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
        entityId,
        locale: "uk",
        canonicalVersion: version,
        contentRevision: 1,
        trigger: "ADMIN_REBUILD",
        enqueuedAt: pending.enqueuedAt,
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
    assert.equal(outcome.status, "COMPLETED");
    await markPlpAutoBuildWorkCompleted(pending.workKey);
    const done = listPlpAutoBuildWorkForTests().find((r) => r.entityId === entityId)!;
    assert.equal(done.status, "completed");
    assert.equal(done.failureCode, null);
    assert.equal(done.lastError, null);
  });

  it("12: new RSS uses new provider directly; exhausted legacy needs recovery classifier", async () => {
    const article = makeNews("news-fresh-rss");
    await upsertPublicNewsRecords([article]);
    await seedFailedProviderWork({
      article,
      failureCode: "PROVIDER_FAILURE",
      safeReason: "PROVIDER_FAILURE",
    });
    // Collection refresh may one-shot recover media-12 legacy provider failures.
    const rss = await enqueueConsumerVisibleNewsPlpBuilds({
      locales: ["uk"],
      limit: 12,
    });
    assert.equal(rss.PROVIDER_CALLS, 0);
    const afterRss = listPlpAutoBuildWorkForTests().find(
      (r) => r.entityId === mediaPlpPublicNewsEntityId(article.id),
    )!;
    assert.equal(afterRss.status, "pending");
    assert.equal(afterRss.recoveryGeneration, "05E");
    assert.equal(afterRss.attempts, 0);

    // Brand-new article with no prior failure enters without recovery stamp.
    const fresh = makeNews("news-brand-new");
    await upsertPublicNewsRecords([fresh]);
    const enq = await enqueuePlpBuildRequest({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: mediaPlpPublicNewsEntityId(fresh.id),
      locale: "uk",
      canonicalVersion: fingerprintMediaPlpCanonicalVersion(treeFor(fresh)),
      contentRevision: 1,
      trigger: "DYNAMIC_SOURCE_REFRESH",
      canonicalPresentation: treeFor(fresh),
      reopenFailedSameVersion: false,
    });
    assert.equal(enq.accepted, true);
    const freshRow = listPlpAutoBuildWorkForTests().find(
      (r) => r.entityId === mediaPlpPublicNewsEntityId(fresh.id),
    )!;
    assert.equal(freshRow.recoveryGeneration, null);
    assert.equal(freshRow.status, "pending");
  });

  it("13: recovery remains bounded to current /media 12", () => {
    const src = readFileSync(
      join(
        apiRoot,
        "src/modules/language/published-localized-presentation/universal/current-consumer-provider-heal.ts",
      ),
      "utf8",
    );
    assert.match(src, /selectMediaPlpConsumerNewsArticles\(\{\s*limit:\s*12/);
    assert.match(src, /PLP_PROVIDER_CONTRACT_RECOVERY_GENERATION/);
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
