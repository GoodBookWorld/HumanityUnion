/**
 * Pack 08K.2.1 — residual retry readiness + validation root cause.
 * Deterministic only — no live Gemini / no staging Mongo mutation.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";
process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY = "1";
process.env.LANGUAGE_REGISTRY_PERSISTENCE = "memory";

import type { Initiative, InitiativeCollectiveDecision } from "@hu/types";
import { protectedIdentity, protectedTechnical } from "@hu/types";

import {
  assertTranslatedProseChangedFromSource,
  assertCivicTitleFieldsTranslatedFromSource,
  buildPublicLocalizationRetryPreflight,
  collectAutoTranslatableNodes,
  ContentTranslationValidationError,
  encodeContentTranslationFailureMetadata,
  ensureLanguageRegistrySeeded,
  enqueueContentTranslationWarmRequested,
  explainPublicLocalizationResidualsWithPreflight,
  markContentTranslationWarmMemoryFailedForTests,
  parseContentTranslationFailureMetadata,
  resetContentTranslationMemoryStoreForTests,
  resetContentTranslationWarmMemoryForTests,
  resetLanguageRegistryStoreForTests,
  resetTranslationProviderForTests,
  selectReadyPresentationsForResidualRetry,
  setContentTranslationWarmForceMemoryForTests,
  setLanguageRegistryForceMemoryForTests,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";
import { upsertContentTranslation } from "../../../src/modules/language/persistence/content-translation.repository.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";
import {
  createDecision,
  deleteDecisionsByStewardIdForTests,
} from "../../../src/modules/initiative-collective-decision/initiative-collective-decision.store.js";

function sampleInitiative(suffix: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-pack08k21-${suffix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    stewardId: "member-pack08k21",
    createdAt: now,
    updatedAt: now,
    title: `Pack08K21 Initiative ${suffix}`,
    description: `Canonical English prose for retry preflight ${suffix}.`,
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

function sampleDecision(initiativeId: string, suffix: string): InitiativeCollectiveDecision {
  const now = new Date().toISOString();
  return {
    decisionId: `decision-pack08k21-${suffix}-${Math.random().toString(16).slice(2, 8)}`,
    initiativeId,
    decisionSessionId: null,
    stewardId: "member-pack08k21",
    sequenceNumber: 1,
    participationScope: "open",
    status: "opened",
    question: `Retry-ready decision question ${suffix}?`,
    openedAt: now,
    closesAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now,
    updatedAt: now,
  };
}

describe("Pack 08K.2.1 — residual retry preflight", () => {
  const createdInitiativeIds: string[] = [];

  beforeEach(async () => {
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWarmMemoryForTests();
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
  });

  afterEach(() => {
    deleteDecisionsByStewardIdForTests("member-pack08k21");
    for (const id of createdInitiativeIds.splice(0)) {
      try {
        deleteInitiative(id);
      } catch {
        // ignore
      }
    }
    setContentTranslationWarmForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("A. hydrated CD source + missing row + no active work → ready=true", async () => {
    const initiative = sampleInitiative("cd-ready");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);
    const decision = createDecision(sampleDecision(initiative.initiativeId, "ready"));

    const preflight = await buildPublicLocalizationRetryPreflight({
      workItem: {
        sourceKind: "collective_decision",
        sourceRecordId: decision.decisionId,
        sourceVersion: "v-live",
        targetLanguage: "uk",
        state: "MISSING",
        autoNodeCount: 1,
        missingOrStaleNodeCount: 1,
        fallbackPaths: ["question"],
      },
    });

    assert.equal(preflight.sourceResolvable, true);
    assert.equal(preflight.presentationValid, true);
    assert.equal(preflight.localeEligible, true);
    assert.equal(preflight.currentTranslationAbsent, true);
    assert.equal(preflight.activeWorkAbsent, true);
    assert.equal(preflight.ready, true);
    assert.equal(preflight.readyState, "MISSING_READY_FOR_WARM");
    assert.equal(
      preflight.architectureRetryBasis,
      "COLLECTIVE_DECISION_HYDRATE_SYNC_08K2",
    );
  });

  it("B. missing source → ready=false", async () => {
    const preflight = await buildPublicLocalizationRetryPreflight({
      workItem: {
        sourceKind: "collective_decision",
        sourceRecordId: "missing-decision-08k21",
        sourceVersion: "v1",
        targetLanguage: "uk",
        state: "MISSING",
        autoNodeCount: 0,
        missingOrStaleNodeCount: 0,
        fallbackPaths: [],
      },
    });
    assert.equal(preflight.sourceResolvable, false);
    assert.equal(preflight.ready, false);
    assert.match(preflight.blockReason ?? "", /Source loader/);
  });

  it("C. active queued work → ready=false", async () => {
    const initiative = sampleInitiative("queued");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);
    const decision = createDecision(sampleDecision(initiative.initiativeId, "queued"));

    await enqueueContentTranslationWarmRequested({
      sourceKind: "collective_decision",
      sourceRecordId: decision.decisionId,
      reason: "operator_backfill",
    });

    const preflight = await buildPublicLocalizationRetryPreflight({
      workItem: {
        sourceKind: "collective_decision",
        sourceRecordId: decision.decisionId,
        sourceVersion: "v1",
        targetLanguage: "ar",
        state: "QUEUED",
        autoNodeCount: 1,
        missingOrStaleNodeCount: 1,
        fallbackPaths: ["question"],
      },
    });
    assert.equal(preflight.activeWorkAbsent, false);
    assert.equal(preflight.ready, false);
    assert.equal(preflight.readyState, "ACTIVE_WORK");
  });

  it("D. CURRENT translation → not selected", async () => {
    const initiative = sampleInitiative("current");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);
    const decision = createDecision(sampleDecision(initiative.initiativeId, "current"));

    const { loadTranslatableSource } = await import(
      "../../../src/modules/language/content-translation.service.js"
    );
    const source = await loadTranslatableSource({
      sourceKind: "collective_decision",
      sourceRecordId: decision.decisionId,
    });
    assert.ok(source);

    await upsertContentTranslation({
      translationId: "tr-current-08k21",
      sourceKind: "collective_decision",
      sourceRecordId: decision.decisionId,
      sourceVersion: source.sourceVersion,
      sourceLanguage: "en",
      targetLanguage: "uk",
      translatedContent: { question: "[uk] Q" },
      translationProvider: "deterministic",
      translationKind: "machine",
      createdAt: new Date().toISOString(),
      stale: false,
      freshness: "current",
    });

    const explained = await explainPublicLocalizationResidualsWithPreflight({
      workItems: [
        {
          sourceKind: "collective_decision",
          sourceRecordId: decision.decisionId,
          sourceVersion: source.sourceVersion,
          targetLanguage: "uk",
          state: "MISSING",
          autoNodeCount: 1,
          missingOrStaleNodeCount: 0,
          fallbackPaths: [],
        },
      ],
    });
    assert.equal(explained.selection.RETRY_READY_IDENTITIES, 0);
    assert.equal(explained.residuals[0]!.retryPreflight.ready, false);
    assert.equal(explained.residuals[0]!.retryPreflight.readyState, "CURRENT");
    assert.equal(selectReadyPresentationsForResidualRetry(explained.selection).length, 0);
  });

  it("E. terminal validation failure without retry basis → ready=false", async () => {
    const initiative = sampleInitiative("blocked-val");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);

    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "operator_backfill",
    });
    assert.ok(enqueued.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      enqueued.eventId,
      encodeContentTranslationFailureMetadata({
        schema: "content_translation_failure_meta_v1",
        validationContractVersion: "v1",
        failureClass: "VALIDATION_FAILED",
        failureReasonCode: "UNCHANGED_CIVIC_TITLE",
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        sourceVersion: "v1",
        targetLocale: "uk",
        failedAt: new Date().toISOString(),
        retryabilityHint: "non_retryable_until_code_or_content_change",
      }),
    );

    const preflight = await buildPublicLocalizationRetryPreflight({
      workItem: {
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        sourceVersion: "v1",
        targetLanguage: "uk",
        state: "FAILED",
        autoNodeCount: 2,
        missingOrStaleNodeCount: 2,
        fallbackPaths: ["title"],
      },
    });
    assert.equal(preflight.ready, false);
    assert.equal(preflight.failureReasonCode, "UNCHANGED_CIVIC_TITLE");
    assert.match(preflight.blockReason ?? "", /UNCHANGED_CIVIC_TITLE/);
  });

  it("F. historical UNKNOWN_LEGACY validation failure with proven basis → ready=true", async () => {
    const initiative = sampleInitiative("legacy");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);

    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "operator_backfill",
    });
    assert.ok(enqueued.eventId);
    // Pre-metadata aggregate failure message (staging shape).
    markContentTranslationWarmMemoryFailedForTests(
      enqueued.eventId,
      "One or more automatic warm locale translations failed without CURRENT materialization.",
    );

    const preflight = await buildPublicLocalizationRetryPreflight({
      workItem: {
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        sourceVersion: "v1",
        targetLanguage: "zh-Hant",
        state: "FAILED",
        autoNodeCount: 2,
        missingOrStaleNodeCount: 2,
        fallbackPaths: ["title"],
      },
    });
    assert.equal(preflight.failureReasonCode, "UNKNOWN_LEGACY");
    assert.equal(preflight.ready, true);
    assert.equal(
      preflight.architectureRetryBasis,
      "HISTORICAL_FAILURE_SEMANTICS_UNKNOWN_LEGACY_v1",
    );
  });

  it("G. safe validation reason code persists and is diagnosed", () => {
    assert.throws(
      () =>
        assertTranslatedProseChangedFromSource({
          sourceKind: "discussion_comment",
          sourceLanguage: "en",
          targetLanguage: "uk",
          sourceFields: { body: "Hello" },
          translatedFields: { body: "Hello" },
        }),
      (error: unknown) =>
        error instanceof ContentTranslationValidationError &&
        error.reasonCode === "UNCHANGED_SOURCE_PROSE",
    );

    assert.throws(
      () =>
        assertCivicTitleFieldsTranslatedFromSource({
          sourceKind: "blog_post",
          sourceLanguage: "en",
          targetLanguage: "ar",
          sourceFields: { title: "Title" },
          translatedFields: { title: "Title" },
        }),
      (error: unknown) =>
        error instanceof ContentTranslationValidationError &&
        error.reasonCode === "UNCHANGED_CIVIC_TITLE",
    );

    const encoded = encodeContentTranslationFailureMetadata({
      schema: "content_translation_failure_meta_v1",
      validationContractVersion: "v1",
      failureClass: "VALIDATION_FAILED",
      failureReasonCode: "UNCHANGED_CIVIC_TITLE",
      sourceKind: "blog_post",
      sourceRecordId: "blog-1",
      sourceVersion: "v9",
      targetLocale: "ar",
      failedAt: "2026-09-05T00:00:00.000Z",
      retryabilityHint: "non_retryable_until_code_or_content_change",
    });
    const parsed = parseContentTranslationFailureMetadata(encoded);
    assert.ok(parsed);
    assert.equal(parsed.failureReasonCode, "UNCHANGED_CIVIC_TITLE");
    assert.equal(parsed.sourceRecordId, "blog-1");
    assert.doesNotMatch(encoded, /Title|Hello|prompt|GEMINI/);
  });

  it("H. unknown nested PublicLocalizedPresentation field — no allowlist", () => {
    const tree = {
      title: "T",
      brandNewNested: { deeper: "New prose" },
      author: protectedIdentity("Alice"),
      url: protectedTechnical("https://example.org"),
    };
    const auto = collectAutoTranslatableNodes(tree);
    assert.ok(auto.some((n) => n.path === "brandNewNested.deeper"));
    assert.ok(!auto.some((n) => n.value === "Alice"));
  });
});
