/**
 * RESET 04 — Universal PLP publication contract regressions.
 * No Gemini / live Mongo / materialize / deploy.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  MEDIA_PLP_ENTITY_TYPE,
  PLP_FIELD_AUTHORITY_ORDER,
  PLP_UNIVERSAL_DEFAULT_SCHEMA_VERSION,
  PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
  mediaPlpPublicNewsEntityId,
  protectedTechnical,
} from "@hu/types";

import {
  assertFieldAuthorityOrderDocumented,
  enqueuePlpBuildRequest,
  enqueueConsumerVisibleNewsPlpBuilds,
  ensureMediaPlpAdapterRegistered,
  fixturePlpDomainAdapter,
  FIXTURE_PLP_ENTITY_TYPE,
  getPlpBuildRequestQueueStats,
  getPlpDomainAdapter,
  getPlpSearchSeoInvalidationStatsForTests,
  isPlpBuildStaleAgainstLive,
  listRegisteredPlpEntityTypes,
  machineMayOverwriteExisting,
  mayOverwriteProvenance,
  mediaPlpDomainAdapter,
  notifyMediaCanonicalPublishedForLocalizationBuild,
  MEDIA_LOCALIZATION_BUILD_HOOK_STATUS,
  publishPublishedLocalizedPresentation,
  registerPlpDomainAdapter,
  registerPlpSearchSeoInvalidationListener,
  resetFixturePlpStoreForTests,
  resetMediaPlpAdapterRegistrationForTests,
  resetPlpBuildRequestQueueForTests,
  resetPlpConsumptionCheckersForTests,
  resetPlpDomainAdapterRegistryForTests,
  resetPlpSearchSeoInvalidationForTests,
  resetPublishedLocalizationPersistenceForTests,
  resolveMediaPlpConsumerItem,
  resolvePlpProviderConcurrency,
  runUniversalPlpBuild,
  seedFixturePlpEntityForTests,
  setMediaPlpConsumptionEnabledForTests,
  setPublishedLocalizationPersistenceModeForTests,
  setPlpBuildRequestProcessorForTests,
  PLP_UNIVERSAL_WORKER_SAFETY_DEFAULTS,
  PLP_PUBLICATION_TRIGGER_KINDS,
  createPlpPublicationTrigger,
  dispatchPlpPublicationTrigger,
  asMediaPlpPresentationNode,
  buildCanonicalPublicNewsPresentation,
  fingerprintMediaPlpCanonicalVersion,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import {
  upsertPublicNewsRecords,
  resetPublicNewsMemoryStoreForTests,
} from "../../../src/modules/public-news/public-news.repository.js";
import type { NewsArticleRecord } from "@hu/types";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const plpRoot = join(
  apiRoot,
  "src/modules/language/published-localized-presentation",
);

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "media" || name === "universal") {
        continue;
      }
      out.push(...walkTsFiles(full));
    } else if (name.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

beforeEach(() => {
  process.env.PUBLIC_NEWS_PERSISTENCE = "memory";
  resetPublicNewsMemoryStoreForTests();
  resetPublishedLocalizationPersistenceForTests();
  setPublishedLocalizationPersistenceModeForTests("memory");
  setMediaPlpConsumptionEnabledForTests(true);
  resetPlpDomainAdapterRegistryForTests();
  resetMediaPlpAdapterRegistrationForTests();
  resetPlpConsumptionCheckersForTests();
  resetPlpBuildRequestQueueForTests();
  resetPlpSearchSeoInvalidationForTests();
  resetFixturePlpStoreForTests();
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
  resetFixturePlpStoreForTests();
  setPlpBuildRequestProcessorForTests(null);
  resetPublicNewsMemoryStoreForTests();
});

describe("RESET 04 — Universal PLP publication contract", () => {
  it("1: PLP core (non-media) has no Media domain dependency", () => {
    for (const file of walkTsFiles(plpRoot)) {
      const text = readFileSync(file, "utf8");
      assert.doesNotMatch(text, /PublicNewsCard|media-registry|RSS|@hu\/media-registry/);
      assert.doesNotMatch(text, /mediaPlpPublicNewsEntityId|MEDIA_PLP_ENTITY_TYPE/);
    }
  });

  it("2: Media works through universal adapter contract", () => {
    ensureMediaPlpAdapterRegistered();
    const adapter = getPlpDomainAdapter(MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS);
    assert.ok(adapter);
    assert.equal(adapter!.adapterId, "media_plp");
    assert.equal(adapter!.usesConsumerIdentityAuthority, true);
    assert.deepEqual(
      [...adapter!.supportedEntityTypes].sort(),
      [...mediaPlpDomainAdapter.supportedEntityTypes].sort(),
    );
  });

  it("3: second fixture adapter uses same core without core modification", async () => {
    registerPlpDomainAdapter(fixturePlpDomainAdapter);
    seedFixturePlpEntityForTests({
      entityId: "fx-1",
      title: "Fixture title EN",
      note: "Manual note",
    });
    const contract = await fixturePlpDomainAdapter.resolveCanonicalEntity({
      entityType: FIXTURE_PLP_ENTITY_TYPE,
      entityId: "fx-1",
      locale: "uk",
    });
    assert.ok(contract);
    const built = await runUniversalPlpBuild({
      contract: contract!,
      liveCanonicalVersion: contract!.canonicalVersion,
      layers: [
        {
          source: "MANUAL_APPROVED",
          values: { note: "[uk] Manual note" },
        },
        {
          source: "MACHINE",
          values: { title: "[uk] Fixture title EN" },
        },
      ],
    });
    assert.equal(built.status, "COMPLETED");
    assert.ok(built.snapshotId);
    assert.ok(listRegisteredPlpEntityTypes().includes(FIXTURE_PLP_ENTITY_TYPE));
  });

  it("4: canonical update creates stale/rebuild eligibility", () => {
    assert.equal(
      isPlpBuildStaleAgainstLive({
        buildTargetCanonicalVersion: "v1",
        liveCanonicalVersion: "v2",
      }),
      true,
    );
  });

  it("5: stale build cannot overwrite newer canonical version", async () => {
    registerPlpDomainAdapter(fixturePlpDomainAdapter);
    seedFixturePlpEntityForTests({
      entityId: "fx-stale",
      title: "Title A",
    });
    const contract = await fixturePlpDomainAdapter.resolveCanonicalEntity({
      entityType: FIXTURE_PLP_ENTITY_TYPE,
      entityId: "fx-stale",
      locale: "uk",
    });
    assert.ok(contract);
    const result = await runUniversalPlpBuild({
      contract: { ...contract!, canonicalVersion: "old-version" },
      liveCanonicalVersion: contract!.canonicalVersion,
      layers: [{ source: "MACHINE", values: { title: "[uk] Title A" } }],
    });
    assert.equal(result.status, "FAILED");
    assert.ok(result.reasonCodes.includes("STALE_REVISION"));
    assert.ok(
      result.reasonCodes.some((c) => c.startsWith("STALE_WORK_VERSION=old-version")),
    );
    assert.ok(
      result.reasonCodes.some((c) =>
        c.startsWith(`STALE_CURRENT_SOURCE_VERSION=${contract!.canonicalVersion}`),
      ),
    );
    assert.ok(
      result.reasonCodes.includes("STALE_BOUNDARY=build_pipeline_pre_merge"),
    );
  });

  it("6: Registry locale enablement trigger creates build eligibility", () => {
    const trigger = createPlpPublicationTrigger({
      kind: "REGISTRY_LOCALE_ENABLED",
      entityType: FIXTURE_PLP_ENTITY_TYPE,
      entityId: "fx-1",
      canonicalVersion: "v1",
      contentRevision: 1,
    });
    const n = dispatchPlpPublicationTrigger({
      trigger,
      locales: ["uk", "en", "ar"],
    });
    assert.equal(n, 2);
    assert.equal(getPlpBuildRequestQueueStats().pending, 2);
    assert.ok(PLP_PUBLICATION_TRIGGER_KINDS.includes("REGISTRY_LOCALE_ENABLED"));
  });

  it("7: machine localization cannot overwrite manual/higher-authority", () => {
    assert.equal(
      mayOverwriteProvenance({
        existing: "MANUAL_APPROVED",
        incoming: "MACHINE",
      }),
      false,
    );
    assert.equal(machineMayOverwriteExisting("MANUAL_APPROVED"), false);
    assert.equal(machineMayOverwriteExisting("MACHINE"), true);
    assert.deepEqual(assertFieldAuthorityOrderDocumented()[0], "PROTECTED_CANONICAL");
    assert.ok(PLP_FIELD_AUTHORITY_ORDER.includes("MACHINE_CONTENT"));
  });

  it("8: PARTIAL candidate cannot publish", async () => {
    registerPlpDomainAdapter(fixturePlpDomainAdapter);
    seedFixturePlpEntityForTests({
      entityId: "fx-partial",
      title: "Needs both title and machine path",
    });
    const contract = await fixturePlpDomainAdapter.resolveCanonicalEntity({
      entityType: FIXTURE_PLP_ENTITY_TYPE,
      entityId: "fx-partial",
      locale: "uk",
    });
    assert.ok(contract);
    // Empty machine layer → AUTO title remains canonical → PARTIAL / integrity fail
    const result = await runUniversalPlpBuild({
      contract: contract!,
      liveCanonicalVersion: contract!.canonicalVersion,
      layers: [],
    });
    assert.ok(
      result.status === "REJECTED_PARTIAL" || result.status === "FAILED",
    );
    assert.equal(result.snapshotId, null);
  });

  it("9: read path never calls provider (import + resolve)", async () => {
    const resolveSrc = readFileSync(
      join(plpRoot, "resolve-published-presentation.ts"),
      "utf8",
    );
    assert.doesNotMatch(resolveSrc, /gemini|thin-gemini|TranslationProvider/);
    registerPlpDomainAdapter(fixturePlpDomainAdapter);
    seedFixturePlpEntityForTests({ entityId: "fx-read", title: "EN title" });
    const contract = await fixturePlpDomainAdapter.resolveCanonicalEntity({
      entityType: FIXTURE_PLP_ENTITY_TYPE,
      entityId: "fx-read",
      locale: "uk",
    });
    const resolved = await resolveMediaPlpConsumerItem({
      locale: "uk",
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: "missing-trusted",
      canonicalPresentation: {
        name: protectedTechnical("X"),
        websiteUrl: protectedTechnical("https://example.com"),
        explanation: "EN",
      },
    });
    assert.equal(resolved.mode, "CANONICAL_FALLBACK");
    void contract;
  });

  it("10: missing snapshot → coherent CANONICAL_FALLBACK", async () => {
    ensureMediaPlpAdapterRegistered();
    const article = {
      id: "news-missing",
      title: "EN title",
      summary: "EN summary long enough for integrity checks here.",
      category: "peace and security",
      sourceName: "Reuters",
      articleUrl: "https://example.com/n",
      publishedAt: "2029-01-01T00:00:00.000Z",
      verificationStatus: "external-source" as const,
      geographicScope: "global",
      language: "en",
    };
    const tree = asMediaPlpPresentationNode(
      buildCanonicalPublicNewsPresentation(article),
    );
    const resolved = await resolveMediaPlpConsumerItem({
      locale: "uk",
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: mediaPlpPublicNewsEntityId(article.id),
      canonicalPresentation: tree,
    });
    assert.equal(resolved.mode, "CANONICAL_FALLBACK");
    const titleNode = (resolved.presentation as { title?: { value?: string } | string })
      .title;
    assert.equal(
      typeof titleNode === "string" ? titleNode : titleNode?.value,
      "EN title",
    );
  });

  it("11: dynamic News build inventory accepts no public_news enqueue under original-language policy", async () => {
    const now = "2030-01-01T00:00:00.000Z";
    const expiresAt = "2030-12-31T00:00:00.000Z";
    const records: NewsArticleRecord[] = Array.from({ length: 3 }, (_, i) => ({
      id: `news-c-${i}`,
      provider: "test",
      sourceName: `Source-${i}`,
      title: `Title ${i}`,
      summary: `Summary ${i} long enough for localization.`,
      articleUrl: `https://example.com/c-${i}`,
      normalizedArticleUrl: `https://example.com/c-${i}`,
      publishedAt: `2029-05-0${i + 1}T00:00:00.000Z`,
      fetchedAt: now,
      expiresAt,
      language: "en",
      category: "peace and security",
      geographicScope: "global",
      status: "active" as const,
      verificationStatus: "external-source" as const,
      createdAt: now,
      updatedAt: now,
    }));
    await upsertPublicNewsRecords(records);
    const result = await enqueueConsumerVisibleNewsPlpBuilds({
      locales: ["uk"],
      limit: 12,
    });
    assert.equal(result.PROVIDER_CALLS, 0);
    assert.equal(result.consumerCount, 0);
    assert.equal(result.enqueued, 0);
    assert.ok(
      getPlpDomainAdapter(MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS)
        ?.usesConsumerIdentityAuthority,
    );
  });

  it("12: bounded worker concurrency defaults to 1", () => {
    assert.equal(PLP_UNIVERSAL_WORKER_SAFETY_DEFAULTS.PROVIDER_CONCURRENCY, 1);
    assert.equal(PLP_UNIVERSAL_WORKER_SAFETY_DEFAULTS.ALLOW_PROVIDER_FANOUT, false);
    assert.equal(PLP_UNIVERSAL_WORKER_SAFETY_DEFAULTS.ALLOW_BUILD_ON_READ, false);
    assert.equal(resolvePlpProviderConcurrency(undefined), 1);
    assert.equal(resolvePlpProviderConcurrency("99"), 2);
  });

  it("13: provider/import isolation remains thin for universal core", () => {
    for (const rel of [
      "universal/build-pipeline.ts",
      "universal/build-request-queue.ts",
      "universal/domain-adapter-registry.ts",
      "universal/news-consumer-build-trigger.ts",
    ]) {
      const text = readFileSync(join(plpRoot, rel), "utf8");
      assert.doesNotMatch(
        text,
        /gemini-translation-provider|thin-gemini|language-registry\/index|content-translation-warm-consumer/,
      );
    }
  });

  it("14: publication exposes search/SEO invalidation hooks", async () => {
    registerPlpDomainAdapter(fixturePlpDomainAdapter);
    seedFixturePlpEntityForTests({
      entityId: "fx-seo",
      title: "SEO title EN",
    });
    const contract = await fixturePlpDomainAdapter.resolveCanonicalEntity({
      entityType: FIXTURE_PLP_ENTITY_TYPE,
      entityId: "fx-seo",
      locale: "uk",
    });
    assert.ok(contract);
    let hooked = 0;
    registerPlpSearchSeoInvalidationListener(() => {
      hooked += 1;
    });
    const built = await runUniversalPlpBuild({
      contract: contract!,
      liveCanonicalVersion: contract!.canonicalVersion,
      layers: [
        { source: "MACHINE", values: { title: "[uk] SEO title EN" } },
        { source: "MANUAL_APPROVED", values: { note: "[uk] note" } },
      ],
    });
    assert.equal(built.status, "COMPLETED");
    assert.equal(hooked, 1);
    assert.equal(getPlpSearchSeoInvalidationStatsForTests().count, 1);
  });

  it("15: Media Ukrainian PLP schema remains PLP.2 compatible", () => {
    assert.equal(PLP_UNIVERSAL_DEFAULT_SCHEMA_VERSION, "PLP.2");
    assert.equal(
      PLP_UNIVERSAL_DEFAULT_SCHEMA_VERSION,
      PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
    );
  });

  it("Media publication hook skips public_news; HU-owned Media still enqueues", () => {
    assert.equal(
      MEDIA_LOCALIZATION_BUILD_HOOK_STATUS,
      "QUEUE_ACTIVE_PROVIDER_DORMANT",
    );
    const news = notifyMediaCanonicalPublishedForLocalizationBuild({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: "news-1",
      canonicalVersion: "v1",
      contentRevision: 1,
      locales: ["uk", "en"],
    });
    assert.equal(news, 0);
    assert.equal(getPlpBuildRequestQueueStats().pending, 0);

    const editorial = notifyMediaCanonicalPublishedForLocalizationBuild({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
      entityId: "civic-media-center",
      canonicalVersion: "v1",
      contentRevision: 1,
      locales: ["uk", "en"],
    });
    assert.equal(editorial, 1);
    assert.equal(getPlpBuildRequestQueueStats().pending, 1);
  });

  it("coalesce duplicate build requests", () => {
    enqueuePlpBuildRequest({
      entityType: "fixture_plp_entity",
      entityId: "a",
      locale: "uk",
      canonicalVersion: "v1",
      contentRevision: 1,
      trigger: "ADMIN_REBUILD",
    });
    enqueuePlpBuildRequest({
      entityType: "fixture_plp_entity",
      entityId: "a",
      locale: "uk",
      canonicalVersion: "v2",
      contentRevision: 2,
      trigger: "CANONICAL_CONTENT_UPDATED",
    });
    assert.equal(getPlpBuildRequestQueueStats().pending, 1);
  });

  it("direct atomic publish of machine overlays for public_news title/summary is rejected", async () => {
    const tree = asMediaPlpPresentationNode(
      buildCanonicalPublicNewsPresentation({
        id: "n-direct",
        title: "T",
        summary: "S long enough for integrity checks.",
        category: "peace and security",
        sourceName: "Reuters",
        articleUrl: "https://example.com/d",
        publishedAt: "2029-01-01T00:00:00.000Z",
        verificationStatus: "external-source",
        geographicScope: "global",
        language: "en",
      }),
    );
    const version = fingerprintMediaPlpCanonicalVersion(tree);
    const published = await publishPublishedLocalizedPresentation({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: "n-direct",
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      canonicalPresentation: tree,
      localizedCandidate: {
        ...tree,
        title: "[uk] T",
        summary: "[uk] S long enough for integrity checks.",
      },
      provenance: [
        {
          path: "title",
          source: "MACHINE",
          appliedAt: new Date().toISOString(),
        },
        {
          path: "summary",
          source: "MACHINE",
          appliedAt: new Date().toISOString(),
        },
      ],
    });
    assert.equal(published.ok, false);
  });
});
