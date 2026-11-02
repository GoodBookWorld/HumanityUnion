/**
 * REGION-500B.P2 — global search index build performance and cache safety.
 *
 * - One language registry and one glossary read per build (locales resolved in memory),
 *   with output identical to the per-entry lookups.
 * - getGlobalSearchIndex: one shared build per generation, no stale publication after
 *   invalidation, failed builds are retried, bounded rebuilds.
 */
process.env.NODE_TEST_ENV = "true";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.INITIATIVE_PERSISTENCE = "memory";
delete process.env.MONGODB_URI;

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type {
  CivicEntityType,
  CivicSearchMetadata,
  LanguageRegistryRecord,
  TerminologyConcept,
  TranslatedContentRecord,
} from "@hu/types";

import { enrichSearchEntryWithMultilingual } from "../../../src/modules/global-search/global-search-multilingual.js";
import {
  GLOBAL_SEARCH_INDEX_MAX_BUILD_ATTEMPTS,
  GlobalSearchIndexUnstableError,
  createGlobalSearchBuildMultilingualDeps,
  getGlobalSearchIndex,
  invalidateGlobalSearchIndex,
  resetGlobalSearchIndexForTests,
  setGlobalSearchIndexBuilderForTests,
} from "../../../src/modules/global-search/global-search.index.js";
import type { GlobalSearchIndexEntry } from "../../../src/modules/global-search/global-search.types.js";
import { invalidateOrdinaryPublicInitiativeCaches } from "../../../src/modules/initiatives/invalidate-ordinary-public-initiative-caches.js";
import {
  ensureLanguageRegistrySeeded,
  ensureTerminologyGlossarySeeded,
  resetContentTranslationMemoryStoreForTests,
  resetLanguageRegistryStoreForTests,
  resetTerminologyGlossaryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
  setTerminologyGlossaryForceMemoryForTests,
  updateLanguageRegistryRecord,
  updateTerminologyConcept,
} from "../../../src/modules/language/index.js";
import {
  listLanguageRegistry,
  resolveLanguageRegistryLocale,
} from "../../../src/modules/language/language-registry/language-registry.repository.js";
import { upsertContentTranslation } from "../../../src/modules/language/persistence/content-translation.repository.js";
import { listTerminologyConcepts } from "../../../src/modules/language/terminology-glossary/terminology-glossary.repository.js";

const LOCALES = ["ar", "en", "es", "he", "ka", "uk", "zh-Hant"];
/** Staging index composition observed in REGION-500B.P1 (140 entries). */
const STAGING_MIX: Record<string, number> = {
  knowledge_article: 59,
  knowledge_media: 34,
  blog_post: 13,
  initiative: 9,
  initiative_revision: 9,
  analysis: 5,
  implementation_commitment: 3,
  implementation_tracking: 3,
  petition: 3,
  collective_decision: 1,
  decision_session: 1,
};

function metadata(entityType: string, entityId: string): CivicSearchMetadata {
  return {
    entityType: entityType as CivicEntityType,
    entityId,
    title: `Title ${entityId}`,
    summary: `Summary ${entityId}`,
    country: "",
    region: "",
    community: "",
    activityArea: "",
    status: "published",
    publicUrl: "/",
    updatedAt: "2026-11-01T00:00:00.000Z",
  };
}

const stagingEntries = Object.entries(STAGING_MIX).flatMap(([type, count]) =>
  Array.from({ length: count }, (_, index) => metadata(type, `${type}-${index}`)),
);

function registryRecord(locale: string): LanguageRegistryRecord {
  return {
    locale,
    enabled: true,
    searchEnabled: true,
    aliases: [],
  } as unknown as LanguageRegistryRecord;
}

function currentTranslations(): TranslatedContentRecord[] {
  return LOCALES.filter((locale) => locale !== "en").map(
    (targetLanguage) =>
      ({
        freshness: "current",
        stale: false,
        targetLanguage,
        sourceLanguage: "en",
        sourceVersion: "v1",
        translatedContent: { title: `t-${targetLanguage}`, summary: `s-${targetLanguage}` },
      }) as unknown as TranslatedContentRecord,
  );
}

describe("REGION-500B.P2 — lookups per index build", () => {
  it("previous per-entry path: 847 lookups for the staging composition", async () => {
    const calls = { registry: 0, glossary: 0, translations: 0, resolveLocale: 0 };
    const registry = LOCALES.map(registryRecord);
    for (const entry of stagingEntries) {
      await enrichSearchEntryWithMultilingual(entry, {
        listSearchEnabledLanguages: async () => (calls.registry++, registry),
        resolveLocale: async (locale) => (
          calls.resolveLocale++,
          registry.find((r) => r.locale === locale) ?? null
        ),
        listTranslationsForSource: async () => (calls.translations++, currentTranslations()),
        listTerminologyConcepts: async () => (calls.glossary++, [] as TerminologyConcept[]),
      });
    }
    assert.deepEqual(calls, { registry: 140, glossary: 140, translations: 81, resolveLocale: 486 });
  });

  it("build-scoped lookups: one registry and one glossary read, no locale queries", async () => {
    const calls = { registry: 0, glossary: 0, translations: 0 };
    const deps = await createGlobalSearchBuildMultilingualDeps({
      listLanguageRegistry: async () => (calls.registry++, LOCALES.map(registryRecord)),
      listTerminologyConcepts: async () => (calls.glossary++, []),
    });
    for (const entry of stagingEntries) {
      await enrichSearchEntryWithMultilingual(entry, {
        ...deps,
        listTranslationsForSource: async () => (calls.translations++, currentTranslations()),
      });
    }
    assert.deepEqual(calls, { registry: 1, glossary: 1, translations: 81 });
  });

  it("keeps the per-entry soft-fail when a shared read fails", async () => {
    const deps = await createGlobalSearchBuildMultilingualDeps({
      listLanguageRegistry: async () => {
        throw new Error("registry unavailable");
      },
      listTerminologyConcepts: async () => [],
    });
    await assert.rejects(
      () => enrichSearchEntryWithMultilingual(stagingEntries[0]!, deps),
      /registry unavailable/,
    );
  });
});

describe("REGION-500B.P2 — identical multilingual output", () => {
  beforeEach(async () => {
    setLanguageRegistryForceMemoryForTests(true);
    setTerminologyGlossaryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    resetTerminologyGlossaryStoreForTests();
    resetContentTranslationMemoryStoreForTests();
    await ensureLanguageRegistrySeeded();
    await ensureTerminologyGlossarySeeded();
    for (const languageId of ["lang-uk", "lang-zh-Hant"]) {
      await updateLanguageRegistryRecord(languageId, {
        enabled: true,
        searchEnabled: true,
        contentTranslationEnabled: true,
      });
    }
  });

  afterEach(() => {
    resetContentTranslationMemoryStoreForTests();
    resetTerminologyGlossaryStoreForTests();
    resetLanguageRegistryStoreForTests();
    setTerminologyGlossaryForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("resolves every registry locale and alias exactly like the repository", async () => {
    const deps = await createGlobalSearchBuildMultilingualDeps();
    const registry = await listLanguageRegistry();
    const keys = registry.flatMap((record) => [
      record.locale,
      record.locale.toUpperCase(),
      ...(record.aliases ?? []),
    ]);
    for (const key of [...keys, "xx-unknown", "", "  "]) {
      const fromRepository = await resolveLanguageRegistryLocale(key);
      const fromSnapshot = await deps.resolveLocale!(key);
      assert.equal(fromSnapshot?.languageId ?? null, fromRepository?.languageId ?? null, key);
    }
    assert.deepEqual(
      (await deps.listTerminologyConcepts!()).map((concept) => concept.conceptId),
      (await listTerminologyConcepts()).map((concept) => concept.conceptId),
    );
  });

  it("enriches entries identically to the per-entry repository lookups", async () => {
    const entries = [
      metadata("initiative", "p2-initiative"),
      metadata("analysis", "p2-analysis"),
      metadata("knowledge_article", "p2-article"),
    ];
    for (const [targetLanguage, title] of [
      ["uk", "Українська назва"],
      ["zh-hant", "中文標題"],
      ["es", "Título no habilitado"],
    ] as const) {
      await upsertContentTranslation({
        translationId: `p2-${targetLanguage}`,
        sourceKind: "initiative",
        sourceRecordId: "p2-initiative",
        sourceVersion: "v1",
        sourceLanguage: "en",
        targetLanguage,
        translatedContent: { title, summary: `${title} summary` },
        translationProvider: "deterministic",
        translationKind: "machine",
        createdAt: "2026-11-01T00:00:00.000Z",
        stale: false,
        freshness: "current",
      } as TranslatedContentRecord);
    }

    await updateTerminologyConcept("initiative", {
      translations: { uk: { preferredTerm: "Ініціатива", aliases: ["громадська ініціатива"] } },
      status: "published",
    });

    const deps = await createGlobalSearchBuildMultilingualDeps();
    for (const entry of entries) {
      const perEntry = await enrichSearchEntryWithMultilingual(entry);
      const buildScoped = await enrichSearchEntryWithMultilingual(entry, deps);
      assert.deepEqual(buildScoped, perEntry, entry.entityId);
    }
    const initiative = await enrichSearchEntryWithMultilingual(entries[0]!, deps);
    assert.deepEqual(
      initiative.translatedFields?.map((field) => field.language),
      ["uk", "zh-Hant"],
    );
    assert.ok(
      initiative.terminologyAliases?.some(
        (alias) => alias.language === "uk" && alias.term === "громадська ініціатива",
      ),
    );
  });
});

function entry(id: string): GlobalSearchIndexEntry {
  return { entityId: id } as GlobalSearchIndexEntry;
}

function controllableBuilder() {
  const pending: Array<{
    resolve: (entries: GlobalSearchIndexEntry[]) => void;
    reject: (error: unknown) => void;
  }> = [];
  let calls = 0;
  const builder = () => {
    calls += 1;
    return new Promise<GlobalSearchIndexEntry[]>((resolve, reject) => {
      pending.push({ resolve, reject });
    });
  };
  return {
    builder,
    calls: () => calls,
    resolve: (index: number, entries: GlobalSearchIndexEntry[]) => pending[index]!.resolve(entries),
    reject: (index: number, error: unknown) => pending[index]!.reject(error),
  };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

describe("REGION-500B.P2 — single-flight index cache", () => {
  afterEach(() => {
    setGlobalSearchIndexBuilderForTests(null);
    resetGlobalSearchIndexForTests();
  });

  it("cold: concurrent callers share one build; warm: no rebuild", async () => {
    const control = controllableBuilder();
    setGlobalSearchIndexBuilderForTests(control.builder);
    const waiters = Array.from({ length: 5 }, () => getGlobalSearchIndex());
    await tick();
    assert.equal(control.calls(), 1);
    const built = [entry("a")];
    control.resolve(0, built);
    for (const result of await Promise.all(waiters)) {
      assert.equal(result, built);
    }
    assert.equal(await getGlobalSearchIndex(), built);
    assert.equal(control.calls(), 1);
  });

  it("never publishes or returns a build that was invalidated while running", async () => {
    const control = controllableBuilder();
    setGlobalSearchIndexBuilderForTests(control.builder);
    const waiter = getGlobalSearchIndex();
    await tick();
    invalidateGlobalSearchIndex();
    const lateJoiner = getGlobalSearchIndex();
    await tick();
    assert.equal(control.calls(), 2, "the new generation starts its own build");
    control.resolve(0, [entry("obsolete")]);
    await tick();
    const fresh = [entry("fresh")];
    control.resolve(1, fresh);
    assert.equal(await waiter, fresh);
    assert.equal(await lateJoiner, fresh);
    assert.equal(await getGlobalSearchIndex(), fresh);
    assert.equal(control.calls(), 2);
  });

  it("handles several invalidations during one build with a single follow-up build", async () => {
    const control = controllableBuilder();
    setGlobalSearchIndexBuilderForTests(control.builder);
    const waiter = getGlobalSearchIndex();
    await tick();
    invalidateGlobalSearchIndex();
    invalidateGlobalSearchIndex();
    invalidateGlobalSearchIndex();
    control.resolve(0, [entry("obsolete")]);
    await tick();
    assert.equal(control.calls(), 2);
    const fresh = [entry("fresh")];
    control.resolve(1, fresh);
    assert.equal(await waiter, fresh);
  });

  it("does not cache a failed build and retries on the next request", async () => {
    const control = controllableBuilder();
    setGlobalSearchIndexBuilderForTests(control.builder);
    const first = getGlobalSearchIndex();
    const second = getGlobalSearchIndex();
    await tick();
    control.reject(0, new Error("mongo down"));
    await assert.rejects(first, /mongo down/);
    await assert.rejects(second, /mongo down/);
    assert.equal(control.calls(), 1);

    const retry = getGlobalSearchIndex();
    await tick();
    assert.equal(control.calls(), 2);
    const recovered = [entry("recovered")];
    control.resolve(1, recovered);
    assert.equal(await retry, recovered);
  });

  it("stops after a bounded number of rebuilds when every build is invalidated", async () => {
    let calls = 0;
    setGlobalSearchIndexBuilderForTests(async () => {
      calls += 1;
      invalidateGlobalSearchIndex();
      return [entry(`build-${calls}`)];
    });
    await assert.rejects(getGlobalSearchIndex(), GlobalSearchIndexUnstableError);
    assert.equal(calls, GLOBAL_SEARCH_INDEX_MAX_BUILD_ATTEMPTS);
  });

  it("translation and moderation invalidations force a rebuild of a warm index", async () => {
    let calls = 0;
    setGlobalSearchIndexBuilderForTests(async () => {
      calls += 1;
      return [entry(`build-${calls}`)];
    });
    assert.equal((await getGlobalSearchIndex())[0]?.entityId, "build-1");
    assert.equal((await getGlobalSearchIndex())[0]?.entityId, "build-1");

    invalidateGlobalSearchIndex();
    assert.equal((await getGlobalSearchIndex())[0]?.entityId, "build-2");

    invalidateOrdinaryPublicInitiativeCaches("p2-moderated-initiative");
    assert.equal((await getGlobalSearchIndex())[0]?.entityId, "build-3");
    assert.equal(calls, 3);
  });

  it("keeps the existing invalidation callers", () => {
    const read = (rel: string) =>
      readFileSync(fileURLToPath(new URL(`../../../src/modules/${rel}`, import.meta.url)), "utf8");
    assert.match(
      read("language/content-translation.service.ts"),
      /await invalidateGlobalSearchIndexLazy\(\);/,
    );
    assert.match(
      read("initiatives/invalidate-ordinary-public-initiative-caches.ts"),
      /invalidateGlobalSearchIndex\(\);/,
    );
    assert.match(
      read("language/terminology-glossary/admin-terminology-glossary.service.ts"),
      /invalidateGlobalSearchIndex\(\);/,
    );
    assert.match(
      read("language/language-registry/language-registry.service.ts"),
      /invalidateGlobalSearchIndex\(\);/,
    );
  });
});
