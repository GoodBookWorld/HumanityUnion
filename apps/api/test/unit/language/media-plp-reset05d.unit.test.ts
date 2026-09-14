/**
 * RESET 05D — Media & Country delivery closure (process-level).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  MEDIA_PLP_ENTITY_TYPE,
  mediaPlpPublicNewsEntityId,
  classifyFaqMachineProseLocalization,
  type NewsArticleRecord,
} from "@hu/types";
import { selectCountryPublicNewsRail } from "@hu/media-registry";

import {
  FakeLocalMediaPlpTransport,
  MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
} from "../../../src/modules/language/media-plp-materializer/thin-gemini-transport.js";
import { resetMediaPlpMaterializerCountersForTests } from "../../../src/modules/language/media-plp-materializer/counters.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalPublicNewsPresentation,
  bootstrapPlpAutoBuildRuntime,
  enqueueCivicMediaEditorialPlpBuilds,
  enqueuePlpBuildRequest,
  fingerprintMediaPlpCanonicalVersion,
  listPlpAutoBuildWorkForTests,
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
  setPlpAutoBuildWorkForceMemoryForTests,
  setPlpBuildRequestProcessor,
  setPublishedLocalizationPersistenceModeForTests,
  stopPlpAutoBuildRuntimeForTests,
  upsertPendingPlpAutoBuildWork,
  markPlpAutoBuildWorkFailed,
  ensureMediaPlpAdapterRegistered,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import {
  selectCountryPublicNewsRailArticles,
  selectMediaPlpConsumerNewsArticles,
  selectConsumerVisibleNewsArticlesForAutoBuild,
} from "../../../src/modules/language/media-plp-carousel/media-plp-news-selection.js";
import {
  resetPublicNewsMemoryStoreForTests,
  upsertPublicNewsRecords,
} from "../../../src/modules/public-news/public-news.repository.js";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function makeNews(
  id: string,
  sourceName: string,
  publishedAt: string,
  geographicScope = "global",
): NewsArticleRecord {
  const now = "2030-01-01T00:00:00.000Z";
  return {
    id,
    provider: "test",
    sourceName,
    title: `Title ${id} long enough for localization integrity checks.`,
    summary: `Summary ${id} long enough for localization integrity checks here.`,
    articleUrl: `https://example.com/${id}`,
    normalizedArticleUrl: `https://example.com/${id}`,
    publishedAt,
    fetchedAt: now,
    expiresAt: "2030-12-31T00:00:00.000Z",
    language: "en",
    category: "peace and security",
    geographicScope,
    status: "active",
    verificationStatus: "external-source",
    createdAt: now,
    updatedAt: now,
  };
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

describe("RESET 05D — delivery closure", () => {
  it("1: country selector does not truncate away country-relevant media", async () => {
    await upsertPublicNewsRecords([
      makeNews("g1", "BBC World", "2030-02-01T00:00:00.000Z"),
      makeNews("ca1", "CBC News", "2030-01-01T00:00:00.000Z"),
    ]);
    const rail = await selectCountryPublicNewsRailArticles({
      context: {
        countryCode: "CA",
        countryName: "Canada",
        recommendedMedia: [{ id: "cbc", name: "CBC News" }],
        language: "en",
      },
      limit: 24,
      candidateLimit: 120,
    });
    assert.ok(rail.articles.some((a) => a.id === "ca1"));
    assert.equal(rail.countryRelevantExcludedByCap, 0);
  });

  it("2: PLP auto-build selector includes country-affiliated ids from shared path", async () => {
    await upsertPublicNewsRecords([
      makeNews("m1", "BBC World", "2030-02-10T00:00:00.000Z"),
      makeNews("ca1", "CBC News", "2030-01-01T00:00:00.000Z"),
    ]);
    const media = await selectMediaPlpConsumerNewsArticles({ limit: 12 });
    const auto = await selectConsumerVisibleNewsArticlesForAutoBuild({
      countryContexts: [
        {
          countryCode: "CA",
          countryName: "Canada",
          recommendedMedia: [{ id: "cbc", name: "CBC News" }],
          language: "en",
        },
      ],
    });
    const shared = selectCountryPublicNewsRail(
      auto,
      {
        countryCode: "CA",
        countryName: "Canada",
        recommendedMedia: [{ id: "cbc", name: "CBC News" }],
        language: "en",
      },
      24,
    );
    assert.ok(media.length >= 1);
    assert.ok(auto.some((a) => a.id === "ca1"));
    assert.ok(shared.articles.some((a) => a.id === "ca1"));
  });

  it("4–5: editorial enqueue on current fingerprint; FAQ brand-only is not machine localized", async () => {
    const faq = classifyFaqMachineProseLocalization({
      template: "{siteName} curates sources that meet published selection principles.",
      canonicalTemplate:
        "{siteName} curates sources that meet published selection principles.",
      editorialMode: "CANONICAL_FALLBACK",
    });
    assert.equal(faq.brandOnlyIllusion, true);
    assert.equal(faq.machineLocalized, false);

    const result = await enqueueCivicMediaEditorialPlpBuilds({ locales: ["uk"] });
    assert.ok(result.canonicalVersion.startsWith("v-"));
    const work = listPlpAutoBuildWorkForTests().find(
      (row) => row.entityType === MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
    );
    assert.ok(work);
    assert.equal(work!.status, "pending");
  });

  it("6: brand token protect path keeps structural token for machine hop", async () => {
    const { protectBrandTokensForMachineTranslation, restoreBrandTokensAfterMachineTranslation } =
      await import("@hu/types");
    const protectedText = protectBrandTokensForMachineTranslation(
      "{siteName} recommends organizations.",
    );
    assert.doesNotMatch(protectedText, /\{siteName\}/);
    assert.doesNotMatch(protectedText, /Humanity Union/);
    const restored = restoreBrandTokensAfterMachineTranslation(protectedText);
    assert.match(restored, /\{siteName\}/);
  });

  it("media-12 heal can reopen same-version failed without mass historical reopen", async () => {
    const article = makeNews("heal-1", "BBC World", "2030-02-10T00:00:00.000Z");
    await upsertPublicNewsRecords([article]);
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
    const version = fingerprintMediaPlpCanonicalVersion(tree);
    const upsert = await upsertPendingPlpAutoBuildWork({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: mediaPlpPublicNewsEntityId(article.id),
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      trigger: "CONSUMER_VISIBLE_COLLECTION_REFRESH",
    });
    await markPlpAutoBuildWorkFailed({
      workKey: upsert.record.workKey,
      attempts: 5,
      maxAttempts: 5,
      failure: {
        failureCode: "PROVIDER_TIMEOUT",
        retryable: true,
        stage: "provider",
        safeReason: "PROVIDER_TIMEOUT",
      },
    });

    const blocked = await enqueuePlpBuildRequest({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: mediaPlpPublicNewsEntityId(article.id),
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      trigger: "DYNAMIC_SOURCE_REFRESH",
      canonicalPresentation: tree,
      reopenFailedSameVersion: false,
    });
    assert.equal(blocked.deduped, true);

    const healed = await enqueuePlpBuildRequest({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: mediaPlpPublicNewsEntityId(article.id),
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      trigger: "CONSUMER_VISIBLE_COLLECTION_REFRESH",
      canonicalPresentation: tree,
      reopenFailedSameVersion: true,
    });
    assert.equal(healed.accepted, true);
    const work = listPlpAutoBuildWorkForTests().find(
      (row) => row.entityId === mediaPlpPublicNewsEntityId(article.id),
    );
    assert.equal(work?.status, "pending");
    assert.equal(work?.attempts, 0);
    assert.equal(work?.failureCode, "PROVIDER_TIMEOUT");
  });

  it("10–12: read path provider-free; bootstrap schedules editorial; restart keeps work", async () => {
    const resolveSrc = readFileSync(
      join(
        apiRoot,
        "src/modules/language/published-localized-presentation/resolve-published-presentation.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(resolveSrc, /gemini|thin-gemini|importMediaPlpMaterializerProvider/);

    await bootstrapPlpAutoBuildRuntime();
    const editorial = listPlpAutoBuildWorkForTests().find(
      (row) => row.entityType === MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
    );
    assert.ok(editorial);

    stopPlpAutoBuildRuntimeForTests();
    setPlpBuildRequestProcessor((request) =>
      processPlpBuildRequest(request, {
        importProvider: async () => ({
          provider: new FakeLocalMediaPlpTransport({}),
          PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
        }),
        verifyDurability: async () => ({ ok: true }),
      }),
    );
    assert.ok(
      listPlpAutoBuildWorkForTests().some(
        (row) => row.entityType === MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      ),
    );
  });

  it("script + web country consumer share selector import", () => {
    const webSection = readFileSync(
      join(
        apiRoot,
        "../web/src/features/public-news/components/PublicNewsSection.tsx",
      ),
      "utf8",
    );
    assert.match(webSection, /selectCountryPublicNewsRail/);
    assert.match(webSection, /COUNTRY_PUBLIC_NEWS_CANDIDATE_LIMIT/);
    const selection = readFileSync(
      join(
        apiRoot,
        "src/modules/language/media-plp-carousel/media-plp-news-selection.ts",
      ),
      "utf8",
    );
    assert.match(selection, /selectCountryPublicNewsRail/);
    const script = readFileSync(
      join(apiRoot, "src/scripts/diagnose-media-live-closure.ts"),
      "utf8",
    );
    assert.match(script, /diagnose_media_live_closure|media-live-closure/);
  });
});
