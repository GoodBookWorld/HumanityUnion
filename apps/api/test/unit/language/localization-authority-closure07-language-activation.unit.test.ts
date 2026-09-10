/**
 * Localization Authority Closure 07 — Language Activation & Historical Backfill.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  LANGUAGE_ACTIVATION_CT_OWNED_KINDS,
  LANGUAGE_ACTIVATION_NO_OWNER_KIND_IDS,
  LANGUAGE_ACTIVATION_PROTECTED_EXCLUDED_KINDS,
  deriveLanguageLocalizationReadinessState,
  emptyLanguageLocalizationCountBucket,
  isLocalizationReadyForSeo,
  isLocalizationReadyForSearch,
} from "@hu/types";

import {
  activateLanguageLocalization,
  assertNoHardcodedLocaleEligibilityPolicy,
  evaluateLanguageLocalizationReadiness,
  planLanguageHistoricalBackfill,
} from "../../../src/modules/language/language-localization-activation/index.js";
import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  listAutomaticContentTranslationTargetLocales,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");
const apiSrc = path.resolve(here, "../../../src");

function emptyAuditForLocale(locale: string) {
  return {
    discoveryStatus: "COMPLETE" as const,
    discoveryHint: null,
    discoveryByKind: [],
    targetLocales: [locale],
    schemaVersion: "test",
    byFamily: [],
    byLocale: [
      {
        targetLanguage: locale,
        MISSING_TARGET_TRANSLATION_IDENTITIES: 0,
        STALE_TARGET_TRANSLATION_IDENTITIES: 0,
        FAILED_TARGET_TRANSLATION_IDENTITIES: 0,
        CURRENT_TARGET_TRANSLATION_IDENTITIES: 0,
        WORK_ITEMS_REQUIRED: 0,
      },
    ],
    totals: {
      SOURCE_PRESENTATION_COUNT: 0,
      PRESENTATIONS_WITH_ANY_FALLBACK: 0,
      TOTAL_SEMANTIC_NODES: 0,
      CURRENT_LOCALIZED_NODES: 0,
      CANONICAL_FALLBACK_NODES: 0,
      PROTECTED_NODES: 0,
      MISSING_TARGET_TRANSLATION_IDENTITIES: 0,
      STALE_TARGET_TRANSLATION_IDENTITIES: 0,
      FAILED_TARGET_TRANSLATION_IDENTITIES: 0,
      WORK_ITEMS_REQUIRED: 0,
      IDENTITY_COUNT: 0,
      MISSING_TRANSLATION_IDENTITIES: 0,
      TARGET_TRANSLATION_IDENTITIES: 0,
    },
    workItems: [],
    candidates: [],
  };
}

function missingAuditForLocale(locale: string, missing = 2) {
  const base = emptyAuditForLocale(locale);
  return {
    ...base,
    byLocale: [
      {
        targetLanguage: locale,
        MISSING_TARGET_TRANSLATION_IDENTITIES: missing,
        STALE_TARGET_TRANSLATION_IDENTITIES: 0,
        FAILED_TARGET_TRANSLATION_IDENTITIES: 0,
        CURRENT_TARGET_TRANSLATION_IDENTITIES: 0,
        WORK_ITEMS_REQUIRED: missing,
      },
    ],
  };
}

describe("Localization Authority Closure 07 — language activation", () => {
  beforeEach(async () => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
  });

  afterEach(() => {
    resetLanguageRegistryStoreForTests();
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("disabled locale → DISABLED; CT disabled stays DISABLED", async () => {
    const disabled = await evaluateLanguageLocalizationReadiness({
      locale: "uk",
      registryRecord: {
        languageId: "lang-uk",
        locale: "uk",
        languageCode: "uk",
        englishName: "Ukrainian",
        nativeName: "Українська",
        textDirection: "ltr",
        fallbackLocale: "en",
        enabled: false,
        uiTranslationStatus: "complete",
        contentTranslationEnabled: false,
        searchEnabled: false,
        seoIndexingEnabled: false,
        aliases: [],
        providerMappings: {},
        createdAt: "2020-01-01T00:00:00.000Z",
        updatedAt: "2020-01-01T00:00:00.000Z",
      },
      skipCorpusPlan: true,
      ctCounts: emptyLanguageLocalizationCountBucket(),
      plpCounts: emptyLanguageLocalizationCountBucket(),
    });
    assert.equal(disabled.state, "DISABLED");
    assert.equal(disabled.engineReady, false);
    assert.equal(isLocalizationReadyForSeo(disabled), false);

    const ctOff = await evaluateLanguageLocalizationReadiness({
      locale: "uk",
      registryRecord: {
        ...disabled.registry,
        languageId: "lang-uk",
        locale: "uk",
        languageCode: "uk",
        englishName: "Ukrainian",
        nativeName: "Українська",
        textDirection: "ltr",
        fallbackLocale: "en",
        enabled: true,
        uiTranslationStatus: "complete",
        contentTranslationEnabled: false,
        searchEnabled: true,
        seoIndexingEnabled: true,
        aliases: [],
        providerMappings: {},
        createdAt: "2020-01-01T00:00:00.000Z",
        updatedAt: "2020-01-01T00:00:00.000Z",
      } as never,
      skipCorpusPlan: true,
      ctCounts: emptyLanguageLocalizationCountBucket(),
      plpCounts: emptyLanguageLocalizationCountBucket(),
    });
    assert.equal(ctOff.state, "DISABLED");
    assert.equal(ctOff.registry.seoIndexingEnabled, true);
    assert.equal(ctOff.seoReady, false);
  });

  it("configured CT-enabled locale needing backfill → BACKFILL_REQUIRED", async () => {
    const state = deriveLanguageLocalizationReadinessState({
      enabled: true,
      contentTranslationEnabled: true,
      webUiDataReady: true,
      controlledVocabularyPresentationReady: true,
      ct: {
        ...emptyLanguageLocalizationCountBucket(),
        missing: 3,
        workItemsRequired: 3,
      },
      plpMedia: emptyLanguageLocalizationCountBucket(),
    });
    assert.equal(state, "BACKFILL_REQUIRED");
  });

  it("ready / degraded / failed / in-progress states derive from measured counts", () => {
    assert.equal(
      deriveLanguageLocalizationReadinessState({
        enabled: true,
        contentTranslationEnabled: true,
        webUiDataReady: true,
        controlledVocabularyPresentationReady: true,
        ct: { ...emptyLanguageLocalizationCountBucket(), current: 5 },
        plpMedia: { ...emptyLanguageLocalizationCountBucket(), current: 1 },
      }),
      "READY",
    );
    assert.equal(
      deriveLanguageLocalizationReadinessState({
        enabled: true,
        contentTranslationEnabled: true,
        webUiDataReady: true,
        controlledVocabularyPresentationReady: true,
        ct: {
          ...emptyLanguageLocalizationCountBucket(),
          current: 2,
          failed: 1,
        },
        plpMedia: emptyLanguageLocalizationCountBucket(),
      }),
      "DEGRADED",
    );
    assert.equal(
      deriveLanguageLocalizationReadinessState({
        enabled: true,
        contentTranslationEnabled: true,
        webUiDataReady: true,
        controlledVocabularyPresentationReady: true,
        ct: {
          ...emptyLanguageLocalizationCountBucket(),
          failed: 4,
        },
        plpMedia: emptyLanguageLocalizationCountBucket(),
      }),
      "FAILED",
    );
    assert.equal(
      deriveLanguageLocalizationReadinessState({
        enabled: true,
        contentTranslationEnabled: true,
        webUiDataReady: true,
        controlledVocabularyPresentationReady: true,
        ct: {
          ...emptyLanguageLocalizationCountBucket(),
          pending: 2,
          workItemsRequired: 2,
        },
        plpMedia: emptyLanguageLocalizationCountBucket(),
      }),
      "BACKFILL_IN_PROGRESS",
    );
    assert.equal(
      deriveLanguageLocalizationReadinessState({
        enabled: true,
        contentTranslationEnabled: true,
        webUiDataReady: false,
        controlledVocabularyPresentationReady: true,
        ct: emptyLanguageLocalizationCountBucket(),
        plpMedia: emptyLanguageLocalizationCountBucket(),
      }),
      "DATA_NOT_READY",
    );
  });

  it("A–G. Synthetic future locale fr enters Registry CT targets + planner + readiness", async () => {
    await createLanguageRegistryRecord({
      locale: "fr",
      englishName: "French",
      nativeName: "Français",
      textDirection: "ltr",
      enabled: true,
      contentTranslationEnabled: true,
      searchEnabled: false,
      seoIndexingEnabled: false,
      uiTranslationStatus: "none",
    });

    const targets = await listAutomaticContentTranslationTargetLocales({
      excludeSourceLanguage: "en",
    });
    assert.ok(targets.includes("fr"));

    const plan = await planLanguageHistoricalBackfill({
      locale: "fr",
      registryEligible: true,
      mode: "dry-run",
      deps: {
        auditCorpus: async () => missingAuditForLocale("fr", 1) as never,
        classifyMediaEditorial: async () => "MISSING",
      },
    });
    assert.equal(plan.registryEligible, true);
    assert.ok(plan.summary.ctWorkItems > 0);
    assert.ok(plan.summary.plpWorkItems > 0);
    assert.ok(
      plan.excluded.some((row) => row.kindId === "public_news"),
    );
    assert.ok(
      plan.excluded.some((row) => row.kindId === "knowledge_article"),
    );
    assert.ok(
      plan.items.every((item) => !LANGUAGE_ACTIVATION_PROTECTED_EXCLUDED_KINDS.includes(item.kindId as never)),
    );

    const readiness = await evaluateLanguageLocalizationReadiness({
      locale: "fr",
      skipCorpusPlan: true,
      ctCounts: {
        ...emptyLanguageLocalizationCountBucket(),
        missing: 1,
        workItemsRequired: 1,
      },
      plpCounts: {
        ...emptyLanguageLocalizationCountBucket(),
        missing: 1,
        workItemsRequired: 1,
      },
      assessWebUi: () => ({
        engineReady: true,
        dataReady: false,
        requiredKeyCount: 10,
        missingKeyCount: 10,
        emptyKeyCount: 0,
        englishFallbackKeyCount: 0,
        sampleMissingPaths: ["navigation.home"],
      }),
      assessControlledVocabulary: async () => ({
        presentationReady: true,
        conceptsChecked: 5,
        conceptsWithTerminologyPreferredTerm: 0,
        conceptsWithWebUiFallbackOnly: 5,
        conceptsMissingLocalizedLabel: 0,
        missingPreferredTermGaps: ["analysis"],
      }),
    });
    assert.equal(readiness.state, "DATA_NOT_READY");
    assert.equal(readiness.engineReady, true);
    assert.equal(readiness.registry.searchEnabled, false);
    assert.equal(readiness.registry.seoIndexingEnabled, false);
    assert.equal(readiness.seoReady, false);
    assert.equal(isLocalizationReadyForSearch(readiness), false);
    assert.ok(
      readiness.kindRows.some(
        (row) =>
          row.kindId === "knowledge_article" &&
          row.ownership === "NO_TRANSLATION_OWNER",
      ),
    );

    // Once WEB_UI + owned content complete → READY without locale-specific code.
    const ready = await evaluateLanguageLocalizationReadiness({
      locale: "fr",
      skipCorpusPlan: true,
      ctCounts: { ...emptyLanguageLocalizationCountBucket(), current: 4 },
      plpCounts: { ...emptyLanguageLocalizationCountBucket(), current: 1 },
      assessWebUi: () => ({
        engineReady: true,
        dataReady: true,
        requiredKeyCount: 10,
        missingKeyCount: 0,
        emptyKeyCount: 0,
        englishFallbackKeyCount: 0,
        sampleMissingPaths: [],
      }),
      assessControlledVocabulary: async () => ({
        presentationReady: true,
        conceptsChecked: 5,
        conceptsWithTerminologyPreferredTerm: 1,
        conceptsWithWebUiFallbackOnly: 4,
        conceptsMissingLocalizedLabel: 0,
        missingPreferredTermGaps: ["initiative"],
      }),
    });
    assert.equal(ready.state, "READY");
    assert.equal(ready.seoReady, true);
    assert.equal(ready.PROVIDER_CALLS, 0);
    assert.equal(ready.WRITES_PERFORMED, 0);
  });

  it("another arbitrary locale pt proves fr is not special-cased", async () => {
    await createLanguageRegistryRecord({
      locale: "pt",
      englishName: "Portuguese",
      nativeName: "Português",
      textDirection: "ltr",
      enabled: true,
      contentTranslationEnabled: true,
    });
    const targets = await listAutomaticContentTranslationTargetLocales({
      excludeSourceLanguage: "en",
    });
    assert.ok(targets.includes("pt"));
    const plan = await planLanguageHistoricalBackfill({
      locale: "pt",
      registryEligible: true,
      deps: {
        auditCorpus: async () => emptyAuditForLocale("pt") as never,
        classifyMediaEditorial: async () => "CURRENT_PUBLISHED_COMPLETE",
      },
    });
    assert.equal(plan.locale, "pt");
    assert.ok(plan.items.some((item) => item.owner === "CT"));
  });

  it("Terminology missing but WEB_UI fallback keeps presentationReady", async () => {
    const readiness = await evaluateLanguageLocalizationReadiness({
      locale: "uk",
      registryRecord: {
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
        searchEnabled: false,
        seoIndexingEnabled: false,
        aliases: [],
        providerMappings: {},
        createdAt: "2020-01-01T00:00:00.000Z",
        updatedAt: "2020-01-01T00:00:00.000Z",
      },
      skipCorpusPlan: true,
      ctCounts: { ...emptyLanguageLocalizationCountBucket(), current: 1 },
      plpCounts: { ...emptyLanguageLocalizationCountBucket(), current: 1 },
      assessWebUi: () => ({
        engineReady: true,
        dataReady: true,
        requiredKeyCount: 1,
        missingKeyCount: 0,
        emptyKeyCount: 0,
        englishFallbackKeyCount: 0,
        sampleMissingPaths: [],
      }),
      assessControlledVocabulary: async () => ({
        presentationReady: true,
        conceptsChecked: 3,
        conceptsWithTerminologyPreferredTerm: 0,
        conceptsWithWebUiFallbackOnly: 3,
        conceptsMissingLocalizedLabel: 0,
        missingPreferredTermGaps: ["analysis", "discussion", "initiative"],
      }),
    });
    assert.equal(readiness.state, "READY");
    assert.ok(
      readiness.gaps.some((gap) => gap.includes("Terminology preferredTerm gaps")),
    );
  });

  it("dry-run performs no writes; execute delegates bounded mechanisms", async () => {
    await createLanguageRegistryRecord({
      locale: "fr",
      englishName: "French",
      nativeName: "Français",
      textDirection: "ltr",
      enabled: true,
      contentTranslationEnabled: true,
    });

    let residualCalls = 0;
    let plpCalls = 0;
    const dry = await activateLanguageLocalization({
      locale: "fr",
      execute: false,
      skipCorpusInReadiness: true,
      plannerDeps: {
        auditCorpus: async () => missingAuditForLocale("fr", 1) as never,
        classifyMediaEditorial: async () => "MISSING",
      },
      runResidualRetry: async () => {
        residualCalls += 1;
        throw new Error("should not run in dry-run");
      },
      enqueuePlpEditorial: async () => {
        plpCalls += 1;
      },
    });
    assert.equal(dry.mode, "dry-run");
    assert.equal(dry.WRITES_PERFORMED, 0);
    assert.equal(dry.PROVIDER_CALLS, 0);
    assert.equal(residualCalls, 0);
    assert.equal(plpCalls, 0);
    assert.equal(dry.seoIndexingEnabledUnchanged, true);

    const executed = await activateLanguageLocalization({
      locale: "fr",
      execute: true,
      skipCorpusInReadiness: true,
      plannerDeps: {
        auditCorpus: async () => missingAuditForLocale("fr", 1) as never,
        classifyMediaEditorial: async () => "MISSING",
      },
      runResidualRetry: async () => {
        residualCalls += 1;
        return {
          mode: "execute",
          preAudit: missingAuditForLocale("fr", 1) as never,
          selection: { ready: [], blocked: [] } as never,
          RETRY_READY_IDENTITIES: 1,
          RETRY_BLOCKED_IDENTITIES: 0,
          RETRY_SELECTED_IDENTITIES: 1,
          selectedIdentities: [],
          blockedIdentities: [],
          schedule: [],
          presentationsToEnqueue: 1,
          presentationGroupingExplained: true,
          selectedWorkItems: [],
          presentationsScheduled: 1,
          presentationsDeduped: 0,
          presentationsFailed: 0,
          enqueueResults: [],
          abortReason: null,
        };
      },
      enqueuePlpEditorial: async () => {
        plpCalls += 1;
      },
    });
    assert.equal(executed.mode, "execute");
    assert.equal(residualCalls, 1);
    assert.equal(plpCalls, 1);
    assert.equal(executed.execute.ctKindsEnqueued, 1);
    assert.equal(executed.execute.plpEditorialEnqueued, true);
    assert.equal(executed.seoIndexingEnabledUnchanged, true);

    // Idempotent rerun with CURRENT skips PLP enqueue
    const rerun = await activateLanguageLocalization({
      locale: "fr",
      execute: true,
      skipCorpusInReadiness: true,
      plannerDeps: {
        auditCorpus: async () => emptyAuditForLocale("fr") as never,
        classifyMediaEditorial: async () => "CURRENT_PUBLISHED_COMPLETE",
      },
      runResidualRetry: async () => {
        residualCalls += 1;
        return {
          mode: "execute",
          preAudit: emptyAuditForLocale("fr") as never,
          selection: { ready: [], blocked: [] } as never,
          RETRY_READY_IDENTITIES: 0,
          RETRY_BLOCKED_IDENTITIES: 0,
          RETRY_SELECTED_IDENTITIES: 0,
          selectedIdentities: [],
          blockedIdentities: [],
          schedule: [],
          presentationsToEnqueue: 0,
          presentationGroupingExplained: true,
          selectedWorkItems: [],
          presentationsScheduled: 0,
          presentationsDeduped: 0,
          presentationsFailed: 0,
          enqueueResults: [],
          abortReason: null,
        };
      },
      enqueuePlpEditorial: async () => {
        plpCalls += 1;
      },
    });
    assert.equal(rerun.execute.plpEditorialEnqueued, false);
    assert.equal(plpCalls, 1);
  });

  it("no automatic seoIndexingEnabled mutation on CT enable path (source guard)", () => {
    const service = readFileSync(
      path.join(apiSrc, "modules/language/language-registry/language-registry.service.ts"),
      "utf8",
    );
    assert.match(service, /enqueueCivicMediaEditorialPlpBuilds/);
    assert.doesNotMatch(service, /seoIndexingEnabled:\s*true/);
    assert.doesNotMatch(
      service,
      /becameCtEligible[\s\S]{0,400}seoIndexingEnabled/,
    );
  });

  it("CT kinds include owned public kinds; exclude public_news; Knowledge is no-owner", () => {
    assert.ok(LANGUAGE_ACTIVATION_CT_OWNED_KINDS.includes("initiative"));
    assert.ok(LANGUAGE_ACTIVATION_CT_OWNED_KINDS.includes("blog_post"));
    assert.ok(LANGUAGE_ACTIVATION_CT_OWNED_KINDS.includes("collaborative_analysis"));
    assert.ok(!LANGUAGE_ACTIVATION_CT_OWNED_KINDS.includes("public_news" as never));
    assert.deepEqual([...LANGUAGE_ACTIVATION_PROTECTED_EXCLUDED_KINDS], ["public_news"]);
    assert.deepEqual([...LANGUAGE_ACTIVATION_NO_OWNER_KIND_IDS], ["knowledge_article"]);
  });

  it("hardcoded locale eligibility regression gate on Closure 05–07 engine modules", () => {
    assertNoHardcodedLocaleEligibilityPolicy({
      roots: [
        path.join(apiSrc, "modules/language/language-localization-activation"),
        path.join(apiSrc, "modules/language/content-translation-warm-targets.ts"),
        path.join(
          apiSrc,
          "modules/language/published-localized-presentation/universal/public-source-mutation-bridge.ts",
        ),
        path.join(apiSrc, "modules/language/media-hu-localization-integrity.ts"),
      ],
    });
  });

  it("operator script defaults to dry-run and requires --locale", () => {
    const script = readFileSync(
      path.join(apiSrc, "scripts/activate-language-localization.ts"),
      "utf8",
    );
    assert.match(script, /--execute/);
    assert.match(script, /activateLanguageLocalization/);
    assert.match(script, /Missing required --locale/);
    const pkg = JSON.parse(
      readFileSync(path.join(repoRoot, "apps/api/package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    assert.match(pkg.scripts["localization:activate-language"] ?? "", /activate-language-localization/);
  });

  it("Admin readiness route exists and does not enqueue in GET", () => {
    const routes = readFileSync(
      path.join(apiSrc, "modules/language/language-registry/admin-languages.routes.ts"),
      "utf8",
    );
    assert.match(routes, /localization-readiness/);
    assert.match(routes, /evaluateLanguageLocalizationReadiness/);
    assert.doesNotMatch(routes, /activateLanguageLocalization/);
  });

  it("Closure 01–06 test files remain present", () => {
    for (const name of [
      "localization-authority-closure01-public-presentation.unit.test.ts",
      "localization-authority-closure02-public-presentation-resolver.unit.test.ts",
      "localization-authority-closure03-initiative-ca.unit.test.ts",
      "localization-authority-closure04-improvement-proposals.unit.test.ts",
      "localization-authority-closure05-media-registry.unit.test.ts",
      "localization-authority-closure06-public-surfaces.unit.test.ts",
    ]) {
      assert.ok(readFileSync(path.join(here, name), "utf8").length > 100);
    }
  });
});
