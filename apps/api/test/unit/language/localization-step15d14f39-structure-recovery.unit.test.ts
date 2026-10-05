/**
 * STEP 15D.14.F.3.9 — automatic recovery for retryable WEB_UI
 * provider-output structure failures. Deterministic provider only.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { isLocalizationSourceOriginalEntityType } from "@hu/types";

import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/index.js";
import { readLocalizationProviderCooldown } from "../../../src/modules/language/localization-provider-governor.js";
import { TranslationProviderError } from "../../../src/modules/language/translation.config.js";
import type { TranslationProviderRequest } from "../../../src/modules/language/translation-provider.js";
import {
  activateLocalizationProviderPressure,
  resetThinGeminiProviderStateForTests,
  setThinGeminiProviderStateForceMemoryForTests,
} from "../../../src/modules/language/media-plp-materializer/thin-gemini-provider-state.js";
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
import { loadPublicWebUiEnglishCorpus } from "../../../src/modules/web-ui-message-packs/web-ui-draft-builder.js";
import {
  getWebUiActivationCheckpointByJobId,
  listWebUiActivationBatches,
  resetWebUiActivationCheckpointStoreForTests,
  setWebUiActivationCheckpointForceMemoryForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-activation-checkpoint.repository.js";
import {
  getPublishedWebUiMessagePackByLocale,
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import {
  protectWebUiMessageForProvider,
  WebUiMessageStructureError,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-structure-protect.js";
import { isRetryableWebUiProviderOutputStructureFailure } from "../../../src/modules/web-ui-message-packs/web-ui-provider-output-structure.js";

const corpus = loadPublicWebUiEnglishCorpus();

function plainCommonPaths(): readonly string[] {
  return corpus.requiredPaths
    .filter((pathKey) => {
      const value = corpus.flat[pathKey] ?? "";
      return (
        pathKey.startsWith("common.") &&
        !value.includes("{") &&
        !value.includes("<") &&
        !value.includes("⟦")
      );
    })
    .slice(0, 6);
}

function laterPlaceholderPath(): string {
  const found = corpus.requiredPaths.find((pathKey) => {
    const namespace = pathKey.split(".")[0] ?? "";
    const value = corpus.flat[pathKey] ?? "";
    return namespace > "common" && value.includes("{") && !value.includes("⟦");
  });
  if (!found) {
    throw new Error("No later placeholder fixture.");
  }
  return found;
}

const PRESERVED_PATHS = plainCommonPaths();
const PLACEHOLDER_PATH = laterPlaceholderPath();
const TWO_BATCH_PATHS = [...PRESERVED_PATHS, PLACEHOLDER_PATH];

function echo(request: TranslationProviderRequest, corruptSentinels: boolean) {
  const parsed = JSON.parse(request.text) as Record<string, unknown>;
  const translated: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (Array.isArray(value)) {
      const spans = value.map((span) => String(span));
      // Shape v3 sends every leaf as spans and keeps placeholders out of the
      // provider text. A multi-span leaf is the protected placeholder case.
      // An extra span is the same class of retryable structure failure the
      // test used to produce by renaming a sentinel. A one-span plain leaf
      // stays valid.
      if (corruptSentinels && spans.length > 1) {
        spans.push("extra");
      } else {
        for (let index = 0; index < spans.length; index += 1) {
          if (spans[index]!.length > 0) {
            spans[index] = `[xx] ${spans[index]}`;
          }
        }
      }
      translated[key] = spans;
    } else {
      translated[key] = `[xx] ${String(value)}`;
    }
  }
  return {
    translatedText: JSON.stringify(translated),
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

describe("15D.14.F.3.9 — retryable WEB_UI provider-output structure recovery", () => {
  let nowMs = Date.now();

  beforeEach(async () => {
    nowMs = Date.now();
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
      participantId: "participant-admin-f39",
    }));
  });

  afterEach(() => {
    setLanguageActivationJobProcessDepsForTests(null);
    setLanguageActivationJobAdminAssertOverrideForTests(null);
    resetLanguageActivationJobSchedulerForTests();
    resetThinGeminiProviderStateForTests();
    setThinGeminiProviderStateForceMemoryForTests(false);
  });

  async function createJob(locale = "eo") {
    const record = await createLanguageRegistryRecord({
      locale,
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
    return { record, job: started.job };
  }

  function installTranslator(input: {
    readonly includePaths: readonly string[];
    readonly corruptSentinels: () => boolean;
    readonly failWith?: () => Error | null;
    readonly onCall: () => void;
  }) {
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: activateNoOp(),
      webUiPreparationDeps: {
        includePaths: input.includePaths,
        now: () => new Date(nowMs).toISOString(),
        translator: async (request) => {
          input.onCall();
          const failure = input.failWith?.() ?? null;
          if (failure) {
            throw failure;
          }
          return echo(request, input.corruptSentinels());
        },
        loadLiveTerminology: async () => "",
      },
    });
  }

  it("1. reordered sentinels are retryable; source sentinels and pressure are not", () => {
    assert.equal(
      isRetryableWebUiProviderOutputStructureFailure(
        new WebUiMessageStructureError("Protection sentinels were reordered or renumbered."),
      ),
      true,
    );
    assert.equal(
      isRetryableWebUiProviderOutputStructureFailure(
        new WebUiMessageStructureError("Protection sentinel count 1 does not match 2."),
      ),
      true,
    );
    assert.equal(
      isRetryableWebUiProviderOutputStructureFailure(
        new WebUiMessageStructureError("Protection sentinel index is missing."),
      ),
      true,
    );
    assert.equal(
      isRetryableWebUiProviderOutputStructureFailure(
        new WebUiMessageStructureError("Unresolved protection sentinel remains."),
      ),
      true,
    );
    assert.equal(
      isRetryableWebUiProviderOutputStructureFailure(
        new WebUiMessageStructureError("Message structure is unbalanced."),
      ),
      true,
    );
    assert.equal(
      isRetryableWebUiProviderOutputStructureFailure(
        new WebUiMessageStructureError("Placeholders do not match English."),
      ),
      true,
    );
    assert.equal(
      isRetryableWebUiProviderOutputStructureFailure(
        new WebUiMessageStructureError("Rich-text tags do not match English."),
      ),
      true,
    );
    assert.throws(
      () => protectWebUiMessageForProvider("already ⟦w0⟧ here"),
      (error: unknown) => {
        assert.equal(isRetryableWebUiProviderOutputStructureFailure(error), false);
        return true;
      },
    );
    assert.equal(
      isRetryableWebUiProviderOutputStructureFailure(
        new TranslationProviderError("rate_limited", "429"),
      ),
      false,
    );
    assert.equal(
      isRetryableWebUiProviderOutputStructureFailure(
        new TranslationProviderError("timeout", "timed out"),
      ),
      false,
    );
    assert.equal(
      isRetryableWebUiProviderOutputStructureFailure(
        new TranslationProviderError("network_failure", "reset"),
      ),
      false,
    );
    assert.equal(
      isRetryableWebUiProviderOutputStructureFailure(
        new TranslationProviderError("not_configured", "missing"),
      ),
      false,
    );
  });

  it("2–11 valid source, reordered sentinels, durable wait, resume, restart", async () => {
    const { record, job: started } = await createJob();
    let providerCalls = 0;
    let corrupt = true;
    installTranslator({
      includePaths: TWO_BATCH_PATHS,
      corruptSentinels: () => corrupt,
      onCall: () => {
        providerCalls += 1;
      },
    });

    let job = await processLanguageActivationJob(started.jobId, { webUiTick: true });
    assert.equal(job.domains.webUi.completedBatches, 1);
    const callsAfterOk = providerCalls;

    job = await processLanguageActivationJob(started.jobId, { webUiTick: true });
    assert.equal(providerCalls, callsAfterOk + 1);
    assert.equal(job.status, "running");
    assert.notEqual(job.status, "failed");
    assert.equal(job.domains.webUi.preparationPhase, "structure_retry");
    assert.equal(job.domains.webUi.providerFailure, false);
    assert.equal(job.domains.webUi.completedBatches, 1);
    assert.equal(job.domains.webUi.lastTransientFailure ?? null, null);
    assert.ok(job.domains.webUi.nextAttemptAt);
    const firstWake = job.domains.webUi.nextAttemptAt!;
    assert.equal(firstWake, new Date(nowMs + 60_000).toISOString());
    assert.match(job.domains.webUi.detail ?? "", /No operator action required/);
    assert.doesNotMatch(job.domains.webUi.detail ?? "", /rate limit/i);
    assert.doesNotMatch(job.domains.webUi.detail ?? "", /retry activation/i);

    const checkpoint = await getWebUiActivationCheckpointByJobId(started.jobId);
    assert.ok(checkpoint);
    assert.equal(checkpoint!.phase, "structure_retry");
    assert.equal(checkpoint!.completedBatchCount, 1);
    assert.equal(checkpoint!.failedBatchCount, 0);
    assert.equal(checkpoint!.structureRetryCount, 1);
    assert.equal(checkpoint!.nextAttemptAt, firstWake);
    assert.equal(checkpoint!.sourceHash.length > 0, true);

    const batches = await listWebUiActivationBatches(checkpoint!.checkpointId, "primary");
    const okBatches = batches.filter((batch) => batch.status === "ok");
    const waiting = batches.filter((batch) => batch.status === "pending");
    assert.equal(okBatches.length, 1);
    assert.equal(waiting.length, 1);
    assert.equal(waiting[0]!.reason, "retryable_provider_output_structure");
    assert.deepEqual(waiting[0]!.values, {});
    assert.ok(Object.keys(okBatches[0]!.values).length > 0);
    const failedBatchId = waiting[0]!.batchId;
    assert.equal(await getPublishedWebUiMessagePackByLocale(record.locale), null);

    const governor = await readLocalizationProviderCooldown();
    assert.equal(governor.active, false);

    const beforeDue = providerCalls;
    job = await processLanguageActivationJob(started.jobId, { webUiTick: true });
    assert.equal(providerCalls, beforeDue);
    assert.equal(job.domains.webUi.preparationPhase, "structure_retry");
    assert.equal(job.domains.webUi.completedBatches, 1);
    const stillWaiting = await listWebUiActivationBatches(checkpoint!.checkpointId, "primary");
    assert.equal(
      stillWaiting.find((batch) => batch.batchId === failedBatchId)?.status,
      "pending",
    );

    resetLanguageActivationJobSchedulerForTests();
    const resumed = await resumeIncompleteWebUiActivationJobsOnBoot();
    assert.ok(resumed.scheduled >= 1);
    const snapshot = getWebUiActivationSchedulerSnapshotForTests(started.jobId);
    assert.equal(snapshot.delayedPending, true);
    assert.equal(snapshot.delayedNextAttemptAt, firstWake);

    nowMs = Date.parse(firstWake) + 1000;
    corrupt = false;
    job = await processLanguageActivationJob(started.jobId, { webUiTick: true });
    assert.equal(job.status, "running");
    assert.notEqual(job.status, "failed");
    assert.equal(job.domains.webUi.completedBatches, 2);
    assert.notEqual(job.domains.webUi.preparationPhase, "structure_retry");
    assert.notEqual(job.domains.webUi.preparationPhase, "failed");
    const afterSuccess = await listWebUiActivationBatches(checkpoint!.checkpointId, "primary");
    assert.equal(afterSuccess.find((batch) => batch.batchId === failedBatchId)?.status, "ok");
    assert.equal(afterSuccess.filter((batch) => batch.status === "ok").length, 2);
    const advanced = await getWebUiActivationCheckpointByJobId(started.jobId);
    assert.equal(advanced!.completedBatchCount, 2);
    assert.equal(advanced!.structureRetryCount ?? 0, 0);
    assert.equal(await getPublishedWebUiMessagePackByLocale(record.locale), null);
  });

  it("9. another structure failure schedules a longer wait without a hot loop", async () => {
    const { job: started } = await createJob();
    let providerCalls = 0;
    installTranslator({
      includePaths: TWO_BATCH_PATHS,
      corruptSentinels: () => true,
      onCall: () => {
        providerCalls += 1;
      },
    });
    await processLanguageActivationJob(started.jobId, { webUiTick: true });
    let job = await processLanguageActivationJob(started.jobId, { webUiTick: true });
    const firstWake = job.domains.webUi.nextAttemptAt!;
    const callsAtFirstWait = providerCalls;
    nowMs = Date.parse(firstWake) + 1000;
    job = await processLanguageActivationJob(started.jobId, { webUiTick: true });
    assert.equal(providerCalls, callsAtFirstWait + 1);
    assert.equal(job.status, "running");
    assert.equal(job.domains.webUi.preparationPhase, "structure_retry");
    assert.equal(job.domains.webUi.completedBatches, 1);
    const secondWake = job.domains.webUi.nextAttemptAt!;
    assert.equal(secondWake, new Date(nowMs + 120_000).toISOString());
    assert.notEqual(secondWake, firstWake);
    const checkpoint = await getWebUiActivationCheckpointByJobId(started.jobId);
    assert.equal(checkpoint!.structureRetryCount, 2);
    const quiet = providerCalls;
    job = await processLanguageActivationJob(started.jobId, { webUiTick: true });
    assert.equal(providerCalls, quiet);
    assert.equal(job.domains.webUi.nextAttemptAt, secondWake);
  });

  it("11. shared provider cooldown defers without consuming a structure attempt", async () => {
    const { job: started } = await createJob();
    let providerCalls = 0;
    installTranslator({
      includePaths: TWO_BATCH_PATHS,
      corruptSentinels: () => true,
      onCall: () => {
        providerCalls += 1;
      },
    });
    await processLanguageActivationJob(started.jobId, { webUiTick: true });
    let job = await processLanguageActivationJob(started.jobId, { webUiTick: true });
    const checkpointBefore = await getWebUiActivationCheckpointByJobId(started.jobId);
    assert.equal(checkpointBefore!.structureRetryCount, 1);
    const armed = await activateLocalizationProviderPressure({
      category: "rate_limited",
      nowMs: Date.now(),
      retryAfterSeconds: 120,
    });
    nowMs = Date.parse(job.domains.webUi.nextAttemptAt!) + 1000;
    const callsBefore = providerCalls;
    job = await processLanguageActivationJob(started.jobId, { webUiTick: true });
    assert.equal(providerCalls, callsBefore);
    assert.equal(job.status, "running");
    assert.equal(job.domains.webUi.preparationPhase, "structure_retry");
    assert.equal(job.domains.webUi.lastTransientFailure ?? null, null);
    assert.equal(job.domains.webUi.nextAttemptAt, armed.cooldownUntil);
    assert.doesNotMatch(job.domains.webUi.detail ?? "", /rate limit/i);
    const checkpointAfter = await getWebUiActivationCheckpointByJobId(started.jobId);
    assert.equal(checkpointAfter!.structureRetryCount, 1);
    assert.equal(checkpointAfter!.completedBatchCount, 1);
    assert.equal(checkpointAfter!.phase, "structure_retry");
    assert.notEqual(checkpointAfter!.lastTransientFailure, "rate_limited");
  });

  it("12. invalid source structure stays terminal", async () => {
    const { job: started } = await createJob();
    let providerCalls = 0;
    installTranslator({
      includePaths: [PLACEHOLDER_PATH],
      corruptSentinels: () => false,
      failWith: () =>
        new WebUiMessageStructureError("English source already contains a protection sentinel."),
      onCall: () => {
        providerCalls += 1;
      },
    });
    const job = await processLanguageActivationJob(started.jobId, { webUiTick: true });
    assert.equal(providerCalls, 2);
    assert.equal(job.status, "failed");
    assert.equal(job.domains.webUi.preparationPhase, "failed");
    assert.equal(job.domains.webUi.providerFailure, true);
    assert.equal(job.domains.webUi.nextAttemptAt ?? null, null);
    const checkpoint = await getWebUiActivationCheckpointByJobId(started.jobId);
    assert.equal(checkpoint!.phase, "failed");
    assert.equal(checkpoint!.structureRetryCount ?? 0, 0);
  });

  it("13. not_configured remains terminal", async () => {
    const { job: started } = await createJob();
    let providerCalls = 0;
    installTranslator({
      includePaths: [PLACEHOLDER_PATH],
      corruptSentinels: () => false,
      failWith: () => new TranslationProviderError("not_configured", "missing key"),
      onCall: () => {
        providerCalls += 1;
      },
    });
    const job = await processLanguageActivationJob(started.jobId, { webUiTick: true });
    assert.equal(providerCalls, 1);
    assert.equal(job.status, "failed");
    assert.equal(job.domains.webUi.preparationPhase, "failed");
    assert.notEqual(job.domains.webUi.preparationPhase, "structure_retry");
  });

  it("14. rate limit, timeout, and network stay Gate E pressure", async () => {
    const cases = [
      { code: "rate_limited" as const, kind: "rate_limited" },
      { code: "timeout" as const, kind: "timeout" },
      { code: "network_failure" as const, kind: "unavailable" },
    ];
    const locales = ["eo", "ia", "vo"];
    for (const [index, item] of cases.entries()) {
      resetWebUiActivationCheckpointStoreForTests();
      resetLanguageActivationJobStoreForTests();
      resetLanguageActivationJobSchedulerForTests();
      resetThinGeminiProviderStateForTests();
      const { job: started } = await createJob(locales[index]!);
      installTranslator({
        includePaths: [PLACEHOLDER_PATH],
        corruptSentinels: () => false,
        failWith: () => new TranslationProviderError(item.code, item.code),
        onCall: () => undefined,
      });
      const job = await processLanguageActivationJob(started.jobId, { webUiTick: true });
      assert.equal(job.status, "running");
      assert.equal(job.domains.webUi.preparationPhase, "provider_cooldown");
      assert.equal(job.domains.webUi.lastTransientFailure, item.kind);
      assert.notEqual(job.domains.webUi.preparationPhase, "structure_retry");
      const checkpoint = await getWebUiActivationCheckpointByJobId(started.jobId);
      assert.equal(checkpoint!.phase, "provider_cooldown");
      assert.equal(checkpoint!.structureRetryCount ?? 0, 0);
    }
  });

  it("18. public news remains SOURCE_ORIGINAL", () => {
    assert.equal(isLocalizationSourceOriginalEntityType("public_news"), true);
  });
});
