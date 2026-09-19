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
  buildImprovementProposalIdentityCountPipeline,
  buildPresentationIdentityCountPipeline,
  buildPwaCivicBoundedMeasurePlans,
  evaluateLanguageLocalizationReadiness,
  measureBoundedPwaCivicCoverage,
  PWA_CIVIC_BOUNDED_CT_KINDS,
  setBoundedPwaCivicCoverageDepsForTests,
} from "../../../src/modules/language/language-localization-activation/index.js";
import { fromLanguageRegistryMongoDocument } from "../../../src/modules/language/language-registry/language-registry.mongo-document.js";
import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  listPublicLanguages,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/index.js";
import {
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiSrc = path.resolve(here, "../../../src");

/** Full corpus = 14 CT kinds + civic_media editorial PLP. */
const FULL_PWA_CIVIC_KIND_COUNT = PWA_CIVIC_BOUNDED_CT_KINDS.length + 1;

function coverageReady(overrides?: Partial<PwaCivicCoverageScalars>): PwaCivicCoverageScalars {
  return {
    current: 10,
    missing: 0,
    stale: 0,
    failed: 0,
    pending: 0,
    workItemsRequired: 0,
    measuredKindCount: FULL_PWA_CIVIC_KIND_COUNT,
    unmeasuredKindCount: 0,
    coverageMeasurement: "complete",
    ...overrides,
  };
}

function stubLiveCt(input: {
  readonly current: number;
  readonly missing: number;
  readonly stale?: number;
  readonly failed?: number;
}) {
  const counts = {
    current: input.current,
    missing: input.missing,
    stale: input.stale ?? 0,
    failed: input.failed ?? 0,
    pending: 0,
    workItemsRequired: input.missing + (input.stale ?? 0),
  };
  return async () => ({
    ct: {
      current: counts.current * PWA_CIVIC_BOUNDED_CT_KINDS.length,
      missing: counts.missing * PWA_CIVIC_BOUNDED_CT_KINDS.length,
      stale: counts.stale * PWA_CIVIC_BOUNDED_CT_KINDS.length,
      failed: counts.failed * PWA_CIVIC_BOUNDED_CT_KINDS.length,
      pending: 0,
      workItemsRequired: counts.workItemsRequired * PWA_CIVIC_BOUNDED_CT_KINDS.length,
    },
    kindRows: PWA_CIVIC_BOUNDED_CT_KINDS.map((kindId) => ({
      kindId,
      counts,
    })),
  });
}

function emptyOverrideReport(locale: string, coverage: PwaCivicCoverageScalars) {
  return {
    locale,
    coverage,
    kindRows: [],
    ct: emptyLanguageLocalizationCountBucket(),
    plpMedia: emptyLanguageLocalizationCountBucket(),
    PROVIDER_CALLS: 0 as const,
    WRITES_PERFORMED: 0 as const,
    usedFullCorpusHydrate: false as const,
    readinessModel: "presentation_coverage" as const,
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
    for (const locale of ["uk", "ar", "zh-Hant"] as const) {
      const row = fromLanguageRegistryMongoDocument({
        languageId: `lang-${locale}`,
        locale,
        localeKey: locale.toLowerCase(),
        languageCode: locale.split("-")[0] ?? locale,
        englishName: locale,
        nativeName: locale,
        textDirection: locale === "ar" ? "rtl" : "ltr",
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
      assert.equal(row.pwaPersistedReadingEnabled, true, locale);
    }

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

  it("eligibility predicate requires Registry activation gates (not corpus READY)", () => {
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
    // Version 5.0 — readiness false must not block runtime eligibility.
    assert.equal(
      isPwaPersistedOrdinaryReadingEligible({
        enabled: true,
        contentTranslationEnabled: true,
        pwaPersistedReadingEnabled: true,
        pwaPersistedReadingReady: false,
      }),
      true,
    );
  });
});

describe("Version 5.0 — public languages runtime capability (no corpus readiness I/O)", () => {
  beforeEach(async () => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
  });

  afterEach(() => {
    resetLanguageRegistryStoreForTests();
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("listPublicLanguages source does not invoke measureBoundedPwaCivicCoverage", () => {
    const service = readFileSync(
      path.join(apiSrc, "modules/language/language-registry/language-registry.service.ts"),
      "utf8",
    );
    assert.doesNotMatch(service, /measureBoundedPwaCivicCoverage\(/);
    assert.doesNotMatch(service, /buildLanguagePwaCivicReadinessSlice\(/);
    assert.match(service, /lightweight public Registry capability catalog/i);
    assert.match(service, /pwaPersistedReadingReady:\s*false/);
  });

  it("public capability catalog returns activation flags without corpus readiness", async () => {
    const created = await createLanguageRegistryRecord({
      locale: "xx-Cap",
      englishName: "Capability Test",
      nativeName: "Capability Test",
      textDirection: "ltr",
      enabled: true,
      contentTranslationEnabled: true,
      pwaPersistedReadingEnabled: true,
    });
    assert.equal(created.pwaPersistedReadingEnabled, true);

    const publicList = await listPublicLanguages();
    const row = publicList.languages.find((entry) => entry.locale === "xx-Cap");
    assert.ok(row);
    assert.equal(row.contentTranslationEnabled, true);
    assert.equal(row.pwaPersistedReadingEnabled, true);
    // Public catalog does not compute operational readiness.
    assert.equal(row.pwaPersistedReadingReady, false);
  });

  it("readiness measurement failure is irrelevant to public capability (Admin path still measures)", async () => {
    const publicList = await listPublicLanguages();
    assert.ok(Array.isArray(publicList.languages));

    setBoundedPwaCivicCoverageDepsForTests({
      isMongoReady: () => {
        throw new Error("simulated readiness failure");
      },
    });
    // Public capability remains available even if readiness tooling would throw.
    const again = await listPublicLanguages();
    assert.ok(again.languages.length >= 0);

    const evaluator = readFileSync(
      path.join(
        apiSrc,
        "modules/language/language-localization-activation/language-localization-readiness-evaluator.ts",
      ),
      "utf8",
    );
    assert.match(evaluator, /measureBoundedPwaCivicCoverage/);
    setBoundedPwaCivicCoverageDepsForTests(null);
  });

  it("explicit future locale with activation flags is runtime-eligible without allowlist", async () => {
    await createLanguageRegistryRecord({
      locale: "xx-FuturePwa",
      englishName: "Future PWA",
      nativeName: "Future PWA",
      textDirection: "ltr",
      enabled: true,
      contentTranslationEnabled: true,
      pwaPersistedReadingEnabled: true,
    });
    const row = (await listPublicLanguages()).languages.find(
      (entry) => entry.locale === "xx-FuturePwa",
    );
    assert.ok(row);
    assert.equal(
      isPwaPersistedOrdinaryReadingEligible({
        enabled: true,
        contentTranslationEnabled: row.contentTranslationEnabled,
        pwaPersistedReadingEnabled: row.pwaPersistedReadingEnabled,
        pwaPersistedReadingReady: row.pwaPersistedReadingReady,
      }),
      true,
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

  it("full PWA civic CT corpus includes lifecycle kinds and excludes public_news", () => {
    const kinds = [...PWA_CIVIC_BOUNDED_CT_KINDS];
    for (const required of [
      "improvement_proposal",
      "petition",
      "initiative_revision",
      "decision_session",
      "collective_decision",
      "implementation_commitment",
      "implementation_tracking",
      "public_impact",
      "civic_archive",
      "initiative",
      "discussion_comment",
      "collaborative_analysis",
      "official_response",
      "blog_post",
    ] as const) {
      assert.ok(kinds.includes(required), `missing ${required}`);
    }
    assert.equal(kinds.includes("public_news" as never), false);
    assert.equal(kinds.length, 14);

    const plans = buildPwaCivicBoundedMeasurePlans();
    assert.equal(plans.length, 14);
    const byKind = new Map(plans.map((p) => [p.sourceKind, p]));
    assert.equal(byKind.get("improvement_proposal")?.identityMode, "improvement_proposal_unwind");
    assert.equal(JSON.stringify(byKind.get("petition")?.match), JSON.stringify({ status: { $ne: "Draft" } }));
    assert.equal(
      JSON.stringify(byKind.get("decision_session")?.match),
      JSON.stringify({ status: { $in: ["published", "closed"] } }),
    );
    assert.equal(
      JSON.stringify(byKind.get("collective_decision")?.match),
      JSON.stringify({ status: { $in: ["opened", "closed", "cancelled"] } }),
    );
    assert.equal(
      JSON.stringify(byKind.get("implementation_commitment")?.match),
      JSON.stringify({ status: { $in: ["published", "withdrawn", "completed"] } }),
    );
    assert.equal(
      JSON.stringify(byKind.get("implementation_tracking")?.match),
      JSON.stringify({ status: { $in: ["active", "completed", "archived"] } }),
    );
    assert.equal(
      JSON.stringify(byKind.get("public_impact")?.match),
      JSON.stringify({ status: { $in: ["published", "verified", "archived"] } }),
    );
    assert.equal(JSON.stringify(byKind.get("civic_archive")?.match), JSON.stringify({ status: "published" }));
    assert.equal(JSON.stringify(byKind.get("initiative_revision")?.match), "{}");
  });

  it("identity pipelines count presentation IDs — no character volume", () => {
    const source = readFileSync(
      path.join(
        apiSrc,
        "modules/language/language-localization-activation/bounded-pwa-civic-coverage.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(source, /\$strLenCP|characterVolume|translatedChars|canonicalChars/);
    assert.match(source, /presentation_coverage/);
    assert.match(source, /measureLiveActivationCtCoverage/);

    const identity = buildPresentationIdentityCountPipeline({ status: "published" });
    assert.equal(identity.at(-1)?.$count, "eligibleRecords");
    const ip = buildImprovementProposalIdentityCountPipeline();
    assert.ok(ip.some((stage) => stage.$unwind === "$proposals"));
    assert.equal(ip.at(-1)?.$count, "eligibleRecords");
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
    assert.equal(report.readinessModel, "presentation_coverage");
    assert.ok(report.coverage.unmeasuredKindCount > 0);
    assert.equal(report.coverage.coverageMeasurement, "partial_unmeasured");
    assert.ok(report.kindRows.every((row) => row.status === "UNMEASURED"));
    assert.ok(report.kindRows.some((row) => row.kindId === "civic_media_editorial"));
    assert.equal(
      report.kindRows.some((row) => row.kindId === "public_news"),
      false,
    );
  });

  it("accepts injected coverage without provider side effects", async () => {
    const injected = await measureBoundedPwaCivicCoverage({
      locale: "xx-Test",
      deps: {
        coverageOverride: emptyOverrideReport("xx-Test", coverageReady()),
      },
    });
    assert.equal(injected.coverage.coverageMeasurement, "complete");
    assert.equal(injected.coverage.missing, 0);
    assert.equal(injected.readinessModel, "presentation_coverage");
  });

  it("aggregate path: missing CURRENT in any included kind yields approximateMissing", async () => {
    const collectionsSeen: string[] = [];
    setBoundedPwaCivicCoverageDepsForTests({
      isMongoReady: () => true,
      classifyMediaEditorial: async () => "CURRENT_PUBLISHED_COMPLETE",
      measureLiveCt: stubLiveCt({ current: 0, missing: 2 }),
      aggregate: async (collectionName, pipeline) => {
        collectionsSeen.push(collectionName);
        if (collectionName === "content_translations") {
          return [
            {
              targetLanguage: "uk",
              sourceKind: "initiative",
              current: 1,
              stale: 0,
            },
          ];
        }
        // Every eligible source collection reports 2 presentation identities.
        if (pipeline.some((stage) => stage.$count === "eligibleRecords")) {
          return [{ eligibleRecords: 2 }];
        }
        return [];
      },
    });

    const report = await measureBoundedPwaCivicCoverage({ locale: "uk" });
    assert.equal(report.readinessModel, "presentation_coverage");
    assert.equal(report.coverage.coverageMeasurement, "complete");
    assert.equal(report.coverage.unmeasuredKindCount, 0);
    assert.equal(report.kindRows.length, FULL_PWA_CIVIC_KIND_COUNT);

    const ip = report.kindRows.find((r) => r.kindId === "improvement_proposal");
    assert.ok(ip && ip.status === "measured" && ip.counts);
    assert.equal(ip.counts.missing, 2); // eligible 2, current 0

    const petition = report.kindRows.find((r) => r.kindId === "petition");
    assert.ok(petition && petition.status === "measured" && petition.counts);
    assert.equal(petition.counts.missing, 2);

    for (const kind of [
      "initiative_revision",
      "decision_session",
      "collective_decision",
      "implementation_commitment",
      "implementation_tracking",
      "public_impact",
      "civic_archive",
    ] as const) {
      const row = report.kindRows.find((r) => r.kindId === kind);
      assert.ok(row && row.status === "measured" && row.counts, kind);
      assert.equal(row.counts.missing, 2, kind);
    }

    const media = report.kindRows.find((r) => r.kindId === "civic_media_editorial");
    assert.ok(media);
    assert.equal(media.ownership, "PLP_OWNED");
    assert.equal(media.status, "measured");
    assert.equal(media.counts?.current, 1);

    assert.equal(
      report.kindRows.some((r) => r.kindId === "public_news"),
      false,
    );
    assert.ok(report.coverage.missing > 0);
    assert.doesNotMatch(collectionsSeen.join(","), /public_news/);
  });

  it("complete presentation coverage across all included kinds permits READY", async () => {
    setBoundedPwaCivicCoverageDepsForTests({
      isMongoReady: () => true,
      classifyMediaEditorial: async () => "CURRENT_PUBLISHED_COMPLETE",
      measureLiveCt: stubLiveCt({ current: 2, missing: 0 }),
      aggregate: async (collectionName, pipeline) => {
        if (collectionName === "content_translations") {
          return PWA_CIVIC_BOUNDED_CT_KINDS.map((sourceKind) => ({
            targetLanguage: "ar",
            sourceKind,
            current: 2,
            stale: 0,
          }));
        }
        if (pipeline.some((stage) => stage.$count === "eligibleRecords")) {
          return [{ eligibleRecords: 2 }];
        }
        return [];
      },
    });

    const report = await measureBoundedPwaCivicCoverage({ locale: "ar" });
    assert.equal(report.coverage.missing, 0);
    assert.equal(report.coverage.stale, 0);
    assert.equal(report.coverage.unmeasuredKindCount, 0);
    assert.equal(report.coverage.coverageMeasurement, "complete");

    const status = derivePwaCivicReadinessState({
      enabled: true,
      contentTranslationEnabled: true,
      pwaPersistedReadingEnabled: true,
      coverage: report.coverage,
    });
    assert.equal(status, "READY");
  });

  it("UNKNOWN/UNMEASURED included kind cannot produce READY", async () => {
    setBoundedPwaCivicCoverageDepsForTests({
      isMongoReady: () => true,
      classifyMediaEditorial: async () => {
        throw new Error("PLP failed");
      },
      measureLiveCt: stubLiveCt({ current: 2, missing: 0 }),
      aggregate: async (collectionName, pipeline) => {
        if (collectionName === "content_translations") {
          return PWA_CIVIC_BOUNDED_CT_KINDS.map((sourceKind) => ({
            targetLanguage: "zh-Hant",
            sourceKind,
            current: 2,
            stale: 0,
          }));
        }
        if (pipeline.some((stage) => stage.$count === "eligibleRecords")) {
          return [{ eligibleRecords: 2 }];
        }
        return [];
      },
    });

    const report = await measureBoundedPwaCivicCoverage({ locale: "zh-Hant" });
    assert.ok(report.coverage.unmeasuredKindCount >= 1);
    assert.equal(report.coverage.coverageMeasurement, "partial_unmeasured");
    const status = derivePwaCivicReadinessState({
      enabled: true,
      contentTranslationEnabled: true,
      pwaPersistedReadingEnabled: true,
      coverage: report.coverage,
    });
    assert.notEqual(status, "READY");
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
      pwaCivicCoverage: emptyOverrideReport("xx-Pwa", coverageReady()),
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
    assert.match(report.pwaCivic.note ?? "", /presentation coverage/i);
    assert.notEqual(report.state, "READY");
  });

  it("missing CURRENT across corpus → BACKFILL/DEGRADED; READY→DEGRADED when current remains", async () => {
    const degraded = await evaluateLanguageLocalizationReadiness({
      locale: "uk",
      registryRecord: baseRecord({
        locale: "uk",
        pwaPersistedReadingEnabled: true,
      }),
      skipCorpusPlan: true,
      pwaCivicCoverage: emptyOverrideReport(
        "uk",
        coverageReady({ current: 8, missing: 3, workItemsRequired: 3 }),
      ),
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
    assert.equal(degraded.pwaCivic.pwaCivicReadinessStatus, "DEGRADED");
    assert.equal(degraded.pwaCivic.pwaPersistedReadingReady, false);

    const backfill = derivePwaCivicReadinessState({
      enabled: true,
      contentTranslationEnabled: true,
      pwaPersistedReadingEnabled: true,
      coverage: coverageReady({ current: 0, missing: 5, workItemsRequired: 5 }),
    });
    assert.equal(backfill, "BACKFILL_REQUIRED");
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
