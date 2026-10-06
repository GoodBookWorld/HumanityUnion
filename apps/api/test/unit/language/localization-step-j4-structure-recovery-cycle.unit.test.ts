/**
 * STEP J.4 — one later same-version WEB_UI recovery cycle after structure_blocked.
 * Deterministic translator only. No Gemini.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import type { LanguageRegistryRecord } from "@hu/types";

import { emptyPendingDomains } from "../../../src/modules/language/language-localization-activation/language-activation-job.domains.js";
import { isLanguageActivationWebUiReadyForHistoricalEnqueue } from "../../../src/modules/language/language-localization-activation/language-activation-job.domains.js";
import {
  ensureWebUiPreparationForUnreadyLocale,
  processLanguageActivationJob,
  resetLanguageActivationJobSchedulerForTests,
  resumeIncompleteWebUiActivationJobsOnBoot,
  setLanguageActivationJobAdminAssertOverrideForTests,
  setLanguageActivationJobForceMemoryForTests,
  setLanguageActivationJobProcessDepsForTests,
  startOrResumeLanguageActivationJob,
} from "../../../src/modules/language/language-localization-activation/index.js";
import {
  getLanguageActivationJobById,
  resetLanguageActivationJobStoreForTests,
  saveLanguageActivationJob,
} from "../../../src/modules/language/language-localization-activation/language-activation-job.repository.js";
import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/index.js";
import {
  setLocalizationProviderClockForTests,
  setLocalizationProviderPacingIntervalMsForTests,
} from "../../../src/modules/language/localization-provider-governor.js";
import {
  resetThinGeminiProviderStateForTests,
  setThinGeminiProviderStateForceMemoryForTests,
  tryAcquireLocalizationProviderPacingPermit,
} from "../../../src/modules/language/media-plp-materializer/thin-gemini-provider-state.js";
import type { TranslationProviderRequest } from "../../../src/modules/language/translation-provider.js";
import {
  getWebUiActivationCheckpointByJobId,
  listIncompleteWebUiActivationCheckpoints,
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
import { getPublishedWebUiMessagePackByLocale } from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import {
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import { WebUiMessageStructureError } from "../../../src/modules/web-ui-message-packs/web-ui-message-structure-protect.js";
import {
  incompleteWebUiActivationCheckpointMongoFilter,
  isRecoverableWebUiActivationCheckpoint,
  WEB_UI_PROVIDER_SHAPE_STRUCTURE_FAILURE_BOUND,
  WEB_UI_PROVIDER_SHAPE_VERSION,
  WEB_UI_STRUCTURE_BLOCKED_REASON,
  WEB_UI_STRUCTURE_RECOVERY_BACKOFF_MS,
  WEB_UI_STRUCTURE_RECOVERY_OUTER_MAX_CYCLES,
} from "../../../src/modules/web-ui-message-packs/web-ui-provider-output-structure.js";

function echoArrays(request: TranslationProviderRequest, shorten: boolean) {
  const parsed = JSON.parse(request.text) as Record<string, unknown>;
  const translated: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    assert.ok(Array.isArray(value), key);
    const spans = (value as unknown[]).map((span) => String(span));
    translated[key] = shorten ? spans.slice(0, Math.max(0, spans.length - 1)) : spans;
  }
  return {
    translatedText: JSON.stringify(translated),
    providerId: "deterministic" as const,
    isPlaceholder: false as const,
  };
}

describe("J.4 bounded structure_blocked recovery", () => {
  let nowMs = Date.now();
  let calls = 0;
  let shorten = true;
  let seenKeys: string[] = [];

  beforeEach(async () => {
    nowMs = Date.now();
    calls = 0;
    shorten = true;
    seenKeys = [];
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
      participantId: "participant-admin-j4",
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
    readonly includePaths: readonly string[];
    readonly readProviderCooldown?: () => Promise<{
      readonly active: boolean;
      readonly cooldownUntil: string | null;
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
        readProviderCooldown: input.readProviderCooldown,
        translator: async (request) => {
          calls += 1;
          const parsed = JSON.parse(request.text) as Record<string, unknown>;
          seenKeys = Object.keys(parsed);
          return echoArrays(request, shorten);
        },
      },
    });
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

  async function tick(jobId: string) {
    const job = await processLanguageActivationJob(jobId, { webUiTick: true });
    resetLanguageActivationJobSchedulerForTests();
    return job;
  }

  async function exhaustInner(jobId: string) {
    let job = await getLanguageActivationJobById(jobId);
    assert.ok(job);
    let guard = 0;
    while (job.domains.webUi.preparationPhase !== "structure_blocked" && guard < 8) {
      guard += 1;
      const waiting = await getWebUiActivationCheckpointByJobId(jobId);
      if (waiting?.nextAttemptAt) {
        nowMs = Date.parse(waiting.nextAttemptAt) + 1_000;
      }
      job = await tick(jobId);
    }
    return job;
  }

  it("covers the outer cycle, legacy adoption, and the closed cases", async () => {
    assert.equal(WEB_UI_STRUCTURE_RECOVERY_OUTER_MAX_CYCLES, 2);
    assert.equal(WEB_UI_STRUCTURE_RECOVERY_BACKOFF_MS, 60 * 60 * 1000);
    assert.equal(
      isRecoverableWebUiActivationCheckpoint({
        phase: "structure_blocked",
        providerShapeVersion: WEB_UI_PROVIDER_SHAPE_VERSION,
      }),
      false,
    );
    assert.equal(
      isRecoverableWebUiActivationCheckpoint({
        phase: "structure_blocked",
        providerShapeVersion: WEB_UI_PROVIDER_SHAPE_VERSION,
        providerShapeFailureCount: 6,
      }),
      true,
    );
    assert.equal(
      isRecoverableWebUiActivationCheckpoint({
        phase: "structure_blocked",
        providerShapeVersion: WEB_UI_PROVIDER_SHAPE_VERSION,
        structureRecoveryCycleCount: 2,
      }),
      false,
    );
    assert.equal(
      isRecoverableWebUiActivationCheckpoint({
        phase: "failed",
        providerShapeVersion: WEB_UI_PROVIDER_SHAPE_VERSION,
        providerShapeFailureCount: 6,
      }),
      false,
    );
    assert.equal(
      isRecoverableWebUiActivationCheckpoint({
        phase: "ready",
        providerShapeVersion: WEB_UI_PROVIDER_SHAPE_VERSION,
      }),
      false,
    );
    const filter = JSON.stringify(incompleteWebUiActivationCheckpointMongoFilter());
    assert.match(filter, /structureRecoveryCycleCount/);
    assert.match(filter, /"\$lt":2/);

    const corpus = loadPublicWebUiEnglishCorpus();
    const fullPlan = planWebUiDraftBatches(corpus.flat);
    const first = fullPlan[0];
    const second = fullPlan[1];
    assert.ok(first && second);
    const includePaths = [...first.keys, ...second.keys];
    const subset = loadPublicWebUiEnglishCorpus(includePaths);
    const plan = planWebUiDraftBatches(subset.flat);
    assert.equal(plan.length, 2);
    const sourceHash = hashWebUiEnglishFlatMap(subset.flat);
    const record = await registryEo();
    install({ includePaths });

    shorten = false;
    const started = await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    assert.ok(started.job);
    const jobId = started.job.jobId;
    const generation = started.job.generation;
    let job = await tick(jobId);
    assert.equal(calls, 1);
    assert.equal(job.domains.webUi.completedBatches, 1);
    const checkpointId = job.domains.webUi.checkpointId;
    assert.ok(checkpointId);

    shorten = true;
    const callsAtSecond = calls;
    job = await exhaustInner(jobId);
    assert.equal(job.domains.webUi.preparationPhase, "structure_blocked");
    assert.equal(calls - callsAtSecond, WEB_UI_PROVIDER_SHAPE_STRUCTURE_FAILURE_BOUND);
    const blocked = await getWebUiActivationCheckpointByJobId(jobId);
    assert.equal(blocked?.checkpointId, checkpointId);
    assert.equal(blocked?.generation, generation);
    assert.equal(blocked?.preparationContract, "partial_reuse_v1");
    assert.equal(blocked?.structureRecoveryCycleCount, 1);
    assert.equal(blocked?.structureRecoveryBlockedBatchId, second.id);
    assert.equal(blocked?.providerShapeVersion, WEB_UI_PROVIDER_SHAPE_VERSION);
    assert.equal(blocked?.providerShapeFailureCount, 6);
    const firstWake = Date.parse(blocked?.nextAttemptAt ?? "");
    assert.equal(firstWake - nowMs, WEB_UI_STRUCTURE_RECOVERY_BACKOFF_MS);
    assert.equal(await getPublishedWebUiMessagePackByLocale("eo"), null);
    assert.equal(
      isLanguageActivationWebUiReadyForHistoricalEnqueue({
        webUi: job.domains.webUi,
        publicWebUiDataReady: false,
        participantWebUiDataReady: false,
      }),
      false,
    );

    const callsAtWait = calls;
    job = await tick(jobId);
    assert.equal(calls, callsAtWait);
    const stillWaiting = await getWebUiActivationCheckpointByJobId(jobId);
    assert.equal(stillWaiting?.phase, "structure_blocked");
    assert.equal(stillWaiting?.structureRecoveryCycleCount, 1);
    assert.equal(stillWaiting?.providerShapeFailureCount, 6);
    assert.equal(stillWaiting?.nextAttemptAt, blocked?.nextAttemptAt);
    assert.equal(stillWaiting?.checkpointId, checkpointId);
    assert.equal((await getLanguageActivationJobById(jobId))?.generation, generation);

    const bootWaiting = await resumeIncompleteWebUiActivationJobsOnBoot();
    assert.equal(bootWaiting.scheduled, 1);
    resetLanguageActivationJobSchedulerForTests();
    assert.equal(calls, callsAtWait);

    const ensured = await ensureWebUiPreparationForUnreadyLocale({
      locale: "eo",
      scheduleProcess: true,
    });
    assert.equal(ensured.action, "reused");
    assert.equal(ensured.jobId, jobId);
    assert.equal(ensured.generation, generation);
    assert.equal(
      (await getWebUiActivationCheckpointByJobId(jobId))?.nextAttemptAt,
      blocked?.nextAttemptAt,
    );
    assert.equal(calls, callsAtWait);

    for (let extra = 0; extra < 3; extra += 1) {
      await tick(jobId);
    }
    assert.equal(calls, callsAtWait);
    assert.equal(
      (await getWebUiActivationCheckpointByJobId(jobId))?.nextAttemptAt,
      blocked?.nextAttemptAt,
    );

    const keptBefore = await listWebUiActivationBatches(checkpointId, "primary");
    const keptRow = keptBefore.find((row) => row.batchId === first.id);
    assert.equal(keptRow?.status, "ok");
    const keptValue = keptRow?.values[first.keys[0] ?? ""];
    await upsertWebUiActivationBatch({
      ...keptRow!,
      preparationProvenance: "REUSED_EXISTING_VALID",
      reusedKeyCount: first.keys.length,
      providerKeyCount: 0,
    });

    nowMs = firstWake + 1_000;
    shorten = false;
    seenKeys = [];
    job = await tick(jobId);
    assert.equal(calls, callsAtWait + 1);
    assert.ok(seenKeys.includes(second.keys[0] ?? ""));
    assert.equal(seenKeys.includes(first.keys[0] ?? ""), false);
    const recovered = await getWebUiActivationCheckpointByJobId(jobId);
    assert.equal(recovered?.checkpointId, checkpointId);
    assert.equal(recovered?.structureRecoveryCycleCount, 0);
    assert.equal(recovered?.structureRecoveryBlockedBatchId ?? null, null);
    assert.equal(recovered?.providerShapeFailureCount, 0);
    assert.equal(recovered?.preparationContract, "partial_reuse_v1");
    assert.notEqual(recovered?.phase, "structure_blocked");
    const after = await listWebUiActivationBatches(checkpointId, "primary");
    const keptAfter = after.find((row) => row.batchId === first.id);
    const opened = after.find((row) => row.batchId === second.id);
    assert.equal(keptAfter?.status, "ok");
    assert.equal(keptAfter?.values[first.keys[0] ?? ""], keptValue);
    assert.equal(keptAfter?.preparationProvenance, "REUSED_EXISTING_VALID");
    assert.equal(opened?.status, "ok");
  });

  it("terminates the same streak on the second exhaustion", async () => {
    const corpus = loadPublicWebUiEnglishCorpus();
    const fullPlan = planWebUiDraftBatches(corpus.flat);
    const first = fullPlan[0];
    const second = fullPlan[1];
    assert.ok(first && second);
    const includePaths = [...first.keys, ...second.keys];
    const subset = loadPublicWebUiEnglishCorpus(includePaths);
    const sourceHash = hashWebUiEnglishFlatMap(subset.flat);
    const record = await registryEo();
    install({ includePaths });
    const stamp = new Date(nowMs).toISOString();
    const jobId = "lang-act-eo-j4-terminal";
    const checkpointId = "webui-act-j4-terminal";
    const values: Record<string, string> = {};
    for (const key of first.keys) {
      values[key] = "kept";
    }
    await upsertWebUiActivationBatch({
      checkpointId,
      batchId: first.id,
      phase: "primary",
      namespace: first.namespace,
      keys: first.keys,
      values,
      status: "ok",
      attempts: 1,
      reason: null,
      preparationProvenance: "PROVIDER_GENERATED",
      reusedKeyCount: 0,
      providerKeyCount: first.keys.length,
      updatedAt: stamp,
    });
    await upsertWebUiActivationBatch({
      checkpointId,
      batchId: second.id,
      phase: "primary",
      namespace: second.namespace,
      keys: second.keys,
      values: {},
      status: "pending",
      attempts: 1,
      reason: WEB_UI_STRUCTURE_BLOCKED_REASON,
      updatedAt: stamp,
    });
    await upsertWebUiActivationCheckpoint({
      checkpointId,
      jobId,
      locale: "eo",
      generation: 4,
      sourceHash,
      terminologyMode: "live",
      phase: "structure_blocked",
      leafCount: subset.requiredPaths.length,
      batchCount: 2,
      completedBatchCount: 1,
      failedBatchCount: 0,
      qualityBatchCount: 0,
      qualityCompletedBatchCount: 0,
      suspiciousPathCount: 0,
      englishName: "Esperanto",
      nativeName: "Esperanto",
      textDirection: "ltr",
      detail: "Automatic translation is blocked by a structural defect.",
      createdAt: stamp,
      updatedAt: stamp,
      nextAttemptAt: new Date(nowMs - 1_000).toISOString(),
      structureRetryCount: 6,
      providerShapeVersion: WEB_UI_PROVIDER_SHAPE_VERSION,
      providerShapeFailureCount: 6,
      structureRecoveryCycleCount: 1,
      structureRecoveryBlockedBatchId: second.id,
      preparationContract: "partial_reuse_v1",
    });
    const domains = emptyPendingDomains();
    await saveLanguageActivationJob({
      jobId,
      locale: "eo",
      languageId: record.languageId,
      generation: 4,
      status: "running",
      domains: {
        ...domains,
        webUi: {
          ...domains.webUi,
          status: "in_progress",
          dataReady: false,
          preparationPhase: "structure_blocked",
          checkpointId,
          sourceHash,
          totalBatches: 2,
          completedBatches: 1,
          providerFailure: false,
          nextAttemptAt: new Date(nowMs - 1_000).toISOString(),
        },
      },
      lastError: null,
      diagnosticSummary: "running",
      createdAt: stamp,
      updatedAt: stamp,
      startedAt: stamp,
      completedAt: null,
      createdByParticipantId: "participant-admin-j4",
      searchEnabledSnapshot: false,
      seoIndexingEnabledSnapshot: false,
    });

    await tick(jobId);
    const job = await exhaustInner(jobId);
    assert.equal(calls, WEB_UI_PROVIDER_SHAPE_STRUCTURE_FAILURE_BOUND);
    assert.equal(job.domains.webUi.preparationPhase, "structure_blocked");
    assert.equal(job.generation, 4);
    const terminal = await getWebUiActivationCheckpointByJobId(jobId);
    assert.equal(terminal?.checkpointId, checkpointId);
    assert.equal(terminal?.structureRecoveryCycleCount, 2);
    assert.equal(terminal?.nextAttemptAt ?? null, null);
    assert.equal(terminal?.structureRecoveryBlockedBatchId, second.id);
    const kept = (await listWebUiActivationBatches(checkpointId, "primary")).find(
      (row) => row.batchId === first.id,
    );
    assert.equal(kept?.status, "ok");
    assert.equal(kept?.values[first.keys[0] ?? ""], "kept");

    const callsAtTerminal = calls;
    await tick(jobId);
    assert.equal(calls, callsAtTerminal);
    const listed = await listIncompleteWebUiActivationCheckpoints();
    assert.equal(listed.some((row) => row.checkpointId === checkpointId), false);
    const boot = await resumeIncompleteWebUiActivationJobsOnBoot();
    resetLanguageActivationJobSchedulerForTests();
    assert.equal(boot.scheduled, 0);
    const ensured = await ensureWebUiPreparationForUnreadyLocale({
      locale: "eo",
      scheduleProcess: true,
    });
    assert.equal(ensured.jobId, jobId);
    assert.equal(ensured.generation, 4);
    assert.notEqual(ensured.action, "created");
    assert.equal(calls, callsAtTerminal);
    assert.equal(await getPublishedWebUiMessagePackByLocale("eo"), null);
  });

  it("adopts a legacy exhausted checkpoint as cycle 1 and does not touch ready work", async () => {
    const corpus = loadPublicWebUiEnglishCorpus();
    const fullPlan = planWebUiDraftBatches(corpus.flat);
    const first = fullPlan[0];
    const second = fullPlan[1];
    assert.ok(first && second);
    const includePaths = [...first.keys, ...second.keys];
    const subset = loadPublicWebUiEnglishCorpus(includePaths);
    const sourceHash = hashWebUiEnglishFlatMap(subset.flat);
    const record = await registryEo();
    install({ includePaths });
    const stamp = new Date(nowMs).toISOString();
    const jobId = "lang-act-he-style-j4";
    const checkpointId = "webui-act-he-style-j4";
    const values: Record<string, string> = {};
    for (const key of first.keys) {
      values[key] = "kept-legacy";
    }
    await upsertWebUiActivationBatch({
      checkpointId,
      batchId: first.id,
      phase: "primary",
      namespace: first.namespace,
      keys: first.keys,
      values,
      status: "ok",
      attempts: 1,
      reason: null,
      preparationProvenance: "PROVIDER_GENERATED",
      reusedKeyCount: 0,
      providerKeyCount: first.keys.length,
      updatedAt: stamp,
    });
    await upsertWebUiActivationBatch({
      checkpointId,
      batchId: second.id,
      phase: "primary",
      namespace: second.namespace,
      keys: second.keys,
      values: {},
      status: "pending",
      attempts: 1,
      reason: WEB_UI_STRUCTURE_BLOCKED_REASON,
      updatedAt: stamp,
    });
    await upsertWebUiActivationCheckpoint({
      checkpointId,
      jobId,
      locale: "eo",
      generation: 1,
      sourceHash,
      terminologyMode: "live",
      phase: "structure_blocked",
      leafCount: subset.requiredPaths.length,
      batchCount: 2,
      completedBatchCount: 1,
      failedBatchCount: 0,
      qualityBatchCount: 0,
      qualityCompletedBatchCount: 0,
      suspiciousPathCount: 0,
      englishName: "Esperanto",
      nativeName: "Esperanto",
      textDirection: "ltr",
      detail: "Automatic translation is blocked by a structural defect.",
      createdAt: stamp,
      updatedAt: stamp,
      nextAttemptAt: null,
      structureRetryCount: 6,
      providerShapeVersion: WEB_UI_PROVIDER_SHAPE_VERSION,
      providerShapeFailureCount: 6,
      preparationContract: "partial_reuse_v1",
    });
    const domains = emptyPendingDomains();
    await saveLanguageActivationJob({
      jobId,
      locale: "eo",
      languageId: record.languageId,
      generation: 1,
      status: "running",
      domains: {
        ...domains,
        webUi: {
          ...domains.webUi,
          status: "in_progress",
          dataReady: false,
          preparationPhase: "structure_blocked",
          checkpointId,
          sourceHash,
          totalBatches: 2,
          completedBatches: 1,
          providerFailure: false,
        },
      },
      lastError: null,
      diagnosticSummary: "running",
      createdAt: stamp,
      updatedAt: stamp,
      startedAt: stamp,
      completedAt: null,
      createdByParticipantId: "participant-admin-j4",
      searchEnabledSnapshot: false,
      seoIndexingEnabledSnapshot: false,
    });

    const listed = await listIncompleteWebUiActivationCheckpoints();
    assert.equal(listed.some((row) => row.checkpointId === checkpointId), true);
    const job = await tick(jobId);
    assert.equal(calls, 0);
    assert.equal(job.generation, 1);
    assert.equal(job.domains.webUi.preparationPhase, "structure_blocked");
    const adopted = await getWebUiActivationCheckpointByJobId(jobId);
    assert.equal(adopted?.checkpointId, checkpointId);
    assert.equal(adopted?.structureRecoveryCycleCount, 1);
    assert.equal(adopted?.structureRecoveryBlockedBatchId, second.id);
    assert.equal(adopted?.providerShapeFailureCount, 6);
    assert.equal(
      Date.parse(adopted?.nextAttemptAt ?? "") - nowMs,
      WEB_UI_STRUCTURE_RECOVERY_BACKOFF_MS,
    );
    const kept = (await listWebUiActivationBatches(checkpointId, "primary")).find(
      (row) => row.batchId === first.id,
    );
    assert.equal(kept?.values[first.keys[0] ?? ""], "kept-legacy");

    const pastDue = new Date(Date.now() - 1_000).toISOString();
    nowMs = Date.now();
    shorten = false;
    await upsertWebUiActivationCheckpoint({
      ...adopted!,
      nextAttemptAt: pastDue,
    });
    const dueBoot = await resumeIncompleteWebUiActivationJobsOnBoot();
    assert.equal(dueBoot.scheduled, 1);
    for (let attempt = 0; attempt < 10 && calls < 1; attempt += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    resetLanguageActivationJobSchedulerForTests();
    assert.equal(calls, 1);
    const resumed = await getWebUiActivationCheckpointByJobId(jobId);
    assert.equal(resumed?.checkpointId, checkpointId);
    assert.notEqual(resumed?.phase, "structure_blocked");

    await upsertWebUiActivationCheckpoint({
      checkpointId: "webui-ready-ar-style",
      jobId: "lang-act-ar-style-j4",
      locale: "eo",
      generation: 1,
      sourceHash,
      terminologyMode: "live",
      phase: "ready",
      leafCount: 1,
      batchCount: 1,
      completedBatchCount: 1,
      failedBatchCount: 0,
      qualityBatchCount: 0,
      qualityCompletedBatchCount: 0,
      suspiciousPathCount: 0,
      englishName: "Esperanto",
      nativeName: "Esperanto",
      textDirection: "ltr",
      detail: "Public interface ready",
      createdAt: stamp,
      updatedAt: stamp,
      providerShapeVersion: WEB_UI_PROVIDER_SHAPE_VERSION,
    });
    const afterReady = await listIncompleteWebUiActivationCheckpoints();
    assert.equal(
      afterReady.some((row) => row.checkpointId === "webui-ready-ar-style"),
      false,
    );
  });

  it("defers a due recovery for Gate E and provider pacing without counting a failure", async () => {
    const corpus = loadPublicWebUiEnglishCorpus();
    const batch = planWebUiDraftBatches(corpus.flat)[0];
    assert.ok(batch);
    const subset = loadPublicWebUiEnglishCorpus(batch.keys);
    const sourceHash = hashWebUiEnglishFlatMap(subset.flat);
    const record = await registryEo();
    const cooldownUntil = new Date(nowMs + 2 * 60 * 60 * 1000).toISOString();
    install({
      includePaths: batch.keys,
      readProviderCooldown: async () => ({ active: true, cooldownUntil }),
    });
    const stamp = new Date(nowMs).toISOString();
    const jobId = "lang-act-eo-j4-governor";
    const checkpointId = "webui-act-j4-governor";
    await upsertWebUiActivationBatch({
      checkpointId,
      batchId: batch.id,
      phase: "primary",
      namespace: batch.namespace,
      keys: batch.keys,
      values: {},
      status: "pending",
      attempts: 1,
      reason: WEB_UI_STRUCTURE_BLOCKED_REASON,
      updatedAt: stamp,
    });
    await upsertWebUiActivationCheckpoint({
      checkpointId,
      jobId,
      locale: "eo",
      generation: 2,
      sourceHash,
      terminologyMode: "live",
      phase: "structure_blocked",
      leafCount: subset.requiredPaths.length,
      batchCount: 1,
      completedBatchCount: 0,
      failedBatchCount: 0,
      qualityBatchCount: 0,
      qualityCompletedBatchCount: 0,
      suspiciousPathCount: 0,
      englishName: "Esperanto",
      nativeName: "Esperanto",
      textDirection: "ltr",
      detail: "Automatic translation is blocked by a structural defect.",
      createdAt: stamp,
      updatedAt: stamp,
      nextAttemptAt: new Date(nowMs - 1_000).toISOString(),
      structureRetryCount: 6,
      providerShapeVersion: WEB_UI_PROVIDER_SHAPE_VERSION,
      providerShapeFailureCount: 6,
      structureRecoveryCycleCount: 1,
      structureRecoveryBlockedBatchId: batch.id,
    });
    const domains = emptyPendingDomains();
    await saveLanguageActivationJob({
      jobId,
      locale: "eo",
      languageId: record.languageId,
      generation: 2,
      status: "running",
      domains: {
        ...domains,
        webUi: {
          ...domains.webUi,
          status: "in_progress",
          dataReady: false,
          preparationPhase: "structure_blocked",
          checkpointId,
          sourceHash,
          providerFailure: false,
          nextAttemptAt: new Date(nowMs - 1_000).toISOString(),
        },
      },
      lastError: null,
      diagnosticSummary: "running",
      createdAt: stamp,
      updatedAt: stamp,
      startedAt: stamp,
      completedAt: null,
      createdByParticipantId: "participant-admin-j4",
      searchEnabledSnapshot: false,
      seoIndexingEnabledSnapshot: false,
    });

    await tick(jobId);
    assert.equal(calls, 0);
    const cooled = await getWebUiActivationCheckpointByJobId(jobId);
    assert.equal(cooled?.phase, "structure_blocked");
    assert.equal(cooled?.structureRecoveryCycleCount, 1);
    assert.equal(cooled?.providerShapeFailureCount, 6);
    assert.equal(cooled?.nextAttemptAt, cooldownUntil);

    install({ includePaths: batch.keys });
    setLocalizationProviderPacingIntervalMsForTests(60_000);
    const permit = await tryAcquireLocalizationProviderPacingPermit({
      nowMs,
      intervalMs: 60_000,
    });
    assert.equal(permit.acquired, true);
    await upsertWebUiActivationCheckpoint({
      ...cooled!,
      nextAttemptAt: new Date(nowMs - 1_000).toISOString(),
    });
    await tick(jobId);
    assert.equal(calls, 0);
    const paced = await getWebUiActivationCheckpointByJobId(jobId);
    assert.equal(paced?.phase, "structure_blocked");
    assert.equal(paced?.structureRecoveryCycleCount, 1);
    assert.equal(paced?.providerShapeFailureCount, 6);
    assert.equal(paced?.nextAttemptAt, permit.nextAllowedAt);
  });

  it("keeps a deterministic source defect out of outer recovery", async () => {
    const corpus = loadPublicWebUiEnglishCorpus();
    const batch = planWebUiDraftBatches(corpus.flat)[0];
    assert.ok(batch);
    const record = await registryEo();
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: async () => {
        throw new Error("CT/PLP activate must not run.");
      },
      webUiPreparationDeps: {
        includePaths: batch.keys,
        now: () => new Date(nowMs).toISOString(),
        loadLiveTerminology: async () => "",
        translator: async () => {
          calls += 1;
          throw new WebUiMessageStructureError(
            "English source already contains a protection sentinel.",
          );
        },
      },
    });
    const started = await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    assert.ok(started.job);
    const job = await tick(started.job.jobId);
    assert.equal(job.status, "failed");
    assert.equal(job.domains.webUi.preparationPhase, "failed");
    const checkpoint = await getWebUiActivationCheckpointByJobId(started.job.jobId);
    assert.equal(checkpoint?.phase, "failed");
    assert.equal(checkpoint?.structureRecoveryCycleCount ?? null, null);
    assert.equal(checkpoint?.nextAttemptAt ?? null, null);
    const listed = await listIncompleteWebUiActivationCheckpoints();
    assert.equal(listed.some((row) => row.checkpointId === checkpoint?.checkpointId), false);
  });
});
