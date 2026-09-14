/**
 * Localization Simplification Step 06C.2A —
 * CT discovery field projection + full-coverage upgrade semantics.
 *
 * Synthetic Registry locale. Deterministic provider only.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_ANALYSIS_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";

import type { Initiative, InitiativeCollaborativeAnalysis } from "@hu/types";

import {
  CONTENT_TRANSLATION_SEARCH_DISCOVERY_FIELDS,
  DeterministicTranslationProvider,
  contentTranslationCoversRequiredSourceFields,
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  ensureTerminologyGlossarySeeded,
  getOrCreateContentTranslation,
  isSearchDiscoveryMappedSourceKind,
  loadTranslatableSource,
  projectFieldsToSearchDiscoveryAllowlist,
  resetContentTranslationMemoryStoreForTests,
  resetLanguageRegistryStoreForTests,
  resetTerminologyGlossaryStoreForTests,
  resetTranslationProviderForTests,
  setLanguageRegistryForceMemoryForTests,
  setTerminologyGlossaryForceMemoryForTests,
  setTranslationProviderForTests,
} from "../../../src/modules/language/index.js";
import {
  createAnalysis,
  deleteAnalysesByAuthorIdForTests,
} from "../../../src/modules/initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";

const DISCOVERY_LOCALE = "xx-C2A1";
const DISCOVERY_LANGUAGE_ID = "lang-xx-c2a1";
const AUTHOR_ID = "member-06c2a";

function sampleInitiative(): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-06c2a-${Date.now()}`,
    stewardId: AUTHOR_ID,
    createdAt: now,
    updatedAt: now,
    title: "Coverage River Initiative",
    description: "Participants will restore a local river for coverage tests.",
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
    analysisId: `analysis-06c2a-${Date.now()}`,
    initiativeId,
    authorId: AUTHOR_ID,
    title: "Fat Analysis Discovery Title",
    summary: "Fat analysis discovery summary for Search.",
    supportingEvidence: "Long supporting evidence body for Extended Localization.",
    risks: "Documented flood and erosion risks for Extended Localization.",
    openQuestions: "Which partners fund the next phase?",
    suggestedImprovements: "Add staged monitoring checkpoints.",
    references: "https://example.test/analysis-ref",
    status: "published",
    initiativeVersion: 1,
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
  };
}

describe("Localization Simplification Step 06C.2A — discovery coverage upgrade", () => {
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
      languageId: DISCOVERY_LANGUAGE_ID,
      locale: DISCOVERY_LOCALE,
      englishName: "Coverage Synthetic",
      nativeName: "Coverage Synthetic",
      textDirection: "ltr",
      enabled: true,
      contentTranslationEnabled: false,
      searchEnabled: true,
      seoIndexingEnabled: false,
      uiTranslationStatus: "none",
    });

    initiative = sampleInitiative();
    createInitiative(initiative);
    analysis = sampleAnalysis(initiative.initiativeId);
    createAnalysis(analysis);
  });

  afterEach(() => {
    deleteAnalysesByAuthorIdForTests(AUTHOR_ID);
    deleteInitiative(initiative.initiativeId);
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    resetTerminologyGlossaryStoreForTests();
    resetLanguageRegistryStoreForTests();
    setTerminologyGlossaryForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("maps discovery fields and excludes civic_media", () => {
    assert.deepEqual([...CONTENT_TRANSLATION_SEARCH_DISCOVERY_FIELDS.collaborative_analysis], [
      "title",
      "summary",
    ]);
    assert.equal(isSearchDiscoveryMappedSourceKind("civic_media"), false);
    assert.equal(isSearchDiscoveryMappedSourceKind("collaborative_analysis"), true);
  });

  it("CA discovery: provider gets title+summary only; compact CT; full sourceVersion", async () => {
    const loaded = await loadTranslatableSource({
      sourceKind: "collaborative_analysis",
      sourceRecordId: analysis.analysisId,
    });
    assert.ok(loaded);
    assert.ok(Object.keys(loaded!.fields).includes("supportingEvidence"));

    const discovery = await getOrCreateContentTranslation({
      sourceKind: "collaborative_analysis",
      sourceRecordId: analysis.analysisId,
      targetLanguage: DISCOVERY_LOCALE,
      generateIfMissing: true,
      intent: "search_discovery",
    });
    assert.equal(discovery.generated, true);
    assert.equal(discovery.translation?.sourceVersion, loaded!.sourceVersion);
    assert.equal(translateCalls, 1);

    const sent = JSON.parse(lastProviderText!) as Record<string, string>;
    assert.deepEqual(Object.keys(sent).sort(), ["summary", "title"]);
    assert.equal(sent.title, analysis.title);
    assert.equal(sent.summary, analysis.summary);

    const content = discovery.translation!.translatedContent as Record<string, string>;
    assert.deepEqual(Object.keys(content).sort(), ["summary", "title"]);
    assert.match(content.title, new RegExp(DISCOVERY_LOCALE));
    assert.equal("supportingEvidence" in content, false);

    assert.equal(
      contentTranslationCoversRequiredSourceFields({
        sourceKind: "collaborative_analysis",
        sourceFields: projectFieldsToSearchDiscoveryAllowlist({
          sourceKind: "collaborative_analysis",
          fields: loaded!.fields,
        })!,
        translatedContent: discovery.translation!.translatedContent,
      }),
      true,
    );
    assert.equal(
      contentTranslationCoversRequiredSourceFields({
        sourceKind: "collaborative_analysis",
        sourceFields: loaded!.fields,
        translatedContent: discovery.translation!.translatedContent,
      }),
      false,
    );
  });

  it("CA compact → full upgrade; then both intents skip without downgrade", async () => {
    const discovery = await getOrCreateContentTranslation({
      sourceKind: "collaborative_analysis",
      sourceRecordId: analysis.analysisId,
      targetLanguage: DISCOVERY_LOCALE,
      generateIfMissing: true,
      intent: "search_discovery",
    });
    assert.equal(discovery.generated, true);
    const compactId = discovery.translation!.translationId;
    const sourceVersion = discovery.translation!.sourceVersion;
    const callsAfterDiscovery = translateCalls;

    const rediscovery = await getOrCreateContentTranslation({
      sourceKind: "collaborative_analysis",
      sourceRecordId: analysis.analysisId,
      targetLanguage: DISCOVERY_LOCALE,
      generateIfMissing: true,
      intent: "search_discovery",
    });
    assert.equal(rediscovery.generated, false);
    assert.equal(translateCalls, callsAfterDiscovery);

    // Enable Extended Localization for automatic_warm.
    const { updateLanguageRegistryRecord } = await import(
      "../../../src/modules/language/index.js"
    );
    await updateLanguageRegistryRecord(DISCOVERY_LANGUAGE_ID, {
      contentTranslationEnabled: true,
    });

    const upgraded = await getOrCreateContentTranslation({
      sourceKind: "collaborative_analysis",
      sourceRecordId: analysis.analysisId,
      targetLanguage: DISCOVERY_LOCALE,
      generateIfMissing: true,
      intent: "automatic_warm",
    });
    assert.equal(upgraded.generated, true);
    assert.equal(upgraded.translation?.sourceVersion, sourceVersion);
    assert.equal(upgraded.translation?.translationId, compactId);
    assert.ok(translateCalls > callsAfterDiscovery);

    const fullSent = JSON.parse(lastProviderText!) as Record<string, unknown>;
    // CA full path uses lifecycle-slot hop; resulting CURRENT must include full prose.
    assert.ok(typeof fullSent === "object" && fullSent !== null);

    const fullContent = upgraded.translation!.translatedContent as Record<string, string>;
    assert.ok(Object.keys(fullContent).includes("supportingEvidence"));
    assert.ok(Object.keys(fullContent).includes("risks"));
    assert.ok(Object.keys(fullContent).includes("title"));
    assert.ok(Object.keys(fullContent).includes("summary"));

    const callsAfterFull = translateCalls;
    const fullAgain = await getOrCreateContentTranslation({
      sourceKind: "collaborative_analysis",
      sourceRecordId: analysis.analysisId,
      targetLanguage: DISCOVERY_LOCALE,
      generateIfMissing: true,
      intent: "automatic_warm",
    });
    assert.equal(fullAgain.generated, false);
    assert.equal(translateCalls, callsAfterFull);

    const discoveryAfterFull = await getOrCreateContentTranslation({
      sourceKind: "collaborative_analysis",
      sourceRecordId: analysis.analysisId,
      targetLanguage: DISCOVERY_LOCALE,
      generateIfMissing: true,
      intent: "search_discovery",
    });
    assert.equal(discoveryAfterFull.generated, false);
    assert.equal(translateCalls, callsAfterFull);
    const stillFull = discoveryAfterFull.translation!.translatedContent as Record<string, string>;
    assert.ok(Object.keys(stillFull).includes("supportingEvidence"));
    assert.equal(Object.keys(stillFull).includes("title"), true);
  });

  it("Initiative discovery remains full-coverage compatible (06C.1)", async () => {
    const first = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: DISCOVERY_LOCALE,
      generateIfMissing: true,
      intent: "search_discovery",
    });
    assert.equal(first.generated, true);
    const calls = translateCalls;

    const { updateLanguageRegistryRecord } = await import(
      "../../../src/modules/language/index.js"
    );
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
    assert.equal(extended.translation?.translationId, first.translation?.translationId);
    assert.equal(translateCalls, calls);
  });

  it("unsupported discovery kinds are rejected without provider work", async () => {
    assert.equal(isSearchDiscoveryMappedSourceKind("discussion_comment"), false);
    assert.equal(isSearchDiscoveryMappedSourceKind("civic_media"), false);
    assert.equal(
      projectFieldsToSearchDiscoveryAllowlist({
        sourceKind: "civic_media",
        fields: { overviewTitle: "x", overviewSummary: "y" },
      }),
      null,
    );

    const { TranslationProviderError } = await import(
      "../../../src/modules/language/index.js"
    );
    await assert.rejects(
      () =>
        getOrCreateContentTranslation({
          sourceKind: "civic_media",
          sourceRecordId: "civic-media-center",
          targetLanguage: DISCOVERY_LOCALE,
          generateIfMissing: true,
          intent: "search_discovery",
        }),
      (error: unknown) =>
        error instanceof TranslationProviderError &&
        error.code === "bad_request" &&
        /not supported/i.test(error.message),
    );
    assert.equal(translateCalls, 0);
  });
});
