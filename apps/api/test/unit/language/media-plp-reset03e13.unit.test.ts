/**
 * Reset 03E.13 — public_news consumer parity (selection + batch identity join).
 * No Gemini / Mongo writes / materialize / live ops.
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
  type PublicNewsArticleItem,
} from "@hu/types";

import {
  upsertPublicNewsRecords,
  resetPublicNewsMemoryStoreForTests,
} from "../../../src/modules/public-news/public-news.repository.js";
import {
  MEDIA_PLP_CAROUSEL_NEWS_LIMIT,
  MEDIA_PLP_NEWS_CONSUMER_LANGUAGE,
  listNewestActivePublicNewsIdsIgnoringConsumerBalance,
  selectMediaPlpConsumerNewsIds,
} from "../../../src/modules/language/media-plp-carousel/index.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalPublicNewsPresentation,
  fingerprintMediaPlpCanonicalVersion,
  publishMediaPlpEntity,
  resetMediaPlpInstrumentationForTests,
  resetMediaPlpResolveCacheForTests,
  resetPublishedLocalizationPersistenceForTests,
  resolveMediaPlpConsumerBatch,
  setMediaPlpConsumptionEnabledForTests,
  setPublishedLocalizationPersistenceModeForTests,
} from "../../../src/modules/language/published-localized-presentation/index.js";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const now = "2030-01-01T00:00:00.000Z";
const expiresAt = "2030-12-31T00:00:00.000Z";

function makeArticle(input: {
  readonly id: string;
  readonly sourceName: string;
  readonly publishedAt: string;
  readonly language?: string;
  readonly title?: string;
}): NewsArticleRecord {
  const title = input.title ?? `Title ${input.id}`;
  return {
    id: input.id,
    provider: "test",
    sourceName: input.sourceName,
    title,
    summary: `Summary ${input.id} long enough for localization integrity checks.`,
    articleUrl: `https://example.com/${input.id}`,
    normalizedArticleUrl: `https://example.com/${input.id}`,
    publishedAt: input.publishedAt,
    fetchedAt: now,
    expiresAt,
    language: input.language ?? "en",
    category: "peace and security",
    geographicScope: "global",
    status: "active",
    verificationStatus: "external-source",
    createdAt: now,
    updatedAt: now,
  };
}

function newsTree(article: PublicNewsArticleItem) {
  return asMediaPlpPresentationNode(buildCanonicalPublicNewsPresentation(article));
}

beforeEach(() => {
  process.env.PUBLIC_NEWS_PERSISTENCE = "memory";
  resetPublicNewsMemoryStoreForTests();
  resetPublishedLocalizationPersistenceForTests();
  resetMediaPlpInstrumentationForTests();
  resetMediaPlpResolveCacheForTests();
  setPublishedLocalizationPersistenceModeForTests("memory");
  setMediaPlpConsumptionEnabledForTests(true);
});

afterEach(() => {
  setMediaPlpConsumptionEnabledForTests(null);
  resetPublishedLocalizationPersistenceForTests();
  resetMediaPlpInstrumentationForTests();
  resetMediaPlpResolveCacheForTests();
  resetPublicNewsMemoryStoreForTests();
});

describe("Reset 03E.13 — public_news consumer selection parity", () => {
  it("consumer selection uses en + source balance (not legacy newest-only)", async () => {
    const records: NewsArticleRecord[] = [];
    // 20 newest from a single source → legacy newest = those 12; consumer balance spreads sources.
    for (let i = 0; i < 20; i += 1) {
      records.push(
        makeArticle({
          id: `mono-${String(i).padStart(2, "0")}`,
          sourceName: "MonoSource",
          publishedAt: `2029-06-${String(20 - Math.floor(i / 10)).padStart(2, "0")}T${String(i % 24).padStart(2, "0")}:00:00.000Z`,
        }),
      );
    }
    for (let i = 0; i < 8; i += 1) {
      records.push(
        makeArticle({
          id: `alt-${String(i).padStart(2, "0")}`,
          sourceName: `AltSource-${i}`,
          publishedAt: `2029-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
        }),
      );
    }
    await upsertPublicNewsRecords(records);

    const consumerIds = await selectMediaPlpConsumerNewsIds({
      limit: MEDIA_PLP_CAROUSEL_NEWS_LIMIT,
      now,
    });
    assert.equal(consumerIds.length, MEDIA_PLP_CAROUSEL_NEWS_LIMIT);
    assert.equal(MEDIA_PLP_NEWS_CONSUMER_LANGUAGE, "en");

    const legacyNewest = await listNewestActivePublicNewsIdsIgnoringConsumerBalance({
      limit: MEDIA_PLP_CAROUSEL_NEWS_LIMIT,
      now,
      findDocs: async ({ filter, sort, limit }) => {
        const all = records.filter((r) => r.status === "active" && r.expiresAt > now);
        const sorted = [...all].sort((a, b) => {
          const byPub = Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
          return byPub !== 0 ? byPub : a.id.localeCompare(b.id);
        });
        void filter;
        void sort;
        return sorted.slice(0, limit).map((r) => ({ id: r.id }));
      },
    });

    const overlap = consumerIds.filter((id) => legacyNewest.includes(id)).length;
    assert.ok(
      overlap < MEDIA_PLP_CAROUSEL_NEWS_LIMIT,
      `expected consumer≠legacy-newest overlap; got overlap=${overlap}`,
    );
    assert.ok(
      consumerIds.some((id) => id.startsWith("alt-")),
      "consumer set must include balanced alternate sources",
    );
  });

  it("discover-entities imports consumer selection helper", () => {
    const src = readFileSync(
      join(
        apiRoot,
        "src/modules/language/media-plp-carousel/discover-entities.ts",
      ),
      "utf8",
    );
    assert.match(src, /selectMediaPlpConsumerNewsIds/);
    assert.match(src, /03E\.13/);
  });
});

describe("Reset 03E.13 — HTTP batch identity contract for 12 news", () => {
  async function publishLocalizedNews(
    article: PublicNewsArticleItem,
    titleUk: string,
    summaryUk: string,
  ): Promise<string> {
    const tree = newsTree(article);
    const version = fingerprintMediaPlpCanonicalVersion(tree);
    const published = await publishMediaPlpEntity({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: mediaPlpPublicNewsEntityId(article.id),
      locale: "uk",
      canonicalVersion: version,
      contentRevision: 1,
      canonicalPresentation: tree,
      layers: [{ source: "MACHINE", values: { title: titleUk, summary: summaryUk } }],
      includeDeterministicMachine: false,
    });
    assert.equal(published.ok, true);
    return version;
  }

  it("12 valid PLP snapshots → 12 keyed PUBLISHED_LOCALIZED results", async () => {
    const articles: PublicNewsArticleItem[] = Array.from({ length: 12 }, (_, i) => {
      const id = `news-${String(i).padStart(2, "0")}`;
      return {
        id,
        title: `EN title ${id}`,
        summary: `EN summary ${id} long enough for integrity.`,
        category: "peace and security",
        sourceName: `Source-${i % 4}`,
        articleUrl: `https://example.com/${id}`,
        publishedAt: `2029-05-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
        verificationStatus: "external-source" as const,
        geographicScope: "global",
        language: "en",
      };
    });

    for (const article of articles) {
      await publishLocalizedNews(
        article,
        `[uk] ${article.title}`,
        `[uk] ${article.summary}`,
      );
    }

    // Adversarial request order (reverse of publish).
    const requestOrder = [...articles].reverse();
    const batch = await resolveMediaPlpConsumerBatch({
      locale: "uk",
      items: requestOrder.map((article) => ({
        entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
        entityId: mediaPlpPublicNewsEntityId(article.id),
        canonicalPresentation: newsTree(article),
      })),
    });
    assert.equal(batch.ok, true);
    if (!batch.ok) {
      return;
    }
    assert.equal(batch.results.length, 12);

    const byId = new Map(batch.results.map((row) => [row.entityId, row]));
    for (const article of articles) {
      const row = byId.get(article.id);
      assert.ok(row, `missing result for ${article.id}`);
      assert.equal(row!.mode, "PUBLISHED_LOCALIZED");
      assert.equal(
        (row!.presentation as { title?: string }).title,
        `[uk] ${article.title}`,
      );
    }
  });

  it("missing / stale / reordered / unknown cannot shift localization onto another card", async () => {
    const a: PublicNewsArticleItem = {
      id: "card-a",
      title: "Title A EN",
      summary: "Summary A EN long enough for integrity checks here.",
      category: "peace and security",
      sourceName: "A",
      articleUrl: "https://example.com/a",
      publishedAt: "2029-05-01T00:00:00.000Z",
      verificationStatus: "external-source",
      geographicScope: "global",
      language: "en",
    };
    const b: PublicNewsArticleItem = {
      id: "card-b",
      title: "Title B EN",
      summary: "Summary B EN long enough for integrity checks here.",
      category: "peace and security",
      sourceName: "B",
      articleUrl: "https://example.com/b",
      publishedAt: "2029-05-02T00:00:00.000Z",
      verificationStatus: "external-source",
      geographicScope: "global",
      language: "en",
    };
    const c: PublicNewsArticleItem = {
      id: "card-c",
      title: "Title C EN",
      summary: "Summary C EN long enough for integrity checks here.",
      category: "peace and security",
      sourceName: "C",
      articleUrl: "https://example.com/c",
      publishedAt: "2029-05-03T00:00:00.000Z",
      verificationStatus: "external-source",
      geographicScope: "global",
      language: "en",
    };

    await publishLocalizedNews(a, "[uk] Title A", "[uk] Summary A EN long enough for integrity checks here.");
    await publishLocalizedNews(b, "[uk] Title B", "[uk] Summary B EN long enough for integrity checks here.");
    // c: no snapshot → missing

    const staleTree = newsTree({
      ...b,
      title: "Title B EN STALE",
      summary: "Summary B EN STALE long enough for integrity checks here.",
    });

    const batch = await resolveMediaPlpConsumerBatch({
      locale: "uk",
      items: [
        {
          entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
          entityId: mediaPlpPublicNewsEntityId(c.id),
          canonicalPresentation: newsTree(c),
        },
        {
          entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
          entityId: mediaPlpPublicNewsEntityId(b.id),
          canonicalPresentation: staleTree,
        },
        {
          entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
          entityId: mediaPlpPublicNewsEntityId(a.id),
          canonicalPresentation: newsTree(a),
        },
        {
          entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
          entityId: "unknown-extra",
          canonicalPresentation: newsTree({
            ...a,
            id: "unknown-extra",
            title: "Unknown EN",
            summary: "Unknown summary EN long enough for integrity.",
          }),
        },
      ],
    });
    assert.equal(batch.ok, true);
    if (!batch.ok) {
      return;
    }

    const byId = new Map(batch.results.map((row) => [row.entityId, row]));
    assert.equal(byId.get("card-a")?.mode, "PUBLISHED_LOCALIZED");
    assert.equal(
      (byId.get("card-a")!.presentation as { title?: string }).title,
      "[uk] Title A",
    );
    assert.equal(byId.get("card-b")?.mode, "CANONICAL_FALLBACK");
    assert.equal(byId.get("card-c")?.mode, "CANONICAL_FALLBACK");
    assert.equal(byId.get("unknown-extra")?.mode, "CANONICAL_FALLBACK");
    // Stale B must not receive A's localization.
    assert.notEqual(
      (byId.get("card-b")!.presentation as { title?: string }).title,
      "[uk] Title A",
    );
  });
});

describe("Reset 03E.13 — diagnostic wiring is read-only", () => {
  it("news parity diagnostic + script forbid writes/provider", () => {
    for (const rel of [
      "src/modules/language/media-plp-carousel/news-parity-diagnostic.ts",
      "src/modules/language/media-plp-carousel/media-plp-news-selection.ts",
      "src/scripts/diagnose-media-plp-news-parity.ts",
    ]) {
      const text = readFileSync(join(apiRoot, rel), "utf8");
      assert.doesNotMatch(text, /gemini|thin-gemini|GEMINI_API_KEY|materializeMediaPlp/);
      assert.match(text, /03E\.13|READ-ONLY|read-only|PROVIDER_CALLS/);
    }
  });
});
