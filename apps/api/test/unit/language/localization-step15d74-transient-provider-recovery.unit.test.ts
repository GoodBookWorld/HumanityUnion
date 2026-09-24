/**
 * Step 15D.7.4 — automatic WEB_UI transient provider recovery (unavailable/timeout).
 * Extends 15C.10 cooldown. Deterministic provider only. No Gemini. No staging writes.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

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
  setLanguageActivationJobAdminAssertOverrideForTests,
  setLanguageActivationJobForceMemoryForTests,
  setLanguageActivationJobProcessDepsForTests,
  startOrResumeLanguageActivationJob,
} from "../../../src/modules/language/language-localization-activation/index.js";
import { getLanguageActivationJobById } from "../../../src/modules/language/language-localization-activation/language-activation-job.repository.js";
import {
  classifyWebUiTransientFailure,
  isWebUiTransientCooldownBudgetExhausted,
  isWebUiTransientProviderError,
  WEB_UI_TRANSIENT_COOLDOWN_BUDGET,
  webUiProviderCooldownDetail,
  webUiProviderCooldownSeconds,
  webUiTransientBudgetExhaustedDetail,
} from "../../../src/modules/web-ui-message-packs/web-ui-provider-cooldown.js";
import {
  loadPublicWebUiEnglishCorpus,
  sanitizeWebUiActivationFailureDetail,
  WebUiDraftBatchError,
} from "../../../src/modules/web-ui-message-packs/web-ui-draft-builder.js";
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

describe("Step 15D.7.4 — automatic transient provider recovery", () => {
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
      participantId: "participant-admin-15d74",
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

  it("1–3 typed transient classification covers rate_limited / unavailable / timeout", () => {
    assert.equal(
      isWebUiTransientProviderError(new TranslationProviderError("rate_limited", "x")),
      true,
    );
    assert.equal(
      isWebUiTransientProviderError(new TranslationProviderError("unavailable", "Gemini HTTP 503")),
      true,
    );
    assert.equal(
      isWebUiTransientProviderError(new TranslationProviderError("timeout", "timed out")),
      true,
    );
    assert.equal(
      isWebUiTransientProviderError(new TranslationProviderError("network_failure", "net")),
      true,
    );
    assert.equal(classifyWebUiTransientFailure(new TranslationProviderError("unavailable", "x")), "unavailable");
    assert.equal(classifyWebUiTransientFailure(new TranslationProviderError("timeout", "x")), "timeout");
    assert.equal(classifyWebUiTransientFailure(new TranslationProviderError("rate_limited", "x")), "rate_limited");
    assert.equal(
      isWebUiTransientProviderError(new TranslationProviderError("not_configured", "key")),
      false,
    );
    assert.equal(
      isWebUiTransientProviderError(new TranslationProviderError("safety_rejected", "blocked")),
      false,
    );
    assert.equal(
      isWebUiTransientProviderError(new WebUiDraftBatchError("Placeholders do not match English.")),
      false,
    );
  });

  it("2–5 unavailable enters cooldown; not terminal after one 503; nextAttemptAt persisted", async () => {
    const { job: started } = await createJob("eo");
    const jobId = started.jobId;
    let providerCalls = 0;
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: activateNoOp(),
      webUiPreparationDeps: {
        includePaths: TWO_BATCH_PATHS,
        now: () => "2026-09-24T12:00:00.000Z",
        translator: async (request) => {
          providerCalls += 1;
          if (providerCalls === 1) {
            return translate(request);
          }
          throw new TranslationProviderError("unavailable", "Gemini HTTP 503");
        },
        loadLiveTerminology: async () => "",
      },
    });

    await processLanguageActivationJob(jobId, { webUiTick: true });
    const callsAfterOk = providerCalls;
    let job = await processLanguageActivationJob(jobId, { webUiTick: true });
    assert.equal(providerCalls, callsAfterOk + 1, "no immediate second 503 call");
    assert.equal(job.status, "running");
    assert.notEqual(job.status, "failed");
    assert.equal(job.domains.webUi.preparationPhase, "provider_cooldown");
    assert.equal(job.domains.webUi.providerFailure, false);
    assert.equal(job.domains.webUi.lastTransientFailure, "unavailable");
    assert.equal(job.domains.webUi.transientFailureCount, 1);
    assert.equal(job.domains.webUi.nextAttemptAt, "2026-09-24T12:01:00.000Z");
    assert.match(
      job.domains.webUi.detail ?? "",
      /temporarily unavailable/i,
    );

    const checkpoint = await getWebUiActivationCheckpointByJobId(jobId);
    assert.equal(checkpoint!.phase, "provider_cooldown");
    assert.equal(checkpoint!.nextAttemptAt, "2026-09-24T12:01:00.000Z");
    assert.equal(checkpoint!.lastTransientFailure, "unavailable");
    assert.equal(checkpoint!.failedBatchCount, 0);
    assert.equal(checkpoint!.completedBatchCount, 1);

    const batches = await listWebUiActivationBatches(checkpoint!.checkpointId, "primary");
    assert.equal(batches.filter((b) => b.status === "ok").length, 1);
    assert.equal(
      batches.filter((b) => b.status === "pending" && b.reason === "unavailable").length,
      1,
    );

    // Still cooling down — no extra provider call.
    job = await processLanguageActivationJob(jobId, { webUiTick: true });
    assert.equal(providerCalls, callsAfterOk + 1);
    assert.equal(job.domains.webUi.preparationPhase, "provider_cooldown");
  });

  it("3 / 6–7 / 9–13 timeout cooldown resumes, clears streak, does not repeat ok batches", async () => {
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
        now: () => "2026-09-24T12:00:00.000Z",
        translator: async (request) => {
          providerCalls += 1;
          if (providerCalls === 1) {
            return translate(request);
          }
          if (failOnce) {
            failOnce = false;
            throw new TranslationProviderError("timeout", "Gemini translation timed out");
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
    assert.equal(job.domains.webUi.lastTransientFailure, "timeout");
    assert.equal(webUiProviderCooldownSeconds(1), 60);
    assert.equal(webUiProviderCooldownSeconds(2), 120);
    assert.equal(webUiProviderCooldownSeconds(3), 300);

    const cooldownCheckpointId = job.domains.webUi.checkpointId;
    const callsBeforeResume = providerCalls;

    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: activateNoOp(),
      webUiPreparationDeps: {
        includePaths: TWO_BATCH_PATHS,
        now: () => "2026-09-24T12:01:01.000Z",
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
    assert.equal(providerCalls, callsBeforeResume + 1);

    const batches = await listWebUiActivationBatches(cooldownCheckpointId!, "primary");
    assert.equal(batches.filter((b) => b.status === "ok").length, 2);
  });

  it("8 boot resume schedules delay from unavailable cooldown", async () => {
    const { job: started } = await createJob("vo");
    const jobId = started.jobId;
    let providerCalls = 0;
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: activateNoOp(),
      webUiPreparationDeps: {
        includePaths: TWO_BATCH_PATHS,
        now: () => "2026-09-24T12:00:00.000Z",
        translator: async (request) => {
          providerCalls += 1;
          if (providerCalls === 1) return translate(request);
          throw new TranslationProviderError("unavailable", "Gemini HTTP 503");
        },
        loadLiveTerminology: async () => "",
      },
    });
    await processLanguageActivationJob(jobId, { webUiTick: true });
    await processLanguageActivationJob(jobId, { webUiTick: true });
    const checkpoint = await getWebUiActivationCheckpointByJobId(jobId);
    assert.equal(checkpoint!.phase, "provider_cooldown");
    const callsBeforeBoot = providerCalls;

    const futureAt = new Date(Date.now() + 90_000).toISOString();
    await upsertWebUiActivationCheckpoint({
      ...checkpoint!,
      nextAttemptAt: futureAt,
    });
    resetLanguageActivationJobSchedulerForTests();
    const boot = await resumeIncompleteWebUiActivationJobsOnBoot();
    assert.ok(boot.scheduled >= 1);
    assert.equal(providerCalls, callsBeforeBoot);
  });

  it("11–14 streak grows; budget exhaustion becomes terminal", async () => {
    assert.equal(WEB_UI_TRANSIENT_COOLDOWN_BUDGET, 5);
    assert.equal(isWebUiTransientCooldownBudgetExhausted(4), false);
    assert.equal(isWebUiTransientCooldownBudgetExhausted(5), true);

    const { job: started } = await createJob("nov");
    const jobId = started.jobId;
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: activateNoOp(),
      webUiPreparationDeps: {
        includePaths: TWO_BATCH_PATHS,
        now: () => "2026-09-24T12:00:00.000Z",
        translator: async () => {
          throw new TranslationProviderError("unavailable", "Gemini HTTP 503");
        },
        loadLiveTerminology: async () => "",
      },
    });

    // First tick: enter cooldown streak=1
    let job = await processLanguageActivationJob(jobId, { webUiTick: true });
    assert.equal(job.domains.webUi.preparationPhase, "provider_cooldown");
    assert.equal(job.domains.webUi.transientFailureCount, 1);

    for (let streak = 2; streak <= WEB_UI_TRANSIENT_COOLDOWN_BUDGET; streak += 1) {
      const checkpoint = await getWebUiActivationCheckpointByJobId(jobId);
      await upsertWebUiActivationCheckpoint({
        ...checkpoint!,
        phase: "primary",
        nextAttemptAt: null,
        transientFailureCount: streak - 1,
        detail: "Preparing…",
      });
      setLanguageActivationJobProcessDepsForTests({
        skipCorpusInReadiness: true,
        skipOwnerPreparation: true,
        activate: activateNoOp(),
        webUiPreparationDeps: {
          includePaths: TWO_BATCH_PATHS,
          now: () => "2026-09-24T12:00:00.000Z",
          translator: async () => {
            throw new TranslationProviderError("unavailable", "Gemini HTTP 503");
          },
          loadLiveTerminology: async () => "",
        },
      });
      job = await processLanguageActivationJob(jobId, { webUiTick: true });
      assert.equal(job.status, "running");
      assert.equal(job.domains.webUi.preparationPhase, "provider_cooldown");
      assert.equal(job.domains.webUi.transientFailureCount, streak);
    }

    // Next transient after budget → terminal
    const checkpoint = await getWebUiActivationCheckpointByJobId(jobId);
    await upsertWebUiActivationCheckpoint({
      ...checkpoint!,
      phase: "primary",
      nextAttemptAt: null,
      transientFailureCount: WEB_UI_TRANSIENT_COOLDOWN_BUDGET,
      detail: "Preparing…",
    });
    job = await processLanguageActivationJob(jobId, { webUiTick: true });
    assert.equal(job.status, "failed");
    assert.equal(job.domains.webUi.preparationPhase, "failed");
    assert.match(job.domains.webUi.detail ?? "", /unavailable repeatedly/i);
  });

  it("15–18 config/auth/forbidden/unsupported/safety remain terminal", async () => {
    for (const [code, message] of [
      ["not_configured", "missing key"],
      ["forbidden", "forbidden"],
      ["unsupported_language", "nope"],
      ["safety_rejected", "blocked"],
    ] as const) {
      resetLanguageActivationJobStoreForTests();
      resetWebUiActivationCheckpointStoreForTests();
      const { job: started } = await createJob(`t-${code.slice(0, 4)}`);
      setLanguageActivationJobProcessDepsForTests({
        skipCorpusInReadiness: true,
        skipOwnerPreparation: true,
        activate: activateNoOp(),
        webUiPreparationDeps: {
          includePaths: TWO_BATCH_PATHS,
          translator: async () => {
            throw new TranslationProviderError(code, message);
          },
          loadLiveTerminology: async () => "",
        },
      });
      await processLanguageActivationJob(started.jobId, { webUiTick: true });
      const job = await getLanguageActivationJobById(started.jobId);
      assert.equal(job!.status, "failed", code);
      assert.equal(job!.domains.webUi.preparationPhase, "failed", code);
    }
  });

  it("19 structure-validation failure is not provider cooldown", async () => {
    const { job: started } = await createJob("struct");
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: activateNoOp(),
      webUiPreparationDeps: {
        includePaths: TWO_BATCH_PATHS,
        translator: async () => {
          throw new WebUiDraftBatchError("Placeholders do not match English.");
        },
        loadLiveTerminology: async () => "",
      },
    });
    await processLanguageActivationJob(started.jobId, { webUiTick: true });
    // Immediate retry then terminal (2 attempts) — never cooldown
    const job = await getLanguageActivationJobById(started.jobId);
    assert.equal(job!.status, "failed");
    assert.notEqual(job!.domains.webUi.preparationPhase, "provider_cooldown");
    assert.match(job!.domains.webUi.detail ?? "", /structure validation/i);
  });

  it("26–28 Admin/sanitize copy for unavailable and timeout; no raw secrets", () => {
    assert.equal(
      webUiProviderCooldownDetail("rate_limited"),
      "Waiting for translation provider — rate limit.",
    );
    assert.match(webUiProviderCooldownDetail("unavailable"), /temporarily unavailable/i);
    assert.match(webUiProviderCooldownDetail("timeout"), /timed out/i);
    assert.match(webUiTransientBudgetExhaustedDetail("unavailable"), /Retry activation/);
    assert.match(
      sanitizeWebUiActivationFailureDetail("Gemini HTTP 503"),
      /temporarily unavailable/i,
    );
    assert.match(
      sanitizeWebUiActivationFailureDetail("Gemini translation timed out"),
      /timed out/i,
    );
    const copies = [
      webUiProviderCooldownDetail("unavailable"),
      webUiProviderCooldownDetail("timeout"),
      sanitizeWebUiActivationFailureDetail("Gemini HTTP 503"),
      sanitizeWebUiActivationFailureDetail("Gemini translation timed out"),
    ].join("\n");
    assert.equal(/AIza|api[_-]?key|Bearer |sk-/i.test(copies), false);
    assert.equal(/⟦w\d+⟧/.test(copies), false);
  });

  it("20 no locale-specific branch in cooldown module", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(
      path.resolve(here, "../../../src/modules/web-ui-message-packs/web-ui-provider-cooldown.ts"),
      "utf8",
    );
    assert.equal(/\bka\b|Georgian|ქართული/i.test(source), false);
  });
});
