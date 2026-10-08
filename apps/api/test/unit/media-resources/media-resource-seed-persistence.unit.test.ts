/**
 * Stage B — catalog seeding is insert-only, and hard delete leaves a
 * (resourceType, id) tombstone that survives the next startup seed.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { AdministrationForbiddenError } from "../../../src/modules/administration/administration.errors.js";
import { TRUSTED_MEDIA_RESOURCES } from "../../../src/modules/civic-media-center/content/trusted-media.js";
import { FACT_CHECK_RESOURCES } from "../../../src/modules/civic-media-center/content/fact-checking.js";
import {
  discoverCivicMediaTranslationRecordIds,
  loadCivicMediaTranslationSource,
} from "../../../src/modules/language/content-translation-civic-loaders.js";
import {
  listContentTranslationWarmMemoryPendingForTests,
  resetContentTranslationWarmMemoryForTests,
  setContentTranslationWarmForceMemoryForTests,
} from "../../../src/modules/language/content-translation-warm-enqueue.js";
import { discoverMediaPlpCarouselStaticEntities } from "../../../src/modules/language/media-plp-carousel/discover-entities.js";
import {
  resetLocalizationReconciliationDriverForTests,
  setLocalizationReconciliationDriverDepsForTests,
} from "../../../src/modules/language/localization-reconciliation-driver.js";
import {
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/language-registry/language-registry.repository.js";
import {
  listPlpAutoBuildWorkForTests,
  resetPlpAutoBuildWorkStoreForTests,
  setPlpAutoBuildWorkForceMemoryForTests,
} from "../../../src/modules/language/published-localized-presentation/universal/plp-auto-build-work.repository.js";
import { MediaResourceForbiddenDeleteError } from "../../../src/modules/media-resources/media-resource.errors.js";
import {
  buildMediaResourceSeedRecords,
  seedMediaResourcesFromCanonicalSources,
} from "../../../src/modules/media-resources/media-resource.seed.js";
import {
  deactivateAdminMediaResource,
  deleteAdminMediaResource,
  ensureMediaResourcesSeededOnce,
  listPublicWorldFactChecking,
  listPublicWorldTrustedMedia,
  resetMediaResourceSeedStateForTests,
  setMediaResourceAdminAssertOverrideForTests,
  updateAdminMediaResource,
} from "../../../src/modules/media-resources/media-resource.service.js";
import { getMediaResourceTombstone } from "../../../src/modules/media-resources/persistence/media-resource-tombstone.repository.js";
import { resetMediaResourcesMemoryForTests } from "../../../src/modules/media-resources/persistence/media-resource.memory.store.js";
import {
  getMediaResourceByIdentity,
  listMediaResources,
  setMediaResourceForceMemoryForTests,
} from "../../../src/modules/media-resources/persistence/media-resource.repository.js";
import { resetApprovedNewsSourcesCacheForTests } from "../../../src/modules/public-news/public-news.config.js";

const apiSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../src");

function read(relativePath: string): string {
  return readFileSync(path.join(apiSrc, relativePath), "utf8");
}

function installAdmin(): void {
  setMediaResourceAdminAssertOverrideForTests(async (userId) => {
    if (userId === "editor-1") {
      throw new AdministrationForbiddenError("Administrator access is required.");
    }
    return { userId, memberId: `member-${userId}` };
  });
}

function civicWarmCount(): number {
  return listContentTranslationWarmMemoryPendingForTests().filter(
    (row) =>
      row.command.sourceKind === "civic_media" &&
      row.command.sourceRecordId === "civic-media-center",
  ).length;
}

async function flushScheduledWork(): Promise<void> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

beforeEach(() => {
  setMediaResourceForceMemoryForTests(true);
  resetMediaResourcesMemoryForTests();
  resetMediaResourceSeedStateForTests();
  resetApprovedNewsSourcesCacheForTests();
  setContentTranslationWarmForceMemoryForTests(true);
  resetContentTranslationWarmMemoryForTests();
  setPlpAutoBuildWorkForceMemoryForTests(true);
  resetPlpAutoBuildWorkStoreForTests();
  resetLocalizationReconciliationDriverForTests();
  setLocalizationReconciliationDriverDepsForTests({
    listTargetLocales: async () => [],
  });
  installAdmin();
});

afterEach(() => {
  setMediaResourceAdminAssertOverrideForTests(null);
  resetMediaResourceSeedStateForTests();
  resetApprovedNewsSourcesCacheForTests();
  resetMediaResourcesMemoryForTests();
  setMediaResourceForceMemoryForTests(false);
  resetContentTranslationWarmMemoryForTests();
  setContentTranslationWarmForceMemoryForTests(false);
  resetPlpAutoBuildWorkStoreForTests();
  setPlpAutoBuildWorkForceMemoryForTests(false);
  resetLocalizationReconciliationDriverForTests();
  resetLanguageRegistryStoreForTests();
  setLanguageRegistryForceMemoryForTests(false);
  delete process.env.HU_PLP_AUTO_BUILD_LOCALES;
});

describe("media resource seed persistence", () => {
  it("seeds canonical defaults into an empty store", async () => {
    const seeds = buildMediaResourceSeedRecords();
    const inserted = await seedMediaResourcesFromCanonicalSources();
    assert.equal(inserted, seeds.length);

    const reuters = await getMediaResourceByIdentity({
      resourceType: "TRUSTED_MEDIA",
      id: "reuters",
    });
    const catalog = TRUSTED_MEDIA_RESOURCES.find((resource) => resource.id === "reuters");
    assert.ok(reuters);
    assert.ok(catalog);
    assert.equal(reuters.name, catalog.name);
    assert.equal(reuters.description, catalog.explanation);
    assert.equal(reuters.websiteUrl, catalog.websiteUrl);
    assert.equal(reuters.active, true);
    assert.equal(reuters.createdAt, "2026-06-27T00:00:00.000Z");
    assert.equal(reuters.updatedAt, "2026-06-27T00:00:00.000Z");
  });

  it("preserves an edited name, description, and URL across startup", async () => {
    await seedMediaResourcesFromCanonicalSources();
    const edited = await updateAdminMediaResource({
      actorUserId: "admin-stage-b",
      id: "reuters",
      resourceType: "TRUSTED_MEDIA",
      name: "Reuters Desk",
      description: "Administrator explanation that must survive restart.",
      websiteUrl: "https://admin.example/reuters",
    });

    resetMediaResourceSeedStateForTests();
    const inserted = await seedMediaResourcesFromCanonicalSources();
    const stored = await getMediaResourceByIdentity({
      resourceType: "TRUSTED_MEDIA",
      id: "reuters",
    });

    assert.equal(inserted, 0);
    assert.deepEqual(stored, edited);
  });

  it("leaves an inactive catalog row inactive", async () => {
    await seedMediaResourcesFromCanonicalSources();
    const inactive = await deactivateAdminMediaResource({
      actorUserId: "admin-stage-b",
      id: "snopes",
      resourceType: "FACT_CHECKING",
    });

    resetMediaResourceSeedStateForTests();
    await seedMediaResourcesFromCanonicalSources();
    const stored = await getMediaResourceByIdentity({
      resourceType: "FACT_CHECKING",
      id: "snopes",
    });

    assert.deepEqual(stored, inactive);
    assert.equal(stored?.active, false);
  });

  it("is idempotent when startup runs again", async () => {
    const firstInserted = await seedMediaResourcesFromCanonicalSources();
    const first = await listMediaResources();
    const secondInserted = await seedMediaResourcesFromCanonicalSources();
    const second = await listMediaResources();

    assert.equal(firstInserted, buildMediaResourceSeedRecords().length);
    assert.equal(secondInserted, 0);
    assert.deepEqual(second, first);
  });

  it("does not create duplicate identities when two seeds run together", async () => {
    const [first, second] = await Promise.all([
      seedMediaResourcesFromCanonicalSources(),
      seedMediaResourcesFromCanonicalSources(),
    ]);
    const rows = await listMediaResources();
    const keys = rows.map((row) => `${row.resourceType}\0${row.id}`);

    assert.equal(first + second, buildMediaResourceSeedRecords().length);
    assert.equal(rows.length, keys.length);
    assert.equal(new Set(keys).size, keys.length);
    assert.equal(rows.length, buildMediaResourceSeedRecords().length);
  });

  it("keeps a hard-deleted catalog row deleted after startup", async () => {
    await seedMediaResourcesFromCanonicalSources();
    await deactivateAdminMediaResource({
      actorUserId: "admin-stage-b",
      id: "snopes",
      resourceType: "FACT_CHECKING",
    });
    const removed = await deleteAdminMediaResource({
      actorUserId: "admin-stage-b",
      id: "snopes",
      resourceType: "FACT_CHECKING",
      hard: true,
    });
    assert.equal(removed.resource, null);
    assert.equal(removed.softDeactivated, false);

    resetMediaResourceSeedStateForTests();
    const inserted = await seedMediaResourcesFromCanonicalSources();
    assert.equal(inserted, 0);
    assert.equal(
      await getMediaResourceByIdentity({ resourceType: "FACT_CHECKING", id: "snopes" }),
      null,
    );
    const tombstone = await getMediaResourceTombstone({
      resourceType: "FACT_CHECKING",
      id: "snopes",
    });
    assert.ok(tombstone);
    assert.equal(tombstone.deletedByParticipantId, "member-admin-stage-b");
  });

  it("keeps the tombstone across a simulated process restart", async () => {
    await seedMediaResourcesFromCanonicalSources();
    await deactivateAdminMediaResource({
      actorUserId: "admin-stage-b",
      id: "snopes",
      resourceType: "FACT_CHECKING",
    });
    await deleteAdminMediaResource({
      actorUserId: "admin-stage-b",
      id: "snopes",
      resourceType: "FACT_CHECKING",
      hard: true,
    });

    resetMediaResourceSeedStateForTests();
    await ensureMediaResourcesSeededOnce();
    resetMediaResourceSeedStateForTests();
    await ensureMediaResourcesSeededOnce();

    assert.equal(
      await getMediaResourceByIdentity({ resourceType: "FACT_CHECKING", id: "snopes" }),
      null,
    );
    assert.ok(
      await getMediaResourceTombstone({ resourceType: "FACT_CHECKING", id: "snopes" }),
    );
    const catalog = FACT_CHECK_RESOURCES.find((resource) => resource.id === "snopes");
    assert.ok(catalog);
  });

  it("removes an inactive non-news resource and records the tombstone", async () => {
    await seedMediaResourcesFromCanonicalSources();
    await deactivateAdminMediaResource({
      actorUserId: "admin-stage-b",
      id: "snopes",
      resourceType: "FACT_CHECKING",
    });

    const removed = await deleteAdminMediaResource({
      actorUserId: "admin-stage-b",
      id: "snopes",
      resourceType: "FACT_CHECKING",
      hard: true,
    });

    assert.equal(removed.softDeactivated, false);
    assert.equal(
      await getMediaResourceByIdentity({ resourceType: "FACT_CHECKING", id: "snopes" }),
      null,
    );
    assert.equal(
      (await getMediaResourceTombstone({ resourceType: "FACT_CHECKING", id: "snopes" }))
        ?.resourceType,
      "FACT_CHECKING",
    );

    const section = readFileSync(
      path.resolve(
        apiSrc,
        "../../../apps/web/src/features/administration/components/AdminMediaResourcesSection.tsx",
      ),
      "utf8",
    );
    assert.match(
      section,
      /Deactivate this resource before permanently removing it\. Deactivate keeps it in the list as inactive\./,
    );
    assert.match(section, /resourceType !== "NEWS_SOURCE" && resource\.active/);
    assert.match(section, /hard: resource\.resourceType !== "NEWS_SOURCE"/);
    assert.match(section, /Deactivate this news source\? Historical articles will be kept\./);
    assert.match(section, /await load\(\)/);
  });

  it("still refuses to hard-delete a news source", async () => {
    await seedMediaResourcesFromCanonicalSources();
    const news = (await listMediaResources()).find((row) => row.resourceType === "NEWS_SOURCE");
    assert.ok(news);

    await assert.rejects(
      () =>
        deleteAdminMediaResource({
          actorUserId: "admin-stage-b",
          id: news.id,
          resourceType: "NEWS_SOURCE",
          hard: true,
        }),
      (error: unknown) => {
        assert.ok(error instanceof MediaResourceForbiddenDeleteError);
        assert.match(error.message, /NEWS_SOURCE/);
        return true;
      },
    );

    const stored = await getMediaResourceByIdentity({
      resourceType: "NEWS_SOURCE",
      id: news.id,
    });
    assert.deepEqual(stored, news);
    assert.equal(
      await getMediaResourceTombstone({ resourceType: "NEWS_SOURCE", id: news.id }),
      null,
    );
  });

  it("does not let an editor hard-delete a media resource", async () => {
    await seedMediaResourcesFromCanonicalSources();
    const before = await getMediaResourceByIdentity({
      resourceType: "TRUSTED_MEDIA",
      id: "reuters",
    });

    await assert.rejects(
      () =>
        deleteAdminMediaResource({
          actorUserId: "editor-1",
          id: "reuters",
          resourceType: "TRUSTED_MEDIA",
          hard: true,
        }),
      AdministrationForbiddenError,
    );

    assert.deepEqual(
      await getMediaResourceByIdentity({ resourceType: "TRUSTED_MEDIA", id: "reuters" }),
      before,
    );
    assert.equal(
      await getMediaResourceTombstone({ resourceType: "TRUSTED_MEDIA", id: "reuters" }),
      null,
    );

    const routes = read("modules/editor-grants/editor-panel.routes.ts");
    const mediaRoutes = routes.slice(
      routes.indexOf('"/media-resources"'),
      routes.indexOf('"/country-people"'),
    );
    assert.match(mediaRoutes, /\/media-resources\/:id\/deactivate/);
    assert.doesNotMatch(mediaRoutes, /\.delete\(/);
    assert.match(read("modules/media-resources/media-resource.service.ts"), /role !== "admin"/);
  });

  it("excludes a deleted resource from public projections", async () => {
    await seedMediaResourcesFromCanonicalSources();
    await deactivateAdminMediaResource({
      actorUserId: "admin-stage-b",
      id: "snopes",
      resourceType: "FACT_CHECKING",
    });
    await deleteAdminMediaResource({
      actorUserId: "admin-stage-b",
      id: "snopes",
      resourceType: "FACT_CHECKING",
      hard: true,
    });
    resetMediaResourceSeedStateForTests();

    const factChecking = await listPublicWorldFactChecking();
    assert.equal(
      factChecking.some((resource) => resource.id === "snopes"),
      false,
    );
    const trusted = await listPublicWorldTrustedMedia();
    assert.equal(
      trusted.some((resource) => resource.id === "reuters"),
      true,
    );
  });

  it("keeps static trusted PLP identities after the Mongo row is deleted", async () => {
    await seedMediaResourcesFromCanonicalSources();
    await deactivateAdminMediaResource({
      actorUserId: "admin-stage-b",
      id: "reuters",
      resourceType: "TRUSTED_MEDIA",
    });
    await deleteAdminMediaResource({
      actorUserId: "admin-stage-b",
      id: "reuters",
      resourceType: "TRUSTED_MEDIA",
      hard: true,
    });

    const staticIds = discoverMediaPlpCarouselStaticEntities()
      .filter((entity) => entity.entityType === "civic_media_trusted")
      .map((entity) => entity.entityId);
    assert.equal(staticIds.includes("reuters"), true);
    assert.equal(
      await getMediaResourceByIdentity({ resourceType: "TRUSTED_MEDIA", id: "reuters" }),
      null,
    );
    assert.deepEqual(discoverCivicMediaTranslationRecordIds(), ["civic-media-center"]);
  });

  it("schedules civic_media recovery when an active trusted resource is deactivated", async () => {
    await seedMediaResourcesFromCanonicalSources();
    await flushScheduledWork();
    resetContentTranslationWarmMemoryForTests();

    await deactivateAdminMediaResource({
      actorUserId: "admin-stage-b",
      id: "reuters",
      resourceType: "TRUSTED_MEDIA",
    });
    await flushScheduledWork();

    assert.equal(civicWarmCount(), 1);
    assert.equal(listPlpAutoBuildWorkForTests().length, 0);
  });

  it("does not schedule civic_media recovery for a name or URL change", async () => {
    await seedMediaResourcesFromCanonicalSources();
    await flushScheduledWork();
    const before = await loadCivicMediaTranslationSource("civic-media-center");
    resetContentTranslationWarmMemoryForTests();
    resetPlpAutoBuildWorkStoreForTests();

    await updateAdminMediaResource({
      actorUserId: "admin-stage-b",
      id: "reuters",
      resourceType: "TRUSTED_MEDIA",
      name: "Reuters Wire",
      websiteUrl: "https://admin.example/reuters-wire",
    });
    await flushScheduledWork();

    const after = await loadCivicMediaTranslationSource("civic-media-center");
    assert.equal(after?.sourceVersion, before?.sourceVersion);
    assert.equal(civicWarmCount(), 0);
    assert.equal(listPlpAutoBuildWorkForTests().length, 0);
  });

  it("does not enqueue translation work when startup seeds existing or new catalog rows", async () => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    await updateLanguageRegistryRecord("lang-zh-Hant", {
      enabled: true,
      contentTranslationEnabled: true,
    });
    process.env.HU_PLP_AUTO_BUILD_LOCALES = "zh-Hant";
    resetContentTranslationWarmMemoryForTests();
    resetPlpAutoBuildWorkStoreForTests();

    const inserted = await seedMediaResourcesFromCanonicalSources();
    await flushScheduledWork();
    assert.ok(inserted > 0);
    assert.equal(civicWarmCount(), 0);
    assert.equal(listPlpAutoBuildWorkForTests().length, 0);

    const before = await loadCivicMediaTranslationSource("civic-media-center");
    resetMediaResourceSeedStateForTests();
    const again = await seedMediaResourcesFromCanonicalSources();
    await flushScheduledWork();
    const after = await loadCivicMediaTranslationSource("civic-media-center");

    assert.equal(again, 0);
    assert.equal(after?.sourceVersion, before?.sourceVersion);
    assert.equal(civicWarmCount(), 0);
    assert.equal(listPlpAutoBuildWorkForTests().length, 0);

    const seedSource = read("modules/media-resources/media-resource.seed.ts");
    assert.doesNotMatch(seedSource, /continueTrustedMediaPlpIfCanonicalChanged|scheduleCivicMedia|gemini/i);
    assert.match(
      read("infrastructure/mongodb/mongo-indexes.ts"),
      /media_resource_tombstones_type_id_unique/,
    );
  });

  it("drops a hard-deleted trusted explanation from civic_media and does not restore it", async () => {
    await seedMediaResourcesFromCanonicalSources();
    await deactivateAdminMediaResource({
      actorUserId: "admin-stage-b",
      id: "reuters",
      resourceType: "TRUSTED_MEDIA",
    });
    await flushScheduledWork();
    resetContentTranslationWarmMemoryForTests();
    const beforeDelete = await loadCivicMediaTranslationSource("civic-media-center");
    assert.ok(beforeDelete);
    const beforeExplanations = JSON.parse(
      String(beforeDelete.fields.trustedMediaExplanations),
    ) as Array<{ id: string }>;
    assert.equal(
      beforeExplanations.some((item) => item.id === "reuters"),
      false,
    );

    await deleteAdminMediaResource({
      actorUserId: "admin-stage-b",
      id: "reuters",
      resourceType: "TRUSTED_MEDIA",
      hard: true,
    });
    resetMediaResourceSeedStateForTests();
    resetContentTranslationWarmMemoryForTests();
    resetPlpAutoBuildWorkStoreForTests();

    const afterRestart = await loadCivicMediaTranslationSource("civic-media-center");
    assert.equal(afterRestart?.sourceVersion, beforeDelete.sourceVersion);
    const explanations = JSON.parse(
      String(afterRestart?.fields.trustedMediaExplanations),
    ) as Array<{ id: string }>;
    assert.equal(
      explanations.some((item) => item.id === "reuters"),
      false,
    );
    assert.equal(civicWarmCount(), 0);
    assert.equal(listPlpAutoBuildWorkForTests().length, 0);
    assert.deepEqual(discoverCivicMediaTranslationRecordIds(), ["civic-media-center"]);
  });
});
