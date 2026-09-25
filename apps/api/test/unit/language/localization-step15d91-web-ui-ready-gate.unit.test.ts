/**
 * Step 15D.9.1 — WEB_UI READY gate before residual CT / Civic Media PLP.
 * Deterministic. No Gemini. No staging/production writes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { emptyLanguageLocalizationCountBucket } from "@hu/types";
import type { LanguageActivationWebUiDomainProgress } from "@hu/types";

import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/index.js";
import {
  isLanguageActivationWebUiReadyForHistoricalEnqueue,
  processLanguageActivationJob,
  resetLanguageActivationJobSchedulerForTests,
  resetLanguageActivationJobStoreForTests,
  setLanguageActivationJobAdminAssertOverrideForTests,
  setLanguageActivationJobForceMemoryForTests,
  setLanguageActivationJobProcessDepsForTests,
  startAndProcessLanguageActivationJobForTests,
  startOrResumeLanguageActivationJob,
} from "../../../src/modules/language/language-localization-activation/index.js";
import { getLanguageActivationJobById } from "../../../src/modules/language/language-localization-activation/language-activation-job.repository.js";
import {
  getWebUiActivationCheckpointByJobId,
  resetWebUiActivationCheckpointStoreForTests,
  setWebUiActivationCheckpointForceMemoryForTests,
  upsertWebUiActivationCheckpoint,
} from "../../../src/modules/web-ui-message-packs/web-ui-activation-checkpoint.repository.js";
import {
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
  upsertWebUiMessagePack,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import { loadBundledEnglishWebUiMessagePack } from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.validate.js";
import { loadPublicWebUiEnglishCorpus } from "../../../src/modules/web-ui-message-packs/web-ui-draft-builder.js";
import { TranslationProviderError } from "../../../src/modules/language/translation.config.js";
import type { TranslationProviderRequest } from "../../../src/modules/language/translation-provider.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const TWO_BATCH_PATHS = loadPublicWebUiEnglishCorpus().requiredPaths.slice(0, 12);

function readyWebUi(
  overrides: Partial<LanguageActivationWebUiDomainProgress> = {},
): LanguageActivationWebUiDomainProgress {
  return {
    status: "ready",
    dataReady: true,
    missingKeyCount: 0,
    emptyKeyCount: 0,
    requiredKeyCount: 10,
    effectiveSource: "remote",
    detail: "Public interface ready",
    preparationPhase: "ready",
    checkpointId: "cp-1",
    sourceHash: "hash-current",
    totalBatches: 1,
    completedBatches: 1,
    totalLeaves: 10,
    completedLeaves: 10,
    providerFailure: false,
    nextAttemptAt: null,
    transientFailureCount: 0,
    lastTransientFailure: null,
    ...overrides,
  };
}

function gate(input: {
  readonly webUi: LanguageActivationWebUiDomainProgress;
  readonly publicReady?: boolean;
  readonly participantReady?: boolean;
}): boolean {
  return isLanguageActivationWebUiReadyForHistoricalEnqueue({
    webUi: input.webUi,
    publicWebUiDataReady: input.publicReady ?? true,
    participantWebUiDataReady: input.participantReady ?? true,
  });
}

describe("Step 15D.9.1 WEB_UI READY gate (pure)", () => {
  it("1–10 blocked states + dataReady/stale measured readiness", () => {
    assert.equal(gate({ webUi: readyWebUi({ status: "pending", preparationPhase: null, dataReady: false }) }), false);
    assert.equal(
      gate({
        webUi: readyWebUi({
          status: "waiting_for_data",
          preparationPhase: null,
          dataReady: false,
        }),
      }),
      false,
    );
    for (const phase of ["primary", "quality", "validating", "publishing", "provider_cooldown"] as const) {
      assert.equal(
        gate({
          webUi: readyWebUi({
            status: "in_progress",
            preparationPhase: phase,
            dataReady: false,
          }),
        }),
        false,
        phase,
      );
    }
    assert.equal(
      gate({
        webUi: readyWebUi({
          status: "failed",
          preparationPhase: "failed",
          dataReady: false,
          providerFailure: true,
        }),
      }),
      false,
    );
    assert.equal(gate({ webUi: readyWebUi({ dataReady: false }) }), false);
    assert.equal(gate({ webUi: readyWebUi(), publicReady: false }), false);
    assert.equal(gate({ webUi: readyWebUi(), participantReady: false }), false);
  });

  it("11–12 READY/current allows historical enqueue", () => {
    assert.equal(gate({ webUi: readyWebUi() }), true);
    assert.equal(
      gate({
        webUi: readyWebUi({ preparationPhase: null, status: "ready", dataReady: true }),
      }),
      true,
    );
  });
});

describe("Step 15D.9.1 WEB_UI READY gate (job process)", () => {
  let activateCalls = 0;
  let residualCalls = 0;
  let plpCalls = 0;

  beforeEach(async () => {
    activateCalls = 0;
    residualCalls = 0;
    plpCalls = 0;
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
      participantId: "participant-admin-15d91",
    }));
  });

  afterEach(() => {
    setLanguageActivationJobProcessDepsForTests(null);
    setLanguageActivationJobAdminAssertOverrideForTests(null);
    setLanguageRegistryForceMemoryForTests(false);
    setWebUiMessagePackForceMemoryForTests(false);
    setWebUiActivationCheckpointForceMemoryForTests(false);
    setLanguageActivationJobForceMemoryForTests(false);
  });

  async function createLocale(locale: string) {
    return createLanguageRegistryRecord({
      locale,
      englishName: locale,
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
  }

  function trackingActivateDeps(extra: Record<string, unknown> = {}) {
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      skipWebUiPreparation: true,
      activate: async (input) => {
        activateCalls += 1;
        residualCalls += 1;
        plpCalls += 1;
        const { evaluateLanguageLocalizationReadiness } = await import(
          "../../../src/modules/language/language-localization-activation/language-localization-readiness-evaluator.js"
        );
        const readiness = await evaluateLanguageLocalizationReadiness({
          locale: input.locale,
          skipCorpusPlan: true,
          ctCounts: {
            ...emptyLanguageLocalizationCountBucket(),
            current: 1,
          },
          plpCounts: {
            ...emptyLanguageLocalizationCountBucket(),
            current: 1,
          },
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
            notes: ["15d91"],
          },
          PROVIDER_CALLS: 0 as const,
          WRITES_PERFORMED: 0 as const,
          seoIndexingEnabledUnchanged: true as const,
        };
      },
      ...extra,
    });
  }

  it("1–2 pending/waiting_for_data block CT and PLP", async () => {
    const record = await createLocale("ie");
    trackingActivateDeps();
    const view = await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.ok(
      view.job?.domains.webUi.status === "waiting_for_data" ||
        view.job?.domains.webUi.status === "pending",
    );
    assert.equal(view.job?.domains.webUi.dataReady, false);
    assert.equal(activateCalls, 0);
    assert.equal(residualCalls, 0);
    assert.equal(plpCalls, 0);
    assert.equal(view.job?.domains.ct.enqueueAttempted, false);
    assert.equal(view.job?.domains.plp.enqueueAttempted, false);
  });

  it("11–13 READY pack allows CT/PLP once; resume still reconciles via activate", async () => {
    const record = await createLocale("io");
    const english = loadBundledEnglishWebUiMessagePack();
    await upsertWebUiMessagePack({
      locale: "io",
      status: "published",
      messages: english as never,
      sourceNote: "15d91 ready pack",
    });
    trackingActivateDeps();
    const first = await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.equal(first.job?.domains.webUi.status, "ready");
    assert.equal(first.job?.domains.webUi.dataReady, true);
    assert.equal(activateCalls, 1);
    assert.equal(first.job?.domains.ct.enqueueAttempted, true);
    assert.equal(first.job?.domains.plp.enqueueAttempted, true);

    const second = await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.equal(second.job?.jobId, first.job?.jobId);
    // Explicit resume may call activate again; enqueueAttempted stays true (idempotent flags).
    assert.equal(second.job?.domains.ct.enqueueAttempted, true);
    assert.equal(second.job?.domains.ct.enqueuedAt, first.job?.domains.ct.enqueuedAt);
    assert.ok(activateCalls >= 1);
  });

  it("14 completed READY re-activation is idempotent no-op", async () => {
    const record = await createLocale("ia");
    const english = loadBundledEnglishWebUiMessagePack();
    await upsertWebUiMessagePack({
      locale: "ia",
      status: "published",
      messages: english as never,
    });
    trackingActivateDeps({
      evaluateReadiness: async (input: { locale: string }) => {
        const { evaluateLanguageLocalizationReadiness } = await import(
          "../../../src/modules/language/language-localization-activation/language-localization-readiness-evaluator.js"
        );
        const readiness = await evaluateLanguageLocalizationReadiness({
          locale: input.locale,
          skipCorpusPlan: true,
          ctCounts: { ...emptyLanguageLocalizationCountBucket(), current: 1 },
          plpCounts: { ...emptyLanguageLocalizationCountBucket(), current: 1 },
        });
        return {
          ...readiness,
          state: "READY" as const,
          languageDataReady: true,
          webUi: { ...readiness.webUi, dataReady: true, missingKeyCount: 0, emptyKeyCount: 0, englishFallbackKeyCount: 0, sampleMissingPaths: [] },
          participantWebUi: {
            ...readiness.participantWebUi,
            dataReady: true,
            missingKeyCount: 0,
            emptyKeyCount: 0,
            englishFallbackKeyCount: 0,
            sampleMissingPaths: [],
          },
          controlledVocabulary: {
            ...readiness.controlledVocabulary,
            presentationReady: true,
            conceptsMissingLocalizedLabel: 0,
            missingLocalizedLabelConceptIds: [],
          },
        };
      },
    });
    const first = await startAndProcessLanguageActivationJobForTests({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.ok(first.job);
    const callsAfterFirst = activateCalls;
    const again = await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    assert.equal(again.job?.jobId, first.job?.jobId);
    assert.match(again.notes.join(" "), /already completed|no new job/i);
    assert.equal(activateCalls, callsAfterFirst);
  });

  it("15 catalog expansion / measured not-ready blocks CT/PLP", async () => {
    const record = await createLocale("vo");
    // Partial pack → measured dataReady false even if a stale checkpoint claims ready.
    await upsertWebUiMessagePack({
      locale: "vo",
      status: "published",
      messages: { common: { save: "Konservi" } } as never,
      sourceNote: "partial",
    });
    trackingActivateDeps();
    const started = await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    assert.ok(started.job);
    await upsertWebUiActivationCheckpoint({
      checkpointId: `webui-act-${started.job.jobId}-stale`,
      jobId: started.job.jobId,
      locale: "vo",
      generation: 1,
      sourceHash: "stale-old-hash",
      terminologyMode: "live",
      phase: "ready",
      leafCount: 1,
      batchCount: 1,
      completedBatchCount: 1,
      failedBatchCount: 0,
      qualityBatchCount: 0,
      qualityCompletedBatchCount: 0,
      suspiciousPathCount: 0,
      englishName: "Volapük",
      nativeName: "Volapük",
      textDirection: "ltr",
      detail: "stale ready",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nextAttemptAt: null,
      transientFailureCount: 0,
      lastTransientFailure: null,
    });
    const job = await processLanguageActivationJob(started.job.jobId, {
      reconcileResiduals: true,
    });
    // Either rebases into preparing or remains not READY for current corpus — never activates residuals.
    assert.equal(activateCalls, 0);
    assert.equal(job.domains.ct.enqueueAttempted, false);
    assert.equal(job.domains.plp.enqueueAttempted, false);
  });

  it("3–8 active WEB_UI phases and cooldown block CT/PLP (source + runtime)", async () => {
    const serviceSrc = readFileSync(
      path.join(
        here,
        "../../../src/modules/language/language-localization-activation/language-activation-job.service.ts",
      ),
      "utf8",
    );
    assert.match(serviceSrc, /isLanguageActivationWebUiReadyForHistoricalEnqueue/);
    assert.doesNotMatch(serviceSrc, /waiting_for_data does not block enqueue/);
    assert.doesNotMatch(serviceSrc, /webUiStillPreparing/);

    const record = await createLocale("yi");
    trackingActivateDeps({
      skipWebUiPreparation: false,
      webUiPreparationDeps: {
        includePaths: TWO_BATCH_PATHS,
        translator: async (request: TranslationProviderRequest) => {
          const parsed = JSON.parse(request.text) as Record<string, string>;
          return {
            translatedText: JSON.stringify(
              Object.fromEntries(
                Object.entries(parsed).map(([key, value]) => [key, `[xx] ${value}`]),
              ),
            ),
            providerId: "deterministic",
            isPlaceholder: false,
          };
        },
        loadLiveTerminology: async () => "",
      },
    });
    const started = await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    assert.ok(started.job);
    const partial = await processLanguageActivationJob(started.job.jobId, {
      reconcileResiduals: true,
    });
    assert.equal(partial.domains.webUi.status, "in_progress");
    assert.ok(
      partial.domains.webUi.preparationPhase === "primary" ||
        partial.domains.webUi.preparationPhase === "quality" ||
        partial.domains.webUi.preparationPhase === "validating" ||
        partial.domains.webUi.preparationPhase === "publishing",
    );
    assert.equal(activateCalls, 0);

    const checkpoint = await getWebUiActivationCheckpointByJobId(partial.jobId);
    assert.ok(checkpoint);
    await upsertWebUiActivationCheckpoint({
      ...checkpoint,
      phase: "provider_cooldown",
      nextAttemptAt: new Date(Date.now() + 60_000).toISOString(),
      transientFailureCount: 1,
      lastTransientFailure: "rate_limited",
      detail: "Waiting for translation provider…",
    });
    const cooling = await processLanguageActivationJob(partial.jobId, { webUiTick: true });
    assert.equal(cooling.domains.webUi.preparationPhase, "provider_cooldown");
    assert.equal(activateCalls, 0);
    resetLanguageActivationJobSchedulerForTests();
  });

  it("8 failed WEB_UI blocks CT/PLP", async () => {
    const record = await createLocale("cy");
    trackingActivateDeps({
      skipWebUiPreparation: false,
      webUiPreparationDeps: {
        includePaths: TWO_BATCH_PATHS.slice(0, 6),
        translator: async () => {
          throw new TranslationProviderError("safety_rejected", "blocked");
        },
        loadLiveTerminology: async () => "",
      },
    });
    const started = await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    assert.ok(started.job);
    const failed = await processLanguageActivationJob(started.job.jobId, {
      reconcileResiduals: true,
    });
    assert.equal(failed.status, "failed");
    assert.equal(failed.domains.webUi.status, "failed");
    assert.equal(activateCalls, 0);
    const stored = await getLanguageActivationJobById(failed.jobId);
    assert.equal(stored?.domains.ct.enqueueAttempted, false);
    assert.equal(stored?.domains.plp.enqueueAttempted, false);
  });

  it("24 no locale-specific branches in gate implementation", () => {
    const domainsSrc = readFileSync(
      path.join(
        here,
        "../../../src/modules/language/language-localization-activation/language-activation-job.domains.ts",
      ),
      "utf8",
    );
    const helper = domainsSrc.slice(
      domainsSrc.indexOf("isLanguageActivationWebUiReadyForHistoricalEnqueue"),
      domainsSrc.indexOf("export function buildControlledVocabularyDomainProgress"),
    );
    assert.doesNotMatch(helper, /\bka\b|\bhe\b|georgian|hebrew|allowlist/i);
  });
});
