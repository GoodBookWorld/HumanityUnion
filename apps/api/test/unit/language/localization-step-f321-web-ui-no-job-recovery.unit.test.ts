/**
 * STEP F.3.21 — automatic WEB_UI recovery when no activation job is active.
 * No provider calls. No locale-specific repair.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { LanguageLocalizationReadinessReport, LanguageWebUiReadinessSlice } from "@hu/types";
import { emptyLanguageLocalizationCountBucket } from "@hu/types";

import { LOCALIZATION_PROVIDER_MIN_INTERVAL_MS_DEFAULT } from "../../../src/modules/language/localization-provider-governor.js";
import {
  LOCALIZATION_RECONCILIATION_NO_PROGRESS_BASE_DELAY_MS,
  resetLocalizationReconciliationDriverForTests,
  runLocalizationReconciliationPass,
  setLocalizationReconciliationDriverDepsForTests,
} from "../../../src/modules/language/localization-reconciliation-driver.js";
import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/language-registry/index.js";
import {
  emptyPendingDomains,
  ensureWebUiPreparationForUnreadyLocale,
  isLanguageActivationWebUiReadyForHistoricalEnqueue,
  resetLanguageActivationJobSchedulerForTests,
  resumeIncompleteWebUiActivationJobsOnBoot,
  setLanguageActivationJobProcessDepsForTests,
} from "../../../src/modules/language/language-localization-activation/index.js";
import {
  getLanguageActivationJobById,
  listLanguageActivationJobs,
  resetLanguageActivationJobStoreForTests,
  saveLanguageActivationJob,
  setLanguageActivationJobForceMemoryForTests,
} from "../../../src/modules/language/language-localization-activation/language-activation-job.repository.js";
import {
  getWebUiActivationCheckpoint,
  listWebUiActivationBatches,
  resetWebUiActivationCheckpointStoreForTests,
  setWebUiActivationCheckpointForceMemoryForTests,
  upsertWebUiActivationBatch,
  upsertWebUiActivationCheckpoint,
} from "../../../src/modules/web-ui-message-packs/web-ui-activation-checkpoint.repository.js";
import {
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import { WEB_UI_PROVIDER_SHAPE_VERSION } from "../../../src/modules/web-ui-message-packs/web-ui-provider-output-structure.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const LOCALE = "eo";

function webUiSlice(dataReady: boolean): LanguageWebUiReadinessSlice {
  return {
    engineReady: true,
    dataReady,
    requiredKeyCount: 4,
    missingKeyCount: 0,
    emptyKeyCount: 0,
    englishFallbackKeyCount: 0,
    sampleMissingPaths: [],
    structuralInvalidCount: dataReady ? 0 : 1,
  };
}

function readinessReport(input: {
  readonly languageId: string;
  readonly dataReady: boolean;
}): LanguageLocalizationReadinessReport {
  const bucket = emptyLanguageLocalizationCountBucket();
  const webUi = webUiSlice(input.dataReady);
  return {
    pack: "closure07",
    locale: LOCALE as LanguageLocalizationReadinessReport["locale"],
    languageId: input.languageId,
    registry: {
      enabled: true,
      contentTranslationEnabled: true,
      searchEnabled: false,
      seoIndexingEnabled: false,
      pwaPersistedReadingEnabled: false,
    },
    engineReady: true,
    languageDataReady: input.dataReady,
    state: input.dataReady ? "READY" : "DATA_NOT_READY",
    webUi,
    participantWebUi: webUiSlice(true),
    controlledVocabulary: {
      presentationReady: true,
      conceptsChecked: 0,
      conceptsWithTerminologyPreferredTerm: 0,
      conceptsWithWebUiFallbackOnly: 0,
      conceptsMissingLocalizedLabel: 0,
      missingLocalizedLabelConceptIds: [],
      missingPreferredTermGaps: [],
    },
    higherAuthority: {
      brandPublished: null,
      legalPublished: null,
      note: null,
    },
    pwaCivic: {
      status: "DISABLED",
      enabled: false,
      current: 0,
      missing: 0,
      stale: 0,
      invalid: 0,
      failed: 0,
      pending: 0,
      workItemsRequired: 0,
    },
    ct: { ...bucket, missing: 1, workItemsRequired: 1 },
    plpMedia: { ...bucket, missing: 9, workItemsRequired: 9 },
    kindRows: [],
    seoReady: false,
    searchLocalizationReady: true,
    PROVIDER_CALLS: 0,
    WRITES_PERFORMED: 0,
    gaps: [],
  };
}

async function jobsForLocale() {
  const jobs = await listLanguageActivationJobs();
  return jobs.filter((job) => job.locale === LOCALE);
}

describe("STEP F.3.21 automatic WEB_UI no-job recovery", () => {
  let languageId = "";
  let webUiReady = false;

  beforeEach(async () => {
    webUiReady = false;
    setLanguageRegistryForceMemoryForTests(true);
    setLanguageActivationJobForceMemoryForTests(true);
    setWebUiActivationCheckpointForceMemoryForTests(true);
    setWebUiMessagePackForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    resetLanguageActivationJobStoreForTests();
    resetWebUiActivationCheckpointStoreForTests();
    resetWebUiMessagePackStoreForTests();
    resetLanguageActivationJobSchedulerForTests();
    resetLocalizationReconciliationDriverForTests();
    await ensureLanguageRegistrySeeded();
    const record = await createLanguageRegistryRecord({
      locale: LOCALE,
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
    languageId = record.languageId;
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      skipWebUiPreparation: true,
      readProviderCooldown: async () => ({
        active: false,
        cooldownUntil: null,
        pressureCategory: null,
      }),
      assessWebUi: async () => webUiSlice(webUiReady),
      evaluateReadiness: async () =>
        readinessReport({ languageId, dataReady: webUiReady }),
      activate: async () => {
        throw new Error("historical CT/PLP must stay blocked until WEB_UI is ready");
      },
    });
  });

  afterEach(() => {
    setLanguageActivationJobProcessDepsForTests(null);
    setLanguageRegistryForceMemoryForTests(false);
    setLanguageActivationJobForceMemoryForTests(false);
    setWebUiActivationCheckpointForceMemoryForTests(false);
    setWebUiMessagePackForceMemoryForTests(false);
    resetLocalizationReconciliationDriverForTests();
    resetLanguageActivationJobSchedulerForTests();
  });

  function installDriver(input?: {
    readonly enabled?: boolean;
    readonly locale?: string;
    readonly onResidual?: () => void;
    readonly onPlp?: () => void;
    readonly onEnsure?: () => void;
  }) {
    const locale = input?.locale ?? LOCALE;
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => ({
        languageId,
        locale,
        enabled: input?.enabled ?? true,
        contentTranslationEnabled: input?.enabled ?? true,
        searchEnabled: false,
        seoIndexingEnabled: false,
        pwaPersistedReadingEnabled: false,
      }),
      assessWebUi: async () => webUiSlice(webUiReady),
      measureCtWork: async () => ({
        ct: {
          current: 0,
          missing: 1,
          stale: 0,
          invalid: 0,
          failed: 0,
          pending: 0,
          workItemsRequired: 1,
        },
        kindRows: [],
      }),
      planBackfill: async () => ({
        pack: "closure07" as const,
        locale,
        mode: "dry-run" as const,
        registryEligible: true,
        items: [
          {
            owner: "PLP" as const,
            kindId: "public_editorial",
            locale,
            workItemsRequired: 9,
            missing: 9,
            stale: 0,
            invalid: 0,
            current: 0,
          },
        ],
        excluded: [],
        summary: { ctWorkItems: 1, plpWorkItems: 9, skippedCurrent: 0 },
        PROVIDER_CALLS: 0 as const,
        WRITES_PERFORMED: 0 as const,
      }),
      runResidual: async () => {
        input?.onResidual?.();
        return {
          mode: "execute" as const,
          preAudit: {} as never,
          selection: { ready: [], blocked: [] } as never,
          RETRY_READY_IDENTITIES: 0,
          RETRY_BLOCKED_IDENTITIES: 0,
          RETRY_SELECTED_IDENTITIES: 0,
          selectedIdentities: [],
          blockedIdentities: [],
          schedule: [],
          presentationsToEnqueue: 0,
          presentationGroupingExplained: false,
          selectedWorkItems: [],
          presentationsScheduled: 0,
          presentationsDeduped: 0,
          presentationsFailed: 0,
          enqueueResults: [],
          abortReason: null,
        };
      },
      enqueuePlp: async () => {
        input?.onPlp?.();
      },
      ensureWebUiPreparation: async (ensureInput) => {
        input?.onEnsure?.();
        return ensureWebUiPreparationForUnreadyLocale({
          locale: ensureInput.locale,
          scheduleProcess: false,
        });
      },
    });
  }

  it("A. WEB_UI not ready and no job ensures recovery", async () => {
    let residual = 0;
    let ensured = 0;
    installDriver({
      onResidual: () => {
        residual += 1;
      },
      onEnsure: () => {
        ensured += 1;
      },
    });
    const pass = await runLocalizationReconciliationPass(LOCALE);
    assert.equal(pass.reason, "web_ui_not_ready");
    assert.equal(pass.ran, false);
    assert.equal(ensured, 1);
    assert.equal(residual, 0);
    assert.equal(pass.continuationScheduled, true);
    assert.equal(
      pass.continuationDelayMs,
      LOCALIZATION_RECONCILIATION_NO_PROGRESS_BASE_DELAY_MS,
    );
    const jobs = await jobsForLocale();
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0]?.generation, 1);
    assert.equal(jobs[0]?.status, "queued");
  });

  it("B. compatible active job is not duplicated", async () => {
    const first = await ensureWebUiPreparationForUnreadyLocale({
      locale: LOCALE,
      scheduleProcess: false,
    });
    const second = await ensureWebUiPreparationForUnreadyLocale({
      locale: LOCALE,
      scheduleProcess: false,
    });
    assert.equal(first.action, "created");
    assert.equal(second.action, "reused");
    assert.equal(second.jobId, first.jobId);
    assert.equal(second.generation, first.generation);
    assert.equal((await jobsForLocale()).length, 1);
  });

  it("C. compatible active checkpoint keeps completed batches", async () => {
    const first = await ensureWebUiPreparationForUnreadyLocale({
      locale: LOCALE,
      scheduleProcess: false,
    });
    const job = await getLanguageActivationJobById(first.jobId!);
    assert.ok(job);
    const now = new Date().toISOString();
    const checkpointId = `webui-act-${job.jobId}-keep`;
    await upsertWebUiActivationCheckpoint({
      checkpointId,
      jobId: job.jobId,
      locale: LOCALE,
      generation: job.generation,
      sourceHash: "abc123",
      terminologyMode: "live",
      phase: "primary",
      leafCount: 4,
      batchCount: 2,
      completedBatchCount: 1,
      failedBatchCount: 0,
      qualityBatchCount: 0,
      qualityCompletedBatchCount: 0,
      suspiciousPathCount: 0,
      englishName: "Esperanto",
      nativeName: "Esperanto",
      textDirection: "ltr",
      detail: null,
      createdAt: now,
      updatedAt: now,
      providerShapeVersion: WEB_UI_PROVIDER_SHAPE_VERSION,
    });
    await upsertWebUiActivationBatch({
      checkpointId,
      batchId: "batch-ok",
      phase: "primary",
      namespace: "common",
      keys: ["common.save"],
      values: { "common.save": "kept" },
      status: "ok",
      attempts: 1,
      reason: null,
      updatedAt: now,
    });
    await saveLanguageActivationJob({
      ...job,
      status: "running",
      startedAt: now,
      domains: {
        ...job.domains,
        webUi: {
          ...job.domains.webUi,
          status: "in_progress",
          preparationPhase: "primary",
          checkpointId,
          completedBatches: 1,
          totalBatches: 2,
          sourceHash: "abc123",
        },
      },
    });

    const again = await ensureWebUiPreparationForUnreadyLocale({
      locale: LOCALE,
      scheduleProcess: false,
    });
    assert.equal(again.action, "reused");
    assert.equal(again.jobId, job.jobId);
    assert.equal(again.generation, job.generation);
    const checkpoint = await getWebUiActivationCheckpoint(checkpointId);
    assert.equal(checkpoint?.completedBatchCount, 1);
    assert.equal(checkpoint?.phase, "primary");
    const batches = await listWebUiActivationBatches(checkpointId, "primary");
    assert.equal(batches.length, 1);
    assert.equal(batches[0]?.status, "ok");
    assert.equal((await jobsForLocale()).length, 1);
  });

  it("D. historical completed job does not block live WEB_UI recovery", async () => {
    const first = await ensureWebUiPreparationForUnreadyLocale({
      locale: LOCALE,
      scheduleProcess: false,
    });
    const job = await getLanguageActivationJobById(first.jobId!);
    assert.ok(job);
    await saveLanguageActivationJob({
      ...job,
      status: "completed",
      completedAt: new Date().toISOString(),
      diagnosticSummary: "completed — historical",
    });
    const recovered = await ensureWebUiPreparationForUnreadyLocale({
      locale: LOCALE,
      scheduleProcess: false,
    });
    assert.equal(recovered.action, "created");
    assert.notEqual(recovered.jobId, first.jobId);
    assert.equal(recovered.generation, (first.generation ?? 0) + 1);
    const third = await ensureWebUiPreparationForUnreadyLocale({
      locale: LOCALE,
      scheduleProcess: false,
    });
    assert.equal(third.action, "reused");
    assert.equal(third.jobId, recovered.jobId);
    assert.equal((await jobsForLocale()).length, 2);
  });

  it("E. WEB_UI ready does not create a recovery job", async () => {
    webUiReady = true;
    let ensured = 0;
    let residual = 0;
    installDriver({
      onEnsure: () => {
        ensured += 1;
      },
      onResidual: () => {
        residual += 1;
      },
    });
    const pass = await runLocalizationReconciliationPass(LOCALE);
    assert.equal(pass.ran, true);
    assert.equal(ensured, 0);
    assert.equal(residual, 1);
    assert.equal((await jobsForLocale()).length, 0);
    const direct = await ensureWebUiPreparationForUnreadyLocale({
      locale: LOCALE,
      scheduleProcess: false,
    });
    assert.equal(direct.action, "skipped");
    assert.equal(direct.reason, "web_ui_ready");
    assert.equal((await jobsForLocale()).length, 0);
  });

  it("F. disabled registry locale does not recover", async () => {
    let ensured = 0;
    installDriver({
      enabled: false,
      onEnsure: () => {
        ensured += 1;
      },
    });
    const pass = await runLocalizationReconciliationPass(LOCALE);
    assert.equal(pass.reason, "registry_ineligible");
    assert.equal(ensured, 0);
    const disabled = await createLanguageRegistryRecord({
      locale: "vo",
      englishName: "Volapuk",
      nativeName: "Volapuk",
      textDirection: "ltr",
      fallbackLocale: "en",
      enabled: false,
      contentTranslationEnabled: false,
      searchEnabled: false,
      seoIndexingEnabled: false,
      pwaPersistedReadingEnabled: false,
      uiTranslationStatus: "none",
    });
    const direct = await ensureWebUiPreparationForUnreadyLocale({
      locale: disabled.locale,
      scheduleProcess: false,
    });
    assert.equal(direct.action, "skipped");
    assert.equal(direct.reason, "registry_ineligible");
    const jobs = await listLanguageActivationJobs();
    assert.equal(jobs.filter((job) => job.locale === "vo").length, 0);
  });

  it("G. English does not recover", async () => {
    let ensured = 0;
    installDriver({
      locale: "en",
      onEnsure: () => {
        ensured += 1;
      },
    });
    const pass = await runLocalizationReconciliationPass("en");
    assert.equal(pass.reason, "source_locale");
    assert.equal(ensured, 0);
    const direct = await ensureWebUiPreparationForUnreadyLocale({
      locale: "en",
      scheduleProcess: false,
    });
    assert.equal(direct.action, "skipped");
    assert.equal(direct.reason, "source_locale");
  });

  it("H. repeated reconciliation ticks do not storm generations", async () => {
    installDriver();
    await runLocalizationReconciliationPass(LOCALE);
    await runLocalizationReconciliationPass(LOCALE);
    await runLocalizationReconciliationPass(LOCALE);
    const jobs = await jobsForLocale();
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0]?.generation, 1);
  });

  it("I. recovery leaves CT blocked before WEB_UI READY", async () => {
    let residual = 0;
    installDriver({
      onResidual: () => {
        residual += 1;
      },
    });
    await runLocalizationReconciliationPass(LOCALE);
    assert.equal(residual, 0);
    const gate = isLanguageActivationWebUiReadyForHistoricalEnqueue({
      webUi: emptyPendingDomains().webUi,
      publicWebUiDataReady: false,
      participantWebUiDataReady: true,
    });
    assert.equal(gate, false);
  });

  it("J. recovery leaves PLP blocked before WEB_UI READY", async () => {
    let plp = 0;
    installDriver({
      onPlp: () => {
        plp += 1;
      },
    });
    await runLocalizationReconciliationPass(LOCALE);
    assert.equal(plp, 0);
    const gate = isLanguageActivationWebUiReadyForHistoricalEnqueue({
      webUi: {
        ...emptyPendingDomains().webUi,
        status: "in_progress",
        preparationPhase: "primary",
      },
      publicWebUiDataReady: false,
      participantWebUiDataReady: false,
    });
    assert.equal(gate, false);
  });

  it("K. WEB_UI becoming READY lets the existing reconciliation path run", async () => {
    let residual = 0;
    let plp = 0;
    installDriver({
      onResidual: () => {
        residual += 1;
      },
      onPlp: () => {
        plp += 1;
      },
    });
    const blocked = await runLocalizationReconciliationPass(LOCALE);
    assert.equal(blocked.reason, "web_ui_not_ready");
    assert.equal(residual, 0);
    assert.equal(plp, 0);
    webUiReady = true;
    const opened = await runLocalizationReconciliationPass(LOCALE);
    assert.equal(opened.ran, true);
    assert.equal(residual, 1);
    assert.equal(plp, 1);
    const gate = isLanguageActivationWebUiReadyForHistoricalEnqueue({
      webUi: {
        ...emptyPendingDomains().webUi,
        status: "ready",
        dataReady: true,
        preparationPhase: "ready",
      },
      publicWebUiDataReady: true,
      participantWebUiDataReady: true,
    });
    assert.equal(gate, true);
  });

  it("L. restart discovery resumes the same job", async () => {
    const first = await ensureWebUiPreparationForUnreadyLocale({
      locale: LOCALE,
      scheduleProcess: false,
    });
    resetLanguageActivationJobSchedulerForTests();
    const resumed = await resumeIncompleteWebUiActivationJobsOnBoot();
    const second = await ensureWebUiPreparationForUnreadyLocale({
      locale: LOCALE,
      scheduleProcess: false,
    });
    assert.ok(resumed.scheduled >= 0);
    assert.equal(second.action, "reused");
    assert.equal(second.jobId, first.jobId);
    assert.equal(second.generation, first.generation);
    assert.equal((await jobsForLocale()).length, 1);
  });

  it("M/N/O. pacing, shape version, and 99 percent semantics stay in place", () => {
    assert.equal(LOCALIZATION_PROVIDER_MIN_INTERVAL_MS_DEFAULT, 10_000);
    assert.equal(WEB_UI_PROVIDER_SHAPE_VERSION, 4);
    const progress = readFileSync(
      path.resolve(
        here,
        "../../../../web/src/features/administration/admin-languages-localization-progress.ts",
      ),
      "utf8",
    );
    assert.match(
      progress,
      /readinessState === "READY" \? 100 : Math\.min\(99, rounded\)/,
    );
    const driver = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/language/localization-reconciliation-driver.ts",
      ),
      "utf8",
    );
    const service = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/language/language-localization-activation/language-activation-job.service.ts",
      ),
      "utf8",
    );
    assert.match(driver, /scheduleProcess: true/);
    assert.doesNotMatch(driver, /locale === "ar"/);
    assert.doesNotMatch(service, /locale === "ar"/);
    assert.doesNotMatch(driver, /showingCount/);
    assert.doesNotMatch(service, /showingCount/);
  });
});
