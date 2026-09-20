/**
 * Localization Simplification Step 06B.1 —
 * Generic future-language multilingual Search acceptance contract.
 *
 * Proves Registry-driven Search for an arbitrary synthetic locale without
 * WEB_UI, Extended Localization READY, PLP, SEO, or Search-core changes.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";

import type { CivicSearchMetadata, TranslatedContentRecord } from "@hu/types";
import {
  emptyLanguageLocalizationCountBucket,
  isLocalizationReadyForSearch,
  isLocalizationReadyForSeo,
  type LanguageLocalizationReadinessReport,
} from "@hu/types";

import {
  enrichSearchEntryWithMultilingual,
  GLOBAL_SEARCH_MULTILINGUAL_SCORES,
  matchGlobalSearchIndex,
  resetGlobalSearchIndexForTests,
  toSearchResult,
} from "../../../src/modules/global-search/index.js";
import type { GlobalSearchIndexEntry } from "../../../src/modules/global-search/global-search.types.js";
import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  resetContentTranslationMemoryStoreForTests,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";
import { upsertContentTranslation } from "../../../src/modules/language/persistence/content-translation.repository.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../",
);

/** Synthetic future locale — not a shipped/seeded/bundled language. */
const FUTURE_LOCALE = "xx-FUT1";
const FUTURE_LANGUAGE_ID = "lang-xx-fut1";
const LOCALIZED_TITLE = "XxFut1 Discovery Title Token";
const LOCALIZED_DESCRIPTION = "XxFut1 discovery summary token for compact Search.";
const UNRELATED_FUTURE_QUERY = "ZzQyx9nonexistentFutureTerm";

function normalizeField(value: string): string {
  return value.trim().toLowerCase();
}

function toMatchableEntry(metadata: CivicSearchMetadata): GlobalSearchIndexEntry {
  const normalizedTranslatedTitles: Record<string, string> = {};
  const normalizedTranslatedSummaries: Record<string, string> = {};

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
    normalizedTerminologyAliasesByLanguage: {},
  };
}

function initiativeEntry(
  entityId: string,
  title: string,
  summary: string,
): CivicSearchMetadata {
  return {
    entityType: "initiative",
    entityId,
    title,
    summary,
    country: "Testland",
    region: "North",
    community: "fixture-community",
    activityArea: "Environment",
    status: "published",
    publicUrl: `/initiatives/${entityId}`,
    updatedAt: "2026-09-13T12:00:00.000Z",
    sourceLanguage: "en",
  };
}

function compactInitiativeCt(input: {
  readonly sourceRecordId: string;
  readonly targetLanguage: string;
  readonly title: string;
  readonly description: string;
}): TranslatedContentRecord {
  return {
    translationId: `translation-${input.sourceRecordId}-${input.targetLanguage}`,
    sourceKind: "initiative",
    sourceRecordId: input.sourceRecordId,
    sourceVersion: "v1",
    sourceLanguage: "en",
    targetLanguage: input.targetLanguage,
    translationProvider: "deterministic",
    translationKind: "machine",
    createdAt: "2026-09-13T12:00:00.000Z",
    stale: false,
    freshness: "current",
    // Initiative CT allowlist: title + description (Search maps description → summary).
    translatedContent: {
      title: input.title,
      description: input.description,
    },
  };
}

function notReadyExtendedLocalizationReport(): LanguageLocalizationReadinessReport {
  return {
    pack: "closure07",
    locale: FUTURE_LOCALE,
    languageId: FUTURE_LANGUAGE_ID,
    engineReady: false,
    languageDataReady: false,
    state: "DATA_NOT_READY",
    registry: {
      enabled: true,
      contentTranslationEnabled: false,
      searchEnabled: true,
      seoIndexingEnabled: false,
      pwaPersistedReadingEnabled: false,
    },
    webUi: {
      engineReady: false,
      dataReady: false,
      requiredKeyCount: 10,
      missingKeyCount: 10,
      emptyKeyCount: 0,
      englishFallbackKeyCount: 0,
      sampleMissingPaths: ["navigation.home"],
    },
    controlledVocabulary: {
      presentationReady: false,
      conceptsChecked: 1,
      conceptsWithTerminologyPreferredTerm: 0,
      conceptsWithWebUiFallbackOnly: 0,
      conceptsMissingLocalizedLabel: 1,
      missingLocalizedLabelConceptIds: [],
      missingPreferredTermGaps: ["discussion"],
    },
    higherAuthority: { brandPublished: null, legalPublished: null, note: null },
    pwaCivic: {
      pwaPersistedReadingEnabled: false,
      pwaPersistedReadingReady: false,
      pwaCivicReadinessStatus: "DISABLED",
      coverage: {
        current: 0, missing: 0, stale: 0, failed: 0, pending: 0, workItemsRequired: 0,
        measuredKindCount: 0, unmeasuredKindCount: 0, coverageMeasurement: "partial_unmeasured",
      },
      note: null,
    },
    ct: {
      ...emptyLanguageLocalizationCountBucket(),
      missing: 5,
      workItemsRequired: 5,
    },
    plpMedia: {
      ...emptyLanguageLocalizationCountBucket(),
      missing: 2,
      workItemsRequired: 2,
    },
    kindRows: [],
    seoReady: false,
    searchLocalizationReady: true,
    PROVIDER_CALLS: 0,
    WRITES_PERFORMED: 0,
    gaps: ["WEB_UI catalog not ready", "Controlled Vocabulary not ready"],
  };
}

async function registerFutureSearchLocale(input?: {
  readonly searchEnabled?: boolean;
}): Promise<void> {
  await createLanguageRegistryRecord({
    languageId: FUTURE_LANGUAGE_ID,
    locale: FUTURE_LOCALE,
    englishName: "Future Fixture One",
    nativeName: "Future Fixture One",
    textDirection: "ltr",
    enabled: true,
    uiTranslationStatus: "none",
    contentTranslationEnabled: false,
    searchEnabled: input?.searchEnabled !== false,
    seoIndexingEnabled: false,
    pwaPersistedReadingEnabled: false,
    aliases: [],
  });
}

describe("Localization Simplification Step 06B.1 — future-language Search acceptance", () => {
  beforeEach(async () => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    resetContentTranslationMemoryStoreForTests();
    resetGlobalSearchIndexForTests();
    await ensureLanguageRegistrySeeded();
  });

  afterEach(() => {
    resetContentTranslationMemoryStoreForTests();
    resetLanguageRegistryStoreForTests();
    resetGlobalSearchIndexForTests();
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("A–C/F/G. synthetic locale: compact CT match + preferred_translation without Extended Localization / SEO", async () => {
    await registerFutureSearchLocale({ searchEnabled: true });

    const readiness = notReadyExtendedLocalizationReport();
    assert.equal(isLocalizationReadyForSearch(readiness), true);
    assert.equal(readiness.languageDataReady, false);
    assert.equal(readiness.state, "DATA_NOT_READY");
    assert.equal(readiness.webUi.dataReady, false);
    assert.equal(readiness.controlledVocabulary.presentationReady, false);
    assert.equal(readiness.registry.seoIndexingEnabled, false);
    // SEO indexable is false because Registry flag is off — independent of EL incompleteness.
    assert.equal(readiness.seoReady, false);
    assert.equal(isLocalizationReadyForSeo(readiness), false);

    const withCt = initiativeEntry(
      "initiative-06b1-localized",
      "Canonical English Discovery Title",
      "Canonical English discovery summary.",
    );

    await upsertContentTranslation(
      compactInitiativeCt({
        sourceRecordId: withCt.entityId,
        targetLanguage: FUTURE_LOCALE,
        title: LOCALIZED_TITLE,
        description: LOCALIZED_DESCRIPTION,
      }),
    );

    // Real Registry + real CT store (no Search-core deps injection).
    const enriched = await enrichSearchEntryWithMultilingual(withCt, {
      listTerminologyConcepts: async () => [],
    });

    assert.ok(
      enriched.translatedFields?.some(
        (field) =>
          field.language === FUTURE_LOCALE &&
          field.title === LOCALIZED_TITLE &&
          field.summary === LOCALIZED_DESCRIPTION &&
          field.freshness === "current",
      ),
      "compact CT title/description must enrich Search translatedFields",
    );

    const matchedTitle = await matchGlobalSearchIndex(
      {
        q: LOCALIZED_TITLE,
        locale: FUTURE_LOCALE,
        limit: 10,
        offset: 0,
      },
      [toMatchableEntry(enriched)],
    );
    assert.equal(matchedTitle.length, 1);
    assert.ok(matchedTitle[0]!.matchedFields.includes("translated_title"));
    assert.ok(
      matchedTitle[0]!.score >= GLOBAL_SEARCH_MULTILINGUAL_SCORES.SCORE_LOCALE_TITLE_EXACT,
    );

    const matchedSummary = await matchGlobalSearchIndex(
      {
        q: "XxFut1 discovery summary token",
        locale: FUTURE_LOCALE,
        limit: 10,
        offset: 0,
      },
      [toMatchableEntry(enriched)],
    );
    assert.equal(matchedSummary.length, 1);
    assert.ok(matchedSummary[0]!.matchedFields.includes("translated_summary"));

    const result = toSearchResult(matchedTitle[0]!, FUTURE_LOCALE);
    assert.equal(result.title, LOCALIZED_TITLE);
    assert.equal(result.summary, LOCALIZED_DESCRIPTION);
    assert.equal(result.presentationMode, "preferred_translation");
    assert.equal(result.displayLanguage, FUTURE_LOCALE);
    assert.equal(result.entityId, withCt.entityId);
  });

  it("D. canonical fallback when no CT exists for the synthetic locale", async () => {
    await registerFutureSearchLocale({ searchEnabled: true });

    const canonicalOnly = initiativeEntry(
      "initiative-06b1-canonical-only",
      "Harbor Cleanup Drive",
      "Community harbor restoration plan.",
    );

    const enriched = await enrichSearchEntryWithMultilingual(canonicalOnly, {
      listTerminologyConcepts: async () => [],
    });
    assert.equal(
      enriched.translatedFields?.some((field) => field.language === FUTURE_LOCALE) ?? false,
      false,
    );

    const englishMatch = await matchGlobalSearchIndex(
      {
        q: "Harbor Cleanup Drive",
        locale: FUTURE_LOCALE,
        limit: 10,
        offset: 0,
      },
      [toMatchableEntry(enriched)],
    );
    assert.equal(englishMatch.length, 1);
    const original = toSearchResult(englishMatch[0]!, FUTURE_LOCALE);
    assert.equal(original.title, "Harbor Cleanup Drive");
    assert.equal(original.summary, "Community harbor restoration plan.");
    assert.equal(original.presentationMode, "original");

    const nonsense = await matchGlobalSearchIndex(
      {
        q: UNRELATED_FUTURE_QUERY,
        locale: FUTURE_LOCALE,
        limit: 10,
        offset: 0,
      },
      [toMatchableEntry(enriched)],
    );
    assert.equal(nonsense.length, 0);
  });

  it("E. searchEnabled=false excludes synthetic-locale CT without breaking canonical Search", async () => {
    await registerFutureSearchLocale({ searchEnabled: true });
    await updateLanguageRegistryRecord(FUTURE_LANGUAGE_ID, {
      searchEnabled: false,
    });

    const withCt = initiativeEntry(
      "initiative-06b1-search-disabled",
      "Canonical English Discovery Title",
      "Canonical English discovery summary.",
    );

    await upsertContentTranslation(
      compactInitiativeCt({
        sourceRecordId: withCt.entityId,
        targetLanguage: FUTURE_LOCALE,
        title: LOCALIZED_TITLE,
        description: LOCALIZED_DESCRIPTION,
      }),
    );

    const enriched = await enrichSearchEntryWithMultilingual(withCt, {
      listTerminologyConcepts: async () => [],
    });
    assert.equal(enriched.translatedFields?.length ?? 0, 0);

    const localizedMiss = await matchGlobalSearchIndex(
      {
        q: LOCALIZED_TITLE,
        locale: FUTURE_LOCALE,
        limit: 10,
        offset: 0,
      },
      [toMatchableEntry(enriched)],
    );
    assert.equal(localizedMiss.length, 0);

    const canonicalHit = await matchGlobalSearchIndex(
      {
        q: "Canonical English Discovery Title",
        limit: 10,
        offset: 0,
      },
      [toMatchableEntry(enriched)],
    );
    assert.equal(canonicalHit.length, 1);
    assert.equal(
      toSearchResult(canonicalHit[0]!).presentationMode,
      "original",
    );
  });

  it("H. synthetic locale is not hardcoded into Search/seed production surfaces", () => {
    const searchDir = path.join(repoRoot, "apps/api/src/modules/global-search");
    const seed = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/language/language-registry/language-registry.seed.ts",
      ),
      "utf8",
    );
    const multilingual = readFileSync(
      path.join(searchDir, "global-search-multilingual.ts"),
      "utf8",
    );
    const matching = readFileSync(
      path.join(searchDir, "global-search.matching.ts"),
      "utf8",
    );

    for (const src of [seed, multilingual, matching]) {
      assert.doesNotMatch(src, new RegExp(FUTURE_LOCALE.replace("-", "\\-")));
      assert.doesNotMatch(src, /lang-xx-fut1/);
      assert.doesNotMatch(src, /\b(?:ka|he)\b/);
    }

    assert.doesNotMatch(multilingual, /languageDataReady|WEB_UI|seoIndexingEnabled/);
    assert.doesNotMatch(matching, /languageDataReady|WEB_UI|seoIndexingEnabled/);
  });
});
