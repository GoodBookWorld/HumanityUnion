/**
 * Production Completion Pack 02H — multilingual Global Search seam.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.INITIATIVE_PERSISTENCE = "memory";

import type {
  CivicSearchMetadata,
  LanguageRegistryRecord,
  TerminologyConcept,
  TranslatedContentRecord,
} from "@hu/types";

import {
  enrichSearchEntryWithMultilingual,
  GLOBAL_SEARCH_ENTITY_TRANSLATION_SOURCE_KIND,
  GLOBAL_SEARCH_MULTILINGUAL_SCORES,
  matchGlobalSearchIndex,
  parseCivicSearchQuery,
  resetGlobalSearchIndexForTests,
  toSearchResult,
} from "../../../src/modules/global-search/index.js";
import type { GlobalSearchIndexEntry } from "../../../src/modules/global-search/global-search.types.js";
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
import { upsertContentTranslation } from "../../../src/modules/language/persistence/content-translation.repository.js";

function baseEntry(overrides?: Partial<CivicSearchMetadata>): CivicSearchMetadata {
  return {
    entityType: "initiative",
    entityId: "initiative-08h-1",
    title: "Clean River Initiative",
    summary: "Restore the local river with community action.",
    country: "Ukraine",
    region: "Kyiv",
    community: "test-community",
    activityArea: "Environment",
    status: "published",
    publicUrl: "/initiatives/initiative-08h-1",
    updatedAt: "2026-09-01T12:00:00.000Z",
    ...overrides,
  };
}

function normalizeField(value: string): string {
  return value.trim().toLowerCase();
}

function toMatchableEntry(metadata: CivicSearchMetadata): GlobalSearchIndexEntry {
  const normalizedTranslatedTitles: Record<string, string> = {};
  const normalizedTranslatedSummaries: Record<string, string> = {};
  const terminologyBuckets = new Map<string, Set<string>>();

  for (const field of metadata.translatedFields ?? []) {
    if (field.freshness !== "current") {
      continue;
    }
    if (field.title) {
      normalizedTranslatedTitles[field.language] = normalizeField(field.title);
    }
    if (field.summary) {
      normalizedTranslatedSummaries[field.language] = normalizeField(field.summary);
    }
  }

  for (const alias of metadata.terminologyAliases ?? []) {
    const bucket = terminologyBuckets.get(alias.language) ?? new Set<string>();
    bucket.add(normalizeField(alias.term));
    terminologyBuckets.set(alias.language, bucket);
  }

  const normalizedTerminologyAliasesByLanguage: Record<string, readonly string[]> = {};
  for (const [language, terms] of terminologyBuckets.entries()) {
    normalizedTerminologyAliasesByLanguage[language] = [...terms].sort((a, b) =>
      a.localeCompare(b),
    );
  }

  return {
    ...metadata,
    normalizedTitle: normalizeField(metadata.title),
    normalizedSummary: normalizeField(metadata.summary),
    normalizedCountry: normalizeField(metadata.country),
    normalizedRegion: normalizeField(metadata.region),
    normalizedCommunity: normalizeField(metadata.community),
    normalizedActivityArea: normalizeField(metadata.activityArea),
    normalizedStatus: normalizeField(metadata.status),
    normalizedEntityType: normalizeField(metadata.entityType),
    normalizedCountryLabel: "",
    normalizedRegionLabel: "",
    normalizedCountryCode: "",
    normalizedRegionCode: "",
    normalizedTranslatedTitles,
    normalizedTranslatedSummaries,
    normalizedTerminologyAliasesByLanguage,
  };
}

function translationRecord(
  overrides: Partial<TranslatedContentRecord> &
    Pick<TranslatedContentRecord, "targetLanguage" | "translatedContent">,
): TranslatedContentRecord {
  return {
    translationId: `translation-${overrides.targetLanguage}`,
    sourceKind: "initiative",
    sourceRecordId: "initiative-08h-1",
    sourceVersion: "v1",
    sourceLanguage: "en",
    translationProvider: "deterministic",
    translationKind: "machine",
    createdAt: "2026-09-01T12:00:00.000Z",
    stale: false,
    freshness: "current",
    ...overrides,
  };
}

const searchEnabledUk: LanguageRegistryRecord = {
  languageId: "lang-uk",
  locale: "uk",
  languageCode: "uk",
  englishName: "Ukrainian",
  nativeName: "Українська",
  textDirection: "ltr",
  fallbackLocale: "en",
  enabled: true,
  uiTranslationStatus: "complete",
  contentTranslationEnabled: true,
  searchEnabled: true,
  seoIndexingEnabled: true,
  aliases: [],
  providerMappings: {},
  createdAt: "2026-08-30T00:00:00.000Z",
  updatedAt: "2026-08-30T00:00:00.000Z",
};

const searchEnabledZhHant: LanguageRegistryRecord = {
  languageId: "lang-zh-Hant",
  locale: "zh-Hant",
  languageCode: "zh",
  englishName: "Chinese (Traditional)",
  nativeName: "繁體中文",
  textDirection: "ltr",
  fallbackLocale: "en",
  enabled: true,
  uiTranslationStatus: "complete",
  contentTranslationEnabled: true,
  searchEnabled: true,
  seoIndexingEnabled: true,
  aliases: ["zh-TW", "zh-HK"],
  providerMappings: {},
  createdAt: "2026-08-30T00:00:00.000Z",
  updatedAt: "2026-08-30T00:00:00.000Z",
};

const searchEnabledEn: LanguageRegistryRecord = {
  languageId: "lang-en",
  locale: "en",
  languageCode: "en",
  englishName: "English",
  nativeName: "English",
  textDirection: "ltr",
  fallbackLocale: "en",
  enabled: true,
  uiTranslationStatus: "complete",
  contentTranslationEnabled: false,
  searchEnabled: true,
  seoIndexingEnabled: true,
  aliases: [],
  providerMappings: {},
  createdAt: "2026-08-30T00:00:00.000Z",
  updatedAt: "2026-08-30T00:00:00.000Z",
};

describe("Production Completion Pack 02H — multilingual Global Search", () => {
  beforeEach(async () => {
    setLanguageRegistryForceMemoryForTests(true);
    setTerminologyGlossaryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    resetTerminologyGlossaryStoreForTests();
    resetContentTranslationMemoryStoreForTests();
    resetGlobalSearchIndexForTests();
    await ensureLanguageRegistrySeeded();
    await ensureTerminologyGlossarySeeded();
    await updateLanguageRegistryRecord("lang-uk", {
      enabled: true,
      searchEnabled: true,
      contentTranslationEnabled: true,
    });
    await updateLanguageRegistryRecord("lang-zh-Hant", {
      enabled: true,
      searchEnabled: true,
      contentTranslationEnabled: true,
    });
  });

  afterEach(() => {
    resetContentTranslationMemoryStoreForTests();
    resetTerminologyGlossaryStoreForTests();
    resetLanguageRegistryStoreForTests();
    resetGlobalSearchIndexForTests();
    setTerminologyGlossaryForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("matches canonical English title without locale", async () => {
    const enriched = await enrichSearchEntryWithMultilingual(baseEntry(), {
      listSearchEnabledLanguages: async () => [searchEnabledEn],
      listTranslationsForSource: async () => [],
      listTerminologyConcepts: async () => [],
    });
    const index = [toMatchableEntry(enriched)];
    const matched = await matchGlobalSearchIndex(
      { q: "Clean River Initiative", limit: 10, offset: 0 },
      index,
    );
    assert.equal(matched.length, 1);
    assert.ok(matched[0]!.score >= GLOBAL_SEARCH_MULTILINGUAL_SCORES.SCORE_EXACT_TITLE);
    assert.ok(matched[0]!.matchedFields.includes("title"));
  });

  it("matches current Ukrainian translation title", async () => {
    await upsertContentTranslation(
      translationRecord({
        targetLanguage: "uk",
        translatedContent: {
          title: "Ініціатива Чиста Річка",
          summary: "Відновити місцеву річку спільно.",
        },
      }),
    );

    const enriched = await enrichSearchEntryWithMultilingual(baseEntry());
    assert.ok(enriched.translatedFields?.some((field) => field.language === "uk"));

    const matched = await matchGlobalSearchIndex(
      {
        q: "Ініціатива Чиста Річка",
        locale: "uk",
        limit: 10,
        offset: 0,
      },
      [toMatchableEntry(enriched)],
    );
    assert.equal(matched.length, 1);
    assert.ok(matched[0]!.matchedFields.includes("translated_title"));
    assert.ok(
      matched[0]!.score >= GLOBAL_SEARCH_MULTILINGUAL_SCORES.SCORE_LOCALE_TITLE_EXACT,
    );

    const result = toSearchResult(matched[0]!, "uk");
    assert.equal(result.title, "Ініціатива Чиста Річка");
    assert.equal(result.presentationMode, "preferred_translation");
    assert.equal(result.displayLanguage, "uk");
    assert.equal(result.publicUrl, "/initiatives/initiative-08h-1");
    assert.equal(result.entityId, "initiative-08h-1");
  });

  it("excludes stale translations from enrichment and matching", async () => {
    const enriched = await enrichSearchEntryWithMultilingual(baseEntry(), {
      listSearchEnabledLanguages: async () => [searchEnabledEn, searchEnabledUk],
      resolveLocale: async (locale) => {
        if (locale === "uk") {
          return searchEnabledUk;
        }
        return searchEnabledEn;
      },
      listTranslationsForSource: async () => [
        translationRecord({
          targetLanguage: "uk",
          freshness: "stale",
          stale: true,
          translatedContent: {
            title: "Застарілий Заголовок",
            summary: "Stale summary",
          },
        }),
      ],
      listTerminologyConcepts: async () => [],
    });

    assert.equal(enriched.translatedFields?.length ?? 0, 0);

    const matched = await matchGlobalSearchIndex(
      { q: "Застарілий Заголовок", locale: "uk", limit: 10, offset: 0 },
      [toMatchableEntry(enriched)],
    );
    assert.equal(matched.length, 0);
  });

  it("matches terminology alias for search-enabled locale", async () => {
    await updateTerminologyConcept("initiative", {
      translations: {
        uk: {
          preferredTerm: "Ініціатива",
          aliases: ["громадська ініціатива"],
        },
      },
      status: "published",
    });

    const enriched = await enrichSearchEntryWithMultilingual(baseEntry());
    assert.ok(
      enriched.terminologyAliases?.some(
        (alias) => alias.language === "uk" && alias.term === "громадська ініціатива",
      ),
    );

    const matched = await matchGlobalSearchIndex(
      { q: "громадська ініціатива", locale: "uk", limit: 10, offset: 0 },
      [toMatchableEntry(enriched)],
    );
    assert.equal(matched.length, 1);
    assert.ok(matched[0]!.matchedFields.includes("terminology_alias"));
  });

  it("resolves zh-TW alias to zh-Hant for matching", async () => {
    const enriched = await enrichSearchEntryWithMultilingual(baseEntry(), {
      listSearchEnabledLanguages: async () => [searchEnabledEn, searchEnabledZhHant],
      resolveLocale: async (locale) => {
        if (locale === "zh-TW" || locale === "zh-Hant" || locale === "zh-HK") {
          return searchEnabledZhHant;
        }
        return searchEnabledEn;
      },
      listTranslationsForSource: async () => [
        translationRecord({
          targetLanguage: "zh-TW",
          translatedContent: {
            title: "清潔河流倡議",
            summary: "與社區一起恢復當地河流。",
          },
        }),
      ],
      listTerminologyConcepts: async () => [],
    });

    assert.ok(enriched.translatedFields?.some((field) => field.language === "zh-Hant"));
    assert.equal(
      enriched.translatedFields?.some((field) => field.language === "zh-TW"),
      false,
    );

    const matched = await matchGlobalSearchIndex(
      { q: "清潔河流倡議", locale: "zh-TW", limit: 10, offset: 0 },
      [toMatchableEntry(enriched)],
    );
    assert.equal(matched.length, 1);
    assert.ok(matched[0]!.matchedFields.includes("translated_title"));

    const result = toSearchResult(matched[0]!, "zh-Hant");
    assert.equal(result.title, "清潔河流倡議");
    assert.equal(result.presentationMode, "preferred_translation");
  });

  it("enrichment is idempotent without duplicate translatedFields or terminologyAliases", async () => {
    const concepts: TerminologyConcept[] = [
      {
        conceptId: "initiative",
        canonicalEnglishTerm: "Initiative",
        category: "workflow_stage",
        linkedRefs: { civicEntityType: "initiative" },
        translations: {
          uk: { preferredTerm: "Ініціатива", aliases: ["ініціатива", "Ініціатива"] },
        },
        status: "published",
        createdAt: "2026-08-31T00:00:00.000Z",
        updatedAt: "2026-08-31T00:00:00.000Z",
      },
    ];

    const deps = {
      listSearchEnabledLanguages: async () => [searchEnabledEn, searchEnabledUk],
      resolveLocale: async (locale: string) =>
        locale === "uk" ? searchEnabledUk : searchEnabledEn,
      listTranslationsForSource: async () => [
        translationRecord({
          targetLanguage: "uk",
          translatedContent: {
            title: "Ініціатива Чиста Річка",
            summary: "Відновити місцеву річку спільно.",
          },
        }),
      ],
      listTerminologyConcepts: async () => concepts,
    };

    const first = await enrichSearchEntryWithMultilingual(baseEntry(), deps);
    const second = await enrichSearchEntryWithMultilingual(first, deps);

    assert.deepEqual(second.translatedFields, first.translatedFields);
    assert.deepEqual(second.terminologyAliases, first.terminologyAliases);
    assert.deepEqual(second.searchableLanguageCodes, first.searchableLanguageCodes);

    const ukTitles = (second.translatedFields ?? []).filter((field) => field.language === "uk");
    assert.equal(ukTitles.length, 1);

    const aliasKeys = new Set(
      (second.terminologyAliases ?? []).map(
        (alias) => `${alias.language}::${alias.term}::${alias.conceptId ?? ""}`,
      ),
    );
    assert.equal(aliasKeys.size, (second.terminologyAliases ?? []).length);
  });

  it("private entityTypes are never accepted by parseEntityTypes", () => {
    const privateTypes = [
      "direct_conversation",
      "blog_author_application",
      "editor_grant",
      "member_badge_contribution",
    ];

    for (const entityType of privateTypes) {
      const query = parseCivicSearchQuery({
        q: "x",
        entityType,
        limit: "10",
        offset: "0",
      });
      assert.equal(query.entityTypes, undefined, `private type leaked: ${entityType}`);
      assert.equal(
        Object.prototype.hasOwnProperty.call(
          GLOBAL_SEARCH_ENTITY_TRANSLATION_SOURCE_KIND,
          entityType,
        ),
        false,
      );
    }

    const allowed = parseCivicSearchQuery({
      entityType: "petition,civic_nomination",
      limit: "10",
      offset: "0",
    });
    assert.deepEqual(allowed.entityTypes, ["petition", "civic_nomination"]);
  });

  it("keeps publicUrl canonical when display title is localized", async () => {
    const enriched = await enrichSearchEntryWithMultilingual(baseEntry(), {
      listSearchEnabledLanguages: async () => [searchEnabledEn, searchEnabledUk],
      resolveLocale: async (locale) => (locale === "uk" ? searchEnabledUk : searchEnabledEn),
      listTranslationsForSource: async () => [
        translationRecord({
          targetLanguage: "uk",
          translatedContent: {
            title: "Локалізований заголовок",
            summary: "Локалізований опис",
          },
        }),
      ],
      listTerminologyConcepts: async () => [],
    });

    const matched = await matchGlobalSearchIndex(
      { q: "Локалізований заголовок", locale: "uk", limit: 5, offset: 0 },
      [toMatchableEntry(enriched)],
    );
    assert.equal(matched.length, 1);
    const result = toSearchResult(matched[0]!, "uk");
    assert.equal(result.publicUrl, "/initiatives/initiative-08h-1");
    assert.equal(result.title, "Локалізований заголовок");
    assert.notEqual(result.title, baseEntry().title);
    assert.equal(result.presentationMode, "preferred_translation");
  });

  it("maps initiative description field onto searchable summary", async () => {
    const enriched = await enrichSearchEntryWithMultilingual(baseEntry(), {
      listSearchEnabledLanguages: async () => [searchEnabledEn, searchEnabledUk],
      resolveLocale: async (locale) => (locale === "uk" ? searchEnabledUk : searchEnabledEn),
      listTranslationsForSource: async () => [
        translationRecord({
          targetLanguage: "uk",
          translatedContent: {
            title: "Ініціатива Чиста Річка",
            description: "Опис ініціативи для пошуку",
          },
        }),
      ],
      listTerminologyConcepts: async () => [],
    });

    assert.equal(
      enriched.translatedFields?.find((field) => field.language === "uk")?.summary,
      "Опис ініціативи для пошуку",
    );

    const matched = await matchGlobalSearchIndex(
      { q: "Опис ініціативи для пошуку", locale: "uk", limit: 5, offset: 0 },
      [toMatchableEntry(enriched)],
    );
    assert.equal(matched.length, 1);
    assert.ok(matched[0]!.matchedFields.includes("translated_summary"));
  });

  it("matches Arabic current translation and prefers English canonical fallback display", async () => {
    const searchEnabledAr: LanguageRegistryRecord = {
      ...searchEnabledUk,
      languageId: "lang-ar",
      locale: "ar",
      languageCode: "ar",
      englishName: "Arabic",
      nativeName: "العربية",
      textDirection: "rtl",
    };

    const enriched = await enrichSearchEntryWithMultilingual(baseEntry(), {
      listSearchEnabledLanguages: async () => [searchEnabledEn, searchEnabledAr],
      resolveLocale: async (locale) => {
        if (locale === "ar") {
          return searchEnabledAr;
        }
        return searchEnabledEn;
      },
      listTranslationsForSource: async () => [
        translationRecord({
          targetLanguage: "ar",
          translatedContent: {
            title: "مبادرة النهر النظيف",
            summary: "استعادة النهر المحلي مع المجتمع.",
          },
        }),
      ],
      listTerminologyConcepts: async () => [],
    });

    const arMatched = await matchGlobalSearchIndex(
      { q: "مبادرة النهر النظيف", locale: "ar", limit: 5, offset: 0 },
      [toMatchableEntry(enriched)],
    );
    assert.equal(arMatched.length, 1);
    assert.ok(arMatched[0]!.matchedFields.includes("translated_title"));

    const enFallback = toSearchResult(arMatched[0]!, "uk");
    assert.equal(enFallback.title, baseEntry().title);
    assert.equal(enFallback.presentationMode, "original");
    assert.equal(enFallback.publicUrl, "/initiatives/initiative-08h-1");

    const enQuery = await matchGlobalSearchIndex(
      { q: "Clean River Initiative", locale: "en", limit: 5, offset: 0 },
      [toMatchableEntry(enriched)],
    );
    assert.equal(enQuery.length, 1);
    assert.ok(enQuery[0]!.matchedFields.includes("title"));
  });

  it("excludes translations for disabled or non-search-enabled languages", async () => {
    const disabledUk: LanguageRegistryRecord = {
      ...searchEnabledUk,
      enabled: true,
      searchEnabled: false,
    };

    const enriched = await enrichSearchEntryWithMultilingual(baseEntry(), {
      listSearchEnabledLanguages: async () => [searchEnabledEn],
      resolveLocale: async (locale) => {
        if (locale === "uk") {
          return disabledUk;
        }
        return searchEnabledEn;
      },
      listTranslationsForSource: async () => [
        translationRecord({
          targetLanguage: "uk",
          translatedContent: {
            title: "Немає індексу",
            summary: "Не повинен індексуватись",
          },
        }),
      ],
      listTerminologyConcepts: async () => [],
    });

    assert.equal(enriched.translatedFields?.length ?? 0, 0);

    const matched = await matchGlobalSearchIndex(
      { q: "Немає індексу", locale: "uk", limit: 5, offset: 0 },
      [toMatchableEntry(enriched)],
    );
    assert.equal(matched.length, 0);
  });

  it("translation update replaces prior language representation without duplicates", async () => {
    const deps = {
      listSearchEnabledLanguages: async () => [searchEnabledEn, searchEnabledUk],
      resolveLocale: async (locale: string) =>
        locale === "uk" ? searchEnabledUk : searchEnabledEn,
      listTranslationsForSource: async () => [
        translationRecord({
          translationId: "translation-uk-v1",
          targetLanguage: "uk",
          sourceVersion: "v1",
          translatedContent: {
            title: "Стара назва",
            summary: "Старий опис",
          },
        }),
        translationRecord({
          translationId: "translation-uk-v2",
          targetLanguage: "uk",
          sourceVersion: "v2",
          translatedContent: {
            title: "Нова назва",
            summary: "Новий опис",
          },
        }),
      ],
      listTerminologyConcepts: async () => [],
    };

    const enriched = await enrichSearchEntryWithMultilingual(baseEntry(), deps);
    const ukFields = (enriched.translatedFields ?? []).filter((field) => field.language === "uk");
    assert.equal(ukFields.length, 1);

    const matchedOld = await matchGlobalSearchIndex(
      { q: "Стара назва", locale: "uk", limit: 5, offset: 0 },
      [toMatchableEntry(enriched)],
    );
    const matchedNew = await matchGlobalSearchIndex(
      { q: "Нова назва", locale: "uk", limit: 5, offset: 0 },
      [toMatchableEntry(enriched)],
    );

    assert.equal(ukFields.length, 1);
    assert.equal(ukFields[0]!.title, "Нова назва");
    assert.equal(matchedOld.length, 0);
    assert.equal(matchedNew.length, 1);
  });

  it("does not display stale translatedFields as preferred current content", () => {
    const entry = toMatchableEntry({
      ...baseEntry(),
      translatedFields: [
        {
          language: "uk",
          title: "Застарілий заголовок",
          summary: "Застарілий опис",
          freshness: "stale",
          sourceVersion: "v0",
        },
      ],
    });

    const result = toSearchResult(
      {
        entry,
        score: 1,
        matchedFields: ["title"],
        explanation: "fixture",
      },
      "uk",
    );
    assert.equal(result.title, baseEntry().title);
    assert.equal(result.presentationMode, "original");
    assert.equal(result.publicUrl, "/initiatives/initiative-08h-1");
  });
});

describe("Pack 02H — ranking regression", () => {
  beforeEach(async () => {
    setLanguageRegistryForceMemoryForTests(true);
    setTerminologyGlossaryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    resetTerminologyGlossaryStoreForTests();
    resetGlobalSearchIndexForTests();
    await ensureLanguageRegistrySeeded();
    await ensureTerminologyGlossarySeeded();
    await updateLanguageRegistryRecord("lang-uk", {
      enabled: true,
      searchEnabled: true,
      contentTranslationEnabled: true,
    });
  });

  afterEach(() => {
    resetTerminologyGlossaryStoreForTests();
    resetLanguageRegistryStoreForTests();
    resetGlobalSearchIndexForTests();
    setTerminologyGlossaryForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("documents score invariants used by ranking policy", () => {
    const s = GLOBAL_SEARCH_MULTILINGUAL_SCORES;
    assert.ok(s.SCORE_LOCALE_TITLE_EXACT > s.SCORE_EXACT_TITLE);
    assert.ok(s.SCORE_EXACT_TITLE > s.SCORE_LOCALE_TITLE_CONTAINS);
    assert.ok(s.SCORE_EXACT_TITLE > s.SCORE_TERMINOLOGY_ALIAS);
    assert.ok(s.SCORE_TERMINOLOGY_ALIAS > s.SCORE_TITLE_CONTAINS);
    assert.ok(s.SCORE_LOCALE_SUMMARY < s.SCORE_TITLE_CONTAINS);
  });

  it("A: English/canonical queries preserve exact-over-contains ordering with no multilingual signal", async () => {
    const exact = toMatchableEntry(
      baseEntry({
        entityId: "exact-1",
        title: "Clean River Initiative",
        summary: "Canonical exact title holder.",
        publicUrl: "/initiatives/exact-1",
        updatedAt: "2026-09-01T10:00:00.000Z",
      }),
    );
    const contains = toMatchableEntry(
      baseEntry({
        entityId: "contains-1",
        title: "About the Clean River Initiative project",
        summary: "Weaker title-contains match.",
        publicUrl: "/initiatives/contains-1",
        updatedAt: "2026-09-01T12:00:00.000Z",
      }),
    );

    const matched = await matchGlobalSearchIndex(
      { q: "Clean River Initiative", limit: 10, offset: 0 },
      [contains, exact],
    );
    assert.equal(matched.length, 2);
    assert.equal(matched[0]!.entry.entityId, "exact-1");
    assert.equal(matched[0]!.score, GLOBAL_SEARCH_MULTILINGUAL_SCORES.SCORE_EXACT_TITLE);
    assert.equal(matched[1]!.entry.entityId, "contains-1");
    assert.ok(matched[1]!.score < matched[0]!.score);
  });

  it("B: preferred-locale exact translation outranks canonical exact only when that locale matches", async () => {
    const canonicalExact = toMatchableEntry(
      baseEntry({
        entityId: "en-exact",
        title: "Shared Phrase",
        summary: "English exact.",
        publicUrl: "/initiatives/en-exact",
        updatedAt: "2026-09-01T12:00:00.000Z",
      }),
    );
    const localeExact = toMatchableEntry({
      ...baseEntry({
        entityId: "uk-exact",
        title: "English Title Unrelated",
        summary: "Canonical does not match query.",
        publicUrl: "/initiatives/uk-exact",
        updatedAt: "2026-09-01T11:00:00.000Z",
      }),
      translatedFields: [
        {
          language: "uk",
          title: "Shared Phrase",
          summary: "Український точний збіг",
          freshness: "current",
        },
      ],
      normalizedTranslatedTitles: { uk: "shared phrase" },
      normalizedTranslatedSummaries: { uk: "український точний збіг" },
      normalizedTerminologyAliasesByLanguage: {},
    });

    const preferred = await matchGlobalSearchIndex(
      { q: "Shared Phrase", locale: "uk", limit: 10, offset: 0 },
      [canonicalExact, localeExact],
    );
    assert.equal(preferred[0]!.entry.entityId, "uk-exact");
    assert.equal(
      preferred[0]!.score,
      GLOBAL_SEARCH_MULTILINGUAL_SCORES.SCORE_LOCALE_TITLE_EXACT,
    );
    assert.equal(preferred[1]!.entry.entityId, "en-exact");
    assert.equal(preferred[1]!.score, GLOBAL_SEARCH_MULTILINGUAL_SCORES.SCORE_EXACT_TITLE);

    const withoutLocale = await matchGlobalSearchIndex(
      { q: "Shared Phrase", limit: 10, offset: 0 },
      [canonicalExact, localeExact],
    );
    // Unpreferred locale exact is preferred − 200 → still above English exact (5300 > 5000).
    assert.equal(withoutLocale[0]!.entry.entityId, "uk-exact");
    assert.equal(
      withoutLocale[0]!.score,
      GLOBAL_SEARCH_MULTILINGUAL_SCORES.SCORE_LOCALE_TITLE_EXACT -
        GLOBAL_SEARCH_MULTILINGUAL_SCORES.SCORE_UNPREFERRED_LOCALE_DELTA,
    );
  });

  it("C: unrelated translated field cannot outrank a stronger canonical match", async () => {
    const canonicalExact = toMatchableEntry(
      baseEntry({
        entityId: "canonical-strong",
        title: "Harbor Cleanup Drive",
        summary: "Strong English exact title.",
        publicUrl: "/initiatives/canonical-strong",
        updatedAt: "2026-09-01T10:00:00.000Z",
      }),
    );
    const unrelatedLocale = toMatchableEntry({
      ...baseEntry({
        entityId: "locale-unrelated",
        title: "Different English Title",
        summary: "Harbor Cleanup Drive appears only in an unrelated language bag.",
        publicUrl: "/initiatives/locale-unrelated",
        updatedAt: "2026-09-01T12:00:00.000Z",
      }),
      translatedFields: [
        {
          language: "uk",
          title: "Повністю інший заголовок",
          summary: "Не повʼязано з запитом",
          freshness: "current",
        },
      ],
      normalizedTranslatedTitles: { uk: "повністю інший заголовок" },
      normalizedTranslatedSummaries: { uk: "не повʼязано з запитом" },
      normalizedTerminologyAliasesByLanguage: {},
    });

    const matched = await matchGlobalSearchIndex(
      { q: "Harbor Cleanup Drive", locale: "uk", limit: 10, offset: 0 },
      [unrelatedLocale, canonicalExact],
    );
    assert.equal(matched[0]!.entry.entityId, "canonical-strong");
    assert.equal(matched[0]!.score, GLOBAL_SEARCH_MULTILINGUAL_SCORES.SCORE_EXACT_TITLE);
    assert.ok(
      matched.every((row) => row.entry.entityId !== "locale-unrelated") ||
        matched[0]!.entry.entityId === "canonical-strong",
    );
    // Summary-contains on the unrelated doc may still match English summary text.
    const unrelatedRow = matched.find((row) => row.entry.entityId === "locale-unrelated");
    if (unrelatedRow) {
      assert.ok(unrelatedRow.score < matched[0]!.score);
    }
  });

  it("D: terminology alias cannot overwhelm an exact canonical title match", async () => {
    const exactTitle = toMatchableEntry(
      baseEntry({
        entityId: "title-exact",
        title: "Civic Initiative",
        summary: "Exact title document.",
        publicUrl: "/initiatives/title-exact",
        updatedAt: "2026-09-01T09:00:00.000Z",
      }),
    );
    const aliasOnly = toMatchableEntry({
      ...baseEntry({
        entityId: "alias-only",
        title: "Other Record",
        summary: "Matches only via glossary alias.",
        publicUrl: "/initiatives/alias-only",
        updatedAt: "2026-09-01T12:00:00.000Z",
      }),
      terminologyAliases: [{ language: "uk", term: "Civic Initiative", conceptId: "initiative" }],
      normalizedTranslatedTitles: {},
      normalizedTranslatedSummaries: {},
      normalizedTerminologyAliasesByLanguage: { uk: ["civic initiative"] },
    });

    const matched = await matchGlobalSearchIndex(
      { q: "Civic Initiative", locale: "uk", limit: 10, offset: 0 },
      [aliasOnly, exactTitle],
    );
    assert.equal(matched[0]!.entry.entityId, "title-exact");
    assert.equal(matched[0]!.score, GLOBAL_SEARCH_MULTILINGUAL_SCORES.SCORE_EXACT_TITLE);
    assert.equal(matched[1]!.entry.entityId, "alias-only");
    assert.equal(
      matched[1]!.score,
      GLOBAL_SEARCH_MULTILINGUAL_SCORES.SCORE_TERMINOLOGY_ALIAS,
    );
    assert.ok(matched[1]!.score < matched[0]!.score);
  });

  it("E: equal scores use updatedAt then entityType:entityId for deterministic ties", async () => {
    const older = toMatchableEntry(
      baseEntry({
        entityId: "tie-b",
        title: "Equal Score Title",
        summary: "Older timestamp.",
        publicUrl: "/initiatives/tie-b",
        updatedAt: "2026-09-01T08:00:00.000Z",
      }),
    );
    const newer = toMatchableEntry(
      baseEntry({
        entityId: "tie-a",
        title: "Equal Score Title",
        summary: "Newer timestamp.",
        publicUrl: "/initiatives/tie-a",
        updatedAt: "2026-09-01T12:00:00.000Z",
      }),
    );
    const sameTimeLaterId = toMatchableEntry(
      baseEntry({
        entityId: "tie-c",
        title: "Equal Score Title",
        summary: "Same time, later id.",
        publicUrl: "/initiatives/tie-c",
        updatedAt: "2026-09-01T12:00:00.000Z",
      }),
    );

    const matched = await matchGlobalSearchIndex(
      { q: "Equal Score Title", limit: 10, offset: 0 },
      [older, sameTimeLaterId, newer],
    );
    assert.deepEqual(
      matched.map((row) => row.entry.entityId),
      ["tie-a", "tie-c", "tie-b"],
    );
    assert.equal(matched[0]!.score, matched[1]!.score);
    assert.equal(matched[1]!.score, matched[2]!.score);
  });
});
