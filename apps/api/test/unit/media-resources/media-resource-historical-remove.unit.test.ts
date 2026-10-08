/**
 * Stage B.1 — Remove permanently deletes canonical and news-source rows.
 * Published articles stay on their own records. RSS uses the loaded catalog.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import type { NewsArticleRecord } from "@hu/types";

import { AdministrationForbiddenError } from "../../../src/modules/administration/administration.errors.js";
import { discoverMediaPlpCarouselStaticEntities } from "../../../src/modules/language/media-plp-carousel/discover-entities.js";
import {
  discoverCivicMediaTranslationRecordIds,
  loadCivicMediaTranslationSource,
} from "../../../src/modules/language/content-translation-civic-loaders.js";
import {
  listContentTranslationWarmMemoryPendingForTests,
  resetContentTranslationWarmMemoryForTests,
  setContentTranslationWarmForceMemoryForTests,
} from "../../../src/modules/language/content-translation-warm-enqueue.js";
import {
  resetLocalizationReconciliationDriverForTests,
  setLocalizationReconciliationDriverDepsForTests,
} from "../../../src/modules/language/localization-reconciliation-driver.js";
import {
  listPlpAutoBuildWorkForTests,
  resetPlpAutoBuildWorkStoreForTests,
  setPlpAutoBuildWorkForceMemoryForTests,
} from "../../../src/modules/language/published-localized-presentation/universal/plp-auto-build-work.repository.js";
import { seedMediaResourcesFromCanonicalSources } from "../../../src/modules/media-resources/media-resource.seed.js";
import {
  createAdminMediaResource,
  deactivateAdminMediaResource,
  deleteAdminMediaResource,
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
import {
  isApprovedNewsFeedUrl,
  listActiveApprovedNewsSources,
  refreshApprovedNewsSourcesFromMediaResources,
  resetApprovedNewsSourcesCacheForTests,
} from "../../../src/modules/public-news/public-news.config.js";
import { toPublicNewsArticleItem } from "../../../src/modules/public-news/public-news.normalize.js";
import {
  findPublicNewsRecordById,
  resetPublicNewsMemoryStoreForTests,
  upsertPublicNewsRecords,
} from "../../../src/modules/public-news/public-news.repository.js";

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

let previousNewsPersistence: string | undefined;

beforeEach(() => {
  previousNewsPersistence = process.env.PUBLIC_NEWS_PERSISTENCE;
  process.env.PUBLIC_NEWS_PERSISTENCE = "memory";
  setMediaResourceForceMemoryForTests(true);
  resetMediaResourcesMemoryForTests();
  resetMediaResourceSeedStateForTests();
  resetApprovedNewsSourcesCacheForTests();
  resetPublicNewsMemoryStoreForTests();
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
  if (previousNewsPersistence === undefined) {
    delete process.env.PUBLIC_NEWS_PERSISTENCE;
  } else {
    process.env.PUBLIC_NEWS_PERSISTENCE = previousNewsPersistence;
  }
  setMediaResourceAdminAssertOverrideForTests(null);
  resetMediaResourceSeedStateForTests();
  resetApprovedNewsSourcesCacheForTests();
  resetPublicNewsMemoryStoreForTests();
  resetMediaResourcesMemoryForTests();
  setMediaResourceForceMemoryForTests(false);
  resetContentTranslationWarmMemoryForTests();
  setContentTranslationWarmForceMemoryForTests(false);
  resetPlpAutoBuildWorkStoreForTests();
  setPlpAutoBuildWorkForceMemoryForTests(false);
  resetLocalizationReconciliationDriverForTests();
});

describe("historical media resource removal", () => {
  it("permanently removes an active canonical trusted resource", async () => {
    await seedMediaResourcesFromCanonicalSources();
    await flushScheduledWork();
    resetContentTranslationWarmMemoryForTests();

    const removed = await deleteAdminMediaResource({
      actorUserId: "admin-stage-b1",
      id: "reuters",
      resourceType: "TRUSTED_MEDIA",
      hard: true,
    });
    await flushScheduledWork();

    assert.equal(removed.resource, null);
    assert.equal(removed.softDeactivated, false);
    assert.equal(
      await getMediaResourceByIdentity({ resourceType: "TRUSTED_MEDIA", id: "reuters" }),
      null,
    );
    assert.equal(
      (await listMediaResources()).some(
        (row) => row.resourceType === "TRUSTED_MEDIA" && row.id === "reuters",
      ),
      false,
    );
    assert.equal(civicWarmCount(), 1);
    assert.equal(listPlpAutoBuildWorkForTests().length, 0);

    const publicTrusted = await listPublicWorldTrustedMedia();
    assert.equal(
      publicTrusted.some((resource) => resource.id === "reuters"),
      false,
    );
    assert.equal(
      discoverMediaPlpCarouselStaticEntities().some(
        (entity) => entity.entityType === "civic_media_trusted" && entity.entityId === "reuters",
      ),
      true,
    );
    assert.deepEqual(discoverCivicMediaTranslationRecordIds(), ["civic-media-center"]);
  });

  it("keeps the trusted tombstone across restart and still allows edits beforehand", async () => {
    await seedMediaResourcesFromCanonicalSources();
    const edited = await updateAdminMediaResource({
      actorUserId: "admin-stage-b1",
      id: "associated-press",
      resourceType: "TRUSTED_MEDIA",
      name: "Associated Press Desk",
      websiteUrl: "https://admin.example/ap",
    });
    assert.equal(edited.name, "Associated Press Desk");
    assert.equal(
      (
        await getMediaResourceByIdentity({
          resourceType: "TRUSTED_MEDIA",
          id: "associated-press",
        })
      )?.websiteUrl,
      "https://admin.example/ap",
    );

    await deleteAdminMediaResource({
      actorUserId: "admin-stage-b1",
      id: "reuters",
      resourceType: "TRUSTED_MEDIA",
      hard: true,
    });
    resetMediaResourceSeedStateForTests();
    await seedMediaResourcesFromCanonicalSources();

    assert.equal(
      await getMediaResourceByIdentity({ resourceType: "TRUSTED_MEDIA", id: "reuters" }),
      null,
    );
    assert.ok(
      await getMediaResourceTombstone({ resourceType: "TRUSTED_MEDIA", id: "reuters" }),
    );
    assert.equal(
      (
        await getMediaResourceByIdentity({
          resourceType: "TRUSTED_MEDIA",
          id: "associated-press",
        })
      )?.name,
      "Associated Press Desk",
    );
  });

  it("permanently removes a user-created resource", async () => {
    const created = await createAdminMediaResource({
      actorUserId: "admin-stage-b1",
      id: "desk-created-fact",
      resourceType: "FACT_CHECKING",
      scopeType: "WORLD",
      name: "Desk Fact Check",
      logoLabel: "DF",
      websiteUrl: "https://desk-fact.example/",
      description: "Created in the admin form.",
      secondaryText: "Claims",
      active: true,
    });

    const removed = await deleteAdminMediaResource({
      actorUserId: "admin-stage-b1",
      id: created.id,
      resourceType: "FACT_CHECKING",
      hard: true,
    });
    assert.equal(removed.resource, null);
    assert.equal(
      await getMediaResourceByIdentity({ resourceType: "FACT_CHECKING", id: created.id }),
      null,
    );
    resetMediaResourceSeedStateForTests();
    await seedMediaResourcesFromCanonicalSources();
    assert.equal(
      await getMediaResourceByIdentity({ resourceType: "FACT_CHECKING", id: created.id }),
      null,
    );
  });

  it("deactivates without a tombstone and removes only on hard delete", async () => {
    await seedMediaResourcesFromCanonicalSources();
    const inactive = await deactivateAdminMediaResource({
      actorUserId: "admin-stage-b1",
      id: "snopes",
      resourceType: "FACT_CHECKING",
    });
    assert.equal(inactive.active, false);
    assert.equal(
      await getMediaResourceTombstone({ resourceType: "FACT_CHECKING", id: "snopes" }),
      null,
    );

    const removed = await deleteAdminMediaResource({
      actorUserId: "admin-stage-b1",
      id: "snopes",
      resourceType: "FACT_CHECKING",
      hard: true,
    });
    assert.equal(removed.softDeactivated, false);
    assert.equal(
      await getMediaResourceByIdentity({ resourceType: "FACT_CHECKING", id: "snopes" }),
      null,
    );
    assert.ok(await getMediaResourceTombstone({ resourceType: "FACT_CHECKING", id: "snopes" }));
  });

  it("removes a news source, keeps the article, and stops RSS for that source", async () => {
    await seedMediaResourcesFromCanonicalSources();
    const newsRows = (await listMediaResources()).filter(
      (row) => row.resourceType === "NEWS_SOURCE" && row.active && row.rssUrl,
    );
    const news = newsRows[0];
    const other = newsRows[1];
    assert.ok(news?.rssUrl);
    assert.ok(other?.rssUrl);

    const article: NewsArticleRecord = {
      id: "article-reuters-kept",
      provider: "rss",
      sourceName: news.name,
      sourceDomain: "reuters.com",
      title: "Stored article",
      summary: "Attribution lives on the article.",
      articleUrl: "https://www.reuters.com/world/stored-article-stage-b1",
      normalizedArticleUrl: "https://www.reuters.com/world/stored-article-stage-b1",
      publishedAt: "2026-10-01T00:00:00.000Z",
      fetchedAt: "2026-10-01T00:00:00.000Z",
      expiresAt: "2026-12-01T00:00:00.000Z",
      language: "en",
      status: "active",
      verificationStatus: "external-source",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    };
    await upsertPublicNewsRecords([article]);
    await flushScheduledWork();
    resetContentTranslationWarmMemoryForTests();

    const removed = await deleteAdminMediaResource({
      actorUserId: "admin-stage-b1",
      id: news.id,
      resourceType: "NEWS_SOURCE",
      hard: true,
    });
    await flushScheduledWork();

    assert.equal(removed.resource, null);
    assert.equal(civicWarmCount(), 0);
    assert.equal(listPlpAutoBuildWorkForTests().length, 0);
    const stored = await findPublicNewsRecordById(article.id);
    assert.equal(stored?.sourceName, news.name);
    assert.equal(stored?.articleUrl, article.articleUrl);
    assert.equal(toPublicNewsArticleItem(stored!).articleUrl, article.articleUrl);
    assert.equal(toPublicNewsArticleItem(stored!).sourceName, news.name);

    const removedFeeds = listActiveApprovedNewsSources(news.language ?? "en").map(
      (source) => source.rssFeedUrl,
    );
    const retainedFeeds = listActiveApprovedNewsSources(other.language ?? "en").map(
      (source) => source.rssFeedUrl,
    );
    assert.equal(removedFeeds.includes(news.rssUrl), false);
    assert.equal(retainedFeeds.includes(other.rssUrl), true);
    assert.equal(isApprovedNewsFeedUrl(news.rssUrl), false);
    assert.equal(isApprovedNewsFeedUrl(other.rssUrl), true);

    resetMediaResourceSeedStateForTests();
    await seedMediaResourcesFromCanonicalSources();
    assert.equal(
      await getMediaResourceByIdentity({ resourceType: "NEWS_SOURCE", id: news.id }),
      null,
    );
    assert.equal(
      (await findPublicNewsRecordById(article.id))?.articleUrl,
      article.articleUrl,
    );
    const source = await loadCivicMediaTranslationSource("civic-media-center");
    const explanations = JSON.parse(String(source?.fields.trustedMediaExplanations)) as Array<{
      id: string;
    }>;
    assert.ok(explanations.length > 0);
  });

  it("does not fall back to the static registry after the news catalog loads empty", async () => {
    await refreshApprovedNewsSourcesFromMediaResources();
    assert.equal(listActiveApprovedNewsSources("en").length, 0);
    assert.equal(isApprovedNewsFeedUrl("https://www.reuters.com/"), false);
  });

  it("does not let an editor remove a historical resource", async () => {
    await seedMediaResourcesFromCanonicalSources();
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
    assert.ok(
      await getMediaResourceByIdentity({ resourceType: "TRUSTED_MEDIA", id: "reuters" }),
    );
    assert.equal(
      await getMediaResourceTombstone({ resourceType: "TRUSTED_MEDIA", id: "reuters" }),
      null,
    );
  });
});
