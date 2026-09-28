/**
 * STEP F.3.14.1 — recoverable WEB_UI provider payload-shape variance.
 * Deterministic translator only. No Gemini.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/index.js";
import {
  runLocalizationProviderRequest,
  setLocalizationProviderClockForTests,
  setLocalizationProviderPacingIntervalMsForTests,
} from "../../../src/modules/language/localization-provider-governor.js";
import { emptyPendingDomains } from "../../../src/modules/language/language-localization-activation/language-activation-job.domains.js";
import { isLanguageActivationWebUiReadyForHistoricalEnqueue } from "../../../src/modules/language/language-localization-activation/language-activation-job.domains.js";
import {
  getLanguageActivationJobById,
  listLanguageActivationJobs,
  saveLanguageActivationJob,
} from "../../../src/modules/language/language-localization-activation/language-activation-job.repository.js";
import {
  processLanguageActivationJob,
  resetLanguageActivationJobSchedulerForTests,
  resetLanguageActivationJobStoreForTests,
  resumeIncompleteWebUiActivationJobsOnBoot,
  setLanguageActivationJobAdminAssertOverrideForTests,
  setLanguageActivationJobForceMemoryForTests,
  setLanguageActivationJobProcessDepsForTests,
  startOrResumeLanguageActivationJob,
} from "../../../src/modules/language/language-localization-activation/index.js";
import { getWebUiActivationSchedulerSnapshotForTests } from "../../../src/modules/language/language-localization-activation/language-activation-job.service.js";
import {
  resetThinGeminiProviderStateForTests,
  setThinGeminiProviderStateForceMemoryForTests,
} from "../../../src/modules/language/media-plp-materializer/thin-gemini-provider-state.js";
import { TranslationProviderError } from "../../../src/modules/language/translation.config.js";
import type { TranslationProviderRequest } from "../../../src/modules/language/translation-provider.js";
import type { LanguageRegistryRecord } from "@hu/types";
import {
  getWebUiActivationBatch,
  getWebUiActivationCheckpointByJobId,
  listWebUiActivationBatches,
  resetWebUiActivationCheckpointStoreForTests,
  setWebUiActivationCheckpointForceMemoryForTests,
  upsertWebUiActivationBatch,
  upsertWebUiActivationCheckpoint,
} from "../../../src/modules/web-ui-message-packs/web-ui-activation-checkpoint.repository.js";
import {
  hashWebUiEnglishFlatMap,
  loadPublicWebUiEnglishCorpus,
  planWebUiDraftBatches,
} from "../../../src/modules/web-ui-message-packs/web-ui-draft-builder.js";
import {
  reconstructWebUiMessageFromProviderSpans,
  WebUiProviderPayloadShapeError,
  webUiProviderPayloadValue,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-structure-protect.js";
import { getPublishedWebUiMessagePackByLocale } from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import {
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import {
  isRecoverableWebUiProviderPayloadShapeFailure,
  isRecoverableWebUiProviderPayloadShapeMessage,
  isRetryableWebUiProviderOutputStructureFailure,
  WEB_UI_PROVIDER_SHAPE_STRUCTURE_FAILURE_BOUND,
  WEB_UI_PROVIDER_SHAPE_VERSION,
  WEB_UI_STRUCTURE_BLOCKED_DETAIL,
} from "../../../src/modules/web-ui-message-packs/web-ui-provider-output-structure.js";

const BADGE_KEYS = [
  "membershipPublic.badgeProduct.features.securePin",
  "membershipPublic.badgeProduct.membersOnly",
  "membershipPublic.badgeProduct.productName",
  "membershipPublic.badgeProduct.subtitle",
  "membershipPublic.badgeProduct.title",
  "membershipPublic.badgeProduct.unavailable",
] as const;

const SHAPE_REASON = "Provider span count 4 does not match 2.";
const SOURCE_SENTINEL = "English source already contains a protection sentinel.";

function echoPayload(
  request: TranslationProviderRequest,
  mode: "four" | "string" | "correct",
) {
  const parsed = JSON.parse(request.text) as Record<string, unknown>;
  const translated: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (Array.isArray(value)) {
      if (mode === "four") {
        translated[key] = ["a", "b", "c", "d"];
      } else if (mode === "string") {
        translated[key] = "not-an-array";
      } else {
        translated[key] = value.map((span) => `「${String(span)}」`);
      }
    } else if (mode === "correct") {
      translated[key] = `「${String(value)}」`;
    } else {
      translated[key] = String(value);
    }
  }
  return {
    translatedText: JSON.stringify(translated),
    providerId: "deterministic" as const,
    isPlaceholder: false as const,
  };
}

describe("F.3.14.1 provider payload shape classification", () => {
  it("rejects a 4-span payload for a 2-span {siteName} message", () => {
    const corpus = loadPublicWebUiEnglishCorpus();
    const membersOnly = corpus.flat["membershipPublic.badgeProduct.membersOnly"] ?? "";
    const productName = corpus.flat["membershipPublic.badgeProduct.productName"] ?? "";
    const membersPayload = webUiProviderPayloadValue(membersOnly);
    const productPayload = webUiProviderPayloadValue(productName);
    assert.ok(Array.isArray(membersPayload));
    assert.equal(membersPayload.length, 2);
    assert.ok(Array.isArray(productPayload));
    assert.equal(productPayload.length, 2);
    assert.equal(JSON.stringify(membersPayload).includes("{siteName}"), false);
    assert.equal(JSON.stringify(productPayload).includes("{siteName}"), false);

    assert.throws(
      () => reconstructWebUiMessageFromProviderSpans(membersOnly, ["a", "b", "c", "d"]),
      (error: unknown) => {
        assert.ok(error instanceof WebUiProviderPayloadShapeError);
        assert.equal((error as Error).message, SHAPE_REASON);
        assert.equal(isRecoverableWebUiProviderPayloadShapeFailure(error), true);
        assert.equal(isRecoverableWebUiProviderPayloadShapeMessage(SHAPE_REASON), true);
        assert.equal(isRetryableWebUiProviderOutputStructureFailure(error), false);
        return true;
      },
    );
    assert.throws(
      () => reconstructWebUiMessageFromProviderSpans(productName, ["a", "b", "c", "d"]),
      /Provider span count 4 does not match 2\./,
    );
  });

  it("classifies a provider span value of the wrong JSON type as recoverable", () => {
    const corpus = loadPublicWebUiEnglishCorpus();
    const membersOnly = corpus.flat["membershipPublic.badgeProduct.membersOnly"] ?? "";
    const securePin = corpus.flat["membershipPublic.badgeProduct.features.securePin"] ?? "";
    assert.throws(
      () => reconstructWebUiMessageFromProviderSpans(membersOnly, "not-an-array"),
      (error: unknown) => {
        assert.ok(error instanceof WebUiProviderPayloadShapeError);
        assert.equal(isRecoverableWebUiProviderPayloadShapeFailure(error), true);
        assert.equal(
          isRecoverableWebUiProviderPayloadShapeMessage(
            "Provider span list must be an array of strings.",
          ),
          true,
        );
        return true;
      },
    );
    assert.throws(
      () => reconstructWebUiMessageFromProviderSpans(securePin, ["not", "a", "string"]),
      (error: unknown) => {
        assert.equal(isRecoverableWebUiProviderPayloadShapeFailure(error), true);
        assert.equal(
          isRecoverableWebUiProviderPayloadShapeMessage(
            "Provider translation value must be a string.",
          ),
          true,
        );
        return true;
      },
    );
    assert.equal(isRecoverableWebUiProviderPayloadShapeMessage(SOURCE_SENTINEL), false);
    assert.equal(
      isRecoverableWebUiProviderPayloadShapeMessage(
        "Public interface translation failed — retry activation",
      ),
      false,
    );
  });
});

describe("F.3.14.1 bounded provider-shape recovery", () => {
  let nowMs = Date.now();

  beforeEach(async () => {
    nowMs = Date.now();
    setLocalizationProviderClockForTests(() => nowMs);
    setLocalizationProviderPacingIntervalMsForTests(0);
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    setWebUiMessagePackForceMemoryForTests(true);
    resetWebUiMessagePackStoreForTests();
    setWebUiActivationCheckpointForceMemoryForTests(true);
    resetWebUiActivationCheckpointStoreForTests();
    setLanguageActivationJobForceMemoryForTests(true);
    resetLanguageActivationJobStoreForTests();
    resetLanguageActivationJobSchedulerForTests();
    setThinGeminiProviderStateForceMemoryForTests(true);
    resetThinGeminiProviderStateForTests();
    setLanguageActivationJobAdminAssertOverrideForTests(async (userId) => ({
      userId,
      participantId: "participant-admin-f3141",
    }));
  });

  afterEach(() => {
    setLocalizationProviderClockForTests(null);
    setLocalizationProviderPacingIntervalMsForTests(null);
    setLanguageActivationJobProcessDepsForTests(null);
    setLanguageActivationJobAdminAssertOverrideForTests(null);
    resetLanguageActivationJobSchedulerForTests();
    resetThinGeminiProviderStateForTests();
    setThinGeminiProviderStateForceMemoryForTests(false);
  });

  function install(input: {
    readonly includePaths?: readonly string[];
    readonly translator: (request: TranslationProviderRequest) => Promise<{
      readonly translatedText: string;
      readonly providerId: "deterministic";
      readonly isPlaceholder: false;
    }>;
  }) {
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: async () => {
        throw new Error("CT/PLP activate must not run before WEB_UI is ready.");
      },
      webUiPreparationDeps: {
        includePaths: input.includePaths,
        now: () => new Date(nowMs).toISOString(),
        loadLiveTerminology: async () => "",
        translator: input.translator,
      },
    });
  }

  async function startBadgeJob(): Promise<string> {
    const record = await createLanguageRegistryRecord({
      locale: "eo",
      englishName: "Esperanto",
      nativeName: "Esperanto",
      textDirection: "ltr",
      fallbackLocale: "en",
      enabled: true,
      contentTranslationEnabled: true,
      searchEnabled: false,
      seoIndexingEnabled: false,
      pwaPersistedReadingEnabled: false,
      uiTranslationStatus: "none",
    });
    const started = await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    assert.ok(started.job);
    return started.job.jobId;
  }

  it("persists one shape failure, leaves the batch unpublished, and yields", async () => {
    const jobId = await startBadgeJob();
    let calls = 0;
    install({
      includePaths: BADGE_KEYS,
      translator: async (request) => {
        calls += 1;
        return echoPayload(request, "four");
      },
    });
    const job = await processLanguageActivationJob(jobId, { webUiTick: true });
    assert.equal(calls, 1);
    assert.equal(job.status, "running");
    assert.equal(job.domains.webUi.providerFailure, false);
    assert.equal(job.domains.webUi.preparationPhase, "structure_retry");
    assert.equal(job.domains.webUi.completedBatches, 0);
    assert.match(job.domains.webUi.detail ?? "", /Automatic retry scheduled/);
    assert.doesNotMatch(job.domains.webUi.detail ?? "", /rate limit/i);
    assert.doesNotMatch(job.domains.webUi.detail ?? "", /retry activation/i);
    const checkpoint = await getWebUiActivationCheckpointByJobId(jobId);
    assert.equal(checkpoint?.phase, "structure_retry");
    assert.equal(checkpoint?.providerShapeVersion, WEB_UI_PROVIDER_SHAPE_VERSION);
    assert.equal(checkpoint?.providerShapeFailureCount, 1);
    assert.ok(checkpoint?.nextAttemptAt);
    const batches = await listWebUiActivationBatches(checkpoint!.checkpointId, "primary");
    const open = batches.find((row) => row.status !== "ok");
    assert.ok(open);
    assert.equal(open.status, "pending");
    assert.deepEqual(open.values, {});
    assert.equal(await getPublishedWebUiMessagePackByLocale("eo"), null);
    const snapshot = getWebUiActivationSchedulerSnapshotForTests(jobId);
    assert.equal(snapshot.delayedPending, true);
    assert.equal(calls, 1);
  });

  it("does not count a pacing wait or a transient provider failure as shape variance", async () => {
    setLocalizationProviderPacingIntervalMsForTests(10_000);
    const jobId = await startBadgeJob();
    let mode: "four" | "correct" = "four";
    let calls = 0;
    install({
      includePaths: BADGE_KEYS,
      translator: (request) =>
        runLocalizationProviderRequest(async () => {
          calls += 1;
          return echoPayload(request, mode);
        }),
    });
    let job = await processLanguageActivationJob(jobId, { webUiTick: true });
    assert.equal(calls, 1);
    assert.equal(job.domains.webUi.preparationPhase, "structure_retry");
    let checkpoint = await getWebUiActivationCheckpointByJobId(jobId);
    assert.equal(checkpoint?.providerShapeFailureCount, 1);
    await upsertWebUiActivationCheckpoint({
      ...checkpoint!,
      nextAttemptAt: new Date(nowMs - 1_000).toISOString(),
    });
    resetLanguageActivationJobSchedulerForTests();
    job = await processLanguageActivationJob(jobId, { webUiTick: true });
    assert.equal(calls, 1);
    checkpoint = await getWebUiActivationCheckpointByJobId(jobId);
    assert.equal(checkpoint?.providerShapeFailureCount, 1);
    assert.equal(checkpoint?.phase, "structure_retry");
    assert.equal(job.domains.webUi.providerFailure, false);
    assert.equal(job.status, "running");

    nowMs += 120_000;
    mode = "correct";
    resetLanguageActivationJobSchedulerForTests();
    job = await processLanguageActivationJob(jobId, { webUiTick: true });
    assert.equal(calls, 2);
    assert.equal(job.domains.webUi.completedBatches, 1);
    assert.equal(job.domains.webUi.providerFailure, false);
    checkpoint = await getWebUiActivationCheckpointByJobId(jobId);
    const done = await getWebUiActivationBatch({
      checkpointId: checkpoint!.checkpointId,
      batchId: checkpoint ? (await listWebUiActivationBatches(checkpoint.checkpointId, "primary"))[0]?.batchId ?? "" : "",
      phase: "primary",
    });
    const batches = await listWebUiActivationBatches(checkpoint!.checkpointId, "primary");
    const row = batches[0];
    assert.equal(row?.status, "ok");
    assert.match(row?.values["membershipPublic.badgeProduct.membersOnly"] ?? "", /\{siteName\}/);
    assert.match(row?.values["membershipPublic.badgeProduct.productName"] ?? "", /\{siteName\}/);
    assert.equal(
      (row?.values["membershipPublic.badgeProduct.membersOnly"] ?? "").includes(
        "__HU_BRAND_SITE_NAME__",
      ),
      false,
    );
    assert.equal(done?.status, "ok");
    assert.ok(checkpoint?.nextAttemptAt);
    assert.equal(job.domains.ct.enqueueAttempted, false);
    assert.equal(job.domains.plp.enqueueAttempted, false);
    assert.equal(
      isLanguageActivationWebUiReadyForHistoricalEnqueue({
        webUi: job.domains.webUi,
        publicWebUiDataReady: false,
        participantWebUiDataReady: false,
      }),
      false,
    );
  });

  it("keeps an HTTP rate limit off the provider-shape counter", async () => {
    const jobId = await startBadgeJob();
    install({
      includePaths: BADGE_KEYS,
      translator: async () => {
        throw new TranslationProviderError("rate_limited", "HTTP 429");
      },
    });
    const job = await processLanguageActivationJob(jobId, { webUiTick: true });
    assert.equal(job.domains.webUi.preparationPhase, "provider_cooldown");
    assert.equal(job.domains.webUi.providerFailure, false);
    assert.equal(job.domains.webUi.lastTransientFailure, "rate_limited");
    assert.equal(job.status, "running");
    const checkpoint = await getWebUiActivationCheckpointByJobId(jobId);
    assert.equal(checkpoint?.providerShapeFailureCount ?? 0, 0);
    assert.equal(checkpoint?.phase, "provider_cooldown");
  });

  it("blocks after the same-version bound without failing the activation", async () => {
    const jobId = await startBadgeJob();
    let calls = 0;
    let mode: "string" | "four" = "string";
    install({
      includePaths: BADGE_KEYS,
      translator: async (request) => {
        calls += 1;
        return echoPayload(request, mode);
      },
    });
    let job = await processLanguageActivationJob(jobId, { webUiTick: true });
    assert.equal(calls, 1);
    assert.equal(job.domains.webUi.preparationPhase, "structure_retry");
    mode = "four";
    while (job.domains.webUi.preparationPhase !== "structure_blocked" && calls < 8) {
      const waiting = await getWebUiActivationCheckpointByJobId(jobId);
      nowMs = Date.parse(waiting?.nextAttemptAt ?? "") + 1_000;
      resetLanguageActivationJobSchedulerForTests();
      job = await processLanguageActivationJob(jobId, { webUiTick: true });
    }
    assert.equal(calls, WEB_UI_PROVIDER_SHAPE_STRUCTURE_FAILURE_BOUND);
    assert.equal(job.status, "running");
    assert.notEqual(job.status, "failed");
    assert.equal(job.domains.webUi.preparationPhase, "structure_blocked");
    assert.equal(job.domains.webUi.providerFailure, false);
    assert.equal(job.domains.webUi.nextAttemptAt ?? null, null);
    assert.equal(job.domains.webUi.detail, WEB_UI_STRUCTURE_BLOCKED_DETAIL);
    assert.doesNotMatch(job.domains.webUi.detail ?? "", /rate limit/i);
    assert.doesNotMatch(job.domains.webUi.detail ?? "", /retry activation/i);
    const checkpoint = await getWebUiActivationCheckpointByJobId(jobId);
    assert.equal(checkpoint?.phase, "structure_blocked");
    assert.equal(checkpoint?.nextAttemptAt ?? null, null);
    assert.equal(checkpoint?.providerShapeFailureCount, WEB_UI_PROVIDER_SHAPE_STRUCTURE_FAILURE_BOUND);
    const batches = await listWebUiActivationBatches(checkpoint!.checkpointId, "primary");
    assert.equal(batches[0]?.status, "pending");
    assert.deepEqual(batches[0]?.values, {});
    assert.equal(await getPublishedWebUiMessagePackByLocale("eo"), null);
    const callsAtBlock = calls;
    job = await processLanguageActivationJob(jobId, { webUiTick: true });
    assert.equal(calls, callsAtBlock);
    assert.equal(job.domains.webUi.preparationPhase, "structure_blocked");
    assert.equal(
      isLanguageActivationWebUiReadyForHistoricalEnqueue({
        webUi: job.domains.webUi,
        publicWebUiDataReady: false,
        participantWebUiDataReady: false,
      }),
      false,
    );
  });

  async function seedGenerationSix(input: {
    readonly record: LanguageRegistryRecord;
    readonly sourceHash: string;
    readonly batchCount: number;
    readonly openReason: string;
    readonly leafCount: number;
    readonly plan: ReturnType<typeof planWebUiDraftBatches>;
  }) {
    const stamp = new Date(nowMs).toISOString();
    const jobId = "lang-act-eo-6-f3141";
    const checkpointId = "webui-act-lang-act-eo-6-f3141";
    const open = input.plan[405];
    assert.ok(open);
    for (let index = 0; index < 405; index += 1) {
      const batch = input.plan[index];
      assert.ok(batch);
      const values: Record<string, string> = {};
      for (const key of batch.keys) {
        values[key] = index === 0 ? `kept:${key}` : "ok";
      }
      await upsertWebUiActivationBatch({
        checkpointId,
        batchId: batch.id,
        phase: "primary",
        namespace: batch.namespace,
        keys: batch.keys,
        values,
        status: "ok",
        attempts: 1,
        reason: null,
        updatedAt: stamp,
      });
    }
    await upsertWebUiActivationBatch({
      checkpointId,
      batchId: open.id,
      phase: "primary",
      namespace: open.namespace,
      keys: open.keys,
      values: {},
      status: "failed",
      attempts: 2,
      reason: input.openReason,
      updatedAt: stamp,
    });
    await upsertWebUiActivationCheckpoint({
      checkpointId,
      jobId,
      locale: input.record.locale,
      generation: 6,
      sourceHash: input.sourceHash,
      terminologyMode: "live",
      phase: "failed",
      leafCount: input.leafCount,
      batchCount: input.batchCount,
      completedBatchCount: 405,
      failedBatchCount: 2,
      qualityBatchCount: 0,
      qualityCompletedBatchCount: 0,
      suspiciousPathCount: 0,
      englishName: input.record.englishName,
      nativeName: input.record.nativeName,
      textDirection: input.record.textDirection,
      detail: "Public interface translation failed — retry activation",
      createdAt: stamp,
      updatedAt: stamp,
      nextAttemptAt: null,
      transientFailureCount: 0,
      lastTransientFailure: null,
      structureRetryCount: 0,
      providerShapeVersion: 1,
      providerShapeFailureCount: 0,
    });
    const domains = emptyPendingDomains();
    await saveLanguageActivationJob({
      jobId,
      locale: input.record.locale,
      languageId: input.record.languageId,
      generation: 6,
      status: "failed",
      domains: {
        ...domains,
        webUi: {
          ...domains.webUi,
          status: "failed",
          dataReady: false,
          preparationPhase: "failed",
          providerFailure: true,
          checkpointId,
          sourceHash: input.sourceHash,
          totalBatches: input.batchCount,
          completedBatches: 405,
          totalLeaves: input.leafCount,
          detail: "Public interface translation failed — retry activation",
        },
      },
      lastError: "Public interface translation failed — retry activation",
      diagnosticSummary:
        "failed — WEB_UI: Public interface translation failed — retry activation",
      createdAt: stamp,
      updatedAt: stamp,
      startedAt: stamp,
      completedAt: stamp,
      createdByParticipantId: "participant-admin-f3141",
      searchEnabledSnapshot: false,
      seoIndexingEnabledSnapshot: false,
    });
    return { jobId, checkpointId, openBatchId: open.id };
  }

  async function registryEo(): Promise<LanguageRegistryRecord> {
    return createLanguageRegistryRecord({
      locale: "eo",
      englishName: "Esperanto",
      nativeName: "Esperanto",
      textDirection: "ltr",
      fallbackLocale: "en",
      enabled: true,
      contentTranslationEnabled: true,
      searchEnabled: false,
      seoIndexingEnabled: false,
      pwaPersistedReadingEnabled: false,
      uiTranslationStatus: "none",
    });
  }

  it("reopens generation 6 at 405 and advances only the open batch", async () => {
    const corpus = loadPublicWebUiEnglishCorpus();
    const sourceHash = hashWebUiEnglishFlatMap(corpus.flat);
    const plan = planWebUiDraftBatches(corpus.flat);
    assert.equal(plan.length, 702);
    assert.deepEqual(plan[405]?.keys, [...BADGE_KEYS]);
    const preservedIds = plan.slice(0, 405).map((batch) => batch.id);
    const record = await registryEo();
    const seeded = await seedGenerationSix({
      record,
      sourceHash,
      batchCount: plan.length,
      leafCount: corpus.requiredPaths.length,
      openReason: SHAPE_REASON,
      plan,
    });
    let calls = 0;
    setLocalizationProviderPacingIntervalMsForTests(10_000);
    install({
      translator: (request) =>
        runLocalizationProviderRequest(async () => {
          calls += 1;
          const parsed = JSON.parse(request.text) as Record<string, unknown>;
          assert.deepEqual(Object.keys(parsed).sort(), [...BADGE_KEYS].sort());
          const during = await getWebUiActivationCheckpointByJobId(seeded.jobId);
          assert.equal(during?.phase, "primary");
          assert.equal(during?.generation, 6);
          assert.equal(during?.completedBatchCount, 405);
          assert.equal(during?.sourceHash, sourceHash);
          assert.equal(during?.checkpointId, seeded.checkpointId);
          const open = await getWebUiActivationBatch({
            checkpointId: seeded.checkpointId,
            batchId: seeded.openBatchId,
            phase: "primary",
          });
          assert.equal(open?.status, "failed");
          assert.equal(open?.attempts, 2);
          assert.equal(open?.reason, SHAPE_REASON);
          return echoPayload(request, "correct");
        }),
    });
    const scheduled = await resumeIncompleteWebUiActivationJobsOnBoot();
    assert.equal(scheduled.scheduled, 1);
    let completed = 0;
    for (let attempt = 0; attempt < 20 && completed < 406; attempt += 1) {
      await new Promise((resolve) => setImmediate(resolve));
      const current = await getLanguageActivationJobById(seeded.jobId);
      completed = current?.domains.webUi.completedBatches ?? 0;
    }
    resetLanguageActivationJobSchedulerForTests();
    const job = await getLanguageActivationJobById(seeded.jobId);
    assert.ok(job);
    assert.equal(calls, 1);
    assert.equal(completed, 406);
    assert.equal(job.generation, 6);
    assert.equal(job.jobId, seeded.jobId);
    assert.equal(job.status, "running");
    assert.equal(job.domains.webUi.providerFailure, false);
    assert.equal(job.domains.webUi.completedBatches, 406);
    assert.equal(job.domains.webUi.totalBatches, 702);
    assert.equal(job.domains.webUi.sourceHash, sourceHash);
    assert.equal(job.domains.ct.status, "pending");
    assert.equal(job.domains.ct.enqueueAttempted, false);
    assert.equal(job.domains.plp.status, "pending");
    assert.equal(job.domains.plp.enqueueAttempted, false);
    assert.equal(
      isLanguageActivationWebUiReadyForHistoricalEnqueue({
        webUi: job.domains.webUi,
        publicWebUiDataReady: false,
        participantWebUiDataReady: false,
      }),
      false,
    );
    const jobs = await listLanguageActivationJobs();
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0]?.generation, 6);
    const checkpoint = await getWebUiActivationCheckpointByJobId(seeded.jobId);
    assert.equal(checkpoint?.generation, 6);
    assert.equal(checkpoint?.checkpointId, seeded.checkpointId);
    assert.equal(checkpoint?.sourceHash, sourceHash);
    assert.equal(checkpoint?.completedBatchCount, 406);
    assert.equal(checkpoint?.batchCount, 702);
    assert.ok(checkpoint?.nextAttemptAt);
    const batches = await listWebUiActivationBatches(seeded.checkpointId, "primary");
    const byId = new Map(batches.map((row) => [row.batchId, row]));
    for (const batchId of preservedIds) {
      assert.equal(byId.get(batchId)?.status, "ok");
    }
    const first = byId.get(preservedIds[0] ?? "");
    const firstKey = plan[0]?.keys[0] ?? "";
    assert.equal(first?.values[firstKey], `kept:${firstKey}`);
    const open = byId.get(seeded.openBatchId);
    assert.equal(open?.batchId, seeded.openBatchId);
    assert.equal(open?.status, "ok");
    assert.match(open?.values["membershipPublic.badgeProduct.membersOnly"] ?? "", /\{siteName\}/);
    assert.match(open?.values["membershipPublic.badgeProduct.productName"] ?? "", /\{siteName\}/);
    assert.equal(await getPublishedWebUiMessagePackByLocale(record.locale), null);
  });

  it("does not reopen when the source hash, plan, or failure class does not qualify", async () => {
    const corpus = loadPublicWebUiEnglishCorpus();
    const sourceHash = hashWebUiEnglishFlatMap(corpus.flat);
    const plan = planWebUiDraftBatches(corpus.flat);
    const record = await registryEo();
    let calls = 0;
    install({
      translator: async () => {
        calls += 1;
        throw new Error("provider must not be called");
      },
    });

    await seedGenerationSix({
      record,
      sourceHash: "0".repeat(64),
      batchCount: plan.length,
      leafCount: corpus.requiredPaths.length,
      openReason: SHAPE_REASON,
      plan,
    });
    let scheduled = await resumeIncompleteWebUiActivationJobsOnBoot();
    assert.equal(scheduled.scheduled, 0);
    let job = await getLanguageActivationJobById("lang-act-eo-6-f3141");
    assert.equal(job?.status, "failed");
    assert.equal(job?.generation, 6);
    assert.equal(job?.domains.webUi.completedBatches, 405);
    let checkpoint = await getWebUiActivationCheckpointByJobId("lang-act-eo-6-f3141");
    assert.equal(checkpoint?.phase, "failed");
    assert.equal(checkpoint?.sourceHash, "0".repeat(64));

    resetWebUiActivationCheckpointStoreForTests();
    resetLanguageActivationJobStoreForTests();
    resetLanguageActivationJobSchedulerForTests();
    await seedGenerationSix({
      record,
      sourceHash,
      batchCount: plan.length - 1,
      leafCount: corpus.requiredPaths.length,
      openReason: SHAPE_REASON,
      plan,
    });
    scheduled = await resumeIncompleteWebUiActivationJobsOnBoot();
    assert.equal(scheduled.scheduled, 0);
    job = await getLanguageActivationJobById("lang-act-eo-6-f3141");
    assert.equal(job?.status, "failed");
    assert.equal(job?.generation, 6);
    checkpoint = await getWebUiActivationCheckpointByJobId("lang-act-eo-6-f3141");
    assert.equal(checkpoint?.phase, "failed");
    assert.equal(checkpoint?.completedBatchCount, 405);

    resetWebUiActivationCheckpointStoreForTests();
    resetLanguageActivationJobStoreForTests();
    resetLanguageActivationJobSchedulerForTests();
    await seedGenerationSix({
      record,
      sourceHash,
      batchCount: plan.length,
      leafCount: corpus.requiredPaths.length,
      openReason: SOURCE_SENTINEL,
      plan,
    });
    scheduled = await resumeIncompleteWebUiActivationJobsOnBoot();
    assert.equal(scheduled.scheduled, 0);
    job = await getLanguageActivationJobById("lang-act-eo-6-f3141");
    assert.equal(job?.status, "failed");
    assert.equal(job?.generation, 6);
    const jobs = await listLanguageActivationJobs();
    assert.equal(jobs.length, 1);
    assert.equal(calls, 0);
  });
});
