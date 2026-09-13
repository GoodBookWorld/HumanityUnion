/**
 * Localization Simplification Step 06C.1 —
 * Initiative Search discovery warm vertical slice.
 *
 * Synthetic Registry locale only (not Georgian/Hebrew).
 * Deterministic/mocked provider — no Staging / live provider jobs.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";
process.env.CONTENT_TRANSLATION_WARM_LOCALE_CONCURRENCY = "1";

import type { CivicSearchMetadata, Initiative } from "@hu/types";
import {
  deriveLanguageLocalizationReadinessState,
  emptyLanguageLocalizationCountBucket,
  isLocalizationReadyForSearch,
} from "@hu/types";

import {
  enrichSearchEntryWithMultilingual,
  matchGlobalSearchIndex,
  resetGlobalSearchIndexForTests,
  toSearchResult,
} from "../../../src/modules/global-search/index.js";
import type { GlobalSearchIndexEntry } from "../../../src/modules/global-search/global-search.types.js";
import {
  DeterministicTranslationProvider,
  assertSearchDiscoveryTargetLocale,
  createLanguageRegistryRecord,
  enqueueContentTranslationWarmRequested,
  ensureLanguageRegistrySeeded,
  ensureTerminologyGlossarySeeded,
  getOrCreateContentTranslation,
  listContentTranslationWarmMemoryPendingForTests,
  listSearchDiscoveryContentTranslationTargetLocales,
  processContentTranslationWarmMemoryQueueForTests,
  resetContentTranslationMemoryStoreForTests,
  resetContentTranslationWarmMemoryForTests,
  resetLanguageRegistryStoreForTests,
  resetTerminologyGlossaryStoreForTests,
  resetTranslationProviderForTests,
  scheduleContentTranslationWarmAfterMutation,
  setContentTranslationWarmForceMemoryForTests,
  setLanguageRegistryAdminAssertOverrideForTests,
  setLanguageRegistryForceMemoryForTests,
  setTerminologyGlossaryForceMemoryForTests,
  setTranslationProviderForTests,
  updateAdminLanguage,
  updateLanguageRegistryRecord,
  TranslationProviderError,
} from "../../../src/modules/language/index.js";
import {
  resetAdministrationAuditMemoryForTests,
  setAdministrationAuditForceMemoryForTests,
} from "../../../src/modules/administration/index.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../..",
);

const DISCOVERY_LOCALE = "xx-DISC1";
const DISCOVERY_LANGUAGE_ID = "lang-xx-disc1";
const BOTH_LOCALE = "xx-BOTH1";
const BOTH_LANGUAGE_ID = "lang-xx-both1";

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
    normalizedCountryLabel: normalizeField(metadata.countryLabel ?? ""),
    normalizedRegionLabel: normalizeField(metadata.regionLabel ?? ""),
    normalizedCountryCode: normalizeField(metadata.countryCode ?? ""),
    normalizedRegionCode: normalizeField(metadata.regionCode ?? ""),
    normalizedTranslatedTitles,
    normalizedTranslatedSummaries,
    normalizedTerminologyAliasesByLanguage: {},
  };
}

function baseSearchEntry(initiative: Initiative): CivicSearchMetadata {
  return {
    entityType: "initiative",
    entityId: initiative.initiativeId,
    initiativeId: initiative.initiativeId,
    title: initiative.title,
    summary: initiative.description,
    status: initiative.status,
    country: "Test",
    region: "Test",
    community: "test",
    activityArea: "Environment",
    updatedAt: initiative.updatedAt,
    publicUrl: `/initiatives/${initiative.initiativeId}`,
    sourceLanguage: "en",
  };
}

function sampleInitiative(suffix: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-06c1-${suffix}-${Date.now()}`,
    stewardId: "member-06c1",
    createdAt: now,
    updatedAt: now,
    title: "Discovery River Initiative",
    description: "Participants will restore a local river for discovery Search.",
    status: "proposal",
    lifecyclePhase: "projected",
    visibility: { policy: "public" },
    metadata: {
      category: "Community",
      tags: [],
      region: "Test",
      language: "en",
      communitySlug: "test",
      activityArea: "Environment",
    },
    revisions: [],
    contributions: [],
    timeline: [],
  };
}

describe("Localization Simplification Step 06C.1 — Initiative Search discovery warm", () => {
  let provider: DeterministicTranslationProvider;
  let initiative: Initiative;
  let translateCalls = 0;

  beforeEach(async () => {
    translateCalls = 0;
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWarmMemoryForTests();
    setContentTranslationWarmForceMemoryForTests(true);
    setLanguageRegistryForceMemoryForTests(true);
    setTerminologyGlossaryForceMemoryForTests(true);
    setAdministrationAuditForceMemoryForTests(true);
    resetAdministrationAuditMemoryForTests();
    resetLanguageRegistryStoreForTests();
    resetTerminologyGlossaryStoreForTests();
    resetGlobalSearchIndexForTests();
    await ensureLanguageRegistrySeeded();
    await ensureTerminologyGlossarySeeded();

    provider = new DeterministicTranslationProvider();
    const originalTranslate = provider.translate.bind(provider);
    provider.translate = async (request) => {
      translateCalls += 1;
      return originalTranslate(request);
    };
    setTranslationProviderForTests(provider);

    await createLanguageRegistryRecord({
      languageId: DISCOVERY_LANGUAGE_ID,
      locale: DISCOVERY_LOCALE,
      englishName: "Discovery Synthetic",
      nativeName: "Discovery Synthetic",
      textDirection: "ltr",
      enabled: true,
      contentTranslationEnabled: false,
      searchEnabled: true,
      seoIndexingEnabled: false,
      uiTranslationStatus: "none",
    });

    initiative = sampleInitiative("main");
    createInitiative(initiative);

    setLanguageRegistryAdminAssertOverrideForTests(async () => ({
      userId: "admin-06c1",
      participantId: "member-admin-06c1",
    }));
  });

  afterEach(() => {
    deleteInitiative(initiative.initiativeId);
    setLanguageRegistryAdminAssertOverrideForTests(null);
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWarmMemoryForTests();
    setContentTranslationWarmForceMemoryForTests(false);
    resetTerminologyGlossaryStoreForTests();
    resetLanguageRegistryStoreForTests();
    resetGlobalSearchIndexForTests();
    resetAdministrationAuditMemoryForTests();
    setAdministrationAuditForceMemoryForTests(false);
    setTerminologyGlossaryForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("1. enabled+searchEnabled+contentTranslationEnabled=false → discovery eligible", async () => {
    const targets = await listSearchDiscoveryContentTranslationTargetLocales({
      excludeSourceLanguage: "en",
    });
    assert.ok(targets.includes(DISCOVERY_LOCALE));
    await assertSearchDiscoveryTargetLocale(DISCOVERY_LOCALE);

    const result = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: DISCOVERY_LOCALE,
      generateIfMissing: true,
      intent: "search_discovery",
    });
    assert.equal(result.generated, true);
    assert.ok(result.translation);
    assert.equal(result.translation!.targetLanguage, DISCOVERY_LOCALE);
    assert.equal(result.translation!.stale, false);
    assert.match(String(result.translation!.translatedContent.title), /xx-DISC1/);
  });

  it("2. enabled+searchEnabled=false → no discovery generation", async () => {
    await updateLanguageRegistryRecord(DISCOVERY_LANGUAGE_ID, {
      searchEnabled: false,
    });
    const targets = await listSearchDiscoveryContentTranslationTargetLocales();
    assert.ok(!targets.includes(DISCOVERY_LOCALE));

    await assert.rejects(
      () =>
        getOrCreateContentTranslation({
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          targetLanguage: DISCOVERY_LOCALE,
          generateIfMissing: true,
          intent: "search_discovery",
        }),
      (error: unknown) =>
        error instanceof TranslationProviderError &&
        error.code === "unsupported_language",
    );
    assert.equal(translateCalls, 0);
  });

  it("3. enabled=false + searchEnabled cannot produce discovery targets", async () => {
    // Policy forbids searchEnabled without enabled; disabling clears searchEnabled.
    await updateLanguageRegistryRecord(DISCOVERY_LANGUAGE_ID, {
      enabled: false,
    });
    const targets = await listSearchDiscoveryContentTranslationTargetLocales();
    assert.ok(!targets.includes(DISCOVERY_LOCALE));
    await assert.rejects(
      () => assertSearchDiscoveryTargetLocale(DISCOVERY_LOCALE),
      (error: unknown) =>
        error instanceof TranslationProviderError &&
        error.code === "unsupported_language",
    );
    assert.equal(translateCalls, 0);
  });

  it("4. searchEnabled false→true → async discovery enqueue; Admin does not call provider", async () => {
    await updateLanguageRegistryRecord(DISCOVERY_LANGUAGE_ID, {
      searchEnabled: false,
    });
    resetContentTranslationWarmMemoryForTests();
    translateCalls = 0;

    await updateAdminLanguage({
      actorUserId: "admin-06c1",
      languageId: DISCOVERY_LANGUAGE_ID,
      body: { searchEnabled: true },
    });

    assert.equal(translateCalls, 0, "Admin mutation must not invoke provider");
    const pending = listContentTranslationWarmMemoryPendingForTests();
    assert.ok(
      pending.some(
        (row) =>
          row.command.sourceKind === "initiative" &&
          row.command.sourceRecordId === initiative.initiativeId &&
          row.command.reason === "search_discovery_enable" &&
          row.command.targetLocales?.includes(DISCOVERY_LOCALE),
      ),
    );
  });

  it("5. Re-enable Search with current CT → idempotent; no unnecessary regeneration", async () => {
    const first = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: DISCOVERY_LOCALE,
      generateIfMissing: true,
      intent: "search_discovery",
    });
    assert.equal(first.generated, true);
    const callsAfterFirst = translateCalls;

    await updateLanguageRegistryRecord(DISCOVERY_LANGUAGE_ID, {
      searchEnabled: false,
    });
    await updateLanguageRegistryRecord(DISCOVERY_LANGUAGE_ID, {
      searchEnabled: true,
    });

    const second = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: DISCOVERY_LOCALE,
      generateIfMissing: true,
      intent: "search_discovery",
    });
    assert.equal(second.generated, false);
    assert.equal(second.translation?.translationId, first.translation?.translationId);
    assert.equal(translateCalls, callsAfterFirst);

    // Outbox re-enqueue path also skips provider via current CT.
    resetContentTranslationWarmMemoryForTests();
    await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "search_discovery_enable",
      targetLocales: [DISCOVERY_LOCALE],
    });
    const warm = await processContentTranslationWarmMemoryQueueForTests();
    const ours = warm.find((row) => row.sourceRecordId === initiative.initiativeId);
    assert.ok(ours);
    const localeRow = ours!.locales.find(
      (locale) => locale.targetLanguage === DISCOVERY_LOCALE,
    );
    assert.ok(localeRow);
    assert.equal(localeRow!.status, "skipped_existing");
    assert.equal(translateCalls, callsAfterFirst);
  });

  it("6. New/changed Initiative with Search locale → discovery work scheduled", async () => {
    resetContentTranslationWarmMemoryForTests();
    scheduleContentTranslationWarmAfterMutation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "public_mutation",
    });
    // scheduleContentTranslationWarmAfterMutation is fire-and-forget — flush microtasks.
    await new Promise<void>((resolve) => setImmediate(resolve));
    const pending = listContentTranslationWarmMemoryPendingForTests();
    assert.ok(
      pending.some(
        (row) =>
          row.command.sourceKind === "initiative" &&
          row.command.sourceRecordId === initiative.initiativeId,
      ),
    );

    const results = await processContentTranslationWarmMemoryQueueForTests();
    assert.ok(results.length >= 1);
    const discoveryOutcome = results[0]!.locales.find(
      (locale) => locale.targetLanguage === DISCOVERY_LOCALE,
    );
    assert.ok(discoveryOutcome);
    assert.equal(discoveryOutcome!.status, "generated");
  });

  it("7. Locale qualifies for Search + Extended → no duplicate/current CT conflict", async () => {
    await createLanguageRegistryRecord({
      languageId: BOTH_LANGUAGE_ID,
      locale: BOTH_LOCALE,
      englishName: "Both Synthetic",
      nativeName: "Both Synthetic",
      textDirection: "ltr",
      enabled: true,
      contentTranslationEnabled: true,
      searchEnabled: true,
      seoIndexingEnabled: false,
      uiTranslationStatus: "none",
    });

    resetContentTranslationWarmMemoryForTests();
    await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "public_mutation",
      targetLocales: [BOTH_LOCALE],
    });
    translateCalls = 0;
    const results = await processContentTranslationWarmMemoryQueueForTests();
    const both = results[0]!.locales.find((locale) => locale.targetLanguage === BOTH_LOCALE);
    assert.ok(both);
    assert.equal(both!.status, "generated");
    assert.equal(translateCalls, 1);

    // Discovery intent against the same current row is idempotent.
    const again = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: BOTH_LOCALE,
      generateIfMissing: true,
      intent: "search_discovery",
    });
    assert.equal(again.generated, false);
    assert.equal(translateCalls, 1);
  });

  it("7b. Discovery CT remains compatible when locale later becomes contentTranslationEnabled", async () => {
    const discovery = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: DISCOVERY_LOCALE,
      generateIfMissing: true,
      intent: "search_discovery",
    });
    assert.equal(discovery.generated, true);
    const calls = translateCalls;

    await updateLanguageRegistryRecord(DISCOVERY_LANGUAGE_ID, {
      contentTranslationEnabled: true,
    });

    const extended = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: DISCOVERY_LOCALE,
      generateIfMissing: true,
      intent: "automatic_warm",
    });
    assert.equal(extended.generated, false);
    assert.equal(extended.translation?.translationId, discovery.translation?.translationId);
    assert.equal(extended.translation?.stale, false);
    assert.equal(translateCalls, calls);
  });

  it("8. Discovery CT → existing Search invalidation/rebuild exposes localized title/description", async () => {
    const serviceSrc = readFileSync(
      path.join(repoRoot, "apps/api/src/modules/language/content-translation.service.ts"),
      "utf8",
    );
    assert.match(serviceSrc, /invalidateGlobalSearchIndexLazy/);
    assert.match(serviceSrc, /upsertContentTranslation\(record\)/);

    const before = await enrichSearchEntryWithMultilingual(baseSearchEntry(initiative));
    assert.equal(
      (before.translatedFields ?? []).some((field) => field.language === DISCOVERY_LOCALE),
      false,
    );

    await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: DISCOVERY_LOCALE,
      generateIfMissing: true,
      intent: "search_discovery",
    });

    // Existing CT upsert invalidates in-memory index; enrichment on next rebuild
    // reads the current Initiative CT title/description.
    const after = await enrichSearchEntryWithMultilingual(baseSearchEntry(initiative));
    const localized = (after.translatedFields ?? []).find(
      (field) => field.language === DISCOVERY_LOCALE && field.freshness === "current",
    );
    assert.ok(localized);
    assert.match(String(localized!.title), /xx-DISC1/);
    assert.match(String(localized!.summary), /xx-DISC1/);

    const matched = await matchGlobalSearchIndex(
      {
        q: String(localized!.title),
        locale: DISCOVERY_LOCALE,
        limit: 10,
        offset: 0,
      },
      [toMatchableEntry(after)],
    );
    assert.equal(matched.length, 1);
    assert.ok(matched[0]!.matchedFields.includes("translated_title"));
    const result = toSearchResult(matched[0]!, DISCOVERY_LOCALE);
    assert.match(result.title, /xx-DISC1/);
  });

  it("9. seoIndexingEnabled=false and Extended Localization DATA_NOT_READY → discovery still eligible", async () => {
    const { getLanguageRegistryByLocale } = await import(
      "../../../src/modules/language/index.js"
    );
    const record = await getLanguageRegistryByLocale(DISCOVERY_LOCALE);
    assert.ok(record);
    assert.equal(record!.seoIndexingEnabled, false);
    assert.equal(record!.contentTranslationEnabled, false);
    assert.equal(record!.enabled, true);
    assert.equal(record!.searchEnabled, true);

    const dataNotReady = deriveLanguageLocalizationReadinessState({
      enabled: true,
      contentTranslationEnabled: true,
      webUiDataReady: false,
      controlledVocabularyPresentationReady: false,
      ct: emptyLanguageLocalizationCountBucket(),
      plpMedia: emptyLanguageLocalizationCountBucket(),
    });
    assert.equal(dataNotReady, "DATA_NOT_READY");

    assert.equal(
      isLocalizationReadyForSearch({
        registry: {
          enabled: true,
          contentTranslationEnabled: false,
          searchEnabled: true,
          seoIndexingEnabled: false,
        },
      }),
      true,
    );

    const targets = await listSearchDiscoveryContentTranslationTargetLocales({
      excludeSourceLanguage: "en",
    });
    assert.ok(targets.includes(DISCOVERY_LOCALE));

    const result = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: DISCOVERY_LOCALE,
      generateIfMissing: true,
      intent: "search_discovery",
    });
    assert.equal(result.generated, true);
  });

  it("architecture: search_discovery intent and Admin trigger are wired", () => {
    const typesSrc = readFileSync(
      path.join(repoRoot, "packages/types/src/domain/content-translation.ts"),
      "utf8",
    );
    assert.match(typesSrc, /search_discovery/);
    assert.match(typesSrc, /search_discovery_enable/);

    const consumer = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/language/content-translation-warm-consumer.ts",
      ),
      "utf8",
    );
    assert.match(consumer, /search_discovery/);
    assert.match(consumer, /resolveSearchDiscoveryContentTranslationWarmTargets/);

    const admin = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/language/language-registry/language-registry.service.ts",
      ),
      "utf8",
    );
    assert.match(admin, /becameSearchDiscoveryEligible/);
    assert.match(admin, /enqueueInitiativeSearchDiscoveryForLocale/);

    const automatic = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/language/content-translation-warm-targets.ts",
      ),
      "utf8",
    );
    assert.match(automatic, /contentTranslationEnabled/);
    assert.doesNotMatch(automatic, /searchEnabled/);
  });
});
