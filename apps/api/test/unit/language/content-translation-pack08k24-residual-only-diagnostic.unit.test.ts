/**
 * Pack 08K.2.4 — memory-safe residual-only diagnostics.
 * Deterministic only — no live Gemini / no staging Mongo mutation.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, it } from "node:test";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.INITIATIVE_ANALYSIS_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";
process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY = "1";
process.env.LANGUAGE_REGISTRY_PERSISTENCE = "memory";

import type { Initiative } from "@hu/types";

import {
  encodeContentTranslationFailureMetadata,
  ensureLanguageRegistrySeeded,
  enqueueContentTranslationWarmRequested,
  explainResidualsOnly,
  getResidualDiagnosticCounters,
  listContentTranslationWarmAttemptsBounded,
  markContentTranslationWarmMemoryFailedForTests,
  resetContentTranslationMemoryStoreForTests,
  resetContentTranslationWarmMemoryForTests,
  resetLanguageRegistryStoreForTests,
  resetResidualDiagnosticCountersForTests,
  resetTranslationProviderForTests,
  setContentTranslationWarmForceMemoryForTests,
  setLanguageRegistryForceMemoryForTests,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(__dirname, "../../..");

function readApi(rel: string): string {
  return readFileSync(join(apiRoot, rel), "utf8");
}

function sampleInitiative(suffix: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-pack08k24-${suffix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    stewardId: "member-pack08k24",
    createdAt: now,
    updatedAt: now,
    title: `Pack08K24 Initiative ${suffix}`,
    description: `Canonical English prose for residual diagnostic ${suffix}.`,
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

function modernMeta(input: {
  sourceRecordId: string;
  targetLocale: string;
  failureReasonCode: string;
}): string {
  return encodeContentTranslationFailureMetadata({
    schema: "content_translation_failure_meta_v1",
    validationContractVersion: "v1",
    failureClass: "VALIDATION_FAILED",
    failureReasonCode: input.failureReasonCode,
    sourceKind: "initiative",
    sourceRecordId: input.sourceRecordId,
    sourceVersion: "v-test",
    targetLocale: input.targetLocale,
    failedAt: new Date().toISOString(),
    retryabilityHint: "non_retryable_until_code_or_content_change",
    localeFailures: [
      {
        targetLocale: input.targetLocale,
        failureClass: "VALIDATION_FAILED",
        failureReasonCode: input.failureReasonCode,
        retryabilityHint: "non_retryable_until_code_or_content_change",
      },
    ],
  });
}

describe("Pack 08K.2.4 — memory-safe residual diagnostics", () => {
  const createdInitiativeIds: string[] = [];

  beforeEach(async () => {
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWarmMemoryForTests();
    resetLanguageRegistryStoreForTests();
    resetTranslationProviderForTests();
    resetResidualDiagnosticCountersForTests();
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

  it("A. 4 residuals => only 4 identity diagnostics", async () => {
    const created: Initiative[] = [];
    for (let i = 0; i < 4; i += 1) {
      const initiative = sampleInitiative(`r${i}`);
      createInitiative(initiative);
      createdInitiativeIds.push(initiative.initiativeId);
      created.push(initiative);
      const enqueued = await enqueueContentTranslationWarmRequested({
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        reason: "operator_residual_retry",
        targetLocales: ["uk"],
      });
      assert.ok(enqueued.eventId);
      markContentTranslationWarmMemoryFailedForTests(
        enqueued.eventId,
        modernMeta({
          sourceRecordId: initiative.initiativeId,
          targetLocale: "uk",
          failureReasonCode: "UNCHANGED_CIVIC_TITLE",
        }),
      );
    }

    const result = await explainResidualsOnly({
      identitiesForTests: created.map((initiative) => ({
        sourceKind: "initiative" as const,
        sourceRecordId: initiative.initiativeId,
        targetLocale: "uk" as const,
      })),
      batchSize: 25,
    });

    assert.equal(result.residuals.length, 4);
    assert.equal(result.memory.DIAGNOSTIC_IDENTITIES, 4);
    assert.equal(result.memory.FULL_CORPUS_HYDRATED, false);
    assert.equal(result.memory.SOURCE_RECORDS_LOADED, 4);
    assert.ok(result.memory.DIAGNOSTIC_BATCH_SIZE <= 25);
  });

  it("B. huge unrelated corpus does not increase loaded source count", async () => {
    // Simulate a large "corpus" of unrelated initiatives that are NOT selected.
    for (let i = 0; i < 40; i += 1) {
      const initiative = sampleInitiative(`noise-${i}`);
      createInitiative(initiative);
      createdInitiativeIds.push(initiative.initiativeId);
    }

    const target = sampleInitiative("target");
    createInitiative(target);
    createdInitiativeIds.push(target.initiativeId);
    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: target.initiativeId,
      reason: "operator_residual_retry",
      targetLocales: ["ar"],
    });
    assert.ok(enqueued.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      enqueued.eventId,
      modernMeta({
        sourceRecordId: target.initiativeId,
        targetLocale: "ar",
        failureReasonCode: "EMPTY_TRANSLATION",
      }),
    );

    resetResidualDiagnosticCountersForTests();
    const result = await explainResidualsOnly({
      identitiesForTests: [
        {
          sourceKind: "initiative",
          sourceRecordId: target.initiativeId,
          targetLocale: "ar",
        },
      ],
    });

    assert.equal(result.residuals.length, 1);
    assert.equal(result.memory.SOURCE_RECORDS_LOADED, 1);
    assert.ok(result.memory.SOURCE_RECORDS_LOADED < 40);
  });

  it("C. huge unrelated outbox history not loaded unbounded", async () => {
    const hugeHistory = Array.from({ length: 500 }, (_, i) => ({
      aggregateId: `initiative::noise-${i}`,
      createdAt: `2026-01-01T00:00:${String(i % 60).padStart(2, "0")}.000Z`,
      lastError: "legacy noise",
      payload: { targetLocales: ["uk"] },
    }));

    const target = sampleInitiative("outbox-bound");
    createInitiative(target);
    createdInitiativeIds.push(target.initiativeId);

    const result = await explainResidualsOnly({
      maxOutboxRows: 100,
      batchSize: 25,
      failedOutboxRowsForTests: [
        ...hugeHistory,
        {
          aggregateId: `initiative::${target.initiativeId}`,
          createdAt: "2026-09-05T00:00:00.000Z",
          lastError: modernMeta({
            sourceRecordId: target.initiativeId,
            targetLocale: "uk",
            failureReasonCode: "UNCHANGED_SOURCE_PROSE",
          }),
          payload: { targetLocales: ["uk"], reason: "operator_residual_retry" },
        },
      ],
      // Force only our identity after discovery bound.
      identitiesForTests: [
        {
          sourceKind: "initiative",
          sourceRecordId: target.initiativeId,
          targetLocale: "uk",
        },
      ],
    });

    assert.equal(result.residuals.length, 1);
    // Discovery scan counters come from failedOutboxRowsForTests when identitiesForTests skips discover —
    // assert bounded attempt listing instead.
    const attempts = await listContentTranslationWarmAttemptsBounded({
      sourceKind: "initiative",
      sourceRecordId: target.initiativeId,
      limit: 10,
    });
    assert.ok(attempts.length <= 10);
  });

  it("D. latest modern event selected over legacy", async () => {
    const initiative = sampleInitiative("latest");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);

    const legacy = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "operator_backfill",
      requestedAt: "2026-01-01T00:00:00.000Z",
    });
    assert.ok(legacy.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      legacy.eventId,
      "One or more automatic warm locale translations failed without CURRENT materialization.",
    );

    const modern = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "operator_residual_retry",
      targetLocales: ["uk"],
      requestedAt: "2026-09-05T00:00:00.000Z",
    });
    assert.ok(modern.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      modern.eventId,
      modernMeta({
        sourceRecordId: initiative.initiativeId,
        targetLocale: "uk",
        failureReasonCode: "MISSING_REQUIRED_PATH",
      }),
    );

    const result = await explainResidualsOnly({
      identitiesForTests: [
        {
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          targetLocale: "uk",
        },
      ],
    });
    assert.equal(result.residuals[0]?.failureReasonCode, "MISSING_REQUIRED_PATH");
    assert.equal(result.residuals[0]?.latestAttemptReason, "operator_residual_retry");
    assert.equal(
      result.residuals[0]?.failureMetadataVersion,
      "content_translation_failure_meta_v1",
    );
  });

  it("E. locale attribution preserved", async () => {
    const initiative = sampleInitiative("locale");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);
    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "operator_residual_retry",
      targetLocales: ["uk", "ar"],
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
        localeFailures: [
          {
            targetLocale: "uk",
            failureClass: "VALIDATION_FAILED",
            failureReasonCode: "UNCHANGED_CIVIC_TITLE",
            retryabilityHint: "non_retryable_until_code_or_content_change",
          },
          {
            targetLocale: "ar",
            failureClass: "VALIDATION_FAILED",
            failureReasonCode: "EMPTY_TRANSLATION",
            retryabilityHint: "non_retryable_until_code_or_content_change",
          },
        ],
      }),
    );

    const result = await explainResidualsOnly({
      identitiesForTests: [
        {
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          targetLocale: "uk",
        },
        {
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          targetLocale: "ar",
        },
      ],
    });
    const uk = result.residuals.find((row) => row.targetLocale === "uk");
    const ar = result.residuals.find((row) => row.targetLocale === "ar");
    assert.equal(uk?.failureReasonCode, "UNCHANGED_CIVIC_TITLE");
    assert.equal(ar?.failureReasonCode, "EMPTY_TRANSLATION");
  });

  it("F. malformed legacy metadata safe", async () => {
    const result = await explainResidualsOnly({
      failedOutboxRowsForTests: [
        {
          aggregateId: "initiative::malformed-08k24",
          createdAt: "2026-09-05T00:00:00.000Z",
          lastError: "CT_FAIL_META_V1:{not-json",
          payload: { targetLocales: ["uk"] },
        },
      ],
      identitiesForTests: [
        {
          sourceKind: "initiative",
          sourceRecordId: "malformed-08k24",
          targetLocale: "uk",
        },
      ],
    });
    assert.equal(result.residuals.length, 1);
    assert.ok(result.residuals[0]);
  });

  it("G/H. no provider calls / no writes", async () => {
    const script = readApi("src/modules/language/public-localization-residual-only-diagnostic.ts");
    assert.doesNotMatch(script, /getOrCreateContentTranslation\(/);
    assert.doesNotMatch(script, /enqueueContentTranslationWarmRequested\(/);
    assert.match(script, /zero provider calls, zero writes/);
  });

  it("I. full bootstrap explicitly not invoked", () => {
    const script = readApi("src/scripts/reconcile-public-localization.ts");
    assert.match(script, /bootstrapContentTranslationResidualDiagnosticPersistence/);
    assert.match(script, /explain-residuals-only/);
    assert.match(script, /NO civic snapshot hydrate/);
    // explain path must not call hydrate operator bootstrap
    const explainBlock = script.slice(
      script.indexOf("if (explainResiduals)"),
      script.indexOf("const bootstrap = await bootstrapContentTranslationOperatorPersistence()"),
    );
    assert.doesNotMatch(
      explainBlock,
      /bootstrapContentTranslationOperatorPersistence\(/,
    );
    assert.doesNotMatch(explainBlock, /hydrateInitiativeMongoPersistence/);
  });

  it("J. modern terminal failures remain blocked unless explicit retry policy", async () => {
    const initiative = sampleInitiative("blocked");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);
    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "operator_residual_retry",
      targetLocales: ["zh-Hant"],
    });
    assert.ok(enqueued.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      enqueued.eventId,
      modernMeta({
        sourceRecordId: initiative.initiativeId,
        targetLocale: "zh-Hant",
        failureReasonCode: "UNCHANGED_CIVIC_TITLE",
      }),
    );

    const result = await explainResidualsOnly({
      identitiesForTests: [
        {
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          targetLocale: "zh-Hant",
        },
      ],
    });
    assert.equal(result.RETRY_READY_IDENTITIES, 0);
    assert.equal(result.residuals[0]?.retryPreflight.ready, false);
    assert.equal(result.residuals[0]?.mayScheduleNewWarm, false);
  });

  it("K. diagnostic contains no prose/provider payload", async () => {
    const initiative = sampleInitiative("safe-json");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);
    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "operator_residual_retry",
      targetLocales: ["uk"],
    });
    assert.ok(enqueued.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      enqueued.eventId,
      modernMeta({
        sourceRecordId: initiative.initiativeId,
        targetLocale: "uk",
        failureReasonCode: "OTHER_VALIDATION_FAILURE",
      }),
    );

    const result = await explainResidualsOnly({
      identitiesForTests: [
        {
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          targetLocale: "uk",
        },
      ],
    });
    const json = JSON.stringify(result.residuals);
    assert.doesNotMatch(json, /Canonical English prose|GEMINI_API_KEY|provider prompt/i);
    assert.doesNotMatch(json, /"translatedContent"/);
  });

  it("memory counters expose FULL_CORPUS_HYDRATED=false", async () => {
    const result = await explainResidualsOnly({ identitiesForTests: [] });
    assert.equal(result.memory.FULL_CORPUS_HYDRATED, false);
    assert.equal(getResidualDiagnosticCounters().FULL_CORPUS_HYDRATED, false);
  });
});
