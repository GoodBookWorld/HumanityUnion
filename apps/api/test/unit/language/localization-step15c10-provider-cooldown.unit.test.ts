/**
 * Step 15C.10 — automatic WEB_UI rate-limit cooldown and resume.
 * Deterministic provider only. No Gemini. No staging writes.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/index.js";
import { TranslationProviderError } from "../../../src/modules/language/translation.config.js";
import type { TranslationProviderRequest } from "../../../src/modules/language/translation-provider.js";
import {
  processLanguageActivationJob,
  resetLanguageActivationJobSchedulerForTests,
  resetLanguageActivationJobStoreForTests,
  resumeIncompleteWebUiActivationJobsOnBoot,
  scheduleWebUiActivationTickAt,
  setLanguageActivationJobAdminAssertOverrideForTests,
  setLanguageActivationJobForceMemoryForTests,
  setLanguageActivationJobProcessDepsForTests,
  startOrResumeLanguageActivationJob,
} from "../../../src/modules/language/language-localization-activation/index.js";
import { getWebUiActivationSchedulerSnapshotForTests } from "../../../src/modules/language/language-localization-activation/language-activation-job.service.js";
import { getLanguageActivationJobById } from "../../../src/modules/language/language-localization-activation/language-activation-job.repository.js";
import {
  computeWebUiCooldownNextAttemptAt,
  isWebUiRateLimitedError,
  webUiProviderCooldownSeconds,
} from "../../../src/modules/web-ui-message-packs/web-ui-provider-cooldown.js";
import { loadPublicWebUiEnglishCorpus } from "../../../src/modules/web-ui-message-packs/web-ui-draft-builder.js";
import {
  getWebUiActivationCheckpointByJobId,
  listWebUiActivationBatches,
  resetWebUiActivationCheckpointStoreForTests,
  setWebUiActivationCheckpointForceMemoryForTests,
  upsertWebUiActivationCheckpoint,
} from "../../../src/modules/web-ui-message-packs/web-ui-activation-checkpoint.repository.js";
import {
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";

const TWO_BATCH_PATHS = loadPublicWebUiEnglishCorpus().requiredPaths.slice(0, 12);
const here = path.dirname(fileURLToPath(import.meta.url));

function translate(request: TranslationProviderRequest) {
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
        ctKindsEnqueued: 2,
        plpEditorialEnqueued: false,
        notes: ["ct residual"],
      },
      PROVIDER_CALLS: 0 as const,
      WRITES_PERFORMED: 0 as const,
      seoIndexingEnabledUnchanged: true,
    };
  };
}

describe("Step 15C.10 — automatic WEB_UI provider cooldown", () => {
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
    setLanguageActivationJobAdminAssertOverrideForTests(async (userId) => ({
      userId,
      participantId: "participant-admin-15c10",
    }));
  });

  afterEach(() => {
    setLanguageActivationJobProcessDepsForTests(null);
    setLanguageActivationJobAdminAssertOverrideForTests(null);
    resetLanguageActivationJobSchedulerForTests();
  });

  async function createJob(locale: string) {
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

  it("1–8 rate_limited enters cooldown without terminal fail or second Gemini call", async () => {
    assert.equal(webUiProviderCooldownSeconds(1), 60);
    assert.equal(webUiProviderCooldownSeconds(2), 120);
    assert.equal(webUiProviderCooldownSeconds(3), 300);
    assert.equal(webUiProviderCooldownSeconds(4), 600);
    assert.equal(webUiProviderCooldownSeconds(5), 900);
    assert.equal(webUiProviderCooldownSeconds(99), 900);
    assert.equal(
      isWebUiRateLimitedError(new TranslationProviderError("rate_limited", "Gemini HTTP 429")),
      true,
    );
    assert.equal(
      isWebUiRateLimitedError(new TranslationProviderError("timeout", "timed out")),
      false,
    );

    const { record, job: started } = await createJob("eo");
    const jobId = started.jobId;
    const generation = started.generation;

    let providerCalls = 0;
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: activateNoOp(),
      webUiPreparationDeps: {
        includePaths: TWO_BATCH_PATHS,
        now: () => "2026-09-22T12:00:00.000Z",
        translator: async (request) => {
          providerCalls += 1;
          if (providerCalls === 1) {
            return translate(request);
          }
          throw new TranslationProviderError("rate_limited", "Gemini HTTP 429");
        },
        loadLiveTerminology: async () => "",
      },
    });

    let job = await processLanguageActivationJob(jobId, { webUiTick: true });
    assert.equal(job.status, "running");
    assert.equal(job.domains.webUi.completedBatches, 1);
    const callsAfterOk = providerCalls;

    job = await processLanguageActivationJob(jobId, { webUiTick: true });
    assert.equal(providerCalls, callsAfterOk + 1, "no immediate second 429 call");
    assert.equal(job.status, "running");
    assert.notEqual(job.status, "failed");
    assert.equal(job.domains.webUi.preparationPhase, "provider_cooldown");
    assert.equal(job.domains.webUi.providerFailure, false);
    assert.equal(job.domains.webUi.completedBatches, 1);
    assert.equal(job.domains.webUi.transientFailureCount, 1);
    assert.equal(job.domains.webUi.lastTransientFailure, "rate_limited");
    assert.equal(job.domains.webUi.nextAttemptAt, "2026-09-22T12:01:00.000Z");

    const checkpoint = await getWebUiActivationCheckpointByJobId(jobId);
    assert.ok(checkpoint);
    assert.equal(checkpoint!.phase, "provider_cooldown");
    assert.equal(checkpoint!.jobId, jobId);
    assert.equal(checkpoint!.generation, generation);
    assert.equal(checkpoint!.completedBatchCount, 1);
    assert.equal(checkpoint!.failedBatchCount, 0);
    assert.equal(checkpoint!.nextAttemptAt, "2026-09-22T12:01:00.000Z");

    const batches = await listWebUiActivationBatches(checkpoint!.checkpointId, "primary");
    assert.equal(batches.filter((b) => b.status === "ok").length, 1);
    assert.equal(
      batches.filter((b) => b.status === "pending" && b.reason === "rate_limited").length,
      1,
    );

    const before = providerCalls;
    job = await processLanguageActivationJob(jobId, { webUiTick: true });
    assert.equal(providerCalls, before);
    assert.equal(job.domains.webUi.preparationPhase, "provider_cooldown");

    const again = await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    assert.equal(again.job!.jobId, jobId);
    assert.equal(again.job!.generation, generation);
    const checkpointAfter = await getWebUiActivationCheckpointByJobId(jobId);
    assert.equal(checkpointAfter!.checkpointId, checkpoint!.checkpointId);
  });

  it("9–17 delayed resume clears cooldown and continues scheduling", async () => {
    const { job: started } = await createJob("ia");
    const jobId = started.jobId;
    let providerCalls = 0;
    let failOnce = true;
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: activateNoOp(),
      webUiPreparationDeps: {
        includePaths: TWO_BATCH_PATHS,
        now: () => "2026-09-22T12:00:00.000Z",
        translator: async (request) => {
          providerCalls += 1;
          if (providerCalls === 1) {
            return translate(request);
          }
          if (failOnce) {
            failOnce = false;
            throw new TranslationProviderError("rate_limited", "Gemini HTTP 429");
          }
          return translate(request);
        },
        loadLiveTerminology: async () => "",
      },
    });

    await processLanguageActivationJob(jobId, { webUiTick: true });
    await processLanguageActivationJob(jobId, { webUiTick: true });
    let job = await processLanguageActivationJob(jobId, { webUiTick: true });
    assert.equal(job.domains.webUi.preparationPhase, "provider_cooldown");
    const cooldownCheckpointId = job.domains.webUi.checkpointId;

    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: activateNoOp(),
      webUiPreparationDeps: {
        includePaths: TWO_BATCH_PATHS,
        now: () => "2026-09-22T12:01:01.000Z",
        translator: async (request) => {
          providerCalls += 1;
          return translate(request);
        },
        loadLiveTerminology: async () => "",
      },
    });

    job = await processLanguageActivationJob(jobId, { webUiTick: true });
    assert.equal(job.status, "running");
    assert.notEqual(job.domains.webUi.preparationPhase, "provider_cooldown");
    assert.ok((job.domains.webUi.completedBatches ?? 0) >= 2);
    assert.equal(job.domains.webUi.transientFailureCount ?? 0, 0);
    assert.equal(job.domains.webUi.nextAttemptAt ?? null, null);
    assert.equal(job.domains.webUi.checkpointId, cooldownCheckpointId);

    const batches = await listWebUiActivationBatches(cooldownCheckpointId!, "primary");
    assert.equal(batches.filter((b) => b.status === "ok").length, 2);
  });

  it("18–24 delayed schedule coalesces; boot restores delay or immediate", async () => {
    const near = new Date(Date.now() + 60_000).toISOString();
    const later = new Date(Date.now() + 120_000).toISOString();
    scheduleWebUiActivationTickAt("job-a", near);
    scheduleWebUiActivationTickAt("job-a", later);
    const snap = getWebUiActivationSchedulerSnapshotForTests("job-a");
    assert.equal(snap.delayedPending, true);
    assert.equal(snap.delayedNextAttemptAt, near);
    resetLanguageActivationJobSchedulerForTests();

    const { job: started } = await createJob("vo");
    const jobId = started.jobId;
    let providerCalls = 0;
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: activateNoOp(),
      webUiPreparationDeps: {
        includePaths: TWO_BATCH_PATHS,
        now: () => "2026-09-22T12:00:00.000Z",
        translator: async (request) => {
          providerCalls += 1;
          if (providerCalls === 1) return translate(request);
          throw new TranslationProviderError("rate_limited", "Gemini HTTP 429");
        },
        loadLiveTerminology: async () => "",
      },
    });
    await processLanguageActivationJob(jobId, { webUiTick: true });
    await processLanguageActivationJob(jobId, { webUiTick: true });
    const checkpoint = await getWebUiActivationCheckpointByJobId(jobId);
    assert.equal(checkpoint!.phase, "provider_cooldown");
    const callsBeforeBoot = providerCalls;

    // Persist a future nextAttemptAt so boot must schedule a delay (not due yet).
    const futureAt = new Date(Date.now() + 90_000).toISOString();
    await upsertWebUiActivationCheckpoint({
      ...checkpoint!,
      nextAttemptAt: futureAt,
    });
    resetLanguageActivationJobSchedulerForTests();
    const boot = await resumeIncompleteWebUiActivationJobsOnBoot();
    assert.ok(boot.scheduled >= 1);
    const afterBoot = getWebUiActivationSchedulerSnapshotForTests(jobId);
    assert.equal(afterBoot.delayedPending, true);
    assert.equal(afterBoot.delayedNextAttemptAt, futureAt);
    assert.equal(providerCalls, callsBeforeBoot, "boot schedules delay without provider call");

    await upsertWebUiActivationCheckpoint({
      ...checkpoint!,
      nextAttemptAt: "2020-01-01T00:00:00.000Z",
    });
    resetLanguageActivationJobSchedulerForTests();
    const bootDue = await resumeIncompleteWebUiActivationJobsOnBoot();
    assert.ok(bootDue.scheduled >= 1);
    assert.equal(
      getWebUiActivationSchedulerSnapshotForTests(jobId).delayedPending,
      false,
    );
    const still = await getLanguageActivationJobById(jobId);
    assert.equal(still!.jobId, jobId);
    assert.equal(still!.generation, started.generation);
    const cp2 = await getWebUiActivationCheckpointByJobId(jobId);
    assert.equal(cp2!.checkpointId, checkpoint!.checkpointId);
  });

  it("25–30 Admin progress + Activate semantics for cooldown", () => {
    const progressSrc = readFileSync(
      path.join(
        here,
        "../../../../web/src/features/administration/admin-languages-localization-progress.ts",
      ),
      "utf8",
    );
    assert.match(progressSrc, /Waiting for translation provider/);
    assert.match(progressSrc, /formatLocalizationRetryAt/);
    assert.match(progressSrc, /provider_cooldown/);

    const section = readFileSync(
      path.join(
        here,
        "../../../../web/src/features/administration/components/AdminLanguagesSection.tsx",
      ),
      "utf8",
    );
    assert.match(section, /Automatic retry at/);
    assert.match(section, /provider_cooldown/);
    assert.match(section, /preparationPhase !==\s*"provider_cooldown"/);

    const pollSrc = readFileSync(
      path.join(
        here,
        "../../../../web/src/features/administration/admin-languages-activation-poll.ts",
      ),
      "utf8",
    );
    assert.match(pollSrc, /status === "running"/);

    assert.equal(
      computeWebUiCooldownNextAttemptAt({
        nowIso: "2026-09-22T12:00:00.000Z",
        transientFailureCount: 2,
      }),
      "2026-09-22T12:02:00.000Z",
    );
  });

  it("31 non-rate-limit failures remain terminal", async () => {
    const { job: started } = await createJob("nov");
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: activateNoOp(),
      webUiPreparationDeps: {
        includePaths: TWO_BATCH_PATHS,
        translator: async () => {
          throw new TranslationProviderError("safety_rejected", "blocked");
        },
        loadLiveTerminology: async () => "",
      },
    });
    await processLanguageActivationJob(started.jobId, { webUiTick: true });
    const job = await getLanguageActivationJobById(started.jobId);
    assert.equal(job!.status, "failed");
    assert.equal(job!.domains.webUi.preparationPhase, "failed");
  });

  it("35–36 CT residual after WEB_UI; no publish during cooldown", () => {
    const serviceSrc = readFileSync(
      path.join(
        here,
        "../../../src/modules/language/language-localization-activation/language-activation-job.service.ts",
      ),
      "utf8",
    );
    assert.match(serviceSrc, /provider_cooldown/);
    assert.match(serviceSrc, /isLanguageActivationWebUiReadyForHistoricalEnqueue/);
    assert.match(serviceSrc, /scheduleWebUiActivationTickAt/);
    assert.match(serviceSrc, /preparationPhase === "provider_cooldown"/);
    assert.doesNotMatch(serviceSrc, /webUiStillPreparing/);
    assert.doesNotMatch(serviceSrc, /waiting_for_data does not block enqueue/);

    const prepSrc = readFileSync(
      path.join(
        here,
        "../../../src/modules/web-ui-message-packs/web-ui-activation-preparation.ts",
      ),
      "utf8",
    );
    assert.match(prepSrc, /enterWebUiProviderCooldown/);
    assert.match(prepSrc, /isWebUiTransientProviderError/);
  });
});
