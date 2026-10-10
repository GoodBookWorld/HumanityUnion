/**
 * One-time truncation release. Deterministic provider only — no live Gemini.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";
process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY = "1";
process.env.LANGUAGE_REGISTRY_PERSISTENCE = "memory";

import type { Initiative } from "@hu/types";

import { SEMANTIC_RESIDUAL_DEFER_STREAK_CAP } from "../../../src/modules/language/content-translation-failure-metadata.js";
import {
  selectInvalidProviderPayloadRetry,
  shouldHoldAutomaticRetryForUnsplitTruncation,
} from "../../../src/modules/language/content-translation-provider-payload-retry.js";
import { findContentTranslation } from "../../../src/modules/language/persistence/content-translation.repository.js";
import {
  ensureLanguageRegistrySeeded,
  getOrCreateContentTranslation,
  listContentTranslationWarmAttempts,
  resetContentTranslationMemoryStoreForTests,
  resetContentTranslationWarmMemoryForTests,
  resetLanguageRegistryStoreForTests,
  resetTranslationProviderForTests,
  setContentTranslationWarmForceMemoryForTests,
  setLanguageRegistryForceMemoryForTests,
  setTranslationProviderForTests,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";
import { loadTranslatableSource } from "../../../src/modules/language/content-translation.service.js";
import { buildPublicLocalizationRetryPreflight } from "../../../src/modules/language/public-localization-retry-preflight.js";
import { selectCurrentlyRetryEligibleResiduals } from "../../../src/modules/language/public-localization-residual-retry.js";
import type { PublicLocalizationResidualWithPreflight } from "../../../src/modules/language/public-localization-retry-preflight.js";
import {
  CONTENT_TRANSLATION_TRUNCATION_RELEASE_BASIS,
  enqueueTruncationReleaseOnce,
  explicitTruncationReleaseIdentity,
  truncationReleaseDecision,
  truncationReleaseMatchesLive,
} from "../../../src/modules/language/content-translation-truncation-release.js";
import {
  consumeTruncationReleaseOnce,
  enqueueContentTranslationWarmRequested,
  markContentTranslationWarmMemoryFailedForTests,
  setTruncationReleaseConsumeDelayForTests,
} from "../../../src/modules/language/content-translation-warm-enqueue.js";
import {
  processContentTranslationWarmMemoryQueueForTests,
  processContentTranslationWarmRequested,
} from "../../../src/modules/language/content-translation-warm-consumer.js";
import {
  runLocalizationProviderRequest,
  setLocalizationProviderClockForTests,
  setLocalizationProviderPacingIntervalMsForTests,
  setLocalizationProviderSleepForTests,
} from "../../../src/modules/language/localization-provider-governor.js";
import type { TranslationProviderRequest } from "../../../src/modules/language/translation-provider.js";
import { createInitiative, deleteInitiative } from "../../../src/modules/initiatives/initiative.store.js";

class PrefixProvider {
  readonly providerId = "gemini" as const;
  callCount = 0;
  mode: "ok" | "truncated" = "ok";

  async translate(request: TranslationProviderRequest) {
    this.callCount += 1;
    if (this.mode === "truncated") {
      return {
        translatedText: "{\"title\":\"partial",
        providerId: this.providerId,
        isPlaceholder: false as const,
        envelope: {
          finishReason: "MAX_TOKENS",
          candidateCount: 1,
          textPartCount: 1,
          extractedLength: 16,
          failureSubtype: "truncated" as const,
        },
      };
    }
    const parsed = JSON.parse(request.text) as Record<string, string>;
    return {
      translatedText: JSON.stringify(
        Object.fromEntries(
          Object.entries(parsed).map(([key, value]) => [
            key,
            key === "title" ? value : `Localized prose ${value}`,
          ]),
        ),
      ),
      providerId: this.providerId,
      isPlaceholder: false as const,
    };
  }
}

function sampleInitiative(suffix: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-release-${suffix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    stewardId: "member-release",
    createdAt: now,
    updatedAt: now,
    title: `Harbor Council ${suffix}`,
    description: `Neighbors prepared a public note ${suffix}.`,
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

function truncatedMeta(input: {
  sourceKind: string;
  sourceRecordId: string;
  sourceVersion: string;
  targetLocale: string;
}): string {
  return `CT_FAIL_META_V1:${JSON.stringify({
    schema: "content_translation_failure_meta_v1",
    validationContractVersion: "v1",
    failureClass: "VALIDATION_FAILED",
    failureReasonCode: "INVALID_PROVIDER_PAYLOAD",
    sourceKind: input.sourceKind,
    sourceRecordId: input.sourceRecordId,
    sourceVersion: input.sourceVersion,
    targetLocale: input.targetLocale,
    failedAt: "2020-01-01T00:00:00.000Z",
    retryabilityHint: "retryable",
    structuredOutputContract: "schema_v1",
    providerPayloadKind: "truncated",
  })}`;
}

describe("truncation release identity", () => {
  const live = {
    sourceKind: "blog_post",
    sourceRecordId: "blog-57d5b2da-84f9-4ca4-96db-a02f8615ef09",
    targetLocale: "he",
    sourceVersion: "v-1-v-6268ff8ac13e5eea",
  };

  it("matches only the exact kind, record, locale, and source version", () => {
    const command = {
      architectureRetryBasis: CONTENT_TRANSLATION_TRUNCATION_RELEASE_BASIS,
      sourceKind: live.sourceKind,
      sourceRecordId: live.sourceRecordId,
      sourceVersion: live.sourceVersion,
      targetLocales: [live.targetLocale] as ["he"],
    };
    assert.equal(truncationReleaseMatchesLive(command, live), true);
    assert.equal(
      truncationReleaseMatchesLive(command, { ...live, sourceVersion: "v-other" }),
      false,
    );
    assert.equal(
      truncationReleaseMatchesLive(command, { ...live, targetLocale: "uk" }),
      false,
    );
    assert.equal(
      truncationReleaseMatchesLive(command, { ...live, sourceKind: "initiative" }),
      false,
    );
    assert.equal(
      truncationReleaseMatchesLive(command, { ...live, sourceRecordId: "blog-other" }),
      false,
    );
    assert.equal(
      explicitTruncationReleaseIdentity({ ...command, sourceVersion: undefined }),
      null,
    );
    assert.equal(
      explicitTruncationReleaseIdentity({
        ...command,
        architectureRetryBasis: "operator_residual_retry",
      }),
      null,
    );
    assert.equal(
      explicitTruncationReleaseIdentity({ ...command, targetLocales: ["he", "uk"] }),
      null,
    );
  });

  it("keeps the retry cap at 8 and does not treat seven truncated failures as exhausted", () => {
    const attempts = Array.from({ length: 7 }, () => ({
      status: "failed" as const,
      architectureRetryBasis: null,
      sourceVersion: live.sourceVersion,
      targetLocales: ["he"],
      attemptAt: "2020-01-01T00:00:00.000Z",
      failureReasonCode: "INVALID_PROVIDER_PAYLOAD",
      failureTargetLocale: "he",
      retryabilityHint: "retryable",
      structuredOutputContract: "schema_v1",
      providerPayloadKind: "truncated" as const,
    }));
    const open = truncationReleaseDecision({
      ...live,
      attempts,
      nowMs: Date.UTC(2030, 0, 1),
    });
    assert.equal(SEMANTIC_RESIDUAL_DEFER_STREAK_CAP, 8);
    assert.equal(open.countedFailures, 7);
    assert.equal(open.required, true);
    assert.equal(open.exhausted, false);
    const closed = truncationReleaseDecision({
      ...live,
      attempts: [...attempts, attempts[0]!],
      nowMs: Date.UTC(2030, 0, 1),
    });
    assert.equal(closed.countedFailures, 8);
    assert.equal(closed.exhausted, true);
    assert.equal(
      shouldHoldAutomaticRetryForUnsplitTruncation({
        sourceVersion: live.sourceVersion,
        targetLocale: "he",
        attempts,
        retryOutcome: "due",
      }),
      true,
    );
  });
});

describe("truncation release warm", () => {
  const createdIds: string[] = [];
  let provider: PrefixProvider;

  beforeEach(async () => {
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWarmMemoryForTests();
    resetLanguageRegistryStoreForTests();
    resetTranslationProviderForTests();
    setLanguageRegistryForceMemoryForTests(true);
    setContentTranslationWarmForceMemoryForTests(true);
    setLocalizationProviderPacingIntervalMsForTests(null);
    setLocalizationProviderSleepForTests(null);
    setLocalizationProviderClockForTests(null);
    provider = new PrefixProvider();
    setTranslationProviderForTests(provider);
    await ensureLanguageRegistrySeeded();
    await updateLanguageRegistryRecord("lang-uk", {
      enabled: true,
      contentTranslationEnabled: true,
    });
  });

  afterEach(() => {
    for (const id of createdIds.splice(0)) {
      deleteInitiative(id);
    }
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWarmMemoryForTests();
    resetTranslationProviderForTests();
    setContentTranslationWarmForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
    setLocalizationProviderPacingIntervalMsForTests(null);
    setLocalizationProviderSleepForTests(null);
    setLocalizationProviderClockForTests(null);
  });

  async function createSource() {
    const initiative = createInitiative(sampleInitiative("note"));
    createdIds.push(initiative.initiativeId);
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    assert.ok(source);
    return { initiative, source };
  }

  async function seedTruncatedFailure(sourceRecordId: string, sourceVersion: string) {
    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId,
      reason: "operator_residual_retry",
      targetLocales: ["uk"],
      sourceVersion,
    });
    assert.ok(enqueued.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      enqueued.eventId,
      truncatedMeta({
        sourceKind: "initiative",
        sourceRecordId,
        sourceVersion,
        targetLocale: "uk",
      }),
      "2020-01-01T00:00:00.000Z",
    );
    return enqueued.eventId;
  }

  async function countedFailures(sourceRecordId: string, sourceVersion: string) {
    const attempts = await listContentTranslationWarmAttempts({
      sourceKind: "initiative",
      sourceRecordId,
      limit: 50,
    });
    return selectInvalidProviderPayloadRetry({
      sourceKind: "initiative",
      sourceRecordId,
      targetLocale: "uk",
      sourceVersion,
      attempts: attempts.map((row) => ({
        status: row.status,
        architectureRetryBasis: row.architectureRetryBasis,
        sourceVersion: row.sourceVersion,
        targetLocales: row.targetLocales,
        attemptAt: row.attemptAt,
        failureReasonCode: row.failureMetadata?.failureReasonCode ?? null,
        failureTargetLocale:
          typeof row.failureMetadata?.targetLocale === "string"
            ? row.failureMetadata.targetLocale
            : null,
        retryabilityHint: row.failureMetadata?.retryabilityHint ?? null,
        localeFailures: row.failureMetadata?.localeFailures ?? null,
        structuredOutputContract: row.failureMetadata?.structuredOutputContract ?? null,
        providerPayloadKind: row.failureMetadata?.providerPayloadKind ?? null,
      })),
      nowMs: Date.UTC(2030, 0, 1),
    });
  }

  it("reconciliation and an unauthorized pending warm leave the identity held", async () => {
    const { initiative, source } = await createSource();
    await seedTruncatedFailure(initiative.initiativeId, source.sourceVersion);
    const preflight = await buildPublicLocalizationRetryPreflight({
      workItem: {
        sourceKind: "initiative",
        sourceRecordId: initiative.initiativeId,
        sourceVersion: source.sourceVersion,
        targetLanguage: "uk",
        state: "MISSING",
        autoNodeCount: 1,
        missingOrStaleNodeCount: 1,
        fallbackPaths: ["title"],
      },
    });
    assert.equal(preflight.semanticRetryDeferred, true);
    const selected = selectCurrentlyRetryEligibleResiduals([
      {
        family: "initiative",
        presentationIdentity: {
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
        },
        targetLocale: "uk",
        translationState: "MISSING",
        sourceVersionMatch: "no_row",
        failureClass: "VALIDATION_FAILED",
        failureReasonCode: "INVALID_PROVIDER_PAYLOAD",
        retryability: "retryable",
        lastFailureAt: "2020-01-01T00:00:00.000Z",
        outboxDisposition: "failed",
        mayScheduleNewWarm: true,
        retryPreflight: preflight,
        latestAttemptAt: "2020-01-01T00:00:00.000Z",
        latestAttemptReason: "operator_residual_retry",
        latestAttemptTargetLocale: "uk",
        failureMetadataVersion: "content_translation_failure_meta_v1",
      } satisfies PublicLocalizationResidualWithPreflight,
    ]);
    assert.equal(selected.length, 0);

    const pending = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "operator_residual_retry",
      targetLocales: ["uk"],
      sourceVersion: source.sourceVersion,
    });
    assert.ok(pending.eventId);
    const withheld = await processContentTranslationWarmRequested(pending.command, {
      eventId: pending.eventId,
    });
    assert.equal(withheld.outcome, "completed");
    assert.equal(withheld.locales[0]?.status, "authorization_withheld");
    assert.equal(provider.callCount, 0);
    const decision = await countedFailures(initiative.initiativeId, source.sourceVersion);
    assert.equal(decision.countedFailures, 1);
    assert.equal(decision.outcome, "due");
  });

  it("spends one exact authorization and does not replay it after a restart", async () => {
    const { initiative, source } = await createSource();
    await seedTruncatedFailure(initiative.initiativeId, source.sourceVersion);
    const authorized = await enqueueTruncationReleaseOnce({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLocale: "uk",
      sourceVersion: source.sourceVersion,
    });
    assert.equal(authorized.enqueued, true);
    assert.ok(authorized.eventId);
    const first = await processContentTranslationWarmRequested(authorized.command, {
      eventId: authorized.eventId,
    });
    assert.equal(first.locales[0]?.status, "generated");
    assert.equal(provider.callCount, 1);
    const saved = await findContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      sourceVersion: source.sourceVersion,
      targetLanguage: "uk",
    });
    assert.ok(saved);
    const beforeReplay = provider.callCount;
    const replay = await processContentTranslationWarmRequested(authorized.command, {
      eventId: authorized.eventId,
    });
    assert.equal(replay.locales[0]?.status, "authorization_withheld");
    assert.equal(provider.callCount, beforeReplay);
    const decision = await countedFailures(initiative.initiativeId, source.sourceVersion);
    assert.equal(decision.countedFailures, 1);
    assert.equal(SEMANTIC_RESIDUAL_DEFER_STREAK_CAP, 8);
  });

  it("does not call the provider for a mismatched version and does not count a failure", async () => {
    const { initiative, source } = await createSource();
    await seedTruncatedFailure(initiative.initiativeId, source.sourceVersion);
    const mismatched = await enqueueTruncationReleaseOnce({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLocale: "uk",
      sourceVersion: "v-not-the-live-version",
    });
    assert.ok(mismatched.eventId);
    const result = await processContentTranslationWarmRequested(mismatched.command, {
      eventId: mismatched.eventId,
    });
    assert.equal(result.locales[0]?.status, "authorization_withheld");
    assert.equal(provider.callCount, 0);
    const decision = await countedFailures(initiative.initiativeId, source.sourceVersion);
    assert.equal(decision.countedFailures, 1);
  });

  it("counts one failed authorized attempt and does not replay it", async () => {
    const { initiative, source } = await createSource();
    await seedTruncatedFailure(initiative.initiativeId, source.sourceVersion);
    provider.mode = "truncated";
    const authorized = await enqueueTruncationReleaseOnce({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLocale: "uk",
      sourceVersion: source.sourceVersion,
    });
    assert.ok(authorized.eventId);
    await assert.rejects(
      () => processContentTranslationWarmMemoryQueueForTests(),
      /truncated|malformed|INVALID_PROVIDER_PAYLOAD|structured content/i,
    );
    assert.equal(provider.callCount, 1);
    const failed = await countedFailures(initiative.initiativeId, source.sourceVersion);
    assert.equal(failed.countedFailures, 2);
    const replay = await processContentTranslationWarmRequested(authorized.command, {
      eventId: authorized.eventId,
    });
    assert.equal(replay.locales[0]?.status, "authorization_withheld");
    assert.equal(provider.callCount, 1);
    const saved = await findContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      sourceVersion: source.sourceVersion,
      targetLanguage: "uk",
    });
    assert.equal(saved, null);
  });

  it("lets one worker spend the release and holds the other", async () => {
    const { initiative, source } = await createSource();
    const authorized = await enqueueTruncationReleaseOnce({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLocale: "uk",
      sourceVersion: source.sourceVersion,
    });
    assert.ok(authorized.eventId);
    let releaseGate: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    setTruncationReleaseConsumeDelayForTests(gate);
    const first = consumeTruncationReleaseOnce(authorized.eventId);
    const second = consumeTruncationReleaseOnce(authorized.eventId);
    releaseGate();
    const results = (await Promise.all([first, second])).sort();
    assert.deepEqual(results, ["already_consumed", "consumed"]);
  });

  it("stays held when the release was spent before the provider returned", async () => {
    const { initiative, source } = await createSource();
    await seedTruncatedFailure(initiative.initiativeId, source.sourceVersion);
    const authorized = await enqueueTruncationReleaseOnce({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLocale: "uk",
      sourceVersion: source.sourceVersion,
    });
    assert.ok(authorized.eventId);
    assert.equal(await consumeTruncationReleaseOnce(authorized.eventId), "consumed");
    const restarted = await processContentTranslationWarmRequested(authorized.command, {
      eventId: authorized.eventId,
    });
    assert.equal(restarted.locales[0]?.status, "authorization_withheld");
    assert.equal(provider.callCount, 0);
    const decision = await countedFailures(initiative.initiativeId, source.sourceVersion);
    assert.equal(decision.countedFailures, 1);
  });

  it("does not let an exhausted identity use a new authorization", async () => {
    const { initiative, source } = await createSource();
    for (let index = 0; index < 8; index += 1) {
      await seedTruncatedFailure(initiative.initiativeId, source.sourceVersion);
    }
    const authorized = await enqueueTruncationReleaseOnce({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLocale: "uk",
      sourceVersion: source.sourceVersion,
    });
    assert.ok(authorized.eventId);
    const result = await processContentTranslationWarmRequested(authorized.command, {
      eventId: authorized.eventId,
    });
    assert.equal(result.locales[0]?.status, "authorization_withheld");
    assert.equal(provider.callCount, 0);
    const decision = await countedFailures(initiative.initiativeId, source.sourceVersion);
    assert.equal(decision.countedFailures, 8);
    assert.equal(decision.outcome, "exhausted");
  });

  it("still translates an ordinary identity that has no truncated failure", async () => {
    const { initiative, source } = await createSource();
    const ordinary = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "public_mutation",
      targetLocales: ["uk"],
      sourceVersion: source.sourceVersion,
    });
    assert.ok(ordinary.eventId);
    const result = await processContentTranslationWarmRequested(ordinary.command, {
      eventId: ordinary.eventId,
    });
    assert.equal(result.locales[0]?.status, "generated");
    assert.equal(provider.callCount, 1);
    const again = await getOrCreateContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLanguage: "uk",
      generateIfMissing: true,
      intent: "automatic_warm",
    });
    assert.equal(again.generated, false);
    assert.equal(provider.callCount, 1);
  });

  it("waits out a closed pacing window without a second provider call", async () => {
    const { initiative, source } = await createSource();
    await seedTruncatedFailure(initiative.initiativeId, source.sourceVersion);
    setLocalizationProviderPacingIntervalMsForTests(10_000);
    let now = 1_700_000_000_000;
    setLocalizationProviderClockForTests(() => now);
    setLocalizationProviderSleepForTests(async (ms) => {
      now += ms;
    });
    await runLocalizationProviderRequest(async () => "primer");
    const authorized = await enqueueTruncationReleaseOnce({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      targetLocale: "uk",
      sourceVersion: source.sourceVersion,
    });
    assert.ok(authorized.eventId);
    const result = await processContentTranslationWarmRequested(authorized.command, {
      eventId: authorized.eventId,
    });
    assert.equal(result.locales[0]?.status, "generated");
    assert.equal(provider.callCount, 1);
  });
});
