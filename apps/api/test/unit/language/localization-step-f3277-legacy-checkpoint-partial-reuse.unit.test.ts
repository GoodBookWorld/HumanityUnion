/**
 * STEP F.3.27.7 — a catalog rebase upgrades a legacy checkpoint to
 * partial_reuse_v1. The marker does not classify leaves. No live Gemini.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type {
  LanguageActivationJobRecord,
  LanguageLocalizationReadinessReport,
  LanguageWebUiReadinessSlice,
  WebUiActivationCheckpointRecord,
} from "@hu/types";
import { emptyLanguageLocalizationCountBucket } from "@hu/types";

import {
  emptyPendingDomains,
  ensureWebUiPreparationForUnreadyLocale,
  isLanguageActivationWebUiReadyForHistoricalEnqueue,
  resetLanguageActivationJobSchedulerForTests,
  scheduleWebUiActivationTick,
  setLanguageActivationJobProcessDepsForTests,
} from "../../../src/modules/language/language-localization-activation/index.js";
import { getWebUiActivationSchedulerSnapshotForTests } from "../../../src/modules/language/language-localization-activation/language-activation-job.service.js";
import { LOCALIZATION_PROVIDER_MIN_INTERVAL_MS_DEFAULT } from "../../../src/modules/language/localization-provider-governor.js";
import { setLocalizationProviderPacingIntervalMsForTests } from "../../../src/modules/language/localization-provider-governor.js";
import {
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
  getWebUiActivationBatch,
  getWebUiActivationCheckpoint,
  listWebUiActivationBatches,
  resetWebUiActivationCheckpointStoreForTests,
  setWebUiActivationCheckpointForceMemoryForTests,
  upsertWebUiActivationBatch,
  upsertWebUiActivationCheckpoint,
} from "../../../src/modules/web-ui-message-packs/web-ui-activation-checkpoint.repository.js";
import {
  buildWebUiSourceFingerprintsByPath,
  fingerprintWebUiEnglishLeaf,
  hashWebUiEnglishFlatMap,
  loadPublicWebUiEnglishCorpus,
  planWebUiDraftBatches,
  unflattenWebUiMessageMap,
} from "../../../src/modules/web-ui-message-packs/web-ui-draft-builder.js";
import {
  processWebUiActivationTick,
  rebaseWebUiCheckpointForCatalogExpansion,
} from "../../../src/modules/web-ui-message-packs/web-ui-activation-preparation.js";
import type { WebUiActivationPreparationDeps } from "../../../src/modules/web-ui-message-packs/web-ui-activation-preparation.js";
import {
  classifyWebUiCatalogLeaves,
  classifyWebUiLeafForReuse,
  WEB_UI_PARTIAL_REUSE_CONTRACT,
} from "../../../src/modules/web-ui-message-packs/web-ui-leaf-reuse.js";
import {
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
  upsertWebUiMessagePack,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiSrc = path.resolve(here, "../../../src");
const LOCALE = "eo";
const SAVE = "common.save";
const CANCEL = "common.cancel";
const NEW_KEY = "common.interfaceNote";
const PATHS = [SAVE, CANCEL, NEW_KEY] as const;
const JOB_ID = "lang-act-eo-1-f3277";
const CHECKPOINT_ID = "webui-act-f3277-legacy";
const GENERATION = 4;

function recordingTranslator(sent: string[][]) {
  return async (request: TranslationProviderRequest) => {
    const parsed = JSON.parse(request.text) as Record<string, string[]>;
    sent.push(Object.keys(parsed).sort());
    const translated: Record<string, string[]> = {};
    for (const [key, spans] of Object.entries(parsed)) {
      translated[key] = spans.map((span, index) => `x${index}:${span.length}`);
    }
    return {
      translatedText: JSON.stringify(translated),
      providerId: "deterministic" as const,
      isPlaceholder: false as const,
    };
  };
}

function tickDeps(sent: string[][]): WebUiActivationPreparationDeps {
  return {
    includePaths: PATHS,
    loadLiveTerminology: async () => "",
    loadPackagedWebUiCatalog: () => null,
    loadBundledWebUiCatalog: () => null,
    translator: recordingTranslator(sent),
  };
}

function legacyCheckpoint(
  overrides: Partial<WebUiActivationCheckpointRecord> = {},
): WebUiActivationCheckpointRecord {
  const now = "2026-09-28T04:00:52.172Z";
  return {
    checkpointId: CHECKPOINT_ID,
    jobId: JOB_ID,
    locale: LOCALE,
    generation: GENERATION,
    sourceHash: "legacy-catalog",
    terminologyMode: "live",
    phase: "ready",
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
    ...overrides,
  };
}

function jobRecord(checkpointId = CHECKPOINT_ID): LanguageActivationJobRecord {
  const now = "2026-09-28T04:00:52.172Z";
  return {
    jobId: JOB_ID,
    locale: LOCALE,
    languageId: "lang-eo",
    generation: GENERATION,
    status: "running",
    domains: {
      ...emptyPendingDomains(),
      webUi: {
        ...emptyPendingDomains().webUi,
        status: "ready",
        dataReady: true,
        preparationPhase: "ready",
        checkpointId,
        sourceHash: "legacy-catalog",
      },
    },
    lastError: null,
    diagnosticSummary: null,
    createdAt: now,
    updatedAt: now,
    startedAt: now,
    completedAt: null,
    createdByParticipantId: null,
    searchEnabledSnapshot: false,
    seoIndexingEnabledSnapshot: false,
  };
}

describe("STEP F.3.27.7 legacy checkpoint partial reuse", () => {
  beforeEach(() => {
    setWebUiActivationCheckpointForceMemoryForTests(true);
    setWebUiMessagePackForceMemoryForTests(true);
    resetWebUiActivationCheckpointStoreForTests();
    resetWebUiMessagePackStoreForTests();
    setLocalizationProviderPacingIntervalMsForTests(0);
  });

  afterEach(() => {
    setLocalizationProviderPacingIntervalMsForTests(null);
    setWebUiActivationCheckpointForceMemoryForTests(false);
    setWebUiMessagePackForceMemoryForTests(false);
  });

  it("A/H/I. a legacy ready checkpoint reuses proven leaves and residuals only the new leaf", async () => {
    const corpus = loadPublicWebUiEnglishCorpus(PATHS);
    const proven = [SAVE, CANCEL];
    const localized = Object.fromEntries(proven.map((pathKey) => [pathKey, `ლ${corpus.flat[pathKey]}`]));
    await upsertWebUiMessagePack({
      locale: LOCALE,
      messages: unflattenWebUiMessageMap(localized),
      status: "published",
      sourceNote: "sourceHash=legacy-catalog",
      sourceFingerprintsByPath: buildWebUiSourceFingerprintsByPath(corpus.flat, proven),
    });
    await upsertWebUiActivationCheckpoint(legacyCheckpoint());
    const sent: string[][] = [];
    const tick = await processWebUiActivationTick({
      job: jobRecord(),
      checkpointId: CHECKPOINT_ID,
      deps: tickDeps(sent),
    });
    const stored = await getWebUiActivationCheckpoint(CHECKPOINT_ID);
    assert.equal(stored?.checkpointId, CHECKPOINT_ID);
    assert.equal(stored?.jobId, JOB_ID);
    assert.equal(stored?.generation, GENERATION);
    assert.equal(stored?.preparationContract, WEB_UI_PARTIAL_REUSE_CONTRACT);
    assert.equal(stored?.sourceHash, hashWebUiEnglishFlatMap(corpus.flat));
    assert.equal(tick.providerCalls, 1);
    assert.deepEqual(sent, [[NEW_KEY]]);
    const batch = planWebUiDraftBatches(corpus.flat)[0];
    assert.ok(batch);
    const row = await getWebUiActivationBatch({
      checkpointId: CHECKPOINT_ID,
      batchId: batch.id,
      phase: "primary",
    });
    assert.equal(row?.providerKeyCount, 1);
    assert.equal(row?.reusedKeyCount, 2);
    assert.equal(row?.preparationProvenance, "MIXED");
    assert.equal(row?.values[SAVE], localized[SAVE]);
    assert.equal(row?.values[CANCEL], localized[CANCEL]);
  });

  it("B. a fingerprint-matched structurally valid leaf is REUSE_CURRENT", () => {
    const english = "Save";
    const decision = classifyWebUiLeafForReuse({
      english,
      candidates: [{
        source: "MONGO_PUBLISHED",
        value: "Konservi",
        provenCurrent: true,
      }],
    });
    assert.equal(decision.classification, "REUSE_CURRENT");
    assert.equal(decision.value, "Konservi");
  });

  it("C. a stale fingerprint stays a provider residual", () => {
    const corpus = loadPublicWebUiEnglishCorpus([SAVE]);
    const decisions = classifyWebUiCatalogLeaves({
      englishFlat: corpus.flat,
      mongo: unflattenWebUiMessageMap({ [SAVE]: "Konservi" }),
      mongoSourceFingerprintsByPath: { [SAVE]: "stale-fingerprint" },
      packaged: null,
      bundled: null,
    });
    assert.equal(decisions.get(SAVE)?.classification, "STALE_SOURCE");
  });

  it("D. a missing fingerprint stays a provider residual", () => {
    const corpus = loadPublicWebUiEnglishCorpus([SAVE]);
    const decisions = classifyWebUiCatalogLeaves({
      englishFlat: corpus.flat,
      mongo: unflattenWebUiMessageMap({ [SAVE]: "Konservi" }),
      mongoSourceFingerprintsByPath: {},
      packaged: null,
      bundled: null,
    });
    assert.notEqual(decisions.get(SAVE)?.classification, "REUSE_CURRENT");
    assert.equal(decisions.get(SAVE)?.classification, "STALE_SOURCE");
  });

  it("E. a structural mismatch stays a provider residual", () => {
    const decision = classifyWebUiLeafForReuse({
      english: "Showing {count}",
      candidates: [{
        source: "MONGO_PUBLISHED",
        value: "Montrante",
        provenCurrent: true,
      }],
    });
    assert.equal(decision.classification, "STRUCTURE_INCOMPATIBLE");
  });

  it("F. a protection sentinel stays a provider residual", () => {
    const decision = classifyWebUiLeafForReuse({
      english: "Save",
      candidates: [{
        source: "MONGO_PUBLISHED",
        value: "Save __HU_BRAND_SITE_NAME__",
        provenCurrent: true,
      }],
    });
    assert.equal(decision.classification, "INVALID_TRANSLATION");
  });

  it("G. an old ok batch is not kept merely because its status was ok", async () => {
    const corpus = loadPublicWebUiEnglishCorpus(PATHS);
    const localized = { [SAVE]: "Konservi", [CANCEL]: "Nuligi" };
    await upsertWebUiMessagePack({
      locale: LOCALE,
      messages: unflattenWebUiMessageMap(localized),
      status: "published",
      sourceNote: "sourceHash=legacy-catalog",
      sourceFingerprintsByPath: buildWebUiSourceFingerprintsByPath(corpus.flat, [SAVE, CANCEL]),
    });
    const batch = planWebUiDraftBatches(corpus.flat)[0];
    assert.ok(batch);
    const checkpoint = legacyCheckpoint({ phase: "primary", completedBatchCount: 1 });
    await upsertWebUiActivationCheckpoint(checkpoint);
    await upsertWebUiActivationBatch({
      checkpointId: CHECKPOINT_ID,
      batchId: batch.id,
      phase: "primary",
      namespace: batch.namespace,
      keys: batch.keys,
      values: Object.fromEntries(batch.keys.map((key) => [key, "LEGACY_PROVIDER_SENTENCE"])),
      status: "ok",
      attempts: 1,
      reason: "provider",
      preparationProvenance: "PROVIDER_GENERATED",
      providerKeyCount: batch.keys.length,
      reusedKeyCount: 0,
      updatedAt: "2026-09-28T04:00:52.172Z",
    });
    const rebased = await rebaseWebUiCheckpointForCatalogExpansion({
      checkpoint,
      sourceHash: hashWebUiEnglishFlatMap(corpus.flat),
      flat: corpus.flat,
      requiredPaths: corpus.requiredPaths,
      deps: tickDeps([]),
    });
    assert.equal(rebased.checkpointId, CHECKPOINT_ID);
    assert.equal(rebased.jobId, JOB_ID);
    assert.equal(rebased.generation, GENERATION);
    assert.equal(rebased.preparationContract, WEB_UI_PARTIAL_REUSE_CONTRACT);
    const row = await getWebUiActivationBatch({
      checkpointId: CHECKPOINT_ID,
      batchId: batch.id,
      phase: "primary",
    });
    assert.notEqual(row?.status, "ok");
    assert.equal(row?.values[SAVE], "Konservi");
    assert.equal(row?.values[CANCEL], "Nuligi");
    assert.equal(row?.values[NEW_KEY], undefined);
    assert.equal(
      Object.values(row?.values ?? {}).includes("LEGACY_PROVIDER_SENTENCE"),
      false,
    );
  });

  it("J. an existing partial_reuse_v1 checkpoint still residuals only the new leaf", async () => {
    const corpus = loadPublicWebUiEnglishCorpus(PATHS);
    const localized = {
      [SAVE]: "Konservi",
      [CANCEL]: "Nuligi",
    };
    await upsertWebUiMessagePack({
      locale: LOCALE,
      messages: unflattenWebUiMessageMap(localized),
      status: "published",
      sourceNote: "sourceHash=legacy-catalog",
      sourceFingerprintsByPath: buildWebUiSourceFingerprintsByPath(corpus.flat, [SAVE, CANCEL]),
    });
    await upsertWebUiActivationCheckpoint(
      legacyCheckpoint({ preparationContract: WEB_UI_PARTIAL_REUSE_CONTRACT }),
    );
    const sent: string[][] = [];
    await processWebUiActivationTick({
      job: jobRecord(),
      checkpointId: CHECKPOINT_ID,
      deps: tickDeps(sent),
    });
    const stored = await getWebUiActivationCheckpoint(CHECKPOINT_ID);
    assert.equal(stored?.preparationContract, WEB_UI_PARTIAL_REUSE_CONTRACT);
    assert.deepEqual(sent, [[NEW_KEY]]);
  });

  it("K. a fingerprint-less pack remains a full residual after the contract upgrade", async () => {
    const corpus = loadPublicWebUiEnglishCorpus(PATHS);
    const localized = Object.fromEntries(PATHS.map((pathKey) => [pathKey, `ლ${corpus.flat[pathKey]}`]));
    await upsertWebUiMessagePack({
      locale: LOCALE,
      messages: unflattenWebUiMessageMap(localized),
      status: "published",
      sourceNote: "legacy import without sourceHash",
      sourceFingerprintsByPath: null,
    });
    const decisions = classifyWebUiCatalogLeaves({
      englishFlat: corpus.flat,
      mongo: unflattenWebUiMessageMap(localized),
      mongoSourceFingerprintsByPath: null,
      packaged: null,
      bundled: null,
    });
    for (const pathKey of PATHS) {
      assert.notEqual(decisions.get(pathKey)?.classification, "REUSE_CURRENT");
    }
    await upsertWebUiActivationCheckpoint(legacyCheckpoint());
    const sent: string[][] = [];
    await processWebUiActivationTick({
      job: jobRecord(),
      checkpointId: CHECKPOINT_ID,
      deps: tickDeps(sent),
    });
    const stored = await getWebUiActivationCheckpoint(CHECKPOINT_ID);
    assert.equal(stored?.preparationContract, WEB_UI_PARTIAL_REUSE_CONTRACT);
    assert.deepEqual(sent[0], [...PATHS].sort());
  });

  it("P. quality preparation still skips only a fingerprint-proven English-identical leaf", async () => {
    const corpus = loadPublicWebUiEnglishCorpus(PATHS);
    const localized = {
      [SAVE]: corpus.flat[SAVE] ?? "",
      [CANCEL]: "Nuligi",
    };
    await upsertWebUiMessagePack({
      locale: LOCALE,
      messages: unflattenWebUiMessageMap(localized),
      status: "published",
      sourceNote: "sourceHash=legacy-catalog",
      sourceFingerprintsByPath: buildWebUiSourceFingerprintsByPath(corpus.flat, [SAVE, CANCEL]),
    });
    await upsertWebUiActivationCheckpoint(legacyCheckpoint());
    const sent: string[][] = [];
    const deps = tickDeps(sent);
    await processWebUiActivationTick({
      job: jobRecord(),
      checkpointId: CHECKPOINT_ID,
      deps,
    });
    const second = await processWebUiActivationTick({
      job: jobRecord(),
      checkpointId: CHECKPOINT_ID,
      deps,
    });
    assert.deepEqual(sent, [[NEW_KEY]]);
    assert.equal(second.providerCalls, 0);
    assert.equal(second.checkpoint?.phase, "validating");
    assert.equal(second.checkpoint?.qualityBatchCount, 0);
    assert.equal(second.checkpoint?.preparationContract, WEB_UI_PARTIAL_REUSE_CONTRACT);
    const quality = await listWebUiActivationBatches(CHECKPOINT_ID, "quality");
    assert.equal(quality.length, 0);
  });

  it("N/O. Gate 15D.9.1 and provider pacing stay in place", () => {
    const closed = isLanguageActivationWebUiReadyForHistoricalEnqueue({
      webUi: {
        status: "pending",
        dataReady: false,
        missingKeyCount: 1,
        emptyKeyCount: 0,
        requiredKeyCount: 4115,
        effectiveSource: "remote",
        detail: null,
        preparationPhase: "ready",
        checkpointId: CHECKPOINT_ID,
        sourceHash: "current",
        totalBatches: 1,
        completedBatches: 1,
        totalLeaves: 4115,
        completedLeaves: 4114,
        providerFailure: false,
      },
      publicWebUiDataReady: false,
      participantWebUiDataReady: true,
    });
    const open = isLanguageActivationWebUiReadyForHistoricalEnqueue({
      webUi: {
        status: "ready",
        dataReady: true,
        missingKeyCount: 0,
        emptyKeyCount: 0,
        requiredKeyCount: 4115,
        effectiveSource: "remote",
        detail: null,
        preparationPhase: "ready",
        checkpointId: CHECKPOINT_ID,
        sourceHash: "current",
        totalBatches: 1,
        completedBatches: 1,
        totalLeaves: 4115,
        completedLeaves: 4115,
        providerFailure: false,
      },
      publicWebUiDataReady: true,
      participantWebUiDataReady: true,
    });
    assert.equal(closed, false);
    assert.equal(open, true);
    assert.equal(LOCALIZATION_PROVIDER_MIN_INTERVAL_MS_DEFAULT, 10_000);
    const preparation = readFileSync(
      path.join(apiSrc, "modules/web-ui-message-packs/web-ui-activation-preparation.ts"),
      "utf8",
    );
    assert.match(
      preparation,
      /return \(request\) => runLocalizationProviderRequest\(\(\) => provider\.translate\(request\)\)/,
    );
  });
});

describe("STEP F.3.27.7 recovery no-op and tick dedupe", () => {
  let languageId = "";
  let webUiReady = false;

  function slice(dataReady: boolean): LanguageWebUiReadinessSlice {
    return {
      engineReady: true,
      dataReady,
      requiredKeyCount: 4115,
      missingKeyCount: dataReady ? 0 : 1,
      emptyKeyCount: 0,
      englishFallbackKeyCount: 0,
      sampleMissingPaths: dataReady ? [] : [NEW_KEY],
      structuralInvalidCount: 0,
    };
  }

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
    setLocalizationProviderPacingIntervalMsForTests(0);
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
      evaluateReadiness: async () => {
        const bucket = emptyLanguageLocalizationCountBucket();
        const report: LanguageLocalizationReadinessReport = {
          pack: "closure07",
          locale: LOCALE,
          languageId,
          registry: {
            enabled: true,
            contentTranslationEnabled: true,
            searchEnabled: false,
            seoIndexingEnabled: false,
            pwaPersistedReadingEnabled: false,
          },
          engineReady: true,
          languageDataReady: webUiReady,
          state: webUiReady ? "READY" : "BACKFILL_REQUIRED",
          webUi: slice(webUiReady),
          participantWebUi: slice(true),
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
          ct: bucket,
          plpMedia: bucket,
          kindRows: [],
          seoReady: false,
          searchLocalizationReady: true,
          PROVIDER_CALLS: 0,
          WRITES_PERFORMED: 0,
          gaps: [],
        };
        return report;
      },
      activate: async () => {
        throw new Error("historical enqueue must stay closed");
      },
      webUiPreparationDeps: {
        includePaths: PATHS,
        loadLiveTerminology: async () => "",
        loadPackagedWebUiCatalog: () => null,
        loadBundledWebUiCatalog: () => null,
        translator: recordingTranslator([]),
      },
    });
  });

  afterEach(() => {
    setLanguageActivationJobProcessDepsForTests(null);
    setLocalizationProviderPacingIntervalMsForTests(null);
    setLanguageRegistryForceMemoryForTests(false);
    setLanguageActivationJobForceMemoryForTests(false);
    setWebUiActivationCheckpointForceMemoryForTests(false);
    setWebUiMessagePackForceMemoryForTests(false);
    resetLanguageActivationJobSchedulerForTests();
  });

  it("L. a current ready pack does not schedule preparation", async () => {
    webUiReady = true;
    const now = "2026-09-30T22:30:55.814Z";
    const domains = emptyPendingDomains();
    await saveLanguageActivationJob({
      jobId: JOB_ID,
      locale: LOCALE,
      languageId,
      generation: 5,
      status: "running",
      domains: {
        ...domains,
        brand: { ...domains.brand, status: "ready" },
        terminology: { ...domains.terminology, status: "ready" },
        webUi: {
          ...domains.webUi,
          status: "ready",
          dataReady: true,
          preparationPhase: "ready",
          checkpointId: CHECKPOINT_ID,
          sourceHash: hashWebUiEnglishFlatMap(loadPublicWebUiEnglishCorpus(PATHS).flat),
          missingKeyCount: 0,
        },
      },
      lastError: null,
      diagnosticSummary: null,
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      completedAt: null,
      createdByParticipantId: null,
      searchEnabledSnapshot: false,
      seoIndexingEnabledSnapshot: false,
    });
    await upsertWebUiActivationCheckpoint(
      legacyCheckpoint({
        generation: 5,
        phase: "ready",
        sourceHash: hashWebUiEnglishFlatMap(loadPublicWebUiEnglishCorpus(PATHS).flat),
        preparationContract: WEB_UI_PARTIAL_REUSE_CONTRACT,
      }),
    );
    const recovered = await ensureWebUiPreparationForUnreadyLocale({
      locale: LOCALE,
      scheduleProcess: true,
    });
    assert.equal(recovered.generation, 5);
    assert.equal(recovered.jobId, JOB_ID);
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(getWebUiActivationSchedulerSnapshotForTests(JOB_ID).inFlight, false);
    const stored = await getWebUiActivationCheckpoint(CHECKPOINT_ID);
    assert.equal(stored?.phase, "ready");
    assert.equal(stored?.updatedAt, "2026-09-28T04:00:52.172Z");
  });

  it("M. repeated wakes while a tick is active do not run provider calls in parallel", async () => {
    const corpus = loadPublicWebUiEnglishCorpus(PATHS);
    await upsertWebUiMessagePack({
      locale: LOCALE,
      messages: unflattenWebUiMessageMap({
        [SAVE]: "Konservi",
        [CANCEL]: "Nuligi",
      }),
      status: "published",
      sourceNote: "sourceHash=legacy-catalog",
      sourceFingerprintsByPath: buildWebUiSourceFingerprintsByPath(corpus.flat, [SAVE, CANCEL]),
    });
    const domains = emptyPendingDomains();
    const now = "2026-09-28T04:00:52.172Z";
    await saveLanguageActivationJob({
      ...jobRecord(),
      languageId,
      domains: {
        ...domains,
        brand: { ...domains.brand, status: "ready" },
        terminology: { ...domains.terminology, status: "ready" },
        webUi: {
          ...domains.webUi,
          status: "ready",
          dataReady: false,
          preparationPhase: "ready",
          checkpointId: CHECKPOINT_ID,
          sourceHash: "legacy-catalog",
        },
      },
    });
    await upsertWebUiActivationCheckpoint(legacyCheckpoint());
    let release: (() => void) | null = null;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let inFlight = 0;
    let maxInFlight = 0;
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      readProviderCooldown: async () => ({
        active: false,
        cooldownUntil: null,
        pressureCategory: null,
      }),
      assessWebUi: async () => slice(false),
      evaluateReadiness: async () => {
        const bucket = emptyLanguageLocalizationCountBucket();
        return {
          pack: "closure07",
          locale: LOCALE,
          languageId,
          registry: {
            enabled: true,
            contentTranslationEnabled: true,
            searchEnabled: false,
            seoIndexingEnabled: false,
            pwaPersistedReadingEnabled: false,
          },
          engineReady: true,
          languageDataReady: false,
          state: "BACKFILL_REQUIRED",
          webUi: slice(false),
          participantWebUi: slice(true),
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
          ct: bucket,
          plpMedia: bucket,
          kindRows: [],
          seoReady: false,
          searchLocalizationReady: true,
          PROVIDER_CALLS: 0,
          WRITES_PERFORMED: 0,
          gaps: [],
        } as LanguageLocalizationReadinessReport;
      },
      activate: async () => {
        throw new Error("historical enqueue must stay closed");
      },
      webUiPreparationDeps: {
        includePaths: PATHS,
        loadLiveTerminology: async () => "",
        loadPackagedWebUiCatalog: () => null,
        loadBundledWebUiCatalog: () => null,
        translator: async (request) => {
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          await gate;
          inFlight -= 1;
          return recordingTranslator([])(request);
        },
      },
    });
    for (let index = 0; index < 5; index += 1) {
      scheduleWebUiActivationTick(JOB_ID);
    }
    for (let attempt = 0; attempt < 40 && maxInFlight < 1; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.equal(maxInFlight, 1);
    assert.equal(getWebUiActivationSchedulerSnapshotForTests(JOB_ID).followUpRequested, true);
    release?.();
    for (let attempt = 0; attempt < 40 && inFlight > 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.equal(maxInFlight, 1);
  });
});
