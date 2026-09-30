/**
 * STEP F.3.27.5 — a running activation job resumes WEB_UI preparation when the
 * current catalog is not ready. No live Gemini. No locale-specific branch.
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import type {
  LanguageActivationJobRecord,
  LanguageLocalizationReadinessReport,
  LanguageWebUiReadinessSlice,
  WebUiActivationCheckpointRecord,
  WebUiMessageTree,
} from "@hu/types";
import { emptyLanguageLocalizationCountBucket } from "@hu/types";

import {
  emptyPendingDomains,
  ensureWebUiPreparationForUnreadyLocale,
  isLanguageActivationWebUiReadyForHistoricalEnqueue,
  resetLanguageActivationJobSchedulerForTests,
  resumeIncompleteWebUiActivationJobsOnBoot,
  scheduleWebUiActivationTick,
  setLanguageActivationJobProcessDepsForTests,
} from "../../../src/modules/language/language-localization-activation/index.js";
import { buildWebUiDomainProgress } from "../../../src/modules/language/language-localization-activation/language-activation-job.domains.js";
import {
  getLanguageActivationJobById,
  listLanguageActivationJobs,
  resetLanguageActivationJobStoreForTests,
  saveLanguageActivationJob,
  setLanguageActivationJobForceMemoryForTests,
} from "../../../src/modules/language/language-localization-activation/language-activation-job.repository.js";
import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/language-registry/index.js";
import type { TranslationProviderRequest } from "../../../src/modules/language/translation-provider.js";
import {
  getWebUiActivationCheckpoint,
  listWebUiActivationBatches,
  resetWebUiActivationCheckpointStoreForTests,
  setWebUiActivationCheckpointForceMemoryForTests,
  upsertWebUiActivationCheckpoint,
} from "../../../src/modules/web-ui-message-packs/web-ui-activation-checkpoint.repository.js";
import {
  buildWebUiSourceFingerprintsByPath,
  fingerprintWebUiEnglishLeaf,
  hashWebUiEnglishFlatMap,
  loadPublicWebUiEnglishCorpus,
  unflattenWebUiMessageMap,
} from "../../../src/modules/web-ui-message-packs/web-ui-draft-builder.js";
import { webUiProgressFromCheckpoint } from "../../../src/modules/web-ui-message-packs/web-ui-activation-preparation.js";
import { classifyWebUiCatalogLeaves } from "../../../src/modules/web-ui-message-packs/web-ui-leaf-reuse.js";
import {
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
  upsertWebUiMessagePack,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";

const LOCALE = "eo";
const SAVE = "common.save";
const CANCEL = "common.cancel";
const NEW_KEY = "common.interfaceNote";
const PATHS = [SAVE, CANCEL, NEW_KEY] as const;
const CT_ENQUEUED_AT = "2026-09-30T02:49:25.834Z";
const PLP_ENQUEUED_AT = "2026-09-30T02:49:25.834Z";

function slice(dataReady: boolean, missing = dataReady ? 0 : 1): LanguageWebUiReadinessSlice {
  return {
    engineReady: true,
    dataReady,
    requiredKeyCount: 4115,
    missingKeyCount: missing,
    emptyKeyCount: 0,
    englishFallbackKeyCount: 0,
    sampleMissingPaths: dataReady ? [] : [NEW_KEY],
    structuralInvalidCount: 0,
  };
}

function report(input: {
  readonly languageId: string;
  readonly webUiReady: boolean;
  readonly participantReady?: boolean;
  readonly stateReady?: boolean;
}): LanguageLocalizationReadinessReport {
  const bucket = emptyLanguageLocalizationCountBucket();
  const ready = input.stateReady === true;
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
    languageDataReady: ready,
    state: ready ? "READY" : "BACKFILL_REQUIRED",
    webUi: slice(input.webUiReady),
    participantWebUi: slice(input.participantReady ?? true, input.participantReady === false ? 1 : 0),
    controlledVocabulary: {
      presentationReady: true,
      conceptsChecked: 0,
      conceptsWithTerminologyPreferredTerm: 0,
      conceptsWithWebUiFallbackOnly: 0,
      conceptsMissingLocalizedLabel: 0,
      missingLocalizedLabelConceptIds: [],
      missingPreferredTermGaps: [],
    },
    higherAuthority: { brandPublished: null, legalPublished: null, note: null },
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
    ct: { ...bucket, missing: ready ? 0 : 1, workItemsRequired: ready ? 0 : 1 },
    plpMedia: { ...bucket },
    kindRows: [],
    seoReady: false,
    searchLocalizationReady: true,
    PROVIDER_CALLS: 0,
    WRITES_PERFORMED: 0,
    gaps: [],
  };
}

function recordingTranslator(sent: string[][]) {
  let inFlight = 0;
  let maxInFlight = 0;
  return {
    sent,
    maxInFlight: () => maxInFlight,
    translate: async (request: TranslationProviderRequest) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      const parsed = JSON.parse(request.text) as Record<string, string[]>;
      sent.push(Object.keys(parsed).sort());
      const translated: Record<string, string[]> = {};
      for (const [key, spans] of Object.entries(parsed)) {
        translated[key] = spans.map((span) => `x${span.length}`);
      }
      inFlight -= 1;
      return {
        translatedText: JSON.stringify(translated),
        providerId: "deterministic" as const,
        isPlaceholder: false as const,
      };
    },
  };
}

async function waitFor(predicate: () => Promise<boolean> | boolean): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail("timed out waiting for WEB_UI recovery");
}

describe("STEP F.3.27.5 running-job WEB_UI recovery", () => {
  let languageId = "";
  let sequence = 0;
  let webUiReady = false;
  let participantReady = true;
  let languageReady = false;
  let activateCalls = 0;
  let acceptProvider = true;
  const sent: string[][] = [];
  const previousPacing = process.env.LOCALIZATION_PROVIDER_MIN_INTERVAL_MS;
  let translator = recordingTranslator(sent);

  beforeEach(async () => {
    acceptProvider = true;
    process.env.LOCALIZATION_PROVIDER_MIN_INTERVAL_MS = "0";
    webUiReady = false;
    sequence += 1;
    participantReady = true;
    languageReady = false;
    activateCalls = 0;
    sent.length = 0;
    translator = recordingTranslator(sent);
    setLanguageRegistryForceMemoryForTests(true);
    setLanguageActivationJobForceMemoryForTests(true);
    setWebUiActivationCheckpointForceMemoryForTests(true);
    setWebUiMessagePackForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    resetLanguageActivationJobStoreForTests();
    resetWebUiActivationCheckpointStoreForTests();
    resetWebUiMessagePackStoreForTests();
    resetLanguageActivationJobSchedulerForTests();
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
      readProviderCooldown: async () => ({
        active: false,
        cooldownUntil: null,
        pressureCategory: null,
      }),
      assessWebUi: async () => slice(webUiReady),
      evaluateReadiness: async () =>
        report({
          languageId,
          webUiReady,
          participantReady,
          stateReady: languageReady,
        }),
      activate: async () => {
        activateCalls += 1;
        throw new Error("CT/PLP enqueue must stay closed while WEB_UI is incomplete");
      },
      webUiPreparationDeps: {
        includePaths: PATHS,
        loadLiveTerminology: async () => "",
        loadPackagedWebUiCatalog: () => bundledShortcut(),
        loadBundledWebUiCatalog: () => bundledShortcut(),
        readProviderCooldown: async () => ({ active: false, cooldownUntil: null }),
        translator: async (request) => {
          if (!acceptProvider) {
            return {
              translatedText: "{}",
              providerId: "deterministic" as const,
              isPlaceholder: false as const,
            };
          }
          return translator.translate(request);
        },
      },
    });
  });

  afterEach(() => {
    acceptProvider = false;
    if (previousPacing == null) {
      delete process.env.LOCALIZATION_PROVIDER_MIN_INTERVAL_MS;
    } else {
      process.env.LOCALIZATION_PROVIDER_MIN_INTERVAL_MS = previousPacing;
    }
    setLanguageActivationJobProcessDepsForTests(null);
    setLanguageRegistryForceMemoryForTests(false);
    setLanguageActivationJobForceMemoryForTests(false);
    setWebUiActivationCheckpointForceMemoryForTests(false);
    setWebUiMessagePackForceMemoryForTests(false);
    resetLanguageActivationJobSchedulerForTests();
  });

  function bundledShortcut(): WebUiMessageTree {
    const corpus = loadPublicWebUiEnglishCorpus(PATHS);
    return unflattenWebUiMessageMap(
      Object.fromEntries(PATHS.map((pathKey) => [pathKey, `bundle:${corpus.flat[pathKey] ?? ""}`])),
    );
  }

  async function saveRunningJob(input?: {
    readonly status?: LanguageActivationJobRecord["status"];
    readonly startedAt?: string | null;
    readonly checkpointId?: string | null;
    readonly phase?: WebUiActivationCheckpointRecord["phase"];
    readonly withCheckpoint?: boolean;
  }): Promise<LanguageActivationJobRecord> {
    const now = "2026-09-26T20:14:23.740Z";
    const checkpointId = input?.checkpointId ?? `webui-act-f3275-${sequence}`;
    const domains = emptyPendingDomains();
    const job: LanguageActivationJobRecord = {
      jobId: `lang-act-eo-${sequence}-f3275`,
      locale: LOCALE,
      languageId,
      generation: 1,
      status: input?.status ?? "running",
      domains: {
        ...domains,
        brand: { ...domains.brand, status: "ready" },
        terminology: { ...domains.terminology, status: "ready" },
        ct: {
          ...domains.ct,
          status: "enqueued",
          enqueueAttempted: true,
          enqueuedAt: CT_ENQUEUED_AT,
        },
        plp: {
          ...domains.plp,
          status: "ready",
          enqueueAttempted: true,
          enqueuedAt: PLP_ENQUEUED_AT,
        },
        webUi: {
          ...domains.webUi,
          status: "ready",
          dataReady: true,
          preparationPhase: "ready",
          checkpointId: input?.withCheckpoint === false ? null : checkpointId,
          sourceHash: "old-catalog",
          missingKeyCount: 0,
        },
      },
      lastError: null,
      diagnosticSummary: "running — historical",
      createdAt: now,
      updatedAt: now,
      startedAt: input?.startedAt === undefined ? now : input.startedAt,
      completedAt: input?.status === "completed" ? now : null,
      createdByParticipantId: null,
      searchEnabledSnapshot: false,
      seoIndexingEnabledSnapshot: false,
    };
    await saveLanguageActivationJob(job);
    if (input?.withCheckpoint !== false) {
      await upsertWebUiActivationCheckpoint({
        checkpointId,
        jobId: job.jobId,
        locale: LOCALE,
        generation: 1,
        sourceHash: "old-catalog",
        terminologyMode: "live",
        phase: input?.phase ?? "ready",
        leafCount: 2,
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
        createdAt: now,
        updatedAt: now,
        preparationContract: "partial_reuse_v1",
      });
    }
    return job;
  }

  async function publishFingerprintedPack(input: { readonly includeNew: boolean; readonly fingerprints: boolean }) {
    const corpus = loadPublicWebUiEnglishCorpus(PATHS);
    const paths = input.includeNew ? PATHS : PATHS.filter((pathKey) => pathKey !== NEW_KEY);
    const localized: Record<string, string> = {};
    for (const pathKey of paths) {
      localized[pathKey] = `ლ${corpus.flat[pathKey] ?? ""}`;
    }
    await upsertWebUiMessagePack({
      locale: LOCALE,
      status: "published",
      messages: unflattenWebUiMessageMap(localized),
      sourceNote: input.fingerprints ? "sourceHash=old-catalog" : "restored without sourceHash",
      sourceFingerprintsByPath: input.fingerprints
        ? buildWebUiSourceFingerprintsByPath(corpus.flat, paths)
        : null,
    });
  }

  it("A/B/C/J/K. a running ready job schedules one rebase tick for the missing leaf", async () => {
    const corpus = loadPublicWebUiEnglishCorpus();
    const oldPaths = corpus.requiredPaths.filter((pathKey) => pathKey !== NEW_KEY);
    const localized: Record<string, string> = {};
    for (const pathKey of oldPaths) {
      localized[pathKey] = corpus.flat[pathKey] ?? "";
    }
    const decisions = classifyWebUiCatalogLeaves({
      englishFlat: corpus.flat,
      mongo: unflattenWebUiMessageMap(localized),
      mongoSourceFingerprintsByPath: buildWebUiSourceFingerprintsByPath(corpus.flat, oldPaths),
      packaged: bundledShortcut(),
      bundled: bundledShortcut(),
    });
    const residual = corpus.requiredPaths.filter(
      (pathKey) => decisions.get(pathKey)?.classification !== "REUSE_CURRENT",
    );
    assert.deepEqual(residual, [NEW_KEY]);

    const job = await saveRunningJob();
    await publishFingerprintedPack({ includeNew: false, fingerprints: true });
    const recovered = await ensureWebUiPreparationForUnreadyLocale({
      locale: LOCALE,
      scheduleProcess: true,
    });
    assert.equal(recovered.action, "reused");
    assert.equal(recovered.jobId, job.jobId);
    assert.equal(recovered.generation, 1);
    const currentHash = hashWebUiEnglishFlatMap(loadPublicWebUiEnglishCorpus(PATHS).flat);
    await waitFor(async () => sent.length > 0);
    const checkpoint = await getWebUiActivationCheckpoint(job.domains.webUi.checkpointId ?? "");
    assert.equal(checkpoint?.checkpointId, job.domains.webUi.checkpointId);
    assert.equal(checkpoint?.jobId, job.jobId);
    assert.equal(checkpoint?.phase, "primary");
    assert.equal(checkpoint?.sourceHash, currentHash);
    assert.deepEqual(sent[0], [NEW_KEY]);
    const stored = await getLanguageActivationJobById(job.jobId);
    assert.equal(stored?.generation, 1);
    assert.equal(stored?.domains.ct.enqueuedAt, CT_ENQUEUED_AT);
    assert.equal(stored?.domains.plp.enqueuedAt, PLP_ENQUEUED_AT);
    assert.equal(stored?.domains.ct.enqueueAttempted, true);
    assert.equal(activateCalls, 0);
    assert.equal(
      isLanguageActivationWebUiReadyForHistoricalEnqueue({
        webUi: stored!.domains.webUi,
        publicWebUiDataReady: false,
        participantWebUiDataReady: true,
      }),
      false,
    );
  });

  it("D. a fingerprint-less pack stays unproven, including packaged and bundled copies", async () => {
    const corpus = loadPublicWebUiEnglishCorpus(PATHS);
    const incomplete = unflattenWebUiMessageMap({
      [SAVE]: `bundle:${corpus.flat[SAVE]}`,
      [CANCEL]: `bundle:${corpus.flat[CANCEL]}`,
    });
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      readProviderCooldown: async () => ({
        active: false,
        cooldownUntil: null,
        pressureCategory: null,
      }),
      assessWebUi: async () => slice(webUiReady),
      evaluateReadiness: async () =>
        report({
          languageId,
          webUiReady,
          participantReady,
          stateReady: languageReady,
        }),
      activate: async () => {
        activateCalls += 1;
        throw new Error("CT/PLP enqueue must stay closed while WEB_UI is incomplete");
      },
      webUiPreparationDeps: {
        includePaths: PATHS,
        loadLiveTerminology: async () => "",
        loadPackagedWebUiCatalog: () => incomplete,
        loadBundledWebUiCatalog: () => incomplete,
        readProviderCooldown: async () => ({ active: false, cooldownUntil: null }),
        translator: async (request) => {
          if (!acceptProvider) {
            return {
              translatedText: "{}",
              providerId: "deterministic" as const,
              isPlaceholder: false as const,
            };
          }
          return translator.translate(request);
        },
      },
    });
    const job = await saveRunningJob({ withCheckpoint: false });
    await publishFingerprintedPack({ includeNew: false, fingerprints: false });
    const decisions = classifyWebUiCatalogLeaves({
      englishFlat: corpus.flat,
      mongo: unflattenWebUiMessageMap({
        [SAVE]: `ლ${corpus.flat[SAVE]}`,
        [CANCEL]: `ლ${corpus.flat[CANCEL]}`,
      }),
      mongoSourceFingerprintsByPath: null,
      packaged: bundledShortcut(),
      bundled: bundledShortcut(),
    });
    assert.deepEqual(
      PATHS.filter((pathKey) => decisions.get(pathKey)?.classification === "REUSE_CURRENT"),
      [],
    );
    await ensureWebUiPreparationForUnreadyLocale({ locale: LOCALE, scheduleProcess: true });
    await waitFor(async () => sent.length > 0);
    assert.ok(sent[0] && sent[0].length > 1);
    assert.ok(sent[0]?.includes(NEW_KEY));
    assert.ok(sent[0]?.includes(SAVE));
    const jobs = await listLanguageActivationJobs();
    assert.equal(jobs.filter((job) => job.locale === LOCALE).length, 1);
    assert.equal(jobs.find((job) => job.locale === LOCALE)?.generation, 1);
    const checkpoint = await getWebUiActivationCheckpoint(
      jobs.find((job) => job.locale === LOCALE)?.domains.webUi.checkpointId ?? "",
    );
    assert.equal(checkpoint?.jobId, job.jobId);
    assert.equal(activateCalls, 0);
  });

  it("E. a completed job with current WEB_UI not ready still opens the next generation", async () => {
    const completed = await saveRunningJob({ status: "completed" });
    const recovered = await ensureWebUiPreparationForUnreadyLocale({
      locale: LOCALE,
      scheduleProcess: false,
    });
    assert.equal(recovered.action, "created");
    assert.equal(recovered.generation, 2);
    assert.notEqual(recovered.jobId, completed.jobId);
  });

  it("F/N. a running job whose current WEB_UI is ready does not schedule preparation", async () => {
    webUiReady = true;
    participantReady = true;
    const job = await saveRunningJob();
    const before = await getWebUiActivationCheckpoint(job.domains.webUi.checkpointId ?? "");
    const recovered = await ensureWebUiPreparationForUnreadyLocale({
      locale: LOCALE,
      scheduleProcess: true,
    });
    assert.equal(recovered.action, "reused");
    assert.equal(recovered.jobId, job.jobId);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(sent.length, 0);
    const after = await getWebUiActivationCheckpoint(job.domains.webUi.checkpointId ?? "");
    assert.equal(after?.phase, "ready");
    assert.equal(after?.updatedAt, before?.updatedAt);
    assert.equal((await listLanguageActivationJobs()).filter((row) => row.locale === LOCALE).length, 1);
  });

  it("G. a completed job whose current WEB_UI is ready does not create a generation", async () => {
    webUiReady = true;
    participantReady = true;
    languageReady = true;
    await saveRunningJob({ status: "completed" });
    const recovered = await ensureWebUiPreparationForUnreadyLocale({
      locale: LOCALE,
      scheduleProcess: true,
    });
    assert.equal(recovered.action, "skipped");
    assert.equal(recovered.reason, "web_ui_ready");
    assert.equal((await listLanguageActivationJobs()).filter((row) => row.locale === LOCALE).length, 1);
  });

  it("H. repeated wakes while a tick is active do not run provider calls in parallel", async () => {
    let release: (() => void) | null = null;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let inFlight = 0;
    let maxInFlight = 0;
    translator.translate = async (request) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await gate;
      inFlight -= 1;
      const parsed = JSON.parse(request.text) as Record<string, string[]>;
      sent.push(Object.keys(parsed).sort());
      return {
        translatedText: JSON.stringify(
          Object.fromEntries(Object.keys(parsed).map((key) => [key, ["x"]])),
        ),
        providerId: "deterministic" as const,
        isPlaceholder: false as const,
      };
    };
    const job = await saveRunningJob();
    await publishFingerprintedPack({ includeNew: false, fingerprints: true });
    for (let index = 0; index < 5; index += 1) {
      scheduleWebUiActivationTick(job.jobId);
    }
    await waitFor(async () => maxInFlight === 1);
    assert.equal(maxInFlight, 1);
    release?.();
    await waitFor(async () => inFlight === 0 && sent.length > 0);
    assert.equal(maxInFlight, 1);
    assert.equal((await listLanguageActivationJobs()).filter((row) => row.locale === LOCALE).length, 1);
  });

  it("I. restart resumes the same primary checkpoint", async () => {
    const job = await saveRunningJob({ phase: "primary" });
    resetLanguageActivationJobSchedulerForTests();
    const resumed = await resumeIncompleteWebUiActivationJobsOnBoot();
    assert.ok(resumed.scheduled >= 1);
    const checkpoint = await getWebUiActivationCheckpoint(job.domains.webUi.checkpointId ?? "");
    assert.equal(checkpoint?.checkpointId, job.domains.webUi.checkpointId);
    assert.equal(checkpoint?.jobId, job.jobId);
    assert.equal(checkpoint?.phase, "primary");
    assert.equal((await getLanguageActivationJobById(job.jobId))?.generation, 1);
    const batches = await listWebUiActivationBatches(checkpoint!.checkpointId, "primary");
    assert.equal(batches.length, 0);
  });

  it("L. a ready checkpoint does not hide a current missing leaf", () => {
    const projected = webUiProgressFromCheckpoint({
      readinessDataReady: false,
      missingKeyCount: 1,
      emptyKeyCount: 0,
      requiredKeyCount: 4115,
      effectiveSource: "remote",
      checkpoint: {
        checkpointId: "webui-act-f3275-ready",
        jobId: "lang-act-eo-1-f3275",
        locale: LOCALE,
        generation: 1,
        sourceHash: "old-catalog",
        terminologyMode: "live",
        phase: "ready",
        leafCount: 4114,
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
        createdAt: "2026-09-26T20:14:23.740Z",
        updatedAt: "2026-09-26T20:14:23.740Z",
      },
    });
    assert.equal(projected.dataReady, false);
    assert.equal(projected.missingKeyCount, 1);
    assert.notEqual(projected.status, "ready");
    assert.equal(projected.checkpointId, "webui-act-f3275-ready");
    assert.equal(projected.sourceHash, "old-catalog");
    const stillReady = webUiProgressFromCheckpoint({
      readinessDataReady: true,
      missingKeyCount: 0,
      emptyKeyCount: 0,
      requiredKeyCount: 4115,
      effectiveSource: "remote",
      checkpoint: {
        checkpointId: "webui-act-ka",
        jobId: "lang-act-ka-5",
        locale: "ka",
        generation: 5,
        sourceHash: fingerprintWebUiEnglishLeaf("current"),
        terminologyMode: "live",
        phase: "ready",
        leafCount: 4115,
        batchCount: 1,
        completedBatchCount: 1,
        failedBatchCount: 0,
        qualityBatchCount: 0,
        qualityCompletedBatchCount: 0,
        suspiciousPathCount: 0,
        englishName: "Georgian",
        nativeName: "ქართული",
        textDirection: "ltr",
        detail: "Public interface ready",
        createdAt: "2026-09-30T22:26:14.903Z",
        updatedAt: "2026-09-30T22:31:16.959Z",
      },
    });
    assert.equal(stillReady.dataReady, true);
    assert.equal(stillReady.status, "ready");
    assert.equal(stillReady.missingKeyCount, 0);
  });

  it("M. a previous ready phase does not hide a current missing leaf", async () => {
    const previous = emptyPendingDomains().webUi;
    const projected = await buildWebUiDomainProgress(
      report({ languageId, webUiReady: false }),
      {
        ...previous,
        status: "ready",
        dataReady: true,
        preparationPhase: "ready",
        missingKeyCount: 0,
        checkpointId: null,
        sourceHash: null,
      },
    );
    assert.equal(projected.dataReady, false);
    assert.equal(projected.missingKeyCount, 1);
    assert.notEqual(projected.status, "ready");
    const current = await buildWebUiDomainProgress(
      report({ languageId, webUiReady: true }),
      {
        ...previous,
        status: "ready",
        dataReady: true,
        preparationPhase: "ready",
        missingKeyCount: 0,
      },
    );
    assert.equal(current.dataReady, true);
    assert.equal(current.status, "ready");
  });
});
