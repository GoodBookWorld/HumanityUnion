/**
 * Step 15C.7 — resume failed WEB_UI checkpoint + missing-key recovery.
 * Deterministic provider only. No Gemini. No staging writes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/index.js";
import {
  getContentTranslationWorkerPeakConcurrencyForTests,
  resetContentTranslationWorkerConcurrencyForTests,
} from "../../../src/modules/language/content-translation-worker-concurrency.js";
import {
  getLanguageActivationAdminView,
  processLanguageActivationJob,
  resetLanguageActivationJobSchedulerForTests,
  resetLanguageActivationJobStoreForTests,
  setLanguageActivationJobAdminAssertOverrideForTests,
  setLanguageActivationJobForceMemoryForTests,
  setLanguageActivationJobProcessDepsForTests,
  startOrResumeLanguageActivationJob,
} from "../../../src/modules/language/language-localization-activation/index.js";
import { getLanguageActivationJobById, saveLanguageActivationJob } from "../../../src/modules/language/language-localization-activation/language-activation-job.repository.js";
import type {
  TranslationProviderRequest,
  TranslationProviderResult,
} from "../../../src/modules/language/translation-provider.js";
import {
  getPublishedWebUiMessagePackByLocale,
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
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
  sanitizeWebUiActivationFailureDetail,
  translateWebUiProviderBatch,
  WebUiDraftBatchError,
} from "../../../src/modules/web-ui-message-packs/web-ui-draft-builder.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../../../../web/src");

const INCLUDE_PATHS = loadPublicWebUiEnglishCorpus().requiredPaths.slice(0, 24);
const TWO_BATCH_PATHS = INCLUDE_PATHS.slice(0, 12);

function translateAll(request: TranslationProviderRequest): TranslationProviderResult {
  const parsed = JSON.parse(request.text) as Record<string, string>;
  return {
    translatedText: JSON.stringify(
      Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, `[xx] ${value}`])),
    ),
    providerId: "deterministic",
    isPlaceholder: false,
  };
}

function activateNoOp() {
  return async (input: { locale: string }) => {
    const { evaluateLanguageLocalizationReadiness } = await import(
      "../../../src/modules/language/language-localization-activation/language-localization-readiness-evaluator.js"
    );
    const readiness = await evaluateLanguageLocalizationReadiness({
      locale: input.locale,
      skipCorpusPlan: true,
    });
    return {
      pack: "closure07" as const,
      locale: input.locale,
      mode: "execute" as const,
      readiness,
      plan: {
        pack: "closure07" as const,
        locale: input.locale,
        mode: "execute" as const,
        registryEligible: true,
        items: [],
        excluded: [],
        summary: { ctWorkItems: 0, plpWorkItems: 0, skippedCurrent: 0 },
        PROVIDER_CALLS: 0 as const,
        WRITES_PERFORMED: 0 as const,
      },
      execute: {
        attempted: true,
        ctKindsEnqueued: 0,
        plpEditorialEnqueued: false,
        notes: [],
      },
      PROVIDER_CALLS: 0 as const,
      WRITES_PERFORMED: 0 as const,
      seoIndexingEnabledUnchanged: true,
    };
  };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

describe("Step 15C.7 — durable WEB_UI resume + missing-key recovery", () => {
  beforeEach(async () => {
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
    resetContentTranslationWorkerConcurrencyForTests();
    setLanguageActivationJobAdminAssertOverrideForTests(async (userId) => ({
      userId,
      participantId: "participant-admin-15c7",
    }));
  });

  afterEach(() => {
    setLanguageActivationJobProcessDepsForTests(null);
    setLanguageActivationJobAdminAssertOverrideForTests(null);
    resetLanguageActivationJobSchedulerForTests();
    resetContentTranslationWorkerConcurrencyForTests();
  });

  async function createQueuedJob(locale: string) {
    const record = await createLanguageRegistryRecord({
      locale,
      englishName: `Test ${locale}`,
      nativeName: locale,
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
    return { record, job: started.job };
  }

  it("1–10 failed compatible checkpoint resumes the same job and first non-ok batch", async () => {
    const { record, job } = await createQueuedJob("eo");
    const corpus = loadPublicWebUiEnglishCorpus(TWO_BATCH_PATHS);
    const plans = planWebUiDraftBatches(corpus.flat);
    assert.ok(plans.length >= 2);
    const sourceHash = hashWebUiEnglishFlatMap(corpus.flat);

    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: activateNoOp(),
      webUiPreparationDeps: {
        includePaths: TWO_BATCH_PATHS,
        loadLiveTerminology: async () => "LIVE",
        translator: async (request) => translateAll(request),
      },
    });

    await processLanguageActivationJob(job.jobId, { webUiTick: true });
    let checkpoint = await getWebUiActivationCheckpointByJobId(job.jobId);
    assert.ok(checkpoint);
    const firstBatch = plans[0]!;
    const okBatch = await getWebUiActivationBatch({
      checkpointId: checkpoint.checkpointId,
      batchId: firstBatch.id,
      phase: "primary",
    });
    assert.equal(okBatch?.status, "ok");

    const second = plans[1]!;
    await upsertWebUiActivationBatch({
      checkpointId: checkpoint.checkpointId,
      batchId: second.id,
      phase: "primary",
      namespace: second.namespace,
      keys: second.keys,
      values: {},
      status: "failed",
      attempts: 2,
      reason: "Provider omitted keys: common.retry",
      updatedAt: new Date().toISOString(),
    });
    checkpoint = {
      ...checkpoint,
      phase: "failed",
      completedBatchCount: 1,
      failedBatchCount: 1,
      sourceHash,
      detail: sanitizeWebUiActivationFailureDetail("Provider omitted keys: common.retry"),
      updatedAt: new Date().toISOString(),
    };
    await upsertWebUiActivationCheckpoint(checkpoint);
    await saveLanguageActivationJob({
      ...job,
      status: "failed",
      domains: {
        ...job.domains,
        webUi: {
          ...job.domains.webUi,
          status: "failed",
          preparationPhase: "failed",
          checkpointId: checkpoint.checkpointId,
          sourceHash,
          completedBatches: 1,
          totalBatches: checkpoint.batchCount,
          providerFailure: true,
          detail: checkpoint.detail,
        },
      },
      lastError: checkpoint.detail,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const translatedKeys: string[][] = [];
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: activateNoOp(),
      webUiPreparationDeps: {
        includePaths: TWO_BATCH_PATHS,
        loadLiveTerminology: async () => "LIVE",
        translator: async (request) => {
          const parsed = JSON.parse(request.text) as Record<string, string>;
          translatedKeys.push(Object.keys(parsed).sort());
          return translateAll(request);
        },
      },
    });

    const resumed = await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    assert.equal(resumed.job?.jobId, job.jobId);
    assert.equal(resumed.job?.status, "running");
    const reopened = await getWebUiActivationCheckpointByJobId(job.jobId);
    assert.ok(reopened);
    assert.equal(reopened.checkpointId, checkpoint.checkpointId);
    assert.equal(reopened.phase, "primary");
    assert.equal(reopened.completedBatchCount, 1);

    const ticked = await processLanguageActivationJob(job.jobId, { webUiTick: true });
    assert.equal(ticked.status, "running");
    assert.equal(translatedKeys.length, 1);
    assert.deepEqual(translatedKeys[0], [...second.keys].sort());
    const firstAfter = await getWebUiActivationBatch({
      checkpointId: checkpoint.checkpointId,
      batchId: firstBatch.id,
      phase: "primary",
    });
    assert.equal(firstAfter?.status, "ok");
    assert.equal(firstAfter?.attempts, 1);
    const secondAfter = await getWebUiActivationBatch({
      checkpointId: checkpoint.checkpointId,
      batchId: second.id,
      phase: "primary",
    });
    assert.equal(secondAfter?.status, "ok");

    const again = await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    assert.equal(again.job?.jobId, job.jobId);
    assert.notEqual(again.job?.status, "failed");
  });

  it("10b sourceHash incompatibility does not merge stale checkpoint work", async () => {
    const { record, job } = await createQueuedJob("nv");
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: activateNoOp(),
      webUiPreparationDeps: {
        includePaths: TWO_BATCH_PATHS,
        loadLiveTerminology: async () => "LIVE",
        translator: async (request) => translateAll(request),
      },
    });
    await processLanguageActivationJob(job.jobId, { webUiTick: true });
    const checkpoint = await getWebUiActivationCheckpointByJobId(job.jobId);
    assert.ok(checkpoint);
    await upsertWebUiActivationCheckpoint({
      ...checkpoint,
      phase: "failed",
      sourceHash: "stale-hash-not-current",
      detail: "Public interface translation failed — retry activation",
      updatedAt: new Date().toISOString(),
    });
    await saveLanguageActivationJob({
      ...(await getLanguageActivationJobById(job.jobId))!,
      status: "failed",
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: activateNoOp(),
      webUiPreparationDeps: {
        includePaths: TWO_BATCH_PATHS,
        loadLiveTerminology: async () => "LIVE",
        translator: async (request) => translateAll(request),
      },
    });
    const restarted = await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    assert.notEqual(restarted.job?.jobId, job.jobId);
    assert.equal(restarted.job?.status, "queued");
    const old = await getWebUiActivationCheckpointByJobId(job.jobId);
    assert.equal(old?.phase, "failed");
    assert.match(old?.detail ?? "", /source catalog changed/i);
  });

  it("11–16 missing-key recovery merges, validates, and stays bounded", async () => {
    const corpus = loadPublicWebUiEnglishCorpus(INCLUDE_PATHS.slice(0, 6));
    const keys = Object.keys(corpus.flat).sort();
    assert.ok(keys.length >= 2);
    const omit = keys[keys.length - 1]!;
    let calls = 0;
    const requested: string[][] = [];
    const result = await translateWebUiProviderBatch({
      locale: "eo",
      englishFlat: corpus.flat,
      keys,
      terminologyContext: "LIVE",
      translator: async (request) => {
        calls += 1;
        const parsed = JSON.parse(request.text) as Record<string, string>;
        requested.push(Object.keys(parsed).sort());
        if (calls === 1) {
          const partial = { ...parsed };
          delete partial[omit];
          return {
            translatedText: JSON.stringify(
              Object.fromEntries(
                Object.entries(partial).map(([key, value]) => [key, `[xx] ${value}`]),
              ),
            ),
            providerId: "deterministic",
            isPlaceholder: false,
          };
        }
        return translateAll(request);
      },
    });
    assert.equal(calls, 2);
    assert.equal(result.missingKeyRecoveryAttempted, true);
    assert.equal(result.providerCalls, 2);
    assert.deepEqual(requested[1], [omit]);
    assert.equal(Object.keys(result.values).sort().join("|"), keys.join("|"));
    for (const key of keys) {
      assert.match(result.values[key]!, /^\[xx\] /);
    }

    let failCalls = 0;
    await assert.rejects(
      () =>
        translateWebUiProviderBatch({
          locale: "eo",
          englishFlat: corpus.flat,
          keys,
          terminologyContext: "LIVE",
          translator: async (request) => {
            failCalls += 1;
            const parsed = JSON.parse(request.text) as Record<string, string>;
            const partial = { ...parsed };
            delete partial[omit];
            return {
              translatedText: JSON.stringify(
                Object.fromEntries(
                  Object.entries(partial).map(([key, value]) => [key, `[xx] ${value}`]),
                ),
              ),
              providerId: "deterministic",
              isPlaceholder: false,
            };
          },
        }),
      /omitted keys after recovery/,
    );
    assert.equal(failCalls, 2);

    const { record, job } = await createQueuedJob("ia");
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: activateNoOp(),
      webUiPreparationDeps: {
        includePaths: INCLUDE_PATHS.slice(0, 6),
        loadLiveTerminology: async () => "LIVE",
        translator: async (request) => {
          const parsed = JSON.parse(request.text) as Record<string, string>;
          const keysRequested = Object.keys(parsed);
          if (keysRequested.length > 1) {
            const partial = { ...parsed };
            delete partial[keysRequested[keysRequested.length - 1]!];
            return {
              translatedText: JSON.stringify(
                Object.fromEntries(
                  Object.entries(partial).map(([key, value]) => [key, `[xx] ${value}`]),
                ),
              ),
              providerId: "deterministic",
              isPlaceholder: false,
            };
          }
          return translateAll(request);
        },
      },
    });
    const ticked = await processLanguageActivationJob(job.jobId, { webUiTick: true });
    assert.equal(ticked.status, "running");
    const checkpoint = await getWebUiActivationCheckpointByJobId(job.jobId);
    assert.ok(checkpoint);
    const batches = await listWebUiActivationBatches(checkpoint.checkpointId, "primary");
    const ok = batches.find((batch) => batch.status === "ok");
    assert.ok(ok);
    assert.equal(ok.reason, "ok after missing-key recovery");
    assert.equal(await getPublishedWebUiMessagePackByLocale(record.locale), null);
    assert.ok(getContentTranslationWorkerPeakConcurrencyForTests() <= 1);
  });

  it("17–22 unexpected keys and structural violations stay rejected; concurrency stays 1", async () => {
    const corpus = loadPublicWebUiEnglishCorpus(INCLUDE_PATHS.slice(0, 3));
    const keys = Object.keys(corpus.flat).sort();
    await assert.rejects(
      () =>
        translateWebUiProviderBatch({
          locale: "eo",
          englishFlat: corpus.flat,
          keys,
          terminologyContext: "LIVE",
          translator: async () => ({
            translatedText: JSON.stringify({
              [keys[0]!]: `[xx] ${corpus.flat[keys[0]!]}`,
              "unexpected.key": "nope",
            }),
            providerId: "deterministic",
            isPlaceholder: false,
          }),
        }),
      /unexpected keys/,
    );

    await assert.rejects(
      () =>
        translateWebUiProviderBatch({
          locale: "eo",
          englishFlat: { "x.a": "Hello {name}" },
          keys: ["x.a"],
          terminologyContext: "LIVE",
          translator: async () => ({
            translatedText: JSON.stringify({ "x.a": "Hello" }),
            providerId: "deterministic",
            isPlaceholder: false,
          }),
        }),
      /Placeholder|sentinel|Protection/i,
    );

    await assert.rejects(
      () =>
        translateWebUiProviderBatch({
          locale: "eo",
          englishFlat: { "x.b": "Click <b>here</b>" },
          keys: ["x.b"],
          terminologyContext: "LIVE",
          translator: async () => ({
            translatedText: JSON.stringify({ "x.b": "Click here" }),
            providerId: "deterministic",
            isPlaceholder: false,
          }),
        }),
      /Rich-text|sentinel|Protection/i,
    );

    await assert.rejects(
      () =>
        translateWebUiProviderBatch({
          locale: "eo",
          englishFlat: { "x.c": "Welcome to Humanity Union, {name}" },
          keys: ["x.c"],
          terminologyContext: "LIVE",
          translator: async () => ({
            translatedText: JSON.stringify({
              "x.c": "Welcome to Other Brand, name",
            }),
            providerId: "deterministic",
            isPlaceholder: false,
          }),
        }),
      /sentinel|Placeholder|Brand|Protection/i,
    );

    assert.equal(
      sanitizeWebUiActivationFailureDetail("Provider omitted keys: blogPublic.readMore"),
      "Public interface translation failed: provider omitted 1 required key. Retry activation to continue.",
    );
    assert.ok(getContentTranslationWorkerPeakConcurrencyForTests() <= 1);
    assert.ok(new WebUiDraftBatchError("x") instanceof Error);
  });

  it("23–28 sanitized detail, duplicate Admin copy, terminal completed, status provider-free", async () => {
    const { record, job } = await createQueuedJob("vo");
    let providerCalls = 0;
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: activateNoOp(),
      webUiPreparationDeps: {
        includePaths: INCLUDE_PATHS.slice(0, 3),
        loadLiveTerminology: async () => "LIVE",
        translator: async () => {
          providerCalls += 1;
          throw new WebUiDraftBatchError("Provider omitted keys: common.save");
        },
      },
    });
    const failed = await processLanguageActivationJob(job.jobId, { webUiTick: true });
    assert.equal(failed.status, "failed");
    assert.match(
      failed.domains.webUi.detail ?? "",
      /provider omitted 1 required key/i,
    );
    const status = await getLanguageActivationAdminView({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.equal(providerCalls, status.job ? providerCalls : providerCalls);
    const callsAfter = providerCalls;
    await getLanguageActivationAdminView({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.equal(providerCalls, callsAfter);

    const section = readFileSync(
      path.join(webSrc, "features/administration/components/AdminLanguagesSection.tsx"),
      "utf8",
    );
    const gaps = section.slice(
      section.indexOf("function formatActivationWaitingGaps"),
      section.indexOf("function LocalizationProgressMeter"),
    );
    assert.doesNotMatch(
      gaps,
      /webUi\?\.providerFailure[\s\S]*Public interface translation failed/,
    );
    assert.match(section, /formatOwnerPreparationProgress/);

    const completed = await createQueuedJob("cy");
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      skipWebUiPreparation: true,
      activate: activateNoOp(),
    });
    const done = await processLanguageActivationJob(completed.job.jobId, {
      reconcileResiduals: true,
    });
    const terminal = await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: completed.record.languageId,
      scheduleProcess: false,
    });
    if (done.status === "completed") {
      assert.equal(terminal.job?.jobId, completed.job.jobId);
    }
    await settle();
    const stored = await getLanguageActivationJobById(completed.job.jobId);
    assert.ok(stored);
  });
});
