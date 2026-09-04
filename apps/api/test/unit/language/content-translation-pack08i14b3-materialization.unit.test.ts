/**
 * Pack 08I.14B.3 — warm materialization reliability + repair + PC card contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";
process.env.CONTENT_TRANSLATION_WARM_LOCALE_CONCURRENCY = "1";

import type { Initiative } from "@hu/types";

import {
  DeterministicTranslationProvider,
  auditContentTranslationMaterialization,
  buildContentTranslationWarmRequestedCommand,
  classifyContentTranslationWarmFailure,
  createLanguageRegistryRecord,
  enqueueContentTranslationWarmRequested,
  ensureLanguageRegistrySeeded,
  getOrCreateContentTranslation,
  listContentTranslationWarmMemoryPendingForTests,
  processContentTranslationWarmMemoryQueueForTests,
  processContentTranslationWarmRequested,
  resetContentTranslationMemoryStoreForTests,
  resetContentTranslationWarmMemoryForTests,
  resetLanguageRegistryStoreForTests,
  resetTranslationProviderForTests,
  runStagingInitiativePathContentTranslationRepair,
  setContentTranslationWarmForceMemoryForTests,
  setLanguageRegistryForceMemoryForTests,
  setTranslationProviderForTests,
  TranslationProviderError,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";
import { upsertContentTranslation } from "../../../src/modules/language/persistence/content-translation.repository.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");

function readApi(relative: string): string {
  return readFileSync(path.resolve(here, "../../../", relative), "utf8");
}

function sampleInitiative(suffix: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-pack08i14b3-${suffix}-${Date.now()}`,
    stewardId: "member-pack08i14b3",
    createdAt: now,
    updatedAt: now,
    title: "Materialization River Initiative",
    description: "Canonical English prose used for warm materialization tests.",
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

describe("Pack 08I.14B.3 — warm materialization reliability", () => {
  let initiative: Initiative;

  beforeEach(async () => {
    resetTranslationProviderForTests();
    resetContentTranslationMemoryStoreForTests();
    setTranslationProviderForTests(new DeterministicTranslationProvider());
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    setContentTranslationWarmForceMemoryForTests(true);
    resetContentTranslationWarmMemoryForTests();
    await ensureLanguageRegistrySeeded();

    await updateLanguageRegistryRecord("lang-uk", {
      enabled: true,
      contentTranslationEnabled: true,
    });
    // Keep only uk as automatic warm target for focused assertions.
    for (const locale of ["ru", "fr", "es", "de", "pt", "zh", "ar", "hi"] as const) {
      try {
        await updateLanguageRegistryRecord(`lang-${locale}`, {
          contentTranslationEnabled: false,
        });
      } catch {
        // optional seed locales
      }
    }

    initiative = createInitiative(sampleInitiative("main"));
  });

  afterEach(() => {
    if (initiative) {
      deleteInitiative(initiative.initiativeId);
    }
    resetContentTranslationWarmMemoryForTests();
    resetContentTranslationMemoryStoreForTests();
    resetTranslationProviderForTests();
  });

  it("1. enqueued warm event does not imply materialized success", async () => {
    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "operator_backfill",
    });
    assert.equal(enqueued.enqueued, true);
    assert.equal(listContentTranslationWarmMemoryPendingForTests().length, 1);

    const before = await auditContentTranslationMaterialization({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "uk",
    });
    assert.equal(before.state, "MISSING");
  });

  it("2. successful handler produces CURRENT target-locale translation", async () => {
    await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    const outcomes = await processContentTranslationWarmMemoryQueueForTests();
    assert.equal(outcomes[0]?.outcome, "completed");
    assert.ok(outcomes[0]?.locales.some((row) => row.status === "generated"));

    const after = await auditContentTranslationMaterialization({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "uk",
    });
    assert.equal(after.state, "CURRENT");
  });

  it("3. transient failure follows bounded/idempotent retry semantics", async () => {
    assert.equal(
      classifyContentTranslationWarmFailure(new TranslationProviderError("rate_limited", "r")),
      "retryable",
    );

    let calls = 0;
    const provider = new DeterministicTranslationProvider();
    const original = provider.translate.bind(provider);
    provider.translate = async (req) => {
      calls += 1;
      if (calls === 1) {
        throw new TranslationProviderError("rate_limited", "transient");
      }
      return original(req);
    };
    setTranslationProviderForTests(provider);

    await assert.rejects(
      () =>
        processContentTranslationWarmRequested(
          buildContentTranslationWarmRequestedCommand({
            sourceKind: "initiative",
            sourceRecordId: initiative.initiativeId,
          }),
        ),
      /retryable|unavailable|transient/i,
    );

    // Second attempt succeeds and materializes CURRENT (idempotent skip later).
    const second = await processContentTranslationWarmRequested(
      buildContentTranslationWarmRequestedCommand({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
      }),
    );
    assert.equal(second.outcome, "completed");
    const audit = await auditContentTranslationMaterialization({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "uk",
    });
    assert.equal(audit.state, "CURRENT");
  });

  it("non_retryable locale failure does not report completed without CURRENT", async () => {
    const provider = new DeterministicTranslationProvider();
    provider.translate = async () => {
      throw new TranslationProviderError("forbidden", "blocked");
    };
    setTranslationProviderForTests(provider);

    await assert.rejects(
      () =>
        processContentTranslationWarmRequested(
          buildContentTranslationWarmRequestedCommand({
            sourceKind: "initiative",
            sourceRecordId: initiative.initiativeId,
          }),
        ),
      /CURRENT materialization|forbidden|failed/i,
    );

    const audit = await auditContentTranslationMaterialization({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "uk",
    });
    assert.equal(audit.state, "MISSING");
  });

  it("4–6. repair skips CURRENT; selects MISSING and STALE", async () => {
    // Create CURRENT uk for initiative.
    await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "uk",
      generateIfMissing: true,
      intent: "automatic_warm",
    });
    const current = await auditContentTranslationMaterialization({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "uk",
    });
    assert.equal(current.state, "CURRENT");

    const missingInit = createInitiative(sampleInitiative("missing"));
    const staleInit = createInitiative(sampleInitiative("stale"));

    try {
      // Seed a stale uk row for staleInit (wrong version marker via stale flag).
      const source = await import("../../../src/modules/language/content-translation.service.js").then(
        (m) =>
          m.loadTranslatableSource({
            sourceKind: "initiative",
            sourceRecordId: staleInit.initiativeId,
          }),
      );
      assert.ok(source);
      await upsertContentTranslation({
        translationId: `translation-stale-${staleInit.initiativeId}`,
        sourceKind: "initiative",
        sourceRecordId: staleInit.initiativeId,
        sourceVersion: source!.sourceVersion,
        sourceLanguage: "en",
        targetLanguage: "uk",
        translatedContent: { title: "UK stale", description: "UK stale desc" },
        translationProvider: "deterministic",
        translationKind: "machine",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stale: true,
        freshness: "stale",
      });

      const repair = await runStagingInitiativePathContentTranslationRepair({
        execute: false,
        kinds: ["initiative"],
        deps: {
          listInitiatives: () => [initiative, missingInit, staleInit],
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

      assert.ok(repair.totals.CURRENT_SKIPPED >= 1);
      assert.ok(repair.totals.MISSING >= 1);
      assert.ok(repair.totals.STALE >= 1);
      assert.ok(repair.totals.REPAIR_SCHEDULED >= 1);
      assert.ok(
        repair.repairCandidates.some((c) => c.sourceRecordId === missingInit.initiativeId),
      );
      assert.ok(
        repair.repairCandidates.some((c) => c.sourceRecordId === staleInit.initiativeId),
      );
      assert.ok(
        !repair.repairCandidates.some((c) => c.sourceRecordId === initiative.initiativeId),
      );
    } finally {
      deleteInitiative(missingInit.initiativeId);
      deleteInitiative(staleInit.initiativeId);
    }
  });

  it("7. production DB refusal remains enforced on warm script", () => {
    const script = readApi("src/scripts/warm-staging-content-translations.ts");
    assert.match(script, /humanity_union_staging/);
    assert.match(script, /ALLOW_STAGING_CONTENT_TRANSLATION_WARM/);
    assert.match(script, /PLATFORM_MODE=production is not allowed/);
    assert.match(script, /--repair/);
    assert.match(script, /wait-for-materialization/);
    assert.match(script, /enqueue ≠|Enqueue ≠|enqueue is not materialization/i);
  });

  it("dispatcher must not publish when handler deferred in_progress", () => {
    const dispatcher = readApi("src/infrastructure/outbox/outbox.dispatcher.ts");
    assert.match(dispatcher, /deferredInProgress/);
    assert.match(dispatcher, /in_progress_defer_publish/);
    assert.match(dispatcher, /if \(deferredInProgress && !handlerSucceeded\)/);
  });

  it("consumer completed requires locale materialization", () => {
    const consumer = readApi("src/modules/language/content-translation-warm-consumer.ts");
    assert.match(consumer, /materializedOk/);
    assert.match(consumer, /failed_terminal/);
    assert.match(consumer, /consume_terminal_failure/);
  });
});
