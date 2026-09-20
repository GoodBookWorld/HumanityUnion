/**
 * Step 07B.2 — SEO readiness/indexability is Registry SEO eligibility,
 * independent of Extended Localization completeness.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  deriveLanguageLocalizationReadinessState,
  emptyLanguageLocalizationCountBucket,
  isLocalizationReadyForSearch,
  isLocalizationReadyForSeo,
  isSeoIndexableLanguage,
  type LanguageLocalizationReadinessReport,
} from "@hu/types";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../",
);

function readRepo(rel: string): string {
  return readFileSync(path.join(repoRoot, rel), "utf8");
}

const FUTURE_LOCALE = "xx-SEOFUT07B2";

function report(
  overrides: Partial<LanguageLocalizationReadinessReport> & {
    readonly registry: LanguageLocalizationReadinessReport["registry"];
  },
): LanguageLocalizationReadinessReport {
  return {
    pack: "closure07",
    locale: FUTURE_LOCALE,
    languageId: "lang-xx-seofut07b2",
    engineReady: false,
    languageDataReady: false,
    state: "DATA_NOT_READY",
    webUi: {
      engineReady: true,
      dataReady: false,
      requiredKeyCount: 8,
      missingKeyCount: 8,
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
      missing: 3,
      workItemsRequired: 3,
    },
    plpMedia: {
      ...emptyLanguageLocalizationCountBucket(),
      missing: 1,
      workItemsRequired: 1,
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

describe("Step 07B.2 — SEO readiness decoupled from Extended Localization", () => {
  it("1–8. Registry SEO eligibility; incomplete EL / CT / Search flags do not block", () => {
    const indexable = report({
      registry: {
        enabled: true,
        contentTranslationEnabled: false,
        searchEnabled: false,
        seoIndexingEnabled: true,
        pwaPersistedReadingEnabled: false,
      },
      engineReady: false,
      languageDataReady: false,
      state: "DATA_NOT_READY",
    });

    assert.equal(isLocalizationReadyForSeo(indexable), true);
    assert.equal(
      isSeoIndexableLanguage({
        enabled: indexable.registry.enabled,
        seoIndexingEnabled: indexable.registry.seoIndexingEnabled,
      }),
      true,
    );
    assert.equal(indexable.languageDataReady, false);
    assert.equal(indexable.state, "DATA_NOT_READY");
    assert.equal(indexable.registry.contentTranslationEnabled, false);
    assert.equal(indexable.registry.searchEnabled, false);

    const seoOff = report({
      registry: {
        enabled: true,
        contentTranslationEnabled: true,
        searchEnabled: true,
        seoIndexingEnabled: false,
        pwaPersistedReadingEnabled: false,
      },
      languageDataReady: true,
      state: "READY",
      engineReady: true,
    });
    assert.equal(isLocalizationReadyForSeo(seoOff), false);

    const disabled = report({
      registry: {
        enabled: false,
        contentTranslationEnabled: false,
        searchEnabled: false,
        seoIndexingEnabled: true,
        pwaPersistedReadingEnabled: false,
      },
      state: "DISABLED",
    });
    assert.equal(isLocalizationReadyForSeo(disabled), false);
  });

  it("9–10. Search readiness and Extended Localization state remain independent", () => {
    const row = report({
      registry: {
        enabled: true,
        contentTranslationEnabled: false,
        searchEnabled: false,
        seoIndexingEnabled: true,
        pwaPersistedReadingEnabled: false,
      },
      state: "DISABLED",
      engineReady: false,
      languageDataReady: false,
    });
    assert.equal(isLocalizationReadyForSearch(row), true);
    assert.equal(isLocalizationReadyForSeo(row), true);

    const elState = deriveLanguageLocalizationReadinessState({
      enabled: true,
      contentTranslationEnabled: true,
      webUiDataReady: false,
      controlledVocabularyPresentationReady: false,
      ct: emptyLanguageLocalizationCountBucket(),
      plpMedia: emptyLanguageLocalizationCountBucket(),
    });
    assert.equal(elState, "DATA_NOT_READY");
  });

  it("11–12. activation/provider guards and SEO mutation side effects unchanged", () => {
    const activation = readRepo(
      "apps/api/src/modules/language/language-localization-activation/language-activation-job.service.ts",
    );
    assert.match(activation, /languageDataReady && readiness\.state === "READY"/);
    assert.match(activation, /Search\/SEO flags are not modified by activation/);

    const service = readRepo(
      "apps/api/src/modules/language/language-registry/language-registry.service.ts",
    );
    assert.match(service, /becameSearchDiscoveryEligible/);
    assert.match(service, /becameCtEligible/);
    const updateFn = service.slice(service.indexOf("export async function updateAdminLanguage"));
    // SEO toggle must not own discovery/PLP enqueue gates.
    assert.doesNotMatch(
      updateFn.slice(0, updateFn.indexOf("becameSearchDiscoveryEligible")),
      /seoIndexingEnabled[\s\S]{0,200}enqueueSearchDiscoveryForLocale/,
    );
    assert.match(service, /before\.searchEnabled !== updated\.searchEnabled/);
    assert.doesNotMatch(
      service,
      /before\.seoIndexingEnabled !== updated\.seoIndexingEnabled[\s\S]{0,120}enqueue/,
    );
  });

  it("13–15. synthetic future locale; Admin wording; public runtime alignment", () => {
    const readiness = readRepo(
      "packages/types/src/domain/language-localization-readiness.ts",
    );
    const start = readiness.indexOf("export function isLocalizationReadyForSeo");
    const end = readiness.indexOf("export function isLocalizationReadyForSearch", start);
    const seoFn = readiness.slice(start, end);
    const seoBody = seoFn.slice(0, seoFn.includes("\n/**") ? seoFn.indexOf("\n/**") : seoFn.length);
    assert.match(seoBody, /isSeoIndexableLanguage/);
    assert.doesNotMatch(seoBody, /\b(?:ka|he|uk|ar|zh-Hant)\b/);
    assert.doesNotMatch(seoBody, /languageDataReady|engineReady|state === "READY"/);

    const admin = readRepo(
      "apps/web/src/features/administration/components/AdminLanguagesSection.tsx",
    );
    assert.match(admin, /SEO indexable=/);
    assert.doesNotMatch(admin, /SEO-ready=/);
    assert.match(admin, /does not block Search readiness or SEO\s+indexability/);
    assert.match(admin, /Extended Localization/);

    const eligibility = readRepo("apps/web/src/lib/seo/seo-language-eligibility.ts");
    assert.match(eligibility, /isSeoIndexableLanguage/);
    const forRequest = readRepo(
      "apps/web/src/lib/seo/build-public-page-metadata-for-request.ts",
    );
    assert.match(forRequest, /isSeoIndexableLanguage/);
    const sitemap = readRepo("apps/web/src/lib/seo/sitemap/build-public-sitemap.ts");
    assert.match(sitemap, /isSeoIndexableLanguage/);
    assert.doesNotMatch(sitemap, /isLocalizationReadyForSeo|languageDataReady/);
  });
});
