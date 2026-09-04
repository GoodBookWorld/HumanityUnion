/**
 * Pack 08I.16.1 — lightweight operator discovery must not silently return 0/0/0.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_ANALYSIS_PERSISTENCE = "memory";
process.env.INITIATIVE_COMMENT_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";
process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY = "2";

import type {
  Initiative,
  InitiativeCollaborativeAnalysis,
  Petition,
} from "@hu/types";

import {
  DeterministicTranslationProvider,
  assertStagingWarmDiscoveryNotSilentlyEmpty,
  ensureLanguageRegistrySeeded,
  getOrCreateContentTranslation,
  resetContentTranslationMemoryStoreForTests,
  resetContentTranslationWorkerConcurrencyForTests,
  resetLanguageRegistryStoreForTests,
  resetTranslationProviderForTests,
  resolveContentTranslationWorkerConcurrency,
  resolveStagingWarmDiscoveryExpectation,
  runStagingInitiativePathContentTranslationRepair,
  setLanguageRegistryForceMemoryForTests,
  setTranslationProviderForTests,
  StagingContentTranslationDiscoveryFailure,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";
import { discoverStagingInitiativePathWarmSources } from "../../../src/modules/language/content-translation-staging-warm-backfill.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";
import { createAnalysis } from "../../../src/modules/initiative-collaborative-analysis/initiative-collaborative-analysis.store.js";
import {
  createInitiativeComment,
  resetInitiativeCommentStoreForTests,
} from "../../../src/modules/initiative-comments/initiative-comment.memory.store.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const PREFIX = "08i161-disc";

function readApi(relative: string): string {
  return readFileSync(path.resolve(here, "../../../", relative), "utf8");
}

function buildPublicInitiative(overrides: Partial<Initiative> = {}): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `${PREFIX}-init-${Math.random().toString(16).slice(2, 8)}`,
    stewardId: `${PREFIX}-steward`,
    createdAt: now,
    updatedAt: now,
    title: "Discovery Regression Initiative",
    description: "Canonical English description for lightweight discovery fixtures.",
    status: "poll",
    lifecyclePhase: "projected",
    visibility: { policy: "public" },
    metadata: {
      category: "environment",
      tags: [],
      region: "Global",
      language: "en",
      communitySlug: "test-community",
      activityArea: "Environment",
    },
    revisions: [],
    contributions: [],
    timeline: [],
    ...overrides,
  };
}

describe("Pack 08I.16.1 — lightweight discovery regression", () => {
  const createdIds: string[] = [];
  let publicInit: Initiative;
  let analysis: InitiativeCollaborativeAnalysis;
  let commentId: string;
  let petitions: Petition[];

  beforeEach(async () => {
    process.env.INITIATIVE_COMMENT_PERSISTENCE = "memory";
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWorkerConcurrencyForTests();
    setTranslationProviderForTests(new DeterministicTranslationProvider());
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    resetInitiativeCommentStoreForTests();
    await ensureLanguageRegistrySeeded();
    await updateLanguageRegistryRecord("lang-uk", {
      enabled: true,
      contentTranslationEnabled: true,
    });
    for (const locale of ["ru", "fr", "es", "de", "pt", "zh", "ar", "hi"] as const) {
      try {
        await updateLanguageRegistryRecord(`lang-${locale}`, {
          contentTranslationEnabled: false,
        });
      } catch {
        // optional
      }
    }

    publicInit = createInitiative(buildPublicInitiative());
    createdIds.push(publicInit.initiativeId);

    const now = new Date().toISOString();
    analysis = createAnalysis({
      analysisId: `${PREFIX}-analysis-${Math.random().toString(16).slice(2, 8)}`,
      initiativeId: publicInit.initiativeId,
      authorId: `${PREFIX}-author`,
      title: "Published Collaborative Analysis",
      summary: "Analysis summary for discovery.",
      supportingEvidence: "evidence",
      risks: "risks",
      openQuestions: "questions",
      suggestedImprovements: "improvements",
      references: "refs",
      status: "published",
      initiativeVersion: 1,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
    });

    const comment = createInitiativeComment({
      initiativeId: publicInit.initiativeId,
      authorUserId: `${PREFIX}-user`,
      authorDisplayName: "Participant",
      body: "Approved public discussion comment body for discovery.",
    });
    commentId = comment.commentId;

    petitions = [
      {
        petitionId: `${PREFIX}-petition-${Math.random().toString(16).slice(2, 8)}`,
        status: "Open",
        subject: {
          initiativeId: publicInit.initiativeId,
          title: "Open Petition",
          summary: "Petition summary",
          requestStatement: "request",
          expectedOutcome: "outcome",
          supportingContext: "context",
          keyArguments: ["a"],
        },
        createdAt: now,
        updatedAt: now,
      },
    ] as unknown as Petition[];
  });

  afterEach(() => {
    for (const id of createdIds.splice(0)) {
      deleteInitiative(id);
    }
    resetInitiativeCommentStoreForTests();
    resetContentTranslationMemoryStoreForTests();
    resetTranslationProviderForTests();
    resetContentTranslationWorkerConcurrencyForTests();
  });

  it("lightweight bootstrap syncs Initiative/Analysis after hydrate (source contract)", () => {
    const bootstrap = readApi(
      "src/infrastructure/mongodb/bootstrap-content-translation-operator-persistence.ts",
    );
    assert.match(bootstrap, /hydrateInitiativeMongoPersistence/);
    assert.match(bootstrap, /hydrateInitiativeCollaborativeAnalysisMongoPersistence/);
    assert.match(bootstrap, /syncInitiativeStoreAfterMongoHydrate/);
    assert.match(bootstrap, /syncInitiativeCollaborativeAnalysisStoreAfterMongoHydrate/);
    assert.doesNotMatch(bootstrap, /hydrateCivicNominationMongoPersistence/);
    assert.doesNotMatch(bootstrap, /ensureBrandLocalizationSeeded/);
    assert.ok(
      bootstrap.indexOf("hydrateInitiativeMongoPersistence") <
        bootstrap.indexOf("syncInitiativeStoreAfterMongoHydrate"),
    );
  });

  it("fixture corpus discovers all four Initiative-path kinds (non-zero)", async () => {
    const discovered = await discoverStagingInitiativePathWarmSources({
      kinds: ["initiative", "discussion_comment", "collaborative_analysis", "petition"],
      deps: {
        listPetitions: async () => petitions,
      },
    });

    const byKind = Object.fromEntries(
      [...discovered.discoveryByKind.entries()].map(([kind, row]) => [kind, row]),
    );

    assert.ok((byKind.initiative?.sourceRecordsDiscovered ?? 0) >= 1);
    assert.ok((byKind.initiative?.publicRecords ?? 0) >= 1);
    assert.ok((byKind.discussion_comment?.sourceRecordsDiscovered ?? 0) >= 1);
    assert.ok((byKind.discussion_comment?.publicRecords ?? 0) >= 1);
    assert.ok((byKind.collaborative_analysis?.sourceRecordsDiscovered ?? 0) >= 1);
    assert.ok((byKind.collaborative_analysis?.publicRecords ?? 0) >= 1);
    assert.ok((byKind.petition?.sourceRecordsDiscovered ?? 0) >= 1);
    assert.ok((byKind.petition?.publicRecords ?? 0) >= 1);

    assert.ok(
      discovered.candidates.some((c) => c.sourceKind === "initiative"),
    );
    assert.ok(
      discovered.candidates.some(
        (c) => c.sourceKind === "discussion_comment" && c.sourceRecordId === commentId,
      ),
    );
    assert.ok(
      discovered.candidates.some(
        (c) =>
          c.sourceKind === "collaborative_analysis" &&
          c.sourceRecordId === analysis.analysisId,
      ),
    );
    assert.ok(
      discovered.candidates.some(
        (c) =>
          c.sourceKind === "petition" && c.sourceRecordId === petitions[0]!.petitionId,
      ),
    );
    assert.equal(discovered.discoveryHint, null);
  });

  it("1. zero discovery under staging expectation fails loudly", () => {
    const expectation = resolveStagingWarmDiscoveryExpectation({
      databaseName: "humanity_union_staging",
    });
    assert.equal(expectation.expectPersistedSources, true);

    assert.throws(
      () =>
        assertStagingWarmDiscoveryNotSilentlyEmpty({
          expectation,
          discoveryByKind: [],
          discoveryHint: "SOURCE_RECORDS_DISCOVERED.initiative=0",
        }),
      (error: unknown) =>
        error instanceof StagingContentTranslationDiscoveryFailure &&
        error.code === "DISCOVERY_FAILURE",
    );
  });

  it("2. genuinely empty DB allowed without non-empty expectation", () => {
    const expectation = resolveStagingWarmDiscoveryExpectation({
      databaseName: "humanity_union_staging",
      allowEmptyDiscovery: true,
    });
    assert.equal(expectation.expectPersistedSources, false);

    const summary = assertStagingWarmDiscoveryNotSilentlyEmpty({
      expectation,
      discoveryByKind: [],
    });
    assert.equal(summary.SOURCE_RECORDS_DISCOVERED, 0);
  });

  it("3–4. CURRENT translations produce CURRENT_SKIPPED > 0 (not misleading 0/0/0)", async () => {
    await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: publicInit.initiativeId,
      targetLanguage: "uk",
      generateIfMissing: true,
      intent: "automatic_warm",
    });

    const repair = await runStagingInitiativePathContentTranslationRepair({
      execute: false,
      kinds: ["initiative"],
      deps: {
        listInitiatives: () => [publicInit],
        listApprovedInitiativeComments: async () => ({
          comments: [],
          total: 0,
          limit: 100,
          offset: 0,
          hasMore: false,
        }),
        listPublishedAnalysesByInitiative: () => [],
        listPetitions: async () => [],
      },
      targetLanguages: ["uk"],
    });

    assert.ok(repair.discoveryTotals.SOURCE_RECORDS_DISCOVERED >= 1);
    assert.ok(repair.totals.CURRENT_SKIPPED >= 1);
    assert.equal(repair.totals.MISSING, 0);
    assert.ok(repair.repairCandidates.length === 0);
  });

  it("5. missing translations produce MISSING with discovery diagnostics", async () => {
    const repair = await runStagingInitiativePathContentTranslationRepair({
      execute: false,
      kinds: ["initiative", "discussion_comment", "collaborative_analysis"],
      deps: {
        listPetitions: async () => [],
      },
      targetLanguages: ["uk"],
    });

    assert.ok(repair.discoveryTotals.SOURCE_RECORDS_DISCOVERED >= 3);
    assert.ok(repair.discoveryTotals.PUBLIC_RECORDS >= 3);
    assert.ok(repair.discoveryTotals.LOCALE_TARGETS_AUDITED >= 1);
    assert.ok(repair.totals.MISSING >= 1);
    assert.ok(repair.repairCandidates.length >= 1);
  });

  it("6. lightweight discovery does not initialize unrelated full API persistence", () => {
    const bootstrap = readApi(
      "src/infrastructure/mongodb/bootstrap-content-translation-operator-persistence.ts",
    );
    assert.doesNotMatch(bootstrap, /hydrateDecisionSessionMongoPersistence/);
    assert.doesNotMatch(bootstrap, /hydrateCivicActionPackageMongoPersistence/);
    assert.doesNotMatch(bootstrap, /hydratePublicCivicArchiveMongoPersistence/);
    assert.doesNotMatch(bootstrap, /ensureTerminologyGlossarySeeded/);
  });

  it("7. 08I.16 worker concurrency default and stress contract remain", () => {
    const previous = process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY;
    delete process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY;
    assert.equal(resolveContentTranslationWorkerConcurrency(), 1);
    process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY = previous ?? "2";

    const worker = readApi("src/modules/language/content-translation-worker-concurrency.ts");
    assert.match(worker, /DEFAULT_WORKER_CONCURRENCY = 1/);
    assert.match(worker, /withContentTranslationWorkerSlot/);
    const service = readApi("src/modules/language/content-translation.service.ts");
    assert.match(service, /withContentTranslationWorkerSlot/);
  });

  it("script fails closed on DISCOVERY_FAILURE and documents allow-empty", () => {
    const script = readApi("src/scripts/warm-staging-content-translations.ts");
    assert.match(script, /assertStagingWarmDiscoveryNotSilentlyEmpty/);
    assert.match(script, /StagingContentTranslationDiscoveryFailure/);
    assert.match(script, /allow-empty-discovery|allow_empty_discovery/);
    assert.match(script, /process\.exitCode = 3/);
    assert.match(script, /SOURCE_RECORDS_DISCOVERED/);
    assert.match(script, /LOCALE_TARGETS_AUDITED/);
  });
});
