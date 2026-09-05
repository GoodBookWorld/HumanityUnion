/**
 * Pack 08K.2 — residual materialization root-cause diagnostics.
 * Deterministic only — no live Gemini / no staging Mongo mutation.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";
process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY = "1";
process.env.CONTENT_TRANSLATION_WARM_LOCALE_CONCURRENCY = "1";
process.env.LANGUAGE_REGISTRY_PERSISTENCE = "memory";

import type { Initiative, InitiativeCollectiveDecision } from "@hu/types";

import {
  classifyContentTranslationMaterializationFailure,
  ensureLanguageRegistrySeeded,
  enqueueContentTranslationWarmRequested,
  explainPublicLocalizationResiduals,
  listAutomaticContentTranslationTargetLocales,
  loadTranslatableSource,
  markContentTranslationWarmMemoryPublishedForTests,
  processContentTranslationWarmRequested,
  resetContentTranslationMemoryStoreForTests,
  resetContentTranslationWarmMemoryForTests,
  resetContentTranslationWorkerConcurrencyForTests,
  resetLanguageRegistryStoreForTests,
  resetTranslationProviderForTests,
  resolveContentTranslationFailureRetryPolicy,
  resolveContentTranslationWarmOutboxDisposition,
  resolvePublicLocalizationMaterializationState,
  setContentTranslationWarmForceMemoryForTests,
  setLanguageRegistryForceMemoryForTests,
  setTranslationProviderForTests,
  TranslationProviderError,
  updateLanguageRegistryRecord,
  waitForPublicLocalizationMaterialization,
} from "../../../src/modules/language/index.js";
import { findContentTranslation as findTranslationRow } from "../../../src/modules/language/persistence/content-translation.repository.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";
import {
  createDecision,
  deleteDecisionsByStewardIdForTests,
  getDecisionById,
} from "../../../src/modules/initiative-collective-decision/initiative-collective-decision.store.js";
import type { TranslationProvider } from "../../../src/modules/language/translation-provider.js";
import { CONTENT_TRANSLATION_WARM_REQUESTED } from "@hu/types";

const here = path.dirname(fileURLToPath(import.meta.url));

function readApi(relative: string): string {
  return readFileSync(path.resolve(here, "../../../", relative), "utf8");
}

function sampleInitiative(suffix: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-pack08k2-${suffix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    stewardId: "member-pack08k2",
    createdAt: now,
    updatedAt: now,
    title: `Pack08K2 Initiative ${suffix}`,
    description: `Canonical English prose for residual diagnostics ${suffix}.`,
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

function sampleDecision(
  initiativeId: string,
  suffix: string,
): InitiativeCollectiveDecision {
  const now = new Date().toISOString();
  return {
    decisionId: `decision-pack08k2-${suffix}-${Math.random().toString(16).slice(2, 8)}`,
    initiativeId,
    decisionSessionId: null,
    stewardId: "member-pack08k2",
    sequenceNumber: 1,
    participationScope: "open",
    status: "opened",
    question: `Should we adopt residual fix ${suffix}?`,
    openedAt: now,
    closesAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now,
    updatedAt: now,
  };
}

class TrackingFakeProvider implements TranslationProvider {
  readonly providerId = "deterministic" as const;
  callCount = 0;
  failNext = false;
  invalidJson = false;

  async translate(request: {
    readonly text: string;
    readonly targetLanguage: string;
  }): Promise<{
    readonly translatedText: string;
    readonly providerId: "deterministic";
    readonly isPlaceholder: boolean;
  }> {
    this.callCount += 1;
    if (this.failNext) {
      throw new TranslationProviderError("unavailable", "forced provider failure");
    }
    if (this.invalidJson) {
      return {
        translatedText: "not-json",
        providerId: this.providerId,
        isPlaceholder: true,
      };
    }
    const parsed = JSON.parse(request.text) as Record<string, string>;
    const translated: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      translated[key] = `[${request.targetLanguage}] ${value}`;
    }
    return {
      translatedText: JSON.stringify(translated),
      providerId: this.providerId,
      isPlaceholder: true,
    };
  }
}

describe("Pack 08K.2 — residual materialization diagnostics", () => {
  let provider: TrackingFakeProvider;
  const createdInitiativeIds: string[] = [];

  beforeEach(async () => {
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWarmMemoryForTests();
    resetContentTranslationWorkerConcurrencyForTests();
    resetLanguageRegistryStoreForTests();
    resetTranslationProviderForTests();
    setLanguageRegistryForceMemoryForTests(true);
    setContentTranslationWarmForceMemoryForTests(true);
    await ensureLanguageRegistrySeeded();
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      await updateLanguageRegistryRecord(`lang-${locale}`, {
        enabled: true,
        contentTranslationEnabled: true,
      });
    }
    provider = new TrackingFakeProvider();
    setTranslationProviderForTests(provider);
  });

  afterEach(() => {
    deleteDecisionsByStewardIdForTests("member-pack08k2");
    for (const id of createdInitiativeIds.splice(0)) {
      try {
        deleteInitiative(id);
      } catch {
        // ignore
      }
    }
    resetTranslationProviderForTests();
    setContentTranslationWarmForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("A/B/C. 2 Collective Decisions × 3 locales materialize CURRENT after warm", async () => {
    const locales = await listAutomaticContentTranslationTargetLocales();
    assert.deepEqual([...locales].sort(), ["ar", "uk", "zh-Hant"].sort());

    const initiative = sampleInitiative("cd-pair");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);

    const d1 = createDecision(sampleDecision(initiative.initiativeId, "a"));
    const d2 = createDecision(sampleDecision(initiative.initiativeId, "b"));
    assert.ok(getDecisionById(d1.decisionId));
    assert.ok(getDecisionById(d2.decisionId));

    for (const decision of [d1, d2]) {
      const source = await loadTranslatableSource({
        sourceKind: "collective_decision",
        sourceRecordId: decision.decisionId,
      });
      assert.ok(source, `source must load for ${decision.decisionId}`);
      assert.ok(source.fields.question);

      const enqueued = await enqueueContentTranslationWarmRequested({
        sourceKind: "collective_decision",
        sourceRecordId: decision.decisionId,
        reason: "operator_backfill",
      });
      assert.equal(enqueued.enqueued || enqueued.deduped, true);

      await processContentTranslationWarmRequested(enqueued.command);
      if (enqueued.eventId) {
        markContentTranslationWarmMemoryPublishedForTests(enqueued.eventId);
      }
    }

    let currentCount = 0;
    for (const decision of [d1, d2]) {
      const source = await loadTranslatableSource({
        sourceKind: "collective_decision",
        sourceRecordId: decision.decisionId,
      });
      assert.ok(source);
      for (const locale of locales) {
        const row = await findTranslationRow({
          sourceKind: "collective_decision",
          sourceRecordId: decision.decisionId,
          sourceVersion: source.sourceVersion,
          targetLanguage: locale,
        });
        assert.ok(row, `CURRENT missing for ${decision.decisionId} ${locale}`);
        assert.equal(row.freshness, "current");
        assert.equal(row.stale, false);
        currentCount += 1;
      }
    }
    assert.equal(currentCount, 6);
    assert.ok(provider.callCount >= 6);

    // Sync helper must exist and be wired into operator + full bootstrap.
    const storeSrc = readApi(
      "src/modules/initiative-collective-decision/initiative-collective-decision.store.ts",
    );
    const operatorSrc = readApi(
      "src/infrastructure/mongodb/bootstrap-content-translation-operator-persistence.ts",
    );
    const fullSrc = readApi("src/infrastructure/mongodb/bootstrap-mongo-persistence.ts");
    assert.match(storeSrc, /syncInitiativeCollectiveDecisionStoreAfterMongoHydrate/);
    assert.match(operatorSrc, /hydrateInitiativeCollectiveDecisionMongoPersistence/);
    assert.match(operatorSrc, /syncInitiativeCollectiveDecisionStoreAfterMongoHydrate/);
    assert.match(fullSrc, /syncInitiativeCollectiveDecisionStoreAfterMongoHydrate/);
  });

  it("D. FAILED classification + retry policy (provider/validation/source/unsupported/persistence)", () => {
    const cases = [
      {
        error: new TranslationProviderError("timeout", "timeout"),
        failureClass: "PROVIDER_TIMEOUT",
        retryability: "retryable",
      },
      {
        error: new TranslationProviderError("malformed_response", "bad json"),
        failureClass: "PROVIDER_INVALID_RESPONSE",
        retryability: "retryable",
      },
      {
        error: new TranslationProviderError("safety_rejected", "blocked"),
        failureClass: "PROVIDER_REJECTED",
        retryability: "non_retryable_until_code_or_content_change",
      },
      {
        error: new TranslationProviderError("bad_request", "validation prose"),
        failureClass: "VALIDATION_FAILED",
        retryability: "non_retryable_until_code_or_content_change",
      },
      {
        error: new TranslationProviderError("unavailable", "source unavailable"),
        failureClass: "SOURCE_UNAVAILABLE",
        retryability: "retryable",
      },
      {
        error: new TranslationProviderError("unsupported_language", "nope"),
        failureClass: "UNSUPPORTED_SOURCE",
        retryability: "non_retryable_until_code_or_content_change",
      },
      {
        error: new Error("Mongo write failed during persist"),
        failureClass: "PERSISTENCE_FAILED",
        retryability: "retryable",
      },
    ] as const;

    for (const entry of cases) {
      const classified = classifyContentTranslationMaterializationFailure(entry.error);
      assert.equal(classified.failureClass, entry.failureClass, entry.failureClass);
      assert.equal(classified.retryability, entry.retryability, entry.failureClass);
      const policy = resolveContentTranslationFailureRetryPolicy({
        failureClass: classified.failureClass,
        liveSourceVersion: "v2",
        failedSourceVersion: "v1",
      });
      assert.equal(policy.retryability, "retryable_after_source_change");
      assert.equal(policy.mayScheduleNewWarm, true);
    }
  });

  it("E/F. published outbox without translation ⇒ MISSING_AFTER_DISPATCH (not PENDING)", async () => {
    const workItem = {
      sourceKind: "collective_decision" as const,
      sourceRecordId: "cd-missing-after-dispatch",
      sourceVersion: "v1",
      targetLanguage: "uk" as const,
      state: "MISSING" as const,
      autoNodeCount: 1,
      missingOrStaleNodeCount: 1,
      fallbackPaths: ["question"],
    };

    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: workItem.sourceKind,
      sourceRecordId: workItem.sourceRecordId,
      reason: "operator_backfill",
    });
    assert.ok(enqueued.eventId);
    // Simulate prior bug: consumer "succeeded" without persisting a translation.
    markContentTranslationWarmMemoryPublishedForTests(enqueued.eventId);

    assert.equal(
      await resolveContentTranslationWarmOutboxDisposition({
        sourceKind: workItem.sourceKind,
        sourceRecordId: workItem.sourceRecordId,
      }),
      "published",
    );

    const state = await resolvePublicLocalizationMaterializationState({
      workItem,
      outboxDisposition: "published",
    });
    assert.equal(state, "MISSING_AFTER_DISPATCH");

    const waited = await waitForPublicLocalizationMaterialization({
      workItems: [workItem],
      timeoutMs: 1_500,
      pollIntervalMs: 50,
    });
    assert.equal(waited.timedOut, false);
    assert.equal(waited.progress.MISSING_AFTER_DISPATCH, 1);
    assert.equal(waited.progress.PENDING, 0);
    assert.equal(waited.progress.QUEUED, 0);

    const residuals = await explainPublicLocalizationResiduals({
      workItems: [workItem],
    });
    assert.equal(residuals.length, 1);
    assert.equal(residuals[0]!.failureClass, "MISSING_AFTER_DISPATCH");
    assert.equal(residuals[0]!.translationState, "MISSING_AFTER_DISPATCH");
    assert.equal(residuals[0]!.mayScheduleNewWarm, true);
    // Safety: no prose fields in residual report.
    assert.equal("sourceBody" in residuals[0]!, false);
    assert.equal("translatedContent" in residuals[0]!, false);
  });

  it("missing source warm throws (no silent outbox success)", async () => {
    await assert.rejects(
      () =>
        processContentTranslationWarmRequested({
          commandName: CONTENT_TRANSLATION_WARM_REQUESTED,
          sourceKind: "collective_decision",
          sourceRecordId: "does-not-exist-pack08k2",
          requestedAt: new Date().toISOString(),
          reason: "operator_backfill",
        }),
      (error: unknown) =>
        error instanceof TranslationProviderError &&
        error.code === "unavailable" &&
        error.message.toLowerCase().includes("source unavailable"),
    );
  });

  it("explain-residuals script contract is read-only", () => {
    const script = readApi("src/scripts/reconcile-public-localization.ts");
    assert.match(script, /--explain-residuals/);
    assert.match(script, /explainPublicLocalizationResiduals/);
    assert.match(script, /READ-ONLY/);
    assert.match(script, /omit --execute/);
  });

  it("consumer no longer returns skipped_missing_source success", () => {
    const consumer = readApi("src/modules/language/content-translation-warm-consumer.ts");
    assert.doesNotMatch(
      consumer,
      /outcome:\s*"skipped_missing_source"/,
    );
    assert.match(consumer, /SOURCE_UNAVAILABLE/);
    assert.match(consumer, /throw new TranslationProviderError/);
  });
});
