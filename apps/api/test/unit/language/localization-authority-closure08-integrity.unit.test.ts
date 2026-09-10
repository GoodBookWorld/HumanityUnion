/**
 * Localization Authority Closure 08 — final integrity / operational safety.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  CONTROLLED_PUBLIC_DOMAIN_CONCEPT_IDS,
  LANGUAGE_ACTIVATION_CT_OWNED_KINDS,
  LANGUAGE_ACTIVATION_MANUAL_AUTHOR_PUBLIC_KINDS,
  LANGUAGE_ACTIVATION_NO_OWNER_KIND_IDS,
  LANGUAGE_ACTIVATION_PLP_OWNED_MEDIA_ENTITY_TYPES,
  LANGUAGE_ACTIVATION_PROTECTED_EXCLUDED_KINDS,
  LOCALIZATION_INTEGRITY_OWNERSHIP_POLICY,
  applyControlledPublicVocabularyToProse,
  buildLocalizationIntegrityReport,
  deriveLanguageLocalizationReadinessState,
  emptyLanguageLocalizationCountBucket,
  isLocalizationReadyForSearch,
  isLocalizationReadyForSeo,
  resolvePublicPresentationField,
  type LanguageLocalizationReadinessReport,
} from "@hu/types";

import {
  activateLanguageLocalization,
  assertNoHardcodedLocaleEligibilityPolicy,
  ensureLanguageRegistrySeeded,
  evaluateLanguageLocalizationReadiness,
  planLanguageHistoricalBackfill,
  resetLanguageRegistryStoreForTests,
  runLocalizationIntegrityCheck,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/index.js";
import { resolveContentTranslationOperatorHydrateScopes } from "../../../src/modules/language/content-translation-staging-warm-operator-scope.js";
import { checkPublicCatalogReadiness } from "../../../../web/src/features/language/public-catalog-readiness.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");
const apiSrc = path.resolve(here, "../../../src");
const webSrc = path.resolve(here, "../../../../web/src");

function readApi(rel: string): string {
  return readFileSync(path.join(apiSrc, rel), "utf8");
}

function readWeb(rel: string): string {
  return readFileSync(path.join(webSrc, rel), "utf8");
}

function readRepo(rel: string): string {
  return readFileSync(path.join(repoRoot, rel), "utf8");
}

function loadMessages(locale: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(
      path.join(webSrc, "features/i18n/messages", `${locale}.json`),
      "utf8",
    ),
  ) as Record<string, unknown>;
}

function readyReadiness(
  locale: string,
  overrides?: Partial<LanguageLocalizationReadinessReport>,
): LanguageLocalizationReadinessReport {
  const empty = emptyLanguageLocalizationCountBucket();
  const base: LanguageLocalizationReadinessReport = {
    pack: "closure07",
    locale,
    languageId: `lang-${locale}`,
    registry: {
      enabled: true,
      contentTranslationEnabled: true,
      searchEnabled: false,
      seoIndexingEnabled: false,
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
      conceptsChecked: 4,
      conceptsWithTerminologyPreferredTerm: 0,
      conceptsWithWebUiFallbackOnly: 4,
      conceptsMissingLocalizedLabel: 0,
      missingPreferredTermGaps: [],
    },
    higherAuthority: {
      brandPublished: null,
      legalPublished: null,
      note: null,
    },
    ct: { ...empty, current: 1 },
    plpMedia: { ...empty, current: 1 },
    kindRows: [],
    seoReady: true,
    searchLocalizationReady: true,
    PROVIDER_CALLS: 0,
    WRITES_PERFORMED: 0,
    gaps: [],
  };
  return { ...base, ...overrides };
}

describe("Localization Authority Closure 08 — integrity contract", () => {
  beforeEach(async () => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
  });

  afterEach(() => {
    resetLanguageRegistryStoreForTests();
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("1. ownership policy classifies CT / PLP / protected / no-owner / Part D", () => {
    assert.ok(LOCALIZATION_INTEGRITY_OWNERSHIP_POLICY.ctOwned.includes("initiative"));
    assert.ok(
      LOCALIZATION_INTEGRITY_OWNERSHIP_POLICY.ctOwned.includes("collaborative_analysis"),
    );
    assert.ok(LOCALIZATION_INTEGRITY_OWNERSHIP_POLICY.ctOwned.includes("blog_post"));
    assert.ok(
      LOCALIZATION_INTEGRITY_OWNERSHIP_POLICY.plpOwned.includes("civic_media_editorial"),
    );
    assert.ok(
      LOCALIZATION_INTEGRITY_OWNERSHIP_POLICY.plpOwned.includes("civic_media_principle"),
    );
    assert.deepEqual(
      [...LOCALIZATION_INTEGRITY_OWNERSHIP_POLICY.protectedExcluded],
      [...LANGUAGE_ACTIVATION_PROTECTED_EXCLUDED_KINDS],
    );
    assert.deepEqual(
      [...LOCALIZATION_INTEGRITY_OWNERSHIP_POLICY.noOwner],
      [...LANGUAGE_ACTIVATION_NO_OWNER_KIND_IDS],
    );
    assert.ok(
      LOCALIZATION_INTEGRITY_OWNERSHIP_POLICY.manualAuthor.includes(
        "improvement_proposal_part_d",
      ),
    );
    assert.equal(
      LOCALIZATION_INTEGRITY_OWNERSHIP_POLICY.mediaCarouselDecision,
      "REQUIRED_PLP_DISCRETE_ENTITY_TYPES",
    );
    assert.match(
      LOCALIZATION_INTEGRITY_OWNERSHIP_POLICY.mediaCarouselNote,
      /public_news/,
    );
    assert.ok(!LANGUAGE_ACTIVATION_CT_OWNED_KINDS.includes("knowledge_article" as never));
    assert.ok(
      !LANGUAGE_ACTIVATION_MANUAL_AUTHOR_PUBLIC_KINDS.includes(
        "improvement_proposal" as never,
      ),
    );
  });

  it("2. aggregate READY semantics reuse Closure 07; Knowledge does not block", () => {
    const ready = deriveLanguageLocalizationReadinessState({
      enabled: true,
      contentTranslationEnabled: true,
      webUiDataReady: true,
      controlledVocabularyPresentationReady: true,
      ct: { ...emptyLanguageLocalizationCountBucket(), current: 3 },
      plpMedia: { ...emptyLanguageLocalizationCountBucket(), current: 2 },
    });
    assert.equal(ready, "READY");

    const backfill = deriveLanguageLocalizationReadinessState({
      enabled: true,
      contentTranslationEnabled: true,
      webUiDataReady: true,
      controlledVocabularyPresentationReady: true,
      ct: {
        ...emptyLanguageLocalizationCountBucket(),
        missing: 1,
        workItemsRequired: 1,
      },
      plpMedia: emptyLanguageLocalizationCountBucket(),
    });
    assert.equal(backfill, "BACKFILL_REQUIRED");

    const dataNotReady = deriveLanguageLocalizationReadinessState({
      enabled: true,
      contentTranslationEnabled: true,
      webUiDataReady: false,
      controlledVocabularyPresentationReady: true,
      ct: emptyLanguageLocalizationCountBucket(),
      plpMedia: emptyLanguageLocalizationCountBucket(),
    });
    assert.equal(dataNotReady, "DATA_NOT_READY");

    const report = buildLocalizationIntegrityReport({
      readiness: readyReadiness("uk"),
      kindScope: ["knowledge_article"],
      artifacts: [
        {
          kindId: "knowledge_article",
          ownership: "NO_TRANSLATION_OWNER",
          state: "NO_OWNER",
          detail: "canonical body",
        },
      ],
    });
    assert.equal(report.overallStatus, "READY");
    assert.equal(report.blocking, false);
    assert.equal(report.seoReady, isLocalizationReadyForSeo(report.readiness));
    assert.equal(report.searchReady, isLocalizationReadyForSearch(report.readiness));
    assert.equal(report.safety.providerCalls, 0);
    assert.equal(report.safety.writesPerformed, 0);
    assert.equal(report.safety.enqueuesPerformed, 0);
  });

  it("3. integrity check refuses multi-locale and unbounded kind", async () => {
    await assert.rejects(
      () =>
        runLocalizationIntegrityCheck({
          locale: "uk,ar",
          kinds: ["initiative"],
        }),
      /exactly one locale/i,
    );
    await assert.rejects(
      () =>
        runLocalizationIntegrityCheck({
          locale: "uk",
          kinds: ["all"],
        }),
      /unbounded/i,
    );
  });

  it("4. integrity check consolidates readiness + kind scope (injected)", async () => {
    const report = await runLocalizationIntegrityCheck({
      locale: "uk",
      kinds: ["initiative", "public_news", "knowledge_article"],
      auditCorpus: async () =>
        ({
          discoveryStatus: "COMPLETE",
          discoveryHint: null,
          discoveryByKind: [],
          targetLocales: ["uk"],
          schemaVersion: "test",
          byFamily: [],
          byLocale: [
            {
              targetLanguage: "uk",
              MISSING_TARGET_TRANSLATION_IDENTITIES: 0,
              STALE_TARGET_TRANSLATION_IDENTITIES: 0,
              FAILED_TARGET_TRANSLATION_IDENTITIES: 0,
              CURRENT_TARGET_TRANSLATION_IDENTITIES: 2,
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
        }) as never,
      evaluateReadiness: async () => readyReadiness("uk"),
    });
    assert.equal(report.pack, "closure08");
    assert.equal(report.locale, "uk");
    assert.deepEqual([...report.kindScope], [
      "initiative",
      "public_news",
      "knowledge_article",
    ]);
    const states = Object.fromEntries(
      report.artifacts.map((row) => [row.kindId, row.state]),
    );
    assert.equal(states.initiative, "CURRENT");
    assert.equal(states.public_news, "PROTECTED");
    assert.equal(states.knowledge_article, "NO_OWNER");
    assert.equal(report.blocking, false);
  });

  it("5. CLI script is bounded read-only and exits 2 on blocking", () => {
    const script = readApi("scripts/check-localization-integrity.ts");
    assert.match(script, /runLocalizationIntegrityCheck/);
    assert.match(script, /resolveContentTranslationOperatorHydrateScopes/);
    assert.match(script, /exitCode = 2/);
    assert.match(script, /Refuses unbounded|--kind=all/);
    assert.match(script, /No provider\. No writes\. No enqueue/);
    assert.doesNotMatch(script, /\bTranslationProvider\b|generateContentTranslation\s*\(/);
    const pkg = readRepo("apps/api/package.json");
    assert.match(pkg, /"localization:check"/);
  });

  it("5b. collaborative_analysis hydrate scopes match warm resolver", () => {
    assert.deepEqual(
      resolveContentTranslationOperatorHydrateScopes(["collaborative_analysis"]),
      {
        initiative: true,
        collaborativeAnalysis: true,
        collectiveDecision: false,
      },
    );
    const script = readApi("scripts/check-localization-integrity.ts");
    assert.match(script, /resolveContentTranslationOperatorHydrateScopes/);
    assert.doesNotMatch(
      script,
      /initiative:\s*kinds\.includes\("initiative"\)\s*\|\|\s*kinds\.includes\("discussion_comment"\)/,
    );
  });

  it("5c. failed/empty discovery cannot yield false READY", async () => {
    const report = await runLocalizationIntegrityCheck({
      locale: "uk",
      kinds: ["collaborative_analysis"],
      auditCorpus: async () =>
        ({
          discoveryStatus: "FAILED",
          discoveryHint: "SOURCE_RECORDS_DISCOVERED.initiative=0",
          discoveryByKind: [
            {
              sourceKind: "collaborative_analysis",
              sourceRecordsDiscovered: 0,
              publicRecords: 0,
            },
          ],
          targetLocales: ["uk"],
          schemaVersion: "test",
          byFamily: [],
          byLocale: [
            {
              targetLanguage: "uk",
              MISSING_TARGET_TRANSLATION_IDENTITIES: 0,
              STALE_TARGET_TRANSLATION_IDENTITIES: 0,
              FAILED_TARGET_TRANSLATION_IDENTITIES: 0,
              CURRENT_TARGET_TRANSLATION_IDENTITIES: 0,
              WORK_ITEMS_REQUIRED: 0,
            },
          ],
          totals: {},
          workItems: [],
          candidates: [],
        }) as never,
      evaluateReadiness: async () => readyReadiness("uk"),
    });
    assert.equal(
      report.artifacts.find((row) => row.kindId === "collaborative_analysis")?.state,
      "NO_CORPUS",
    );
    assert.equal(report.overallStatus, "DATA_NOT_READY");
    assert.equal(report.blocking, true);
  });

  it("5d. complete discovered corpus with CURRENT can still yield READY", async () => {
    const report = await runLocalizationIntegrityCheck({
      locale: "uk",
      kinds: ["collaborative_analysis"],
      auditCorpus: async () =>
        ({
          discoveryStatus: "COMPLETE",
          discoveryHint: null,
          discoveryByKind: [
            {
              sourceKind: "collaborative_analysis",
              sourceRecordsDiscovered: 2,
              publicRecords: 2,
            },
          ],
          targetLocales: ["uk"],
          schemaVersion: "test",
          byFamily: [],
          byLocale: [
            {
              targetLanguage: "uk",
              MISSING_TARGET_TRANSLATION_IDENTITIES: 0,
              STALE_TARGET_TRANSLATION_IDENTITIES: 0,
              FAILED_TARGET_TRANSLATION_IDENTITIES: 0,
              CURRENT_TARGET_TRANSLATION_IDENTITIES: 2,
              WORK_ITEMS_REQUIRED: 0,
            },
          ],
          totals: {},
          workItems: [],
          candidates: [{ sourceKind: "collaborative_analysis", sourceRecordId: "ca-1" }],
        }) as never,
      evaluateReadiness: async () => readyReadiness("uk"),
    });
    assert.equal(
      report.artifacts.find((row) => row.kindId === "collaborative_analysis")?.state,
      "CURRENT",
    );
    assert.equal(report.overallStatus, "READY");
    assert.equal(report.blocking, false);
  });

  it("6. Media carousel required discrete PLP types; public_news excluded", async () => {
    assert.deepEqual(
      [...LANGUAGE_ACTIVATION_PLP_OWNED_MEDIA_ENTITY_TYPES],
      [
        "civic_media_editorial",
        "civic_media_principle",
        "civic_media_trusted",
        "civic_media_fact_check",
        "civic_media_propaganda",
      ],
    );
    const plan = await planLanguageHistoricalBackfill({
      locale: "uk",
      registryEligible: true,
      deps: {
        auditCorpus: async () =>
          ({
            byLocale: [
              {
                targetLanguage: "uk",
                MISSING_TARGET_TRANSLATION_IDENTITIES: 0,
                STALE_TARGET_TRANSLATION_IDENTITIES: 0,
                FAILED_TARGET_TRANSLATION_IDENTITIES: 0,
                CURRENT_TARGET_TRANSLATION_IDENTITIES: 1,
                WORK_ITEMS_REQUIRED: 0,
              },
            ],
          }) as never,
        classifyMediaEditorial: async () => "CURRENT_PUBLISHED_COMPLETE",
        assessCarouselPlp: async () => ({
          total: {
            ...emptyLanguageLocalizationCountBucket(),
            current: 4,
          },
          byKind: [
            "civic_media_principle",
            "civic_media_trusted",
            "civic_media_fact_check",
            "civic_media_propaganda",
          ].map((kindId) => ({
            kindId,
            counts: { ...emptyLanguageLocalizationCountBucket(), current: 1 },
            checked: 1,
          })),
        }),
      },
    });
    assert.ok(!plan.excluded.some((row) => row.kindId === "civic_media_principle"));
    assert.ok(plan.excluded.some((row) => row.kindId === "public_news"));
    for (const kindId of [
      "civic_media_principle",
      "civic_media_trusted",
      "civic_media_fact_check",
      "civic_media_propaganda",
    ]) {
      const row = plan.items.find((item) => item.kindId === kindId);
      assert.ok(row);
      assert.equal(row!.owner, "PLP");
      assert.equal(row!.action, "skip_current");
    }
  });

  it("7. remaining English leak disposition — public CV forms + non-public API labels", () => {
    assert.ok(CONTROLLED_PUBLIC_DOMAIN_CONCEPT_IDS.includes("helpful"));
    assert.ok(CONTROLLED_PUBLIC_DOMAIN_CONCEPT_IDS.includes("not_helpful"));
    assert.ok(CONTROLLED_PUBLIC_DOMAIN_CONCEPT_IDS.includes("active_allies"));

    const draft = readApi(
      "modules/initiative-collaborative-analysis/initiative-analysis-draft-builder.ts",
    );
    assert.match(draft, /lifecycleStageToken\("discussion"\)/);
    assert.match(draft, /\bHelpful\b/);
    assert.match(draft, /"Ally"/);
    assert.match(draft, /"Allies"/);

    const substituted = applyControlledPublicVocabularyToProse({
      prose: "3 marked Helpful, 1 Active Allies in Discussion",
      labelLookup: {
        helpful: {
          webUiControlledLabel: "Корисно",
          registryCanonicalEnglishLabel: "Helpful",
        },
        active_allies: {
          webUiControlledLabel: "Активні союзники",
          registryCanonicalEnglishLabel: "Active Allies",
        },
        discussion: {
          webUiControlledLabel: "Обговорення",
          stageId: "discussion",
          registryCanonicalEnglishLabel: "Discussion",
        },
      },
    });
    assert.match(substituted.text, /Корисно/);
    assert.match(substituted.text, /Активні союзники/);
    assert.match(substituted.text, /Обговорення/);

    // API lifecycle adapter Active Allies labels — author/workspace internal (class A).
    const adapter = readApi(
      "modules/initiatives/initiative-lifecycle-stage-adapter.ts",
    );
    assert.match(adapter, /label: "Active Allies"/);
  });

  it("8. future-language adaptivity — synthetic fr uses Registry + same rules", async () => {
    assertNoHardcodedLocaleEligibilityPolicy({
      roots: [
        path.join(apiSrc, "modules/language/language-localization-activation"),
        path.join(apiSrc, "modules/language/localization-integrity-check.ts"),
        path.join(apiSrc, "modules/language/assess-media-carousel-plp-presence.ts"),
        path.join(apiSrc, "modules/language/media-hu-localization-integrity.ts"),
      ],
    });

    const report = await evaluateLanguageLocalizationReadiness({
      locale: "fr",
      registryRecord: {
        languageId: "lang-fr",
        locale: "fr",
        languageCode: "fr",
        englishName: "French",
        nativeName: "Français",
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
      ctCounts: { ...emptyLanguageLocalizationCountBucket(), current: 2 },
      plpCounts: { ...emptyLanguageLocalizationCountBucket(), current: 2 },
      assessWebUi: () => ({
        engineReady: true as const,
        dataReady: true,
        requiredKeyCount: 5,
        missingKeyCount: 0,
        emptyKeyCount: 0,
        englishFallbackKeyCount: 0,
        sampleMissingPaths: [],
      }),
      assessControlledVocabulary: async () => ({
        presentationReady: true,
        conceptsChecked: 4,
        conceptsWithTerminologyPreferredTerm: 0,
        conceptsWithWebUiFallbackOnly: 4,
        conceptsMissingLocalizedLabel: 0,
        missingPreferredTermGaps: [],
      }),
    });
    assert.equal(report.locale, "fr");
    assert.equal(report.engineReady, true);
    assert.equal(report.state, "READY");
    assert.equal(isLocalizationReadyForSeo(report), true);

    const integrity = buildLocalizationIntegrityReport({
      readiness: report,
      kindScope: ["initiative", "civic_media_editorial"],
    });
    assert.equal(integrity.overallStatus, "READY");
    assert.equal(integrity.blocking, false);

    const plan = await planLanguageHistoricalBackfill({
      locale: "fr",
      registryEligible: true,
      deps: {
        auditCorpus: async () =>
          ({
            byLocale: [
              {
                targetLanguage: "fr",
                MISSING_TARGET_TRANSLATION_IDENTITIES: 1,
                STALE_TARGET_TRANSLATION_IDENTITIES: 0,
                FAILED_TARGET_TRANSLATION_IDENTITIES: 0,
                CURRENT_TARGET_TRANSLATION_IDENTITIES: 0,
                WORK_ITEMS_REQUIRED: 1,
              },
            ],
          }) as never,
        classifyMediaEditorial: async () => "MISSING",
        assessCarouselPlp: async () => ({
          total: {
            ...emptyLanguageLocalizationCountBucket(),
            missing: 1,
            workItemsRequired: 1,
          },
          byKind: [
            {
              kindId: "civic_media_principle",
              counts: {
                ...emptyLanguageLocalizationCountBucket(),
                missing: 1,
                workItemsRequired: 1,
              },
              checked: 1,
            },
          ],
        }),
      },
    });
    assert.ok(plan.items.some((item) => item.owner === "CT" && item.workItemsRequired > 0));
    assert.ok(
      plan.items.some(
        (item) => item.kindId === "civic_media_editorial" && item.action === "enqueue_plp_editorial",
      ),
    );
    assert.ok(
      plan.items.some(
        (item) =>
          item.kindId === "civic_media_principle" && item.action === "enqueue_plp_carousel",
      ),
    );
  });

  it("9. activation dry-run writes/enqueues nothing; execute is one locale", async () => {
    let residualCalls = 0;
    let plpCalls = 0;
    const dry = await activateLanguageLocalization({
      locale: "uk",
      execute: false,
      skipCorpusInReadiness: true,
      plannerDeps: {
        auditCorpus: async () =>
          ({
            byLocale: [
              {
                targetLanguage: "uk",
                MISSING_TARGET_TRANSLATION_IDENTITIES: 0,
                STALE_TARGET_TRANSLATION_IDENTITIES: 0,
                FAILED_TARGET_TRANSLATION_IDENTITIES: 0,
                CURRENT_TARGET_TRANSLATION_IDENTITIES: 1,
                WORK_ITEMS_REQUIRED: 0,
              },
            ],
          }) as never,
        classifyMediaEditorial: async () => "CURRENT_PUBLISHED_COMPLETE",
        assessCarouselPlp: async () => ({
          total: emptyLanguageLocalizationCountBucket(),
          byKind: [],
        }),
      },
      runResidualRetry: async () => {
        residualCalls += 1;
        return {
          presentationsScheduled: 1,
          presentationsDeduped: 0,
        } as never;
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
    assert.match(dry.execute.notes.join(" "), /Dry-run/);

    await assert.rejects(
      () => activateLanguageLocalization({ locale: "uk,ar", execute: false }),
      /exactly one locale/i,
    );

    const script = readApi("scripts/activate-language-localization.ts");
    assert.match(script, /DRY RUN|dry-run|execute/i);
    assert.match(script, /--execute/);
  });

  it("10. public read-side paths never import provider/generate/write/enqueue", () => {
    const paths = [
      "features/language/components/PublicTranslatedFields.tsx",
      "features/public-initiative-experience/initiative-experience-i18n.ts",
      "features/initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsPublicResult.tsx",
      "features/blog/resolve-blog-post-presentation.ts",
      "features/language/media-plp/resolve-media-public-hu-owned-body.ts",
      "features/language/media-plp/load-media-plp-ssr.ts",
    ];
    for (const rel of paths) {
      const src = readWeb(rel);
      assert.doesNotMatch(src, /\bTranslationProvider\b/);
      assert.doesNotMatch(src, /POST\s*\/translations\/generate|generateContentTranslation\s*\(/);
      assert.doesNotMatch(src, /enqueuePlpBuildRequest|enqueueCivicMediaEditorial/);
      assert.doesNotMatch(src, /insertOne\(|updateOne\(|content_translations/);
    }
    const fields = readWeb("features/language/components/PublicTranslatedFields.tsx");
    assert.match(fields, /cache-only|never POST \/generate/i);
  });

  it("11. provenance truthfulness — fallback/protected/manual never mislabeled", () => {
    const canonical = resolvePublicPresentationField({
      canonicalEnglishFallback: "English body",
      persistedTranslation: null,
    });
    assert.equal(canonical?.authority, "CANONICAL_ENGLISH_FALLBACK");
    assert.notEqual(canonical?.authority, "PERSISTED_TRANSLATION");
    assert.equal(canonical?.presence, "canonical_english_fallback_only");

    const protectedNews = resolvePublicPresentationField({
      fieldClass: "protected_original_content",
      protectedCanonical: "RSS headline",
      persistedTranslation: "Should never win",
      persistedTranslationMechanism: "content_translation",
    });
    assert.equal(protectedNews?.authority, "PROTECTED_CANONICAL");

    const manual = resolvePublicPresentationField({
      manualAuthor: "Part D author",
      persistedTranslation: "Cap02 chrome MT",
      persistedTranslationMechanism: "content_translation",
    });
    assert.equal(manual?.authority, "MANUAL_AUTHOR");

    const ct = resolvePublicPresentationField({
      persistedTranslation: "CT value",
      persistedTranslationMechanism: "content_translation",
      canonicalEnglishFallback: "EN",
    });
    assert.equal(ct?.authority, "PERSISTED_TRANSLATION");
    assert.equal(ct?.persistedTranslationMechanism, "content_translation");

    const plp = resolvePublicPresentationField({
      persistedTranslation: "PLP value",
      persistedTranslationMechanism: "published_localized_presentation",
      canonicalEnglishFallback: "EN",
    });
    assert.equal(plp?.authority, "PERSISTED_TRANSLATION");
    assert.equal(plp?.persistedTranslationMechanism, "published_localized_presentation");

    const brandWins = resolvePublicPresentationField({
      brand: "Brand",
      persistedTranslation: "MT",
      persistedTranslationMechanism: "published_localized_presentation",
    });
    assert.equal(brandWins?.authority, "BRAND");
  });

  it("12. catalog readiness — missing required chrome ⇒ DATA_NOT_READY; no hardcoded locale triple", () => {
    const en = loadMessages("en");
    const uk = loadMessages("uk");
    const ready = checkPublicCatalogReadiness({
      locales: ["uk"],
      catalogsByLocale: { en, uk },
      flagEnglishIdenticalAsFallback: false,
    });
    assert.equal(ready.ok, true);

    const empty = checkPublicCatalogReadiness({
      locales: ["fr"],
      catalogsByLocale: { en },
    });
    assert.equal(empty.ok, false);
    assert.ok(empty.issues.length > 0);

    const missingCount = empty.issues.filter((issue) => issue.kind === "missing").length;
    const integrity = buildLocalizationIntegrityReport({
      readiness: readyReadiness("fr", {
        state: "DATA_NOT_READY",
        languageDataReady: false,
        webUi: {
          engineReady: true,
          dataReady: false,
          requiredKeyCount: empty.requiredKeyCount,
          missingKeyCount: missingCount,
          emptyKeyCount: 0,
          englishFallbackKeyCount: 0,
          sampleMissingPaths: empty.issues.slice(0, 5).map((issue) => issue.path || issue.detail),
        },
        seoReady: false,
        searchLocalizationReady: false,
      }),
      kindScope: ["web_ui_catalog"],
    });
    assert.equal(integrity.overallStatus, "DATA_NOT_READY");
    assert.equal(integrity.blocking, true);

    assertNoHardcodedLocaleEligibilityPolicy({
      roots: [
        path.join(apiSrc, "modules/language/language-localization-activation"),
        path.join(apiSrc, "modules/language/localization-integrity-check.ts"),
      ],
    });
  });

  it("13. controlled vocabulary — Registry English alone is not localized-ready", async () => {
    const report = await evaluateLanguageLocalizationReadiness({
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
      ctCounts: emptyLanguageLocalizationCountBucket(),
      plpCounts: emptyLanguageLocalizationCountBucket(),
      assessWebUi: () => ({
        engineReady: true as const,
        dataReady: true,
        requiredKeyCount: 1,
        missingKeyCount: 0,
        emptyKeyCount: 0,
        englishFallbackKeyCount: 0,
        sampleMissingPaths: [],
      }),
      assessControlledVocabulary: async () => ({
        presentationReady: false,
        conceptsChecked: 4,
        conceptsWithTerminologyPreferredTerm: 0,
        conceptsWithWebUiFallbackOnly: 0,
        conceptsMissingLocalizedLabel: 2,
        missingPreferredTermGaps: ["helpful", "active_allies"],
      }),
    });
    assert.equal(report.state, "DATA_NOT_READY");
    assert.equal(report.controlledVocabulary.presentationReady, false);
  });

  it("14. dangerous unbounded commands remain marked / must not be staging acceptance tools", () => {
    const reconcile = readApi("scripts/reconcile-public-localization.ts");
    assert.match(reconcile, /OPERATOR_DEPRECATED_MEMORY_UNSAFE|MEMORY_UNSAFE/);
    const warm = readApi(
      "modules/language/content-translation-staging-warm-operator-scope.ts",
    );
    assert.match(warm, /full corpus|Undefined means full corpus/i);
    const check = readApi("scripts/check-localization-integrity.ts");
    assert.match(check, /Read-only\. No provider/);
    const activate = readApi("scripts/activate-language-localization.ts");
    assert.match(activate, /dry-run|DRY RUN/i);
  });
});
