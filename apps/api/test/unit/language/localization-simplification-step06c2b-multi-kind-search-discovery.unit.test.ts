/**
 * Localization Simplification Step 06C.2B —
 * Expand Search discovery warm to supported Search-mapped CT kinds.
 *
 * Synthetic Registry locale. Deterministic provider only.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_ANALYSIS_PERSISTENCE = "memory";
process.env.DECISION_SESSION_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";

import type { Initiative, InitiativeCollaborativeAnalysis } from "@hu/types";

import {
  CONTENT_TRANSLATION_SEARCH_DISCOVERY_FIELDS,
  DeterministicTranslationProvider,
  TranslationProviderError,
  createLanguageRegistryRecord,
  enqueueSearchDiscoveryForLocale,
  ensureLanguageRegistrySeeded,
  ensureTerminologyGlossarySeeded,
  getOrCreateContentTranslation,
  isSearchDiscoveryMappedSourceKind,
  listContentTranslationWarmMemoryPendingForTests,
  listSearchDiscoveryContentTranslationTargetLocales,
  listSearchDiscoveryMappedSourceKinds,
  listSearchDiscoveryWarmTargets,
  processContentTranslationWarmMemoryQueueForTests,
  projectFieldsToSearchDiscoveryAllowlist,
  resetContentTranslationMemoryStoreForTests,
  resetContentTranslationWarmMemoryForTests,
  resetLanguageRegistryStoreForTests,
  resetTerminologyGlossaryStoreForTests,
  resetTranslationProviderForTests,
  scheduleContentTranslationWarmAfterMutation,
  setContentTranslationWarmForceMemoryForTests,
  setLanguageRegistryForceMemoryForTests,
  setTerminologyGlossaryForceMemoryForTests,
  setTranslationProviderForTests,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";
import {
  createAnalysis,
  deleteAnalysesByAuthorIdForTests,
} from "../../../src/modules/initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../..",
);

const LOCALE = "xx-C2B1";
const LANGUAGE_ID = "lang-xx-c2b1";
const AUTHOR_ID = "member-06c2b";

function sampleInitiative(suffix: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-06c2b-${suffix}-${Date.now()}`,
    stewardId: AUTHOR_ID,
    createdAt: now,
    updatedAt: now,
    title: "Discovery Expand Initiative",
    description: "Initiative description for multi-kind discovery.",
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

function sampleAnalysis(initiativeId: string): InitiativeCollaborativeAnalysis {
  const now = new Date().toISOString();
  return {
    analysisId: `analysis-06c2b-${Date.now()}`,
    initiativeId,
    authorId: AUTHOR_ID,
    title: "Multi-kind Analysis Title",
    summary: "Multi-kind analysis summary.",
    supportingEvidence: "Evidence body that must not enter Search-only provider bags.",
    risks: "Risk body for Extended Localization only.",
    openQuestions: "Open questions body.",
    suggestedImprovements: "Improvements body.",
    references: "References body.",
    status: "published",
    initiativeVersion: 1,
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
  };
}

describe("Localization Simplification Step 06C.2B — multi-kind Search discovery warm", () => {
  let provider: DeterministicTranslationProvider;
  let translateCalls = 0;
  let lastProviderText: string | null = null;
  let initiative: Initiative;
  let analysis: InitiativeCollaborativeAnalysis;

  beforeEach(async () => {
    translateCalls = 0;
    lastProviderText = null;
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWarmMemoryForTests();
    setContentTranslationWarmForceMemoryForTests(true);
    setLanguageRegistryForceMemoryForTests(true);
    setTerminologyGlossaryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    resetTerminologyGlossaryStoreForTests();
    await ensureLanguageRegistrySeeded();
    await ensureTerminologyGlossarySeeded();

    provider = new DeterministicTranslationProvider();
    const originalTranslate = provider.translate.bind(provider);
    provider.translate = async (request) => {
      translateCalls += 1;
      lastProviderText = request.text;
      return originalTranslate(request);
    };
    setTranslationProviderForTests(provider);

    await createLanguageRegistryRecord({
      languageId: LANGUAGE_ID,
      locale: LOCALE,
      englishName: "Expand Synthetic",
      nativeName: "Expand Synthetic",
      textDirection: "ltr",
      enabled: true,
      contentTranslationEnabled: false,
      searchEnabled: true,
      seoIndexingEnabled: false,
      pwaPersistedReadingEnabled: false,
      uiTranslationStatus: "none",
    });

    initiative = sampleInitiative("main");
    createInitiative(initiative);
    analysis = sampleAnalysis(initiative.initiativeId);
    createAnalysis(analysis);
  });

  afterEach(() => {
    deleteAnalysesByAuthorIdForTests(AUTHOR_ID);
    deleteInitiative(initiative.initiativeId);
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWarmMemoryForTests();
    setContentTranslationWarmForceMemoryForTests(false);
    resetTerminologyGlossaryStoreForTests();
    resetLanguageRegistryStoreForTests();
    setTerminologyGlossaryForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("1. Admin Search enable schedules multiple supported kinds", async () => {
    const adminSrc = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/language/language-registry/language-registry.service.ts",
      ),
      "utf8",
    );
    assert.match(adminSrc, /becameSearchDiscoveryEligible/);
    assert.match(adminSrc, /enqueueSearchDiscoveryForLocale/);

    translateCalls = 0;
    resetContentTranslationWarmMemoryForTests();
    const targets = [
      { sourceKind: "initiative" as const, sourceRecordId: initiative.initiativeId },
      { sourceKind: "collaborative_analysis" as const, sourceRecordId: analysis.analysisId },
      { sourceKind: "petition" as const, sourceRecordId: "petition-fixture-06c2b" },
      { sourceKind: "blog_post" as const, sourceRecordId: "blog-fixture-06c2b" },
    ];
    const batch = await enqueueSearchDiscoveryForLocale({
      targetLanguage: LOCALE,
      reason: "search_discovery_enable",
      targets,
    });

    assert.equal(translateCalls, 0);
    assert.equal(batch.attempted, 4);
    assert.ok(batch.byKind.initiative >= 1);
    assert.ok(batch.byKind.collaborative_analysis >= 1);
    assert.ok(batch.byKind.petition >= 1);
    assert.ok(batch.byKind.blog_post >= 1);
    assert.equal(batch.byKind.civic_media, undefined);

    const pending = listContentTranslationWarmMemoryPendingForTests();
    assert.ok(
      pending.some(
        (row) =>
          row.command.sourceKind === "collaborative_analysis" &&
          row.command.sourceRecordId === analysis.analysisId &&
          row.command.reason === "search_discovery_enable" &&
          row.command.targetLocales?.includes(LOCALE),
      ),
    );
  });

  it("2. civic_media is excluded from discovery mapping and enumeration kinds", async () => {
    assert.equal(isSearchDiscoveryMappedSourceKind("civic_media"), false);
    assert.ok(!listSearchDiscoveryMappedSourceKinds().includes("civic_media" as never));
    assert.equal("civic_media" in CONTENT_TRANSLATION_SEARCH_DISCOVERY_FIELDS, false);

    const targets = await listSearchDiscoveryWarmTargets();
    assert.ok(!targets.some((row) => row.sourceKind === "civic_media"));
  });

  it("3–4. disabled / search-disabled locales do not schedule discovery", async () => {
    await updateLanguageRegistryRecord(LANGUAGE_ID, { enabled: false });
    let targets = await listSearchDiscoveryContentTranslationTargetLocales();
    assert.ok(!targets.includes(LOCALE));

    await updateLanguageRegistryRecord(LANGUAGE_ID, {
      enabled: true,
      searchEnabled: false,
    });
    targets = await listSearchDiscoveryContentTranslationTargetLocales();
    assert.ok(!targets.includes(LOCALE));

    await assert.rejects(
      () =>
        getOrCreateContentTranslation({
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          targetLanguage: LOCALE,
          generateIfMissing: true,
          intent: "search_discovery",
        }),
      TranslationProviderError,
    );
    assert.equal(translateCalls, 0);
  });

  it("5. collaborative_analysis discovery sends only title+summary", async () => {
    await getOrCreateContentTranslation({
      sourceKind: "collaborative_analysis",
      sourceRecordId: analysis.analysisId,
      targetLanguage: LOCALE,
      generateIfMissing: true,
      intent: "search_discovery",
    });
    const sent = JSON.parse(lastProviderText!) as Record<string, string>;
    assert.deepEqual(Object.keys(sent).sort(), ["summary", "title"]);
  });

  it("6–8. petition / decision_session / blog_post discovery field projection", () => {
    assert.deepEqual(
      Object.keys(
        projectFieldsToSearchDiscoveryAllowlist({
          sourceKind: "petition",
          fields: {
            title: "T",
            summary: "S",
            requestStatement: "R",
            expectedOutcome: "E",
            supportingContext: "C",
            keyArguments: "K",
          },
        })!,
      ).sort(),
      ["summary", "title"],
    );
    assert.deepEqual(
      Object.keys(
        projectFieldsToSearchDiscoveryAllowlist({
          sourceKind: "decision_session",
          fields: {
            title: "T",
            purpose: "P",
            decisionQuestion: "Q",
            structuredContent: "{}",
          },
        })!,
      ).sort(),
      ["title"],
    );
    assert.deepEqual(
      Object.keys(
        projectFieldsToSearchDiscoveryAllowlist({
          sourceKind: "blog_post",
          fields: {
            title: "T",
            excerpt: "E",
            content: "<p>Body</p>",
          },
        })!,
      ).sort(),
      ["excerpt", "title"],
    );
    assert.deepEqual([...CONTENT_TRANSLATION_SEARCH_DISCOVERY_FIELDS.petition], [
      "title",
      "summary",
    ]);
    assert.deepEqual([...CONTENT_TRANSLATION_SEARCH_DISCOVERY_FIELDS.decision_session], [
      "title",
    ]);
    assert.deepEqual([...CONTENT_TRANSLATION_SEARCH_DISCOVERY_FIELDS.blog_post], [
      "title",
      "excerpt",
    ]);
  });

  it("9. Search + Extended locale prefers single automatic_warm (no duplicate provider)", async () => {
    await updateLanguageRegistryRecord(LANGUAGE_ID, {
      contentTranslationEnabled: true,
      searchEnabled: true,
    });
    resetContentTranslationWarmMemoryForTests();
    translateCalls = 0;

    await enqueueSearchDiscoveryForLocale({
      targetLanguage: LOCALE,
      targets: [
        {
          sourceKind: "collaborative_analysis",
          sourceRecordId: analysis.analysisId,
        },
      ],
    });
    // Consumer prefers automatic_warm when both qualify — one provider generation.
    const results = await processContentTranslationWarmMemoryQueueForTests();
    assert.equal(results.length, 1);
    const localeRow = results[0]!.locales.find((row) => row.targetLanguage === LOCALE);
    assert.ok(localeRow);
    assert.equal(localeRow!.status, "generated");
    assert.ok(translateCalls >= 1);
    const callsAfterWarm = translateCalls;

    // Resulting CURRENT includes Extended fields (automatic_warm path).
    const again = await getOrCreateContentTranslation({
      sourceKind: "collaborative_analysis",
      sourceRecordId: analysis.analysisId,
      targetLanguage: LOCALE,
      generateIfMissing: true,
      intent: "search_discovery",
    });
    assert.equal(again.generated, false);
    assert.equal(translateCalls, callsAfterWarm);
    const content = again.translation!.translatedContent as Record<string, string>;
    assert.ok(Object.keys(content).includes("supportingEvidence"));
  });

  it("10. existing full CT causes Search discovery skip", async () => {
    await updateLanguageRegistryRecord(LANGUAGE_ID, {
      contentTranslationEnabled: true,
    });
    const full = await getOrCreateContentTranslation({
      sourceKind: "collaborative_analysis",
      sourceRecordId: analysis.analysisId,
      targetLanguage: LOCALE,
      generateIfMissing: true,
      intent: "automatic_warm",
    });
    assert.equal(full.generated, true);
    const calls = translateCalls;

    const discovery = await getOrCreateContentTranslation({
      sourceKind: "collaborative_analysis",
      sourceRecordId: analysis.analysisId,
      targetLanguage: LOCALE,
      generateIfMissing: true,
      intent: "search_discovery",
    });
    assert.equal(discovery.generated, false);
    assert.equal(translateCalls, calls);
    assert.ok(
      Object.keys(discovery.translation!.translatedContent as Record<string, string>).includes(
        "supportingEvidence",
      ),
    );
  });

  it("11. compact CT upgrades under automatic_warm (06C.2A regression)", async () => {
    const compact = await getOrCreateContentTranslation({
      sourceKind: "collaborative_analysis",
      sourceRecordId: analysis.analysisId,
      targetLanguage: LOCALE,
      generateIfMissing: true,
      intent: "search_discovery",
    });
    assert.equal(compact.generated, true);
    await updateLanguageRegistryRecord(LANGUAGE_ID, {
      contentTranslationEnabled: true,
    });
    const upgraded = await getOrCreateContentTranslation({
      sourceKind: "collaborative_analysis",
      sourceRecordId: analysis.analysisId,
      targetLanguage: LOCALE,
      generateIfMissing: true,
      intent: "automatic_warm",
    });
    assert.equal(upgraded.generated, true);
    assert.equal(upgraded.translation?.translationId, compact.translation?.translationId);
    assert.ok(
      Object.keys(upgraded.translation!.translatedContent as Record<string, string>).includes(
        "supportingEvidence",
      ),
    );
  });

  it("12. Initiative behavior still works", async () => {
    const first = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: LOCALE,
      generateIfMissing: true,
      intent: "search_discovery",
    });
    assert.equal(first.generated, true);
    const calls = translateCalls;
    await updateLanguageRegistryRecord(LANGUAGE_ID, {
      contentTranslationEnabled: true,
    });
    const extended = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: LOCALE,
      generateIfMissing: true,
      intent: "automatic_warm",
    });
    assert.equal(extended.generated, false);
    assert.equal(translateCalls, calls);
  });

  it("13. synthetic future locale works with no locale hardcoding; mutation schedules warm", async () => {
    const kindsSrc = readFileSync(
      path.join(
        repoRoot,
        "apps/api/src/modules/language/content-translation-search-discovery-fields.ts",
      ),
      "utf8",
    );
    assert.doesNotMatch(kindsSrc, /\b(ka|he|ar|uk|zh-Hant)\b/);
    assert.doesNotMatch(kindsSrc, /xx-C2B1/);

    resetContentTranslationWarmMemoryForTests();
    scheduleContentTranslationWarmAfterMutation({
      sourceKind: "collaborative_analysis",
      sourceRecordId: analysis.analysisId,
      reason: "public_update",
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    const pending = listContentTranslationWarmMemoryPendingForTests();
    assert.ok(
      pending.some(
        (row) =>
          row.command.sourceKind === "collaborative_analysis" &&
          row.command.sourceRecordId === analysis.analysisId,
      ),
    );

    const results = await processContentTranslationWarmMemoryQueueForTests();
    assert.ok(results.length >= 1);
    const discoveryLocale = results[0]!.locales.find((row) => row.targetLanguage === LOCALE);
    assert.ok(discoveryLocale);
    assert.equal(discoveryLocale!.status, "generated");
  });
});
