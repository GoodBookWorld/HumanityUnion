/**
 * RESET 05D.4 — provider boundary Brand transport + PARTIAL retry taxonomy.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  BRAND_SITE_NAME_MACHINE_SENTINEL,
  BRAND_SITE_NAME_MACHINE_SENTINEL_LEGACY,
  BRAND_SITE_NAME_TOKEN,
  MEDIA_PLP_ENTITY_TYPE,
  MEDIA_PLP_EDITORIAL_ENTITY_ID,
  mediaPlpEditorialEntityId,
  mediaPlpPublicNewsEntityId,
  protectBrandTokensForMachineTranslation,
  restoreBrandTokensAfterMachineTranslation,
  classifyBrandTokenPathTransport,
} from "@hu/types";

import {
  FakeLocalMediaPlpTransport,
  MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
  callMediaPlpMaterializerProviderOnce,
  validateMediaPlpProviderLocalizationValues,
  buildProviderMachinePathDiagnostics,
} from "../../../src/modules/language/media-plp-materializer/index.js";
import { resetMediaPlpMaterializerCountersForTests } from "../../../src/modules/language/media-plp-materializer/counters.js";
import {
  CIVIC_MEDIA_FAQ,
  CIVIC_MEDIA_OVERVIEW,
} from "../../../src/modules/civic-media-center/content/sections.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalEditorialPresentation,
  buildCanonicalPublicNewsPresentation,
  fingerprintMediaPlpCanonicalVersion,
} from "../../../src/modules/language/published-localized-presentation/media/canonical-trees.js";
import { collectAutoPaths } from "../../../src/modules/language/published-localized-presentation/presentation-paths.js";
import {
  ensureMediaPlpAdapterRegistered,
  isCollectedPathMachineEligible,
  mapProviderBoundaryReasonToFailure,
  markPlpAutoBuildWorkCompleted,
  markPlpAutoBuildWorkFailed,
  processPlpBuildRequest,
  resolveFieldPolicyForEntityType,
  resetMediaPlpAdapterRegistrationForTests,
  resetPlpDomainAdapterRegistryForTests,
  resetPublishedLocalizationPersistenceForTests,
  setPublishedLocalizationPersistenceModeForTests,
  setPlpAutoBuildWorkForceMemoryForTests,
  resetPlpAutoBuildWorkStoreForTests,
  listPlpAutoBuildWorkForTests,
  enqueuePlpBuildRequest,
  findCurrentPublishedPresentation,
  kickPlpAutoBuildDrain,
  setPlpBuildRequestProcessor,
  resetPlpBuildRequestQueueForTests,
  upsertPendingPlpAutoBuildWork,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import {
  resetPublicNewsMemoryStoreForTests,
  upsertPublicNewsRecords,
} from "../../../src/modules/public-news/public-news.repository.js";
import type { NewsArticleRecord } from "@hu/types";

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
    publishedAt: "2030-01-01T00:00:00.000Z",
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
  setPlpAutoBuildWorkForceMemoryForTests(true);
  resetPlpAutoBuildWorkStoreForTests();
  resetPlpBuildRequestQueueForTests();
  resetPublishedLocalizationPersistenceForTests();
  setPublishedLocalizationPersistenceModeForTests("memory");
  resetPublicNewsMemoryStoreForTests();
  resetPlpDomainAdapterRegistryForTests();
  resetMediaPlpAdapterRegistrationForTests();
  resetMediaPlpMaterializerCountersForTests();
  ensureMediaPlpAdapterRegistered();
});

afterEach(() => {
  resetPlpBuildRequestQueueForTests();
  resetPlpAutoBuildWorkStoreForTests();
  setPlpAutoBuildWorkForceMemoryForTests(false);
  resetPublishedLocalizationPersistenceForTests();
  resetPublicNewsMemoryStoreForTests();
});

describe("RESET 05D.4 — provider boundary closure", () => {
  it("1–4: ASCII Brand sentinel survives protect→translate→restore; presentation keeps {siteName}", async () => {
    const source =
      "{siteName} curates sources that meet published selection principles.";
    const protectedText = protectBrandTokensForMachineTranslation(source);
    assert.equal(protectedText.includes(BRAND_SITE_NAME_TOKEN), false);
    assert.match(protectedText, new RegExp(BRAND_SITE_NAME_MACHINE_SENTINEL));
    assert.doesNotMatch(protectedText, /⟦/);

    resetMediaPlpMaterializerCountersForTests();
    const provider = new FakeLocalMediaPlpTransport({});
    const result = await callMediaPlpMaterializerProviderOnce({
      provider,
      locale: "uk",
      autoValues: { "faq[0].answer": source },
      sourceRecordId: "civic_media_editorial:civic-media-center",
      sourceVersion: "v-test",
      PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const out = result.values["faq[0].answer"]!;
    assert.match(out, /\{siteName\}/);
    assert.match(out, /\[uk\]/);
    assert.doesNotMatch(out, /__HU_BRAND_SITE_NAME__/);
    assert.doesNotMatch(out, /Humanity Union/);
    const report = classifyBrandTokenPathTransport({
      path: "faq[0].answer",
      canonicalSource: source,
      restoredTranslated: out,
    });
    assert.equal(report?.TOKEN_STATE, "PRESERVED");
  });

  it("5: missing/altered Brand placeholder fails closed", () => {
    const lost = validateMediaPlpProviderLocalizationValues({
      locale: "uk",
      autoValues: { "faq[0].answer": "{siteName} curates sources." },
      translated: { "faq[0].answer": "Союз Людяності відбирає джерела." },
    });
    assert.equal(lost.ok, false);
    if (!lost.ok) {
      assert.equal(lost.reason, "BRAND_TOKEN_PRESERVATION_FAILED");
      assert.ok(
        lost.pathDiagnostics.BRAND_TOKEN_PATH_STATES.some(
          (r) => r.TOKEN_STATE !== "PRESERVED",
        ),
      );
    }
  });

  it("legacy Unicode sentinel still restores to {siteName}", () => {
    const restored = restoreBrandTokensAfterMachineTranslation(
      `Чи ${BRAND_SITE_NAME_MACHINE_SENTINEL_LEGACY} перевіряє?`,
    );
    assert.match(restored, /\{siteName\}/);
  });

  it("6–7: public_news expected paths from ownership; PARTIAL reports missing paths", () => {
    const tree = asMediaPlpPresentationNode(
      buildCanonicalPublicNewsPresentation({
        id: "news-524c08bdec9253ae24ed",
        title: "Title EN",
        summary: "Summary EN",
        category: "peace and security",
        sourceName: "BBC World",
        articleUrl: "https://example.com/a",
        publishedAt: "2030-01-01T00:00:00.000Z",
        verificationStatus: "unverified",
        language: "en",
      }),
    );
    const policy = resolveFieldPolicyForEntityType(
      MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
    );
    const expected = collectAutoPaths(tree)
      .filter((n) => isCollectedPathMachineEligible(n.path, policy))
      .map((n) => n.path)
      .sort();
    assert.deepEqual(expected, ["summary", "title"]);

    const diag = buildProviderMachinePathDiagnostics({
      autoValues: { title: "Title EN", summary: "Summary EN" },
      translated: { title: "[uk] Title EN" },
    });
    assert.deepEqual(diag.MISSING_MACHINE_PATHS, ["summary"]);
    assert.deepEqual(diag.EXPECTED_MACHINE_PATHS, ["summary", "title"]);

    const partial = validateMediaPlpProviderLocalizationValues({
      locale: "uk",
      autoValues: { title: "Title EN", summary: "Summary EN" },
      translated: { title: "[uk] Title EN" },
    });
    assert.equal(partial.ok, false);
    if (!partial.ok) {
      assert.equal(partial.reason, "PARTIAL");
      assert.deepEqual(partial.pathDiagnostics.MISSING_MACHINE_PATHS, ["summary"]);
    }
  });

  it("8–10: retryable PARTIAL requeues; integrity remains terminal; success publishes", async () => {
    const partialFailure = mapProviderBoundaryReasonToFailure({
      reason: "PARTIAL",
      message:
        "PARTIAL:MISSING_PATH;PROVIDER_PARTIAL_SUBREASON=MISSING_PATH;MISSING_MACHINE_PATHS=summary;EXPECTED_MACHINE_PATHS=summary|title;PATH_STATES=title:1:1:1:1:1|summary:0:0:0:0:0",
    });
    assert.equal(partialFailure.failureCode, "PROVIDER_PARTIAL");
    assert.equal(partialFailure.retryable, true);
    assert.match(partialFailure.safeReason, /PROVIDER_PARTIAL_SUBREASON=MISSING_PATH/);
    assert.match(partialFailure.safeReason, /MISSING_MACHINE_PATHS=summary/);

    const integrity = mapProviderBoundaryReasonToFailure({
      reason: "LOCALIZATION_CONTENT_INTEGRITY_FAILED",
      message: "identical",
    });
    assert.equal(integrity.retryable, false);

    const brand = mapProviderBoundaryReasonToFailure({
      reason: "BRAND_TOKEN_PRESERVATION_FAILED",
      message: "BRAND_TOKEN_PATHS=faq[0].answer:MISSING",
    });
    assert.equal(brand.retryable, false);

    const article = makeNews("news-524c08bdec9253ae24ed");
    await upsertPublicNewsRecords([article]);
    const entityId = mediaPlpPublicNewsEntityId(article.id);
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
      entityId,
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      trigger: "ADMIN_REBUILD",
    });
    const requeued = await markPlpAutoBuildWorkFailed({
      workKey: upsert.record.workKey,
      attempts: 1,
      maxAttempts: 5,
      failure: partialFailure,
    });
    assert.equal(requeued.requeued, true);
    const after = listPlpAutoBuildWorkForTests().find((r) => r.entityId === entityId)!;
    assert.equal(after.status, "pending");
    assert.equal(after.failureCode, "PROVIDER_PARTIAL");

    setPlpBuildRequestProcessor((request) =>
      processPlpBuildRequest(request, {
        importProvider: async () => ({
          provider: new FakeLocalMediaPlpTransport({}),
          PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
        }),
        verifyDurability: async () => ({ ok: true }),
      }),
    );
    kickPlpAutoBuildDrain();
    for (let i = 0; i < 80; i += 1) {
      const row = listPlpAutoBuildWorkForTests().find((r) => r.entityId === entityId);
      if (row?.status === "completed" || row?.status === "failed") break;
      await new Promise((r) => setTimeout(r, 25));
    }
    const done = listPlpAutoBuildWorkForTests().find((r) => r.entityId === entityId)!;
    assert.equal(done.status, "completed", done.lastError ?? "");
    assert.equal(done.failureCode, null);
    assert.equal(done.lastError, null);
    const snapshot = await findCurrentPublishedPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId,
      locale: "uk",
    });
    assert.ok(snapshot);
  });

  it("11: completed work clears current failure metadata", async () => {
    await enqueuePlpBuildRequest({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: mediaPlpEditorialEntityId(MEDIA_PLP_EDITORIAL_ENTITY_ID),
      locale: "uk",
      canonicalVersion: "v-test",
      contentRevision: 1,
      trigger: "ADMIN_REBUILD",
    });
    const work = listPlpAutoBuildWorkForTests()[0]!;
    await markPlpAutoBuildWorkFailed({
      workKey: work.workKey,
      attempts: 5,
      maxAttempts: 5,
      failure: mapProviderBoundaryReasonToFailure({
        reason: "PROVIDER_FAILURE",
        message: "boom",
      }),
    });
    await markPlpAutoBuildWorkCompleted(work.workKey);
    const cleared = listPlpAutoBuildWorkForTests()[0]!;
    assert.equal(cleared.status, "completed");
    assert.equal(cleared.failureCode, null);
    assert.equal(cleared.failureStage, null);
    assert.equal(cleared.lastError, null);
    assert.equal(cleared.retryable, null);
  });

  it("12–14: editorial Brand fields round-trip; ownership inventory unchanged; diagnostic stays read-only", async () => {
    const tree = asMediaPlpPresentationNode(
      buildCanonicalEditorialPresentation({
        overview: CIVIC_MEDIA_OVERVIEW,
        faq: [...CIVIC_MEDIA_FAQ],
      }),
    );
    const policy = resolveFieldPolicyForEntityType(
      MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
    );
    const autoValues: Record<string, string> = {};
    for (const node of collectAutoPaths(tree)) {
      if (isCollectedPathMachineEligible(node.path, policy)) {
        autoValues[node.path] = node.value;
      }
    }
    assert.ok(Object.keys(autoValues).length === 18);
    const brandPaths = Object.entries(autoValues).filter(([, v]) =>
      v.includes(BRAND_SITE_NAME_TOKEN),
    );
    assert.ok(brandPaths.length >= 4);

    resetMediaPlpMaterializerCountersForTests();
    const result = await callMediaPlpMaterializerProviderOnce({
      provider: new FakeLocalMediaPlpTransport({}),
      locale: "uk",
      autoValues,
      sourceRecordId: "civic_media_editorial:civic-media-center",
      sourceVersion: fingerprintMediaPlpCanonicalVersion(tree),
      PROVIDER_TRANSPORT: MEDIA_PLP_FAKE_LOCAL_TRANSPORT_ID,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    for (const [path] of brandPaths) {
      assert.match(result.values[path]!, /\{siteName\}/);
      assert.equal(
        classifyBrandTokenPathTransport({
          path,
          canonicalSource: autoValues[path]!,
          restoredTranslated: result.values[path]!,
        })?.TOKEN_STATE,
        "PRESERVED",
      );
    }

    const { readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
    const diag = readFileSync(
      join(
        apiRoot,
        "src/modules/language/media-plp-carousel/media-live-closure-diagnostic.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(diag, /callMediaPlpMaterializerProviderOnce|enqueuePlpBuildRequest/);
    assert.match(diag, /EXPECTED_MACHINE_PATHS/);
    assert.match(diag, /BRAND_TOKEN_PATHS/);
  });
});
