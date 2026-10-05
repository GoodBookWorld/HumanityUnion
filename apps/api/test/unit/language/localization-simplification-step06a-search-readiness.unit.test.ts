/**
 * Localization Simplification Step 06A —
 * Search readiness is independent of full Extended Localization / SEO.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  emptyLanguageLocalizationCountBucket,
  isLocalizationReadyForSearch,
  isLocalizationReadyForSeo,
  type LanguageLocalizationReadinessReport,
} from "@hu/types";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../",
);

function readRepo(rel: string): string {
  return readFileSync(path.join(repoRoot, rel), "utf8");
}

function baseReport(
  overrides: Partial<LanguageLocalizationReadinessReport> & {
    readonly registry: LanguageLocalizationReadinessReport["registry"];
  },
): LanguageLocalizationReadinessReport {
  return {
    pack: "closure07",
    locale: "xx",
    languageId: "lang-xx",
    engineReady: false,
    languageDataReady: false,
    state: "DATA_NOT_READY",
    webUi: {
      engineReady: true,
      dataReady: false,
      requiredKeyCount: 10,
      missingKeyCount: 10,
      emptyKeyCount: 0,
      englishFallbackKeyCount: 0,
      sampleMissingPaths: ["navigation.home"],
    },
    participantWebUi: {
      engineReady: true,
      dataReady: true,
      requiredKeyCount: 0,
      missingKeyCount: 0,
      emptyKeyCount: 0,
      englishFallbackKeyCount: 0,
      sampleMissingPaths: [],
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
        current: 0, missing: 0, stale: 0, invalid: 0, failed: 0, pending: 0, workItemsRequired: 0,
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
    searchLocalizationReady: false,
    PROVIDER_CALLS: 0,
    WRITES_PERFORMED: 0,
    gaps: ["WEB_UI catalog not ready"],
    ...overrides,
  };
}

describe("Localization Simplification Step 06A — Search readiness decoupling", () => {
  it("enabled locale is Search-ready even when Extended Localization is incomplete", () => {
    const report = baseReport({
      locale: "fr",
      registry: {
        enabled: true,
        contentTranslationEnabled: true,
        searchEnabled: true,
        seoIndexingEnabled: false,
        pwaPersistedReadingEnabled: false,
      },
      engineReady: true,
      languageDataReady: false,
      state: "DATA_NOT_READY",
    });

    assert.equal(isLocalizationReadyForSearch(report), true);
    // SEO indexable requires seoIndexingEnabled (flag off here), not EL completeness.
    assert.equal(isLocalizationReadyForSeo(report), false);
    assert.equal(report.state, "DATA_NOT_READY");
  });

  it("disabled locale is not Search-ready", () => {
    const report = baseReport({
      registry: {
        enabled: false,
        contentTranslationEnabled: false,
        searchEnabled: false,
        seoIndexingEnabled: false,
        pwaPersistedReadingEnabled: false,
      },
      state: "DISABLED",
      engineReady: false,
    });
    assert.equal(isLocalizationReadyForSearch(report), false);
    assert.equal(isLocalizationReadyForSeo(report), false);
  });

  it("Search readiness remains separate from SEO indexability", () => {
    const incomplete = baseReport({
      registry: {
        enabled: true,
        contentTranslationEnabled: true,
        searchEnabled: true,
        seoIndexingEnabled: true,
        pwaPersistedReadingEnabled: false,
      },
      engineReady: true,
      languageDataReady: false,
      state: "BACKFILL_REQUIRED",
    });
    assert.equal(isLocalizationReadyForSearch(incomplete), true);
    // Step 07B.2 — incomplete Extended Localization does not block SEO indexability.
    assert.equal(isLocalizationReadyForSeo(incomplete), true);
    assert.equal(incomplete.languageDataReady, false);
    assert.notEqual(incomplete.state, "READY");

    const extendedReadySeoOff = baseReport({
      registry: {
        enabled: true,
        contentTranslationEnabled: true,
        searchEnabled: false,
        seoIndexingEnabled: false,
        pwaPersistedReadingEnabled: false,
      },
      engineReady: true,
      languageDataReady: true,
      state: "READY",
      webUi: {
        engineReady: true,
        dataReady: true,
        requiredKeyCount: 10,
        missingKeyCount: 0,
        emptyKeyCount: 0,
        englishFallbackKeyCount: 0,
        sampleMissingPaths: [],
      },
      controlledVocabulary: {
        presentationReady: true,
        conceptsChecked: 5,
        conceptsWithTerminologyPreferredTerm: 1,
        conceptsWithWebUiFallbackOnly: 4,
        conceptsMissingLocalizedLabel: 0,
        missingLocalizedLabelConceptIds: [],
        missingPreferredTermGaps: [],
      },
      ct: { ...emptyLanguageLocalizationCountBucket(), current: 4 },
      plpMedia: { ...emptyLanguageLocalizationCountBucket(), current: 1 },
      gaps: [],
    });
    assert.equal(isLocalizationReadyForSearch(extendedReadySeoOff), true);
    assert.equal(extendedReadySeoOff.state, "READY");
    assert.equal(isLocalizationReadyForSeo(extendedReadySeoOff), false);
  });

  it("Search readiness does not require searchEnabled (flag remains separate)", () => {
    const report = baseReport({
      registry: {
        enabled: true,
        contentTranslationEnabled: false,
        searchEnabled: false,
        seoIndexingEnabled: false,
        pwaPersistedReadingEnabled: false,
      },
      state: "DISABLED",
      engineReady: false,
    });
    assert.equal(isLocalizationReadyForSearch(report), true);
    assert.equal(report.registry.searchEnabled, false);
  });

  it("does not introduce hardcoded ka/he/future-locale logic", () => {
    const readiness = readRepo(
      "packages/types/src/domain/language-localization-readiness.ts",
    );
    const admin = readRepo(
      "apps/web/src/features/administration/components/AdminLanguagesSection.tsx",
    );
    const searchFn = readiness.slice(
      readiness.indexOf("export function isLocalizationReadyForSearch"),
    );
    assert.doesNotMatch(searchFn, /\b(?:ka|he)\b/);
    assert.match(searchFn, /registry\.enabled/);
    assert.doesNotMatch(searchFn, /isLocalizationReadyForSeo\(report\)/);
    assert.match(admin, /Search-ready/);
    assert.match(admin, /Overall presentation/);
    assert.doesNotMatch(admin, /\b(?:ka|he)\b/);
  });

  it("SEO predicate uses Registry SEO eligibility (not Extended Localization)", () => {
    const seoSrc = readRepo(
      "packages/types/src/domain/language-localization-readiness.ts",
    );
    const start = seoSrc.indexOf("export function isLocalizationReadyForSeo");
    const end = seoSrc.indexOf("export function isLocalizationReadyForSearch", start);
    const seoFn = seoSrc.slice(start, end);
    const seoBody = seoFn.slice(0, seoFn.indexOf("\n/**") === -1 ? seoFn.length : seoFn.indexOf("\n/**"));
    assert.match(seoBody, /isSeoIndexableLanguage/);
    assert.doesNotMatch(seoBody, /languageDataReady/);
    assert.doesNotMatch(seoBody, /engineReady/);
    assert.doesNotMatch(seoBody, /state === "READY"/);
  });

  it("Search runtime enrichment path is untouched by this readiness change", () => {
    const multilingual = readRepo(
      "apps/api/src/modules/global-search/global-search-multilingual.ts",
    );
    assert.match(multilingual, /searchEnabled/);
    assert.doesNotMatch(multilingual, /isLocalizationReadyForSearch/);
    assert.doesNotMatch(multilingual, /languageDataReady/);
  });
});
