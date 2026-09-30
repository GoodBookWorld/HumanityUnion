/**
 * STEP F.3.27.1 — per-leaf WEB_UI English source fingerprints.
 * No live Gemini. No locale-specific reuse.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { LanguageActivationJobRecord, WebUiMessageTree } from "@hu/types";

import { LOCALIZATION_PROVIDER_MIN_INTERVAL_MS_DEFAULT } from "../../../src/modules/language/localization-provider-governor.js";
import {
  emptyPendingDomains,
  isLanguageActivationWebUiReadyForHistoricalEnqueue,
} from "../../../src/modules/language/language-localization-activation/language-activation-job.domains.js";
import { assessWebUiMessageTreeReadiness } from "../../../src/modules/language/language-localization-activation/assess-web-ui-catalog-readiness.js";
import {
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
  classifyWebUiCatalogLeaves,
  classifyWebUiLeafForReuse,
} from "../../../src/modules/web-ui-message-packs/web-ui-leaf-reuse.js";
import { stampWebUiLeafSourceFingerprintsIfCatalogUnchanged } from "../../../src/modules/web-ui-message-packs/web-ui-leaf-source-stamp.js";
import { processWebUiActivationTick } from "../../../src/modules/web-ui-message-packs/web-ui-activation-preparation.js";
import type { WebUiActivationPreparationDeps } from "../../../src/modules/web-ui-message-packs/web-ui-activation-preparation.js";
import { rebaseWebUiCheckpointForCatalogExpansion } from "../../../src/modules/web-ui-message-packs/web-ui-activation-preparation.js";
import {
  getPublishedWebUiMessagePackByLocale,
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
  upsertWebUiMessagePack,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import { WebUiMessagePackValidationError } from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.errors.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const LOCALE = "eo";
const SAVE = "common.save";
const CANCEL = "common.cancel";
const PREFS = "preferences.title";
const SHOWING = "blogPublic.pagination.showingCount";

function tree(flat: Record<string, string>): WebUiMessageTree {
  return unflattenWebUiMessageMap(flat);
}

function jobRecord(): LanguageActivationJobRecord {
  const now = "2026-09-30T00:00:00.000Z";
  return {
    jobId: `lang-act-${LOCALE}-9-f3271`,
    locale: LOCALE,
    languageId: `lang-${LOCALE}`,
    generation: 9,
    status: "running",
    domains: emptyPendingDomains(),
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

function recordingTranslator(sent: string[][]) {
  return async (request: TranslationProviderRequest) => {
    const parsed = JSON.parse(request.text) as Record<string, string[]>;
    sent.push(Object.keys(parsed).sort());
    const translated: Record<string, string[]> = {};
    for (const [key, spans] of Object.entries(parsed)) {
      translated[key] = spans.map((span, index) => `ل${index}:${span.length}`);
    }
    return {
      translatedText: JSON.stringify(translated),
      providerId: "deterministic" as const,
      isPlaceholder: false as const,
    };
  };
}

async function publishLeaves(input: {
  readonly locale?: string;
  readonly localized: Record<string, string>;
  readonly fingerprints: Record<string, string>;
  readonly sourceHash?: string;
}): Promise<void> {
  const corpus = loadPublicWebUiEnglishCorpus(Object.keys(input.localized));
  await upsertWebUiMessagePack({
    locale: input.locale ?? LOCALE,
    messages: tree(input.localized),
    status: "published",
    sourceNote: `sourceHash=${input.sourceHash ?? hashWebUiEnglishFlatMap(corpus.flat)}`,
    sourceFingerprintsByPath: input.fingerprints,
  });
}

function provenFingerprints(paths: readonly string[]): {
  readonly flat: Record<string, string>;
  readonly localized: Record<string, string>;
  readonly fingerprints: Record<string, string>;
} {
  const corpus = loadPublicWebUiEnglishCorpus(paths);
  const localized: Record<string, string> = {};
  const fingerprints: Record<string, string> = {};
  for (const pathKey of paths) {
    const english = corpus.flat[pathKey] ?? "";
    localized[pathKey] = `ლ${english}`;
    fingerprints[pathKey] = fingerprintWebUiEnglishLeaf(english);
  }
  return { flat: corpus.flat, localized, fingerprints };
}

describe("STEP F.3.27.1 WEB_UI leaf source fingerprints", () => {
  beforeEach(async () => {
    setLanguageRegistryForceMemoryForTests(true);
    setWebUiActivationCheckpointForceMemoryForTests(true);
    setWebUiMessagePackForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    resetWebUiActivationCheckpointStoreForTests();
    resetWebUiMessagePackStoreForTests();
    resetLocalizationReconciliationDriverForTests();
    await ensureLanguageRegistrySeeded();
    await createLanguageRegistryRecord({
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
  });

  afterEach(() => {
    setLanguageRegistryForceMemoryForTests(false);
    setWebUiActivationCheckpointForceMemoryForTests(false);
    setWebUiMessagePackForceMemoryForTests(false);
    resetLocalizationReconciliationDriverForTests();
  });

  it("A. fingerprints are deterministic and change with the English value", () => {
    const first = fingerprintWebUiEnglishLeaf("Hello {name}");
    assert.equal(first, fingerprintWebUiEnglishLeaf("Hello {name}"));
    assert.notEqual(first, fingerprintWebUiEnglishLeaf("Hello {firstName}"));
    assert.match(first, /^[a-f0-9]{64}$/);
    assert.equal(fingerprintWebUiEnglishLeaf("Save"), fingerprintWebUiEnglishLeaf("Save"));
  });

  it("B. a matching fingerprint and valid structure is reusable", () => {
    const english = "Save";
    const decision = classifyWebUiLeafForReuse({
      english,
      candidates: [
        {
          source: "MONGO_PUBLISHED",
          value: "حفظ",
          provenCurrent: true,
        },
      ],
    });
    assert.equal(decision.classification, "REUSE_CURRENT");
    assert.equal(decision.value, "حفظ");
    assert.equal(
      fingerprintWebUiEnglishLeaf(english),
      fingerprintWebUiEnglishLeaf(english),
    );
  });

  it("C. a new key is the only provider input", async () => {
    const kept = [SAVE, CANCEL, PREFS];
    const proven = provenFingerprints(kept);
    await publishLeaves({
      localized: proven.localized,
      fingerprints: proven.fingerprints,
    });
    const sent: string[][] = [];
    const deps: WebUiActivationPreparationDeps = {
      includePaths: [...kept, SHOWING],
      loadLiveTerminology: async () => "",
      loadPackagedWebUiCatalog: () => null,
      loadBundledWebUiCatalog: () => null,
      readProviderCooldown: async () => ({ active: false, cooldownUntil: null }),
      translator: recordingTranslator(sent),
    };
    let result = await processWebUiActivationTick({ job: jobRecord(), deps });
    for (let step = 0; step < 8 && result.needsAnotherTick && !result.published; step += 1) {
      result = await processWebUiActivationTick({
        job: jobRecord(),
        checkpointId: result.checkpoint?.checkpointId,
        deps,
      });
    }
    assert.equal(result.published, true);
    assert.deepEqual(sent.flat(), [SHOWING]);
    const decisions = classifyWebUiCatalogLeaves({
      englishFlat: loadPublicWebUiEnglishCorpus([...kept, SHOWING]).flat,
      mongo: tree(proven.localized),
      mongoSourceFingerprintsByPath: proven.fingerprints,
      packaged: null,
      bundled: null,
    });
    assert.equal(decisions.get(SAVE)?.classification, "REUSE_CURRENT");
    assert.equal(decisions.get(CANCEL)?.classification, "REUSE_CURRENT");
    assert.equal(decisions.get(PREFS)?.classification, "REUSE_CURRENT");
    assert.equal(decisions.get(SHOWING)?.classification, "MISSING");
  });

  it("D. an edited English value is not reused when structure still matches", async () => {
    const proven = provenFingerprints([SAVE, CANCEL, PREFS]);
    const staleFingerprint = fingerprintWebUiEnglishLeaf("a different English sentence");
    await publishLeaves({
      localized: proven.localized,
      fingerprints: {
        ...proven.fingerprints,
        [CANCEL]: staleFingerprint,
      },
    });
    const sent: string[][] = [];
    const deps: WebUiActivationPreparationDeps = {
      includePaths: [SAVE, CANCEL, PREFS],
      loadLiveTerminology: async () => "",
      loadPackagedWebUiCatalog: () => tree({ [CANCEL]: proven.localized[CANCEL]! }),
      loadBundledWebUiCatalog: () => null,
      readProviderCooldown: async () => ({ active: false, cooldownUntil: null }),
      translator: recordingTranslator(sent),
    };
    let result = await processWebUiActivationTick({ job: jobRecord(), deps });
    for (let step = 0; step < 8 && result.needsAnotherTick && !result.published; step += 1) {
      result = await processWebUiActivationTick({
        job: jobRecord(),
        checkpointId: result.checkpoint?.checkpointId,
        deps,
      });
    }
    assert.deepEqual(sent.flat(), [CANCEL]);
    const english = loadPublicWebUiEnglishCorpus([CANCEL]).flat[CANCEL] ?? "";
    const classified = classifyWebUiLeafForReuse({
      english,
      candidates: [
        {
          source: "MONGO_PUBLISHED",
          value: proven.localized[CANCEL],
          provenCurrent: false,
        },
      ],
    });
    assert.equal(classified.classification, "STALE_SOURCE");
  });

  it("E. a placeholder change is not reused", () => {
    const oldEnglish = "Hello {name}";
    const localized = "مرحبا {name}";
    const decision = classifyWebUiCatalogLeaves({
      englishFlat: { "greeting.hello": "Hello {firstName}" },
      mongo: tree({ "greeting.hello": localized }),
      mongoSourceFingerprintsByPath: {
        "greeting.hello": fingerprintWebUiEnglishLeaf(oldEnglish),
      },
      packaged: tree({ "greeting.hello": localized }),
      bundled: tree({ "greeting.hello": localized }),
    });
    assert.equal(decision.get("greeting.hello")?.classification, "STRUCTURE_INCOMPATIBLE");
    assert.equal(decision.get("greeting.hello")?.value, null);
  });

  it("F. a deleted key is absent from the published fingerprint map and does not block readiness", async () => {
    const corpus = loadPublicWebUiEnglishCorpus([SAVE, CANCEL]);
    const fingerprints = buildWebUiSourceFingerprintsByPath(
      { ...corpus.flat, "obsolete.gone": "Gone" },
      [SAVE, CANCEL],
    );
    assert.equal(fingerprints["obsolete.gone"], undefined);
    assert.equal(Object.keys(fingerprints).sort().join(","), [CANCEL, SAVE].sort().join(","));
    await assert.rejects(
      () =>
        upsertWebUiMessagePack({
          locale: LOCALE,
          messages: tree({ ...provenFingerprints([SAVE]).localized, "obsolete.gone": "ذهب" }),
          status: "published",
        }),
      WebUiMessagePackValidationError,
    );
    const proven = provenFingerprints([SAVE, CANCEL]);
    const ready = assessWebUiMessageTreeReadiness({
      messages: tree(proven.localized),
      requiredPaths: [SAVE, CANCEL],
    });
    assert.equal(ready.dataReady, true);
    assert.equal(ready.missingKeyCount, 0);
    const blocked = assessWebUiMessageTreeReadiness({
      messages: tree(proven.localized),
      requiredPaths: [SAVE, CANCEL, SHOWING],
    });
    assert.equal(blocked.dataReady, false);
  });

  it("G/H/I. a hash-matched legacy pack is stamped once, with no provider work and no second write", async () => {
    const corpus = loadPublicWebUiEnglishCorpus();
    const sourceHash = hashWebUiEnglishFlatMap(corpus.flat);
    const beforeMessages = tree({ [SAVE]: "შენახვა" });
    await upsertWebUiMessagePack({
      locale: "ka",
      messages: beforeMessages,
      status: "published",
      sourceNote: `activation; sourceHash=${sourceHash}`,
    });
    const before = await getPublishedWebUiMessagePackByLocale("ka");
    assert.equal(before?.sourceFingerprintsByPath, null);
    const first = await stampWebUiLeafSourceFingerprintsIfCatalogUnchanged("ka");
    assert.equal(first.wrote, true);
    assert.equal(first.reason, "stamped");
    const stamped = await getPublishedWebUiMessagePackByLocale("ka");
    assert.equal(stamped?.revision, before?.revision);
    assert.deepEqual(stamped?.messages, before?.messages);
    assert.equal(
      stamped?.sourceFingerprintsByPath?.[SAVE],
      fingerprintWebUiEnglishLeaf(corpus.flat[SAVE] ?? ""),
    );
    assert.equal(
      Object.keys(stamped?.sourceFingerprintsByPath ?? {}).length,
      corpus.requiredPaths.length,
    );
    const checkpoints = await listWebUiActivationBatches("none");
    assert.equal(checkpoints.length, 0);
    const second = await stampWebUiLeafSourceFingerprintsIfCatalogUnchanged("ka");
    assert.equal(second.wrote, false);
    assert.equal(second.reason, "already_current");
    const again = await getPublishedWebUiMessagePackByLocale("ka");
    assert.equal(again?.updatedAt, stamped?.updatedAt);
    assert.equal(again?.revision, stamped?.revision);
  });

  it("J. a legacy hash mismatch is not stamped", async () => {
    await upsertWebUiMessagePack({
      locale: "he",
      messages: tree({ [SAVE]: "שמור" }),
      status: "published",
      sourceNote: `sourceHash=${"ab".repeat(32)}`,
    });
    const before = await getPublishedWebUiMessagePackByLocale("he");
    const result = await stampWebUiLeafSourceFingerprintsIfCatalogUnchanged("he");
    assert.equal(result.wrote, false);
    assert.equal(result.reason, "hash_mismatch");
    const after = await getPublishedWebUiMessagePackByLocale("he");
    assert.equal(after?.sourceFingerprintsByPath, null);
    assert.equal(after?.updatedAt, before?.updatedAt);
    assert.deepEqual(after?.messages, before?.messages);
  });

  it("K/L. packaged and bundled leaves are not proven current, including locales without a packaged catalog", () => {
    const englishFlat = { [SAVE]: "Save", [CANCEL]: "Cancel" };
    const mongo = tree({ [SAVE]: "حفظ", [CANCEL]: "إلغاء" });
    const fingerprints = {
      [SAVE]: fingerprintWebUiEnglishLeaf("Save"),
      [CANCEL]: fingerprintWebUiEnglishLeaf("old cancel"),
    };
    for (const localeLabel of ["uk", "ka", "he"]) {
      const decisions = classifyWebUiCatalogLeaves({
        englishFlat,
        mongo,
        mongoSourceFingerprintsByPath: fingerprints,
        packaged: tree({ [SAVE]: "пакет", [CANCEL]: "пакет" }),
        bundled: tree({ [SAVE]: "bundle", [CANCEL]: "bundle" }),
      });
      assert.equal(decisions.get(SAVE)?.classification, "REUSE_CURRENT", localeLabel);
      assert.equal(decisions.get(SAVE)?.source, "MONGO_PUBLISHED", localeLabel);
      assert.equal(decisions.get(CANCEL)?.classification, "STALE_SOURCE", localeLabel);
      assert.equal(decisions.get(CANCEL)?.value, null, localeLabel);
    }
  });

  it("M. checkpoint seed and rebase do not mark stale non-empty leaves ok", async () => {
    const corpus = loadPublicWebUiEnglishCorpus([SAVE, CANCEL]);
    await upsertWebUiMessagePack({
      locale: LOCALE,
      messages: tree({ [SAVE]: "حفظ", [CANCEL]: "إلغاء" }),
      status: "published",
      sourceNote: `sourceHash=${"cd".repeat(32)}`,
    });
    const batches = planWebUiDraftBatches(corpus.flat);
    const batch = batches[0]!;
    const now = "2026-09-30T00:00:00.000Z";
    const checkpointId = "webui-act-f3271-rebase";
    await upsertWebUiActivationCheckpoint({
      checkpointId,
      jobId: jobRecord().jobId,
      locale: LOCALE,
      generation: 9,
      sourceHash: "previous-catalog",
      terminologyMode: "live",
      phase: "primary",
      leafCount: corpus.requiredPaths.length,
      batchCount: batches.length,
      completedBatchCount: 1,
      failedBatchCount: 0,
      qualityBatchCount: 0,
      qualityCompletedBatchCount: 0,
      suspiciousPathCount: 0,
      englishName: "Esperanto",
      nativeName: "Esperanto",
      textDirection: "ltr",
      detail: "Preparing public interface…",
      createdAt: now,
      updatedAt: now,
    });
    await upsertWebUiActivationBatch({
      checkpointId,
      batchId: batch.id,
      phase: "primary",
      namespace: batch.namespace,
      keys: batch.keys,
      values: Object.fromEntries(batch.keys.map((key) => [key, "غير فارغ"])),
      status: "ok",
      attempts: 0,
      reason: "reused from published pack",
      updatedAt: now,
    });
    const rebased = await rebaseWebUiCheckpointForCatalogExpansion({
      checkpoint: (await getWebUiActivationCheckpoint(checkpointId))!,
      sourceHash: hashWebUiEnglishFlatMap(corpus.flat),
      flat: corpus.flat,
      requiredPaths: corpus.requiredPaths,
    });
    assert.equal(rebased.checkpointId, checkpointId);
    assert.equal(rebased.completedBatchCount, 0);
    const after = await getWebUiActivationBatch({
      checkpointId,
      batchId: batch.id,
      phase: "primary",
    });
    assert.equal(after?.status, "pending");
  });

  it("N. stamping does not replace an active WEB_UI preparation", async () => {
    const corpus = loadPublicWebUiEnglishCorpus();
    const sourceHash = hashWebUiEnglishFlatMap(corpus.flat);
    await upsertWebUiMessagePack({
      locale: "ka",
      messages: tree({ [SAVE]: "შენახვა" }),
      status: "published",
      sourceNote: `sourceHash=${sourceHash}`,
    });
    const now = "2026-09-30T00:00:00.000Z";
    const checkpointId = "webui-act-f3271-active";
    await upsertWebUiActivationCheckpoint({
      checkpointId,
      jobId: "lang-act-ka-active",
      locale: "ka",
      generation: 4,
      sourceHash,
      terminologyMode: "live",
      phase: "primary",
      leafCount: 10,
      batchCount: 2,
      completedBatchCount: 1,
      failedBatchCount: 0,
      qualityBatchCount: 0,
      qualityCompletedBatchCount: 0,
      suspiciousPathCount: 0,
      englishName: "Georgian",
      nativeName: "ქართული",
      textDirection: "ltr",
      detail: "Preparing public interface…",
      createdAt: now,
      updatedAt: now,
      preparationContract: "partial_reuse_v1",
    });
    const before = await getWebUiActivationCheckpoint(checkpointId);
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () =>
        ({
          languageId: "lang-ka",
          locale: "ka",
          enabled: true,
          contentTranslationEnabled: true,
          searchEnabled: false,
          seoIndexingEnabled: false,
          displayName: "Georgian",
          nativeName: "ქართული",
          aliases: [],
          createdAt: now,
          updatedAt: now,
        }) as never,
      assessWebUi: async () => ({ dataReady: true as const }),
      measureCtWork: async () => ({
        ct: {
          current: 1,
          missing: 0,
          stale: 0,
          invalid: 0,
          failed: 0,
          pending: 0,
          workItemsRequired: 0,
        },
        kindRows: [],
      }),
      planBackfill: async () =>
        ({
          pack: "closure07",
          locale: "ka",
          mode: "dry-run",
          registryEligible: true,
          items: [],
          excluded: [],
          summary: { ctWorkItems: 0, plpWorkItems: 0, skippedCurrent: 0 },
          PROVIDER_CALLS: 0,
          WRITES_PERFORMED: 0,
        }) as never,
      runResidual: async () => {
        throw new Error("provider residual must not run for a stamp");
      },
      ensureWebUiPreparation: async () => {
        throw new Error("stamp must not open preparation");
      },
    });
    await runLocalizationReconciliationPass("ka");
    const after = await getWebUiActivationCheckpoint(checkpointId);
    assert.deepEqual(after, before);
    const pack = await getPublishedWebUiMessagePackByLocale("ka");
    assert.equal(pack?.revision, 1);
    assert.ok(pack?.sourceFingerprintsByPath?.[SAVE]);
  });

  it("O/R. Gate 15D.9.1 stays closed until required leaves are current, then readiness is ready", () => {
    assert.equal(
      isLanguageActivationWebUiReadyForHistoricalEnqueue({
        webUi: emptyPendingDomains().webUi,
        publicWebUiDataReady: false,
        participantWebUiDataReady: true,
      }),
      false,
    );
    const proven = provenFingerprints([SAVE, CANCEL]);
    const missing = assessWebUiMessageTreeReadiness({
      messages: tree({ [SAVE]: proven.localized[SAVE]! }),
      requiredPaths: [SAVE, CANCEL],
    });
    assert.equal(missing.dataReady, false);
    const ready = assessWebUiMessageTreeReadiness({
      messages: tree(proven.localized),
      requiredPaths: [SAVE, CANCEL],
    });
    assert.equal(ready.dataReady, true);
    assert.equal(ready.missingKeyCount, 0);
    const progress = readFileSync(
      path.resolve(
        here,
        "../../../../web/src/features/administration/admin-languages-localization-progress.ts",
      ),
      "utf8",
    );
    assert.match(progress, /readinessState === "READY" \? 100 : Math\.min\(99, rounded\)/);
  });

  it("P. provider cooldown still blocks a residual leaf", async () => {
    assert.equal(LOCALIZATION_PROVIDER_MIN_INTERVAL_MS_DEFAULT, 10_000);
    const corpus = loadPublicWebUiEnglishCorpus([SAVE]);
    const now = "2026-09-30T00:00:00.000Z";
    const checkpointId = "webui-act-f3271-pace";
    await upsertWebUiActivationCheckpoint({
      checkpointId,
      jobId: jobRecord().jobId,
      locale: LOCALE,
      generation: 9,
      sourceHash: hashWebUiEnglishFlatMap(corpus.flat),
      terminologyMode: "live",
      phase: "primary",
      leafCount: 1,
      batchCount: 1,
      completedBatchCount: 0,
      failedBatchCount: 0,
      qualityBatchCount: 0,
      qualityCompletedBatchCount: 0,
      suspiciousPathCount: 0,
      englishName: "Esperanto",
      nativeName: "Esperanto",
      textDirection: "ltr",
      detail: "Preparing public interface…",
      createdAt: now,
      updatedAt: now,
      preparationContract: "partial_reuse_v1",
    });
    let providerCalls = 0;
    const result = await processWebUiActivationTick({
      job: jobRecord(),
      checkpointId,
      deps: {
        includePaths: [SAVE],
        loadLiveTerminology: async () => "",
        loadPackagedWebUiCatalog: () => null,
        loadBundledWebUiCatalog: () => null,
        readProviderCooldown: async () => ({
          active: true,
          cooldownUntil: "2099-01-01T00:00:00.000Z",
        }),
        translator: async () => {
          providerCalls += 1;
          throw new Error("provider must stay gated");
        },
      },
    });
    assert.equal(providerCalls, 0);
    assert.equal(result.providerCalls, 0);
    assert.equal(result.published, false);
  });

  it("Q. successful publish stores fingerprints for every current required path", async () => {
    const proven = provenFingerprints([SAVE, PREFS]);
    await publishLeaves({
      localized: { [SAVE]: proven.localized[SAVE]! },
      fingerprints: { [SAVE]: proven.fingerprints[SAVE]! },
    });
    const sent: string[][] = [];
    const deps: WebUiActivationPreparationDeps = {
      includePaths: [SAVE, PREFS],
      loadLiveTerminology: async () => "",
      loadPackagedWebUiCatalog: () => null,
      loadBundledWebUiCatalog: () => null,
      readProviderCooldown: async () => ({ active: false, cooldownUntil: null }),
      translator: recordingTranslator(sent),
    };
    let result = await processWebUiActivationTick({ job: jobRecord(), deps });
    for (let step = 0; step < 8 && result.needsAnotherTick && !result.published; step += 1) {
      result = await processWebUiActivationTick({
        job: jobRecord(),
        checkpointId: result.checkpoint?.checkpointId,
        deps,
      });
    }
    assert.equal(result.published, true);
    assert.deepEqual(sent.flat(), [PREFS]);
    const pack = await getPublishedWebUiMessagePackByLocale(LOCALE);
    const expected = buildWebUiSourceFingerprintsByPath(
      loadPublicWebUiEnglishCorpus([SAVE, PREFS]).flat,
      [SAVE, PREFS],
    );
    assert.deepEqual(pack?.sourceFingerprintsByPath, expected);
    assert.match(pack?.sourceNote ?? "", /sourceHash=[a-f0-9]{64}/);
    const ready = assessWebUiMessageTreeReadiness({
      messages: pack!.messages,
      requiredPaths: [SAVE, PREFS],
    });
    assert.equal(ready.dataReady, true);
  });
});
