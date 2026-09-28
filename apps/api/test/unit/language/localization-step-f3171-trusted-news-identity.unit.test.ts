/**
 * F.3.17.1 — Trusted Media editorial cards and RSS news sources are separate
 * persistence identities. Public news stays source-original.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  LANGUAGE_ACTIVATION_CT_OWNED_KINDS,
  LANGUAGE_ACTIVATION_PLP_OWNED_MEDIA_ENTITY_TYPES,
  MEDIA_PLP_ENTITY_TYPE,
  PUBLIC_NEWS_FIELD_OWNERSHIP,
  PUBLIC_NEWS_MACHINE_CONTENT_PATHS,
  PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
  isAuthoritativeMachineLocalizedPlpEntityType,
  isLocalizationSourceOriginalEntityType,
} from "@hu/types";

import { TRUSTED_MEDIA_RESOURCES } from "../../../src/modules/civic-media-center/content/trusted-media.js";
import { isLanguageActivationWebUiReadyForHistoricalEnqueue } from "../../../src/modules/language/language-localization-activation/language-activation-job.domains.js";
import { discoverMediaPlpCarouselStaticEntities } from "../../../src/modules/language/media-plp-carousel/discover-entities.js";
import { loadMediaPlpPreflightSource } from "../../../src/modules/language/media-plp-preflight/source-lookup.js";
import { resolveMediaPlpMaterializerSource } from "../../../src/modules/language/media-plp-materializer/source-resolve.js";
import {
  evaluateLocalizationContentIntegrity,
  LOCALIZATION_CONTENT_INTEGRITY_VERSION,
} from "../../../src/modules/language/published-localized-presentation/content-integrity.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalTrustedPresentation,
  fingerprintMediaPlpCanonicalVersion,
} from "../../../src/modules/language/published-localized-presentation/media/canonical-trees.js";
import { loadMediaPlpLiveCanonicalSource } from "../../../src/modules/language/published-localized-presentation/media/live-source.js";
import { resolveTrustedMediaEditorialCanonical } from "../../../src/modules/language/published-localized-presentation/media/trusted-editorial-source.js";
import {
  evaluateLocalizationStructuralIntegrity,
  LOCALIZATION_STRUCTURAL_INTEGRITY_VERSION,
} from "../../../src/modules/language/published-localized-presentation/structural-integrity.js";
import { MEDIA_PLP_PUBLIC_NEWS_FIELD_POLICY, MEDIA_PLP_TRUSTED_FIELD_POLICY } from "../../../src/modules/language/published-localized-presentation/universal/adapters/media-plp-field-policies.js";
import { isPlpBuildStaleAgainstLive } from "../../../src/modules/language/published-localized-presentation/universal/build-request-stale.js";
import { enqueueConsumerVisibleNewsPlpBuilds } from "../../../src/modules/language/published-localized-presentation/universal/news-consumer-build-trigger.js";
import { classifyUsableLocalizedPresentation } from "../../../src/modules/language/published-localized-presentation/usability.js";
import { buildMediaResourceSeedRecords } from "../../../src/modules/media-resources/media-resource.seed.js";
import {
  listPublicCountryTrustedMedia,
  listPublicWorldTrustedMedia,
  listProjectedActiveApprovedNewsSources,
  resetMediaResourceSeedStateForTests,
} from "../../../src/modules/media-resources/media-resource.service.js";
import { resetMediaResourcesMemoryForTests } from "../../../src/modules/media-resources/persistence/media-resource.memory.store.js";
import {
  deleteMediaResource,
  getMediaResourceByIdentity,
  listMediaResources,
  setMediaResourceForceMemoryForTests,
  upsertMediaResource,
} from "../../../src/modules/media-resources/persistence/media-resource.repository.js";
import { resetApprovedNewsSourcesCacheForTests } from "../../../src/modules/public-news/public-news.config.js";

const EMPTY_NEWS_AUTO_VERSION = "v-4f53cda18c2baa0c";

const STORED_UK_TRUSTED_VERSIONS = {
  suspilne: "v-77bb3617833e2139",
  "european-pravda": "v-4deed8b488f378f4",
  "kyiv-independent": "v-fe7f5854855aad08",
} as const;

function installMemory(): void {
  setMediaResourceForceMemoryForTests(true);
  resetMediaResourcesMemoryForTests();
  resetMediaResourceSeedStateForTests();
  resetApprovedNewsSourcesCacheForTests();
}

beforeEach(() => {
  installMemory();
});

afterEach(() => {
  resetMediaResourceSeedStateForTests();
  resetApprovedNewsSourcesCacheForTests();
  resetMediaResourcesMemoryForTests();
  setMediaResourceForceMemoryForTests(false);
});

describe("F.3.17.1 trusted media and news source identity", () => {
  it("persists overlapping TRUSTED_MEDIA and NEWS_SOURCE rows without replacement", async () => {
    const { seedMediaResourcesFromCanonicalSources } = await import(
      "../../../src/modules/media-resources/media-resource.seed.js"
    );
    await seedMediaResourcesFromCanonicalSources();
    const first = await listMediaResources();

    const seeds = buildMediaResourceSeedRecords();
    const trustedIds = new Set(
      seeds.filter((seed) => seed.resourceType === "TRUSTED_MEDIA").map((seed) => seed.id),
    );
    const overlapping = seeds.filter(
      (seed) => seed.resourceType === "NEWS_SOURCE" && trustedIds.has(seed.id),
    );
    assert.ok(overlapping.length > 0);

    for (const newsSeed of overlapping) {
      const trusted = await getMediaResourceByIdentity({
        resourceType: "TRUSTED_MEDIA",
        id: newsSeed.id,
      });
      const news = await getMediaResourceByIdentity({
        resourceType: "NEWS_SOURCE",
        id: newsSeed.id,
      });
      assert.ok(trusted, newsSeed.id);
      assert.ok(news, newsSeed.id);
      assert.equal(trusted.resourceType, "TRUSTED_MEDIA");
      assert.equal(news.resourceType, "NEWS_SOURCE");
      assert.ok(trusted.description && trusted.description.trim().length > 0);
      assert.equal(news.description ?? null, null);
      assert.ok(news.rssUrl);
      assert.equal(news.providerId, newsSeed.id);
    }

    const createdAt = (
      await getMediaResourceByIdentity({ resourceType: "TRUSTED_MEDIA", id: "cbc" })
    )?.createdAt;
    resetMediaResourceSeedStateForTests();
    await seedMediaResourcesFromCanonicalSources();
    const second = await listMediaResources();
    assert.equal(second.length, first.length);
    assert.equal(
      (await getMediaResourceByIdentity({ resourceType: "TRUSTED_MEDIA", id: "cbc" }))
        ?.createdAt,
      createdAt,
    );
    assert.equal(
      second.filter((row) => row.id === "cbc" && row.resourceType === "TRUSTED_MEDIA").length,
      1,
    );
    assert.equal(
      second.filter((row) => row.id === "cbc" && row.resourceType === "NEWS_SOURCE").length,
      1,
    );

    const removed = await deleteMediaResource({
      resourceType: "TRUSTED_MEDIA",
      id: "cbc",
    });
    assert.equal(removed, true);
    assert.equal(
      await getMediaResourceByIdentity({ resourceType: "TRUSTED_MEDIA", id: "cbc" }),
      null,
    );
    assert.equal(
      (await getMediaResourceByIdentity({ resourceType: "NEWS_SOURCE", id: "cbc" }))
        ?.resourceType,
      "NEWS_SOURCE",
    );
  });

  it("resolves civic_media_trusted from the editorial explanation, never the news row", async () => {
    await upsertMediaResource({
      id: "deutsche-welle",
      resourceType: "NEWS_SOURCE",
      scopeType: "COUNTRY",
      countryCode: "DE",
      name: "DW",
      logoLabel: "DW",
      websiteUrl: "https://www.dw.com/en/",
      rssUrl: "https://rss.dw.com/xml/rss-en-world",
      description: null,
      language: "en",
      providerId: "deutsche-welle",
      active: true,
      sortOrder: 1,
      createdAt: "2026-09-28T00:00:00.000Z",
      updatedAt: "2026-09-28T00:00:00.000Z",
    });

    const beforeTrustedRow = await resolveTrustedMediaEditorialCanonical("deutsche-welle");
    const catalog = TRUSTED_MEDIA_RESOURCES.find((resource) => resource.id === "deutsche-welle");
    assert.ok(catalog);
    assert.equal(beforeTrustedRow.authority, "trusted_media_catalog");
    assert.equal(beforeTrustedRow.resource?.name, catalog.name);
    assert.equal(beforeTrustedRow.resource?.explanation, catalog.explanation);
    assert.notEqual(beforeTrustedRow.resource?.name, "DW");
    assert.notEqual(beforeTrustedRow.canonicalVersion, EMPTY_NEWS_AUTO_VERSION);

    const emptyTree = asMediaPlpPresentationNode(
      buildCanonicalTrustedPresentation({ ...catalog, explanation: "" }),
    );
    assert.equal(fingerprintMediaPlpCanonicalVersion(emptyTree), EMPTY_NEWS_AUTO_VERSION);

    const { seedMediaResourcesFromCanonicalSources } = await import(
      "../../../src/modules/media-resources/media-resource.seed.js"
    );
    await seedMediaResourcesFromCanonicalSources();

    const editorial = await resolveTrustedMediaEditorialCanonical("deutsche-welle");
    const live = await loadMediaPlpLiveCanonicalSource({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: "deutsche-welle",
    });
    const claim = await resolveMediaPlpMaterializerSource({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: "deutsche-welle",
      locale: "en",
    });
    const preflight = await loadMediaPlpPreflightSource({
      entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
      entityId: "deutsche-welle",
      locale: "en",
    });

    assert.equal(editorial.authority, "trusted_media_row");
    assert.equal(editorial.resource?.explanation, catalog.explanation);
    assert.equal(editorial.canonicalVersion, "v-f3eb08309d4f6b56");
    assert.equal(live.CANONICAL_VERSION, editorial.canonicalVersion);
    assert.equal(claim.CANONICAL_VERSION, editorial.canonicalVersion);
    assert.equal(preflight.CANONICAL_VERSION, editorial.canonicalVersion);
    assert.equal(claim.identityCollision, false);
    assert.equal(preflight.identityCollision, false);
    assert.deepEqual(
      claim.autoPaths.map((path) => path.path),
      ["explanation"],
    );
    assert.equal(claim.autoPaths[0]?.value, catalog.explanation);
    assert.equal(
      isPlpBuildStaleAgainstLive({
        buildTargetCanonicalVersion: editorial.canonicalVersion!,
        liveCanonicalVersion: live.CANONICAL_VERSION!,
      }),
      false,
    );
    assert.equal(
      isPlpBuildStaleAgainstLive({
        buildTargetCanonicalVersion: editorial.canonicalVersion!,
        liveCanonicalVersion: EMPTY_NEWS_AUTO_VERSION,
      }),
      true,
    );

    const news = await getMediaResourceByIdentity({
      resourceType: "NEWS_SOURCE",
      id: "deutsche-welle",
    });
    assert.equal(news?.resourceType, "NEWS_SOURCE");
    assert.equal(news?.name, "DW");
    assert.equal(news?.rssUrl, "https://rss.dw.com/xml/rss-en-world");
    assert.notEqual(news?.description, catalog.explanation);
  });

  it("keeps stored Ukrainian trusted snapshots current against the editorial fingerprint", async () => {
    const { seedMediaResourcesFromCanonicalSources } = await import(
      "../../../src/modules/media-resources/media-resource.seed.js"
    );
    await seedMediaResourcesFromCanonicalSources();

    for (const [entityId, storedVersion] of Object.entries(STORED_UK_TRUSTED_VERSIONS)) {
      const editorial = await resolveTrustedMediaEditorialCanonical(entityId);
      assert.equal(editorial.canonicalVersion, storedVersion);
      assert.notEqual(editorial.canonicalVersion, EMPTY_NEWS_AUTO_VERSION);
      const canonical = editorial.canonicalPresentation;
      assert.ok(canonical && typeof canonical === "object" && !Array.isArray(canonical));
      const localized = {
        ...(canonical as Record<string, unknown>),
        explanation: `${editorial.resource?.explanation ?? ""} — localized`,
      };
      const content = evaluateLocalizationContentIntegrity({
        locale: "uk",
        canonicalPresentation: canonical,
        localizedPresentation: localized,
        fieldPolicy: MEDIA_PLP_TRUSTED_FIELD_POLICY,
      });
      const structural = evaluateLocalizationStructuralIntegrity({
        locale: "uk",
        canonicalPresentation: canonical,
        localizedPresentation: localized,
        fieldPolicy: MEDIA_PLP_TRUSTED_FIELD_POLICY,
      });
      assert.equal(content.status, "PASSED");
      assert.equal(structural.status, "PASSED");
      const current = classifyUsableLocalizedPresentation({
        locale: "uk",
        liveCanonicalVersion: editorial.canonicalVersion,
        liveLocalizationSchemaVersion: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
        canonicalPresentation: canonical,
        snapshot: {
          state: "PUBLISHED",
          identity: {
            entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
            entityId,
            locale: "uk",
            canonicalVersion: storedVersion,
            localizationSchemaVersion: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
          },
          presentation: localized,
          contentIntegrity: {
            ...content,
            version: LOCALIZATION_CONTENT_INTEGRITY_VERSION,
          },
          structuralIntegrity: {
            ...structural,
            version: LOCALIZATION_STRUCTURAL_INTEGRITY_VERSION,
          },
        },
      });
      assert.equal(current.allowPublishedLocalized, true);
      assert.equal(current.rebuildRequired, false);

      const collided = classifyUsableLocalizedPresentation({
        locale: "uk",
        liveCanonicalVersion: EMPTY_NEWS_AUTO_VERSION,
        canonicalPresentation: canonical,
        snapshot: {
          state: "PUBLISHED",
          identity: {
            entityType: MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
            entityId,
            locale: "uk",
            canonicalVersion: storedVersion,
            localizationSchemaVersion: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
          },
          presentation: localized,
          contentIntegrity: content,
          structuralIntegrity: structural,
        },
      });
      assert.equal(collided.allowPublishedLocalized, false);
      assert.equal(collided.reason, "CANONICAL_VERSION_MISMATCH");
    }
  });

  it("selects TRUSTED_MEDIA for public trusted rails and keeps RSS source-original", async () => {
    const world = await listPublicWorldTrustedMedia();
    const germany = await listPublicCountryTrustedMedia("DE");
    const canada = await listPublicCountryTrustedMedia("CA");
    const news = await listProjectedActiveApprovedNewsSources();

    assert.ok(world.some((resource) => resource.id === "the-guardian"));
    assert.equal(
      world.some((resource) => resource.id === "cbc"),
      false,
    );
    const dw = germany.find((resource) => resource.id === "deutsche-welle");
    const cbc = canada.find((resource) => resource.id === "cbc");
    assert.ok(dw?.explanation);
    assert.ok(cbc?.explanation);
    assert.equal(
      dw?.explanation,
      TRUSTED_MEDIA_RESOURCES.find((resource) => resource.id === "deutsche-welle")?.explanation,
    );

    const dwNews = news.find((source) => source.providerId === "deutsche-welle");
    assert.ok(dwNews);
    assert.equal(dwNews.sourceName, "DW");
    assert.equal(dwNews.rssFeedUrl, "https://rss.dw.com/xml/rss-en-world");
    assert.equal("explanation" in dwNews, false);
    assert.equal("title" in dwNews, false);

    const coverage = discoverMediaPlpCarouselStaticEntities().filter(
      (entity) => entity.entityId === "deutsche-welle",
    );
    assert.equal(coverage.length, 1);
    assert.equal(coverage[0]?.entityType, MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED);
    assert.equal(coverage[0]?.surface, "media_trusted");

    assert.equal(
      (LANGUAGE_ACTIVATION_CT_OWNED_KINDS as readonly string[]).includes("public_news"),
      false,
    );
    assert.equal(
      (LANGUAGE_ACTIVATION_PLP_OWNED_MEDIA_ENTITY_TYPES as readonly string[]).includes(
        "public_news",
      ),
      false,
    );
    assert.equal(isLocalizationSourceOriginalEntityType("public_news"), true);
    assert.equal(isAuthoritativeMachineLocalizedPlpEntityType("public_news"), false);
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.title, "SOURCE_ORIGINAL");
    assert.equal(PUBLIC_NEWS_FIELD_OWNERSHIP.summary, "SOURCE_ORIGINAL");
    assert.deepEqual([...PUBLIC_NEWS_MACHINE_CONTENT_PATHS], []);
    assert.equal(
      Object.values(MEDIA_PLP_PUBLIC_NEWS_FIELD_POLICY).includes("MACHINE_CONTENT"),
      false,
    );
    assert.equal(MEDIA_PLP_TRUSTED_FIELD_POLICY.explanation, "MACHINE_CONTENT");
    assert.equal("title" in MEDIA_PLP_TRUSTED_FIELD_POLICY, false);

    const newsEnqueue = await enqueueConsumerVisibleNewsPlpBuilds({ locales: ["uk", "zh-Hant"] });
    assert.equal(newsEnqueue.enqueued, 0);
    assert.equal(newsEnqueue.consumerCount, 0);
    assert.equal(newsEnqueue.PROVIDER_CALLS, 0);
  });

  it("keeps Gate 15D.9.1 closed until WEB_UI is ready", () => {
    const blocked = isLanguageActivationWebUiReadyForHistoricalEnqueue({
      webUi: {
        status: "in_progress",
        dataReady: false,
        missingKeyCount: 1,
        emptyKeyCount: 0,
        requiredKeyCount: 1,
        effectiveSource: null,
        detail: null,
        preparationPhase: "primary",
        checkpointId: "lang-act-zh-hant-6-1678980a",
        sourceHash: null,
        totalBatches: 702,
        completedBatches: 495,
        totalLeaves: 0,
        completedLeaves: 0,
        providerFailure: false,
      },
      publicWebUiDataReady: false,
      participantWebUiDataReady: false,
    });
    assert.equal(blocked, false);

    const ready = isLanguageActivationWebUiReadyForHistoricalEnqueue({
      webUi: {
        status: "ready",
        dataReady: true,
        missingKeyCount: 0,
        emptyKeyCount: 0,
        requiredKeyCount: 1,
        effectiveSource: "remote",
        detail: null,
        preparationPhase: "ready",
        checkpointId: null,
        sourceHash: null,
        totalBatches: 1,
        completedBatches: 1,
        totalLeaves: 1,
        completedLeaves: 1,
        providerFailure: false,
      },
      publicWebUiDataReady: true,
      participantWebUiDataReady: true,
    });
    assert.equal(ready, true);
  });
});
