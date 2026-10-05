/**
 * STEP 15D.14.F.3.12 — durable global localization provider pacing.
 * Deterministic provider only. No Gemini HTTP.
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
import { isActivationProviderTransientError } from "../../../src/modules/language/activation-provider-transient-recovery.js";
import {
  isLocalizationProviderPacingDeferredError,
  LOCALIZATION_PROVIDER_MIN_INTERVAL_MS_DEFAULT,
  localizationProviderPressureError,
  readLocalizationProviderBlockedUntil,
  readLocalizationProviderPacing,
  resolveLocalizationProviderMinIntervalMs,
  runLocalizationProviderRequest,
  setLocalizationProviderClockForTests,
  setLocalizationProviderPacingIntervalMsForTests,
} from "../../../src/modules/language/localization-provider-governor.js";
import { TranslationProviderError } from "../../../src/modules/language/translation.config.js";
import type { TranslationProviderRequest } from "../../../src/modules/language/translation-provider.js";
import {
  activateLocalizationProviderPressure,
  readThinGeminiProviderState,
  resetThinGeminiProviderStateForTests,
  setThinGeminiProviderStateForceMemoryForTests,
} from "../../../src/modules/language/media-plp-materializer/thin-gemini-provider-state.js";
import { withThinGeminiGovernor } from "../../../src/modules/language/media-plp-materializer/thin-gemini-governor.js";
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
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import { WEB_UI_STRUCTURE_PACING_REASON } from "../../../src/modules/web-ui-message-packs/web-ui-provider-output-structure.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiSrc = path.resolve(here, "../../../src");
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

const TWO_BATCH_PATHS = [...plainCommonPaths(), laterPlaceholderPath()];

function echo(request: TranslationProviderRequest, corruptSentinels: boolean) {
  const parsed = JSON.parse(request.text) as Record<string, unknown>;
  const translated: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (Array.isArray(value)) {
      const spans = value.map((span) => String(span));
      if (corruptSentinels) {
        const index = spans.findIndex((span) => span.length > 0);
        if (index >= 0) {
          spans[index] = `${spans[index]} {renamed}`;
        }
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
    providerId: "deterministic" as const,
    isPlaceholder: false,
  };
}

describe("15D.14.F.3.12 — global provider pacing", () => {
  let clockMs = Date.now();

  beforeEach(async () => {
    clockMs = Date.now();
    setLocalizationProviderClockForTests(() => clockMs);
    setLocalizationProviderPacingIntervalMsForTests(LOCALIZATION_PROVIDER_MIN_INTERVAL_MS_DEFAULT);
    setThinGeminiProviderStateForceMemoryForTests(true);
    resetThinGeminiProviderStateForTests();
    process.env.HU_PLP_THIN_GEMINI_MIN_SPACING_MS = "0";
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
      participantId: "participant-admin-f312",
    }));
  });

  afterEach(() => {
    setLocalizationProviderClockForTests(null);
    setLocalizationProviderPacingIntervalMsForTests(null);
    setThinGeminiProviderStateForceMemoryForTests(false);
    resetThinGeminiProviderStateForTests();
    setLanguageActivationJobProcessDepsForTests(null);
    setLanguageActivationJobAdminAssertOverrideForTests(null);
    resetLanguageActivationJobSchedulerForTests();
    delete process.env.HU_PLP_THIN_GEMINI_MIN_SPACING_MS;
  });

  it("1–4, 6–8, 9–13 default interval, permit, cooldown precedence, shared state, atomic acquire", async () => {
    assert.equal(LOCALIZATION_PROVIDER_MIN_INTERVAL_MS_DEFAULT, 10_000);
    setLocalizationProviderPacingIntervalMsForTests(null);
    const previous = process.env.LOCALIZATION_PROVIDER_MIN_INTERVAL_MS;
    delete process.env.LOCALIZATION_PROVIDER_MIN_INTERVAL_MS;
    assert.equal(resolveLocalizationProviderMinIntervalMs(undefined), 10_000);
    assert.equal(resolveLocalizationProviderMinIntervalMs("0"), 10_000);
    assert.equal(resolveLocalizationProviderMinIntervalMs("15000"), 15_000);
    if (previous === undefined) {
      delete process.env.LOCALIZATION_PROVIDER_MIN_INTERVAL_MS;
    } else {
      process.env.LOCALIZATION_PROVIDER_MIN_INTERVAL_MS = previous;
    }
    setLocalizationProviderPacingIntervalMsForTests(10_000);

    let calls = 0;
    const first = await runLocalizationProviderRequest(async () => {
      calls += 1;
      return "ok";
    });
    assert.equal(first, "ok");
    assert.equal(calls, 1);
    const state = await readThinGeminiProviderState();
    assert.equal(state?.pacingIntervalMs, 10_000);
    assert.equal(state?.providerId, "thin_gemini");
    assert.equal("locale" in (state ?? {}), false);
    const nextAllowedAt = state?.nextProviderRequestAt ?? "";
    assert.equal(nextAllowedAt, new Date(clockMs + 10_000).toISOString());

    await assert.rejects(
      () => runLocalizationProviderRequest(async () => {
        calls += 1;
        return "second";
      }),
      (error: unknown) => {
        assert.equal(isLocalizationProviderPacingDeferredError(error), true);
        assert.equal(isActivationProviderTransientError(error), false);
        assert.equal(error instanceof TranslationProviderError, false);
        return true;
      },
    );
    assert.equal(calls, 1);

    clockMs += 10_000;
    const third = await runLocalizationProviderRequest(async () => {
      calls += 1;
      return "third";
    });
    assert.equal(third, "third");
    assert.equal(calls, 2);

    await assert.rejects(
      () => withThinGeminiGovernor(async () => {
        calls += 1;
        return "plp";
      }),
      (error: unknown) => isLocalizationProviderPacingDeferredError(error),
    );
    assert.equal(calls, 2);

    clockMs += 10_000;
    await runLocalizationProviderRequest(async () => {
      calls += 1;
      return "ct";
    });
    await assert.rejects(
      () => runLocalizationProviderRequest(async () => {
        calls += 1;
        return "ct-2";
      }),
      (error: unknown) => isLocalizationProviderPacingDeferredError(error),
    );
    assert.equal(calls, 3);

    const pacingUntil = (await readLocalizationProviderPacing(clockMs)).nextProviderRequestAt;
    await activateLocalizationProviderPressure({
      category: "rate_limited",
      nowMs: clockMs,
      retryAfterSeconds: null,
    });
    const blocked = await readLocalizationProviderBlockedUntil(clockMs);
    assert.equal(blocked, new Date(clockMs + 60_000).toISOString());
    assert.notEqual(blocked, pacingUntil);
    await assert.rejects(
      () => runLocalizationProviderRequest(async () => {
        calls += 1;
        return "during-cooldown";
      }),
      (error: unknown) => error instanceof TranslationProviderError && error.code === "rate_limited",
    );
    assert.equal(calls, 3);

    clockMs += 60_000;
    resetThinGeminiProviderStateForTests();
    await runLocalizationProviderRequest(async () => "arm");
    calls += 1;
    const openPacing = await readLocalizationProviderPacing(clockMs);
    assert.equal(openPacing.blocked, true);
    await activateLocalizationProviderPressure({
      category: "timeout",
      nowMs: clockMs - 120_000,
      retryAfterSeconds: 1,
    });
    const afterExpiredCooldown = await readLocalizationProviderBlockedUntil(clockMs);
    assert.equal(afterExpiredCooldown, openPacing.nextProviderRequestAt);
    await assert.rejects(
      () => runLocalizationProviderRequest(async () => {
        calls += 1;
        return "still-paced";
      }),
      (error: unknown) => isLocalizationProviderPacingDeferredError(error),
    );

    clockMs += 10_000;
    resetThinGeminiProviderStateForTests();
    const parallelCalls = { n: 0 };
    const parallel = await Promise.allSettled([
      runLocalizationProviderRequest(async () => {
        parallelCalls.n += 1;
        return "a";
      }),
      runLocalizationProviderRequest(async () => {
        parallelCalls.n += 1;
        return "b";
      }),
    ]);
    const fulfilled = parallel.filter((row) => row.status === "fulfilled");
    const rejected = parallel.filter((row) => row.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(parallelCalls.n, 1);
    assert.equal(
      isLocalizationProviderPacingDeferredError(
        rejected[0]?.status === "rejected" ? rejected[0].reason : null,
      ),
      true,
    );

    const durableUntil = (await readThinGeminiProviderState())?.nextProviderRequestAt ?? null;
    assert.ok(durableUntil);
    resetLanguageActivationJobSchedulerForTests();
    const pacingStill = await readLocalizationProviderPacing(clockMs);
    assert.equal(pacingStill.blocked, true);
    assert.equal(pacingStill.nextProviderRequestAt, durableUntil);
    clockMs += 10_000;
    assert.equal((await readLocalizationProviderPacing(clockMs)).blocked, false);
  });

  it("5, 8, 14–16 WEB_UI success yields, structure attempt waits, checkpoint stays resumable", async () => {
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
    let providerCalls = 0;
    let corrupt = false;
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: async () => {
        const { evaluateLanguageLocalizationReadiness } = await import(
          "../../../src/modules/language/language-localization-activation/language-localization-readiness-evaluator.js"
        );
        const readiness = await evaluateLanguageLocalizationReadiness({
          locale: "eo",
          skipCorpusPlan: true,
        });
        return {
          pack: "closure07" as const,
          locale: "eo",
          mode: "execute" as const,
          readiness,
          plan: {
            pack: "closure07" as const,
            locale: "eo",
            mode: "execute" as const,
            registryEligible: true,
            items: [],
            summary: {
              ctWorkItems: 0,
              plpWorkItems: 0,
              totalWorkItems: 0,
            },
          },
        } as never;
      },
      webUiPreparationDeps: {
        includePaths: TWO_BATCH_PATHS,
        now: () => new Date(clockMs).toISOString(),
        loadLiveTerminology: async () => "",
        translator: (request) =>
          runLocalizationProviderRequest(async () => {
            providerCalls += 1;
            return echo(request, corrupt);
          }),
      },
    });

    let job = await processLanguageActivationJob(started.job!.jobId, { webUiTick: true });
    assert.equal(providerCalls, 1);
    assert.equal(job.domains.webUi.completedBatches, 1);
    assert.equal(job.domains.webUi.providerFailure, false);
    assert.equal(job.domains.webUi.transientFailureCount ?? 0, 0);
    assert.notEqual(job.domains.webUi.preparationPhase, "failed");
    const checkpoint = await getWebUiActivationCheckpointByJobId(started.job!.jobId);
    assert.ok(checkpoint);
    assert.equal(checkpoint!.completedBatchCount, 1);
    assert.equal(checkpoint!.nextAttemptAt, new Date(clockMs + 10_000).toISOString());
    const snapshot = getWebUiActivationSchedulerSnapshotForTests(started.job!.jobId);
    assert.equal(snapshot.delayedPending, true);
    assert.equal(snapshot.delayedNextAttemptAt, checkpoint!.nextAttemptAt);

    job = await processLanguageActivationJob(started.job!.jobId, { webUiTick: true });
    assert.equal(providerCalls, 1);
    assert.equal(job.domains.webUi.completedBatches, 1);
    assert.equal(job.domains.webUi.transientFailureCount ?? 0, 0);
    assert.equal(job.domains.webUi.providerFailure, false);

    resetLanguageActivationJobSchedulerForTests();
    const resumed = await resumeIncompleteWebUiActivationJobsOnBoot();
    assert.ok(resumed.scheduled >= 1);
    const afterBoot = getWebUiActivationSchedulerSnapshotForTests(started.job!.jobId);
    assert.equal(afterBoot.delayedPending, true);
    assert.equal(afterBoot.delayedNextAttemptAt, checkpoint!.nextAttemptAt);

    clockMs += 10_000;
    corrupt = true;
    job = await processLanguageActivationJob(started.job!.jobId, { webUiTick: true });
    assert.equal(providerCalls, 2);
    assert.equal(job.domains.webUi.completedBatches, 1);
    assert.equal(job.domains.webUi.preparationPhase, "primary");
    assert.equal(job.domains.webUi.providerFailure, false);
    assert.equal(job.status, "running");
    const mid = await getWebUiActivationCheckpointByJobId(started.job!.jobId);
    assert.equal(mid?.structureRetryCount ?? 0, 0);
    assert.equal(mid?.transientFailureCount ?? 0, 0);
    const waiting = await listWebUiActivationBatches(mid!.checkpointId, "primary");
    const paced = waiting.find((batch) => batch.reason === WEB_UI_STRUCTURE_PACING_REASON);
    assert.ok(paced);
    assert.equal(paced!.status, "pending");
    assert.equal(paced!.attempts, 1);

    job = await processLanguageActivationJob(started.job!.jobId, { webUiTick: true });
    assert.equal(providerCalls, 2);

    clockMs += 10_000;
    job = await processLanguageActivationJob(started.job!.jobId, { webUiTick: true });
    assert.equal(providerCalls, 3);
    assert.equal(job.status, "running");
    assert.equal(job.domains.webUi.preparationPhase, "structure_retry");
    assert.equal(job.domains.webUi.providerFailure, false);
    assert.equal(job.domains.webUi.completedBatches, 1);
    const structured = await getWebUiActivationCheckpointByJobId(started.job!.jobId);
    assert.equal(structured?.structureRetryCount, 1);
    assert.equal(structured?.phase, "structure_retry");
    assert.notEqual(structured?.phase, "failed");

    resetLanguageActivationJobSchedulerForTests();
    const structureBoot = await resumeIncompleteWebUiActivationJobsOnBoot();
    assert.ok(structureBoot.scheduled >= 1);
    const structureSnap = getWebUiActivationSchedulerSnapshotForTests(started.job!.jobId);
    assert.equal(structureSnap.delayedPending, true);
    assert.equal(structureSnap.delayedNextAttemptAt, structured?.nextAttemptAt ?? null);
  });

  it("17–18 Gate 15D.9.1 still blocks CT/PLP until WEB_UI is ready", () => {
    const driver = readFileSync(
      path.join(apiSrc, "modules/language/localization-reconciliation-driver.ts"),
      "utf8",
    );
    const eligibility = driver.slice(driver.indexOf("async function assess"));
    const webUiGate = eligibility.indexOf('reason: "web_ui_not_ready"');
    const cooldownGate = eligibility.indexOf('reason: "provider_cooldown"');
    const measure = eligibility.indexOf("await measureCt(");
    assert.ok(webUiGate > 0);
    assert.ok(cooldownGate > webUiGate);
    assert.ok(measure > webUiGate);
    assert.match(driver, /publicWebUi\.dataReady !== true/);
    assert.match(driver, /participantWebUi\.dataReady !== true/);
    const pressure = readFileSync(
      path.join(apiSrc, "modules/language/localization-provider-governor.ts"),
      "utf8",
    );
    assert.match(pressure, /tryAcquireLocalizationProviderPacingPermit/);
    assert.doesNotMatch(pressure, /zh-hant|zh-Hant/);
  });

  it("pressure error stays distinct from pacing", () => {
    const pressure = localizationProviderPressureError(30);
    assert.equal(isLocalizationProviderPacingDeferredError(pressure), false);
    assert.equal(isActivationProviderTransientError(pressure), true);
  });
});
