/**
 * Language Architecture Pack 02 — automatic language expansion.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildLanguagePwaCivicReadinessSlice,
  derivePwaCivicReadinessState,
  emptyLanguageLocalizationCountBucket,
  emptyPwaCivicCoverageScalars,
  isPwaPersistedOrdinaryReadingEligible,
  isLocalizationReadyForSearch,
  isLocalizationReadyForSeo,
  resolvePwaPersistedReadingEnabled,
  type LanguageRegistryRecord,
  type PwaCivicCoverageScalars,
} from "@hu/types";

import {
  evaluateLanguageLocalizationReadiness,
  measureBoundedPwaCivicCoverage,
  setBoundedPwaCivicCoverageDepsForTests,
} from "../../../src/modules/language/language-localization-activation/index.js";
import { fromLanguageRegistryMongoDocument } from "../../../src/modules/language/language-registry/language-registry.mongo-document.js";
import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/index.js";
import {
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiSrc = path.resolve(here, "../../../src");

function coverageReady(overrides?: Partial<PwaCivicCoverageScalars>): PwaCivicCoverageScalars {
  return {
    current: 10,
    missing: 0,
    stale: 0,
    failed: 0,
    pending: 0,
    workItemsRequired: 0,
    measuredKindCount: 6,
    unmeasuredKindCount: 0,
    coverageMeasurement: "complete",
    ...overrides,
  };
}

function baseRecord(
  overrides: Partial<LanguageRegistryRecord> & Pick<LanguageRegistryRecord, "locale">,
): LanguageRegistryRecord {
  return {
    languageId: `lang-${overrides.locale}`,
    languageCode: overrides.locale.split("-")[0] ?? overrides.locale,
    englishName: overrides.locale,
    nativeName: overrides.locale,
    textDirection: "ltr",
    fallbackLocale: "en",
    enabled: true,
    uiTranslationStatus: "none",
    contentTranslationEnabled: true,
    searchEnabled: false,
    seoIndexingEnabled: false,
    pwaPersistedReadingEnabled: false,
    aliases: [],
    providerMappings: {},
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Language Architecture Pack 02 — Registry PWA gate", () => {
  it("legacy missing field defaults true only for uk/ar/zh-Hant", () => {
    assert.equal(resolvePwaPersistedReadingEnabled("uk", undefined), true);
    assert.equal(resolvePwaPersistedReadingEnabled("ar", undefined), true);
    assert.equal(resolvePwaPersistedReadingEnabled("zh-Hant", undefined), true);
    assert.equal(resolvePwaPersistedReadingEnabled("en", undefined), false);
    assert.equal(resolvePwaPersistedReadingEnabled("ka", undefined), false);
    assert.equal(resolvePwaPersistedReadingEnabled("he", undefined), false);
    assert.equal(resolvePwaPersistedReadingEnabled("fr", undefined), false);
    assert.equal(resolvePwaPersistedReadingEnabled("uk", false), false);
    assert.equal(resolvePwaPersistedReadingEnabled("fr", true), true);
  });

  it("mongo document coerce preserves Pack 01 locales when field absent", () => {
    const uk = fromLanguageRegistryMongoDocument({
      languageId: "lang-uk",
      locale: "uk",
      localeKey: "uk",
      languageCode: "uk",
      englishName: "Ukrainian",
      nativeName: "Українська",
      textDirection: "ltr",
      fallbackLocale: "en",
      enabled: true,
      uiTranslationStatus: "complete",
      contentTranslationEnabled: true,
      searchEnabled: true,
      seoIndexingEnabled: false,
      // field intentionally omitted — Pack 01 migration default
      aliases: [],
      providerMappings: {},
      createdAt: "2020-01-01T00:00:00.000Z",
      updatedAt: "2020-01-01T00:00:00.000Z",
    });
    assert.equal(uk.pwaPersistedReadingEnabled, true);

    const ka = fromLanguageRegistryMongoDocument({
      languageId: "lang-ka",
      locale: "ka",
      localeKey: "ka",
      languageCode: "ka",
      englishName: "Georgian",
      nativeName: "ქართული",
      textDirection: "ltr",
      fallbackLocale: "en",
      enabled: true,
      uiTranslationStatus: "none",
      contentTranslationEnabled: true,
      searchEnabled: false,
      seoIndexingEnabled: false,
      // field intentionally omitted
      aliases: [],
      providerMappings: {},
      createdAt: "2020-01-01T00:00:00.000Z",
      updatedAt: "2020-01-01T00:00:00.000Z",
    });
    assert.equal(ka.pwaPersistedReadingEnabled, false);
  });

  it("eligibility predicate requires all four gates", () => {
    assert.equal(
      isPwaPersistedOrdinaryReadingEligible({
        enabled: true,
        contentTranslationEnabled: true,
        pwaPersistedReadingEnabled: true,
        pwaPersistedReadingReady: true,
      }),
      true,
    );
    assert.equal(
      isPwaPersistedOrdinaryReadingEligible({
        enabled: true,
        contentTranslationEnabled: true,
        pwaPersistedReadingEnabled: false,
        pwaPersistedReadingReady: true,
      }),
      false,
    );
    assert.equal(
      isPwaPersistedOrdinaryReadingEligible({
        enabled: true,
        contentTranslationEnabled: true,
        pwaPersistedReadingEnabled: true,
        pwaPersistedReadingReady: false,
      }),
      false,
    );
  });
});

describe("Language Architecture Pack 02 — PWA civic readiness states", () => {
  it("DISABLED when Registry gates closed", () => {
    assert.equal(
      derivePwaCivicReadinessState({
        enabled: false,
        contentTranslationEnabled: true,
        pwaPersistedReadingEnabled: true,
        coverage: coverageReady(),
      }),
      "DISABLED",
    );
  });

  it("READY when measured coverage complete", () => {
    assert.equal(
      derivePwaCivicReadinessState({
        enabled: true,
        contentTranslationEnabled: true,
        pwaPersistedReadingEnabled: true,
        coverage: coverageReady(),
      }),
      "READY",
    );
  });

  it("DEGRADED when CURRENT exists alongside new missing work", () => {
    assert.equal(
      derivePwaCivicReadinessState({
        enabled: true,
        contentTranslationEnabled: true,
        pwaPersistedReadingEnabled: true,
        coverage: coverageReady({ missing: 2, workItemsRequired: 2 }),
      }),
      "DEGRADED",
    );
  });

  it("UNKNOWN / partial_unmeasured never becomes READY", () => {
    const status = derivePwaCivicReadinessState({
      enabled: true,
      contentTranslationEnabled: true,
      pwaPersistedReadingEnabled: true,
      coverage: coverageReady({
        unmeasuredKindCount: 2,
        coverageMeasurement: "partial_unmeasured",
        missing: 0,
        workItemsRequired: 0,
      }),
    });
    assert.notEqual(status, "READY");
    assert.equal(status, "DEGRADED");

    const slice = buildLanguagePwaCivicReadinessSlice({
      enabled: true,
      contentTranslationEnabled: true,
      pwaPersistedReadingEnabled: true,
      coverage: emptyPwaCivicCoverageScalars(),
    });
    assert.equal(slice.pwaPersistedReadingReady, false);
    assert.notEqual(slice.coverage.coverageMeasurement, "complete");
  });

  it("Search and SEO remain independent of PWA readiness", () => {
    const report = {
      registry: {
        enabled: true,
        contentTranslationEnabled: true,
        searchEnabled: true,
        seoIndexingEnabled: true,
        pwaPersistedReadingEnabled: false,
      },
    };
    assert.equal(isLocalizationReadyForSearch(report), true);
    assert.equal(isLocalizationReadyForSeo(report), true);
  });
});

describe("Language Architecture Pack 02 — bounded coverage engine", () => {
  afterEach(() => {
    setBoundedPwaCivicCoverageDepsForTests(null);
  });

  it("does not call full corpus hydrate / provider / warm / write", async () => {
    const source = readFileSync(
      path.join(
        apiSrc,
        "modules/language/language-localization-activation/bounded-pwa-civic-coverage.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(source, /auditPublicLocalizationCorpus\(/);
    assert.doesNotMatch(source, /planLanguageHistoricalBackfill\(/);
    assert.doesNotMatch(source, /generateContentTranslation\(/);
    assert.doesNotMatch(source, /enqueueContentTranslationWarm\(/);
    assert.match(source, /WRITES_PERFORMED: 0/);
    assert.match(source, /PROVIDER_CALLS: 0/);
    assert.match(source, /usedFullCorpusHydrate: false/);

    const evaluator = readFileSync(
      path.join(
        apiSrc,
        "modules/language/language-localization-activation/language-localization-readiness-evaluator.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(evaluator, /auditPublicLocalizationCorpus\(/);
    assert.doesNotMatch(evaluator, /planLanguageHistoricalBackfill\(/);
    assert.match(evaluator, /measureBoundedPwaCivicCoverage/);
  });

  it("reports UNMEASURED honestly when Mongo is unavailable", async () => {
    setBoundedPwaCivicCoverageDepsForTests({
      isMongoReady: () => false,
    });
    const report = await measureBoundedPwaCivicCoverage({ locale: "uk" });
    assert.equal(report.usedFullCorpusHydrate, false);
    assert.equal(report.PROVIDER_CALLS, 0);
    assert.equal(report.WRITES_PERFORMED, 0);
    assert.ok(report.coverage.unmeasuredKindCount > 0);
    assert.equal(report.coverage.coverageMeasurement, "partial_unmeasured");
    assert.ok(report.kindRows.every((row) => row.status === "UNMEASURED"));
  });

  it("accepts injected coverage without provider side effects", async () => {
    const injected = await measureBoundedPwaCivicCoverage({
      locale: "xx-Test",
      deps: {
        coverageOverride: {
          locale: "xx-Test",
          coverage: coverageReady(),
          kindRows: [],
          ct: emptyLanguageLocalizationCountBucket(),
          plpMedia: emptyLanguageLocalizationCountBucket(),
          PROVIDER_CALLS: 0,
          WRITES_PERFORMED: 0,
          usedFullCorpusHydrate: false,
        },
      },
    });
    assert.equal(injected.coverage.coverageMeasurement, "complete");
    assert.equal(injected.coverage.missing, 0);
  });
});

describe("Language Architecture Pack 02 — readiness evaluator PWA slice", () => {
  beforeEach(async () => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    setWebUiMessagePackForceMemoryForTests(true);
    resetWebUiMessagePackStoreForTests();
    setBoundedPwaCivicCoverageDepsForTests(null);
  });

  afterEach(() => {
    resetLanguageRegistryStoreForTests();
    setLanguageRegistryForceMemoryForTests(false);
    resetWebUiMessagePackStoreForTests();
    setWebUiMessagePackForceMemoryForTests(false);
    setBoundedPwaCivicCoverageDepsForTests(null);
  });

  it("PWA civic READY does not require WEB_UI / CV completeness", async () => {
    const report = await evaluateLanguageLocalizationReadiness({
      locale: "xx-Pwa",
      registryRecord: baseRecord({
        locale: "xx-Pwa",
        pwaPersistedReadingEnabled: true,
      }),
      skipCorpusPlan: true,
      ctCounts: { ...emptyLanguageLocalizationCountBucket(), current: 5 },
      plpCounts: { ...emptyLanguageLocalizationCountBucket(), current: 1 },
      assessWebUi: async () => ({
        engineReady: true as const,
        dataReady: false,
        requiredKeyCount: 10,
        missingKeyCount: 10,
        emptyKeyCount: 0,
        englishFallbackKeyCount: 10,
        sampleMissingPaths: [],
      }),
      assessControlledVocabulary: async () => ({
        presentationReady: false,
        conceptsChecked: 1,
        conceptsWithTerminologyPreferredTerm: 0,
        conceptsWithWebUiFallbackOnly: 0,
        conceptsMissingLocalizedLabel: 1,
        missingPreferredTermGaps: ["x"],
      }),
      assessHigherAuthority: async () => ({
        brandPublished: null,
        legalPublished: null,
        note: null,
      }),
    });

    assert.equal(report.pwaCivic.pwaPersistedReadingEnabled, true);
    assert.equal(report.pwaCivic.pwaCivicReadinessStatus, "READY");
    assert.equal(report.pwaCivic.pwaPersistedReadingReady, true);
    assert.notEqual(report.state, "READY");
  });

  it("Registry disable / PWA gate closed → PWA DISABLED", async () => {
    const report = await evaluateLanguageLocalizationReadiness({
      locale: "uk",
      registryRecord: baseRecord({
        locale: "uk",
        enabled: false,
        contentTranslationEnabled: false,
        pwaPersistedReadingEnabled: false,
      }),
      skipCorpusPlan: true,
      ctCounts: emptyLanguageLocalizationCountBucket(),
      plpCounts: emptyLanguageLocalizationCountBucket(),
      assessWebUi: async () => ({
        engineReady: true as const,
        dataReady: true,
        requiredKeyCount: 0,
        missingKeyCount: 0,
        emptyKeyCount: 0,
        englishFallbackKeyCount: 0,
        sampleMissingPaths: [],
      }),
      assessControlledVocabulary: async () => ({
        presentationReady: true,
        conceptsChecked: 0,
        conceptsWithTerminologyPreferredTerm: 0,
        conceptsWithWebUiFallbackOnly: 0,
        conceptsMissingLocalizedLabel: 0,
        missingPreferredTermGaps: [],
      }),
      assessHigherAuthority: async () => ({
        brandPublished: null,
        legalPublished: null,
        note: null,
      }),
    });
    assert.equal(report.pwaCivic.pwaCivicReadinessStatus, "DISABLED");
    assert.equal(report.pwaCivic.pwaPersistedReadingReady, false);
  });

  it("create path defaults pwaPersistedReadingEnabled false for new locales", async () => {
    const created = await createLanguageRegistryRecord({
      locale: "xx-New",
      englishName: "Test New",
      nativeName: "Test New",
      textDirection: "ltr",
      enabled: true,
      contentTranslationEnabled: true,
    });
    assert.equal(created.pwaPersistedReadingEnabled, false);
  });
});
