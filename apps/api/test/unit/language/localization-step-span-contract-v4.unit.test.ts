/**
 * WEB_UI provider shape 4 — machine-enforced span cardinality.
 * Deterministic translator only. No Gemini HTTP call.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import type { LanguageRegistryRecord } from "@hu/types";

import { emptyPendingDomains } from "../../../src/modules/language/language-localization-activation/language-activation-job.domains.js";
import {
  processLanguageActivationJob,
  resetLanguageActivationJobSchedulerForTests,
  resumeIncompleteWebUiActivationJobsOnBoot,
  setLanguageActivationJobAdminAssertOverrideForTests,
  setLanguageActivationJobForceMemoryForTests,
  setLanguageActivationJobProcessDepsForTests,
} from "../../../src/modules/language/language-localization-activation/index.js";
import {
  resetLanguageActivationJobStoreForTests,
  saveLanguageActivationJob,
} from "../../../src/modules/language/language-localization-activation/language-activation-job.repository.js";
import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/index.js";
import {
  setLocalizationProviderClockForTests,
  setLocalizationProviderPacingIntervalMsForTests,
} from "../../../src/modules/language/localization-provider-governor.js";
import {
  resetThinGeminiProviderStateForTests,
  setThinGeminiProviderStateForceMemoryForTests,
} from "../../../src/modules/language/media-plp-materializer/thin-gemini-provider-state.js";
import { buildGeminiGenerationConfig } from "../../../src/modules/language/providers/gemini-translation-provider.js";
import type { TranslationProviderRequest } from "../../../src/modules/language/translation-provider.js";
import {
  getWebUiActivationCheckpointByJobId,
  listIncompleteWebUiActivationCheckpoints,
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
  translateWebUiProviderBatch,
} from "../../../src/modules/web-ui-message-packs/web-ui-draft-builder.js";
import {
  getPublishedWebUiMessagePackByLocale,
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import {
  reconstructWebUiMessageFromProviderSpans,
  webUiProviderPayloadValue,
  webUiProviderResponseSchema,
  WebUiProviderSpanCountError,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-structure-protect.js";
import {
  isRecoverableWebUiActivationCheckpoint,
  WEB_UI_PROVIDER_SHAPE_VERSION,
  WEB_UI_STRUCTURE_BLOCKED_REASON,
} from "../../../src/modules/web-ui-message-packs/web-ui-provider-output-structure.js";

const ONE = "Plain label";
const TWO = "Before <emphasis>inside</emphasis>";
const THREE =
  "A <emphasis>Volunteer</emphasis> is not a title. It is a sign of responsibility — one that society often underestimates.";

const KEY_ONE = "leaf.one";
const KEY_TWO = "leaf.two";
const KEY_THREE = "leaf.three";

function echoRequest(request: TranslationProviderRequest, shortenKey?: string) {
  const parsed = JSON.parse(request.text) as Record<string, unknown>;
  const translated: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(parsed)) {
    assert.ok(Array.isArray(value), key);
    const spans = (value as unknown[]).map((span) => String(span));
    translated[key] = key === shortenKey ? spans.slice(0, Math.max(0, spans.length - 1)) : spans;
  }
  return {
    translatedText: JSON.stringify(translated),
    providerId: "deterministic" as const,
    isPlaceholder: false as const,
  };
}

describe("WEB_UI span contract shape 4", () => {
  it("states exact array bounds for 1, 2, and 3 spans, including different counts in one batch", () => {
    assert.equal(WEB_UI_PROVIDER_SHAPE_VERSION, 4);
    const one = webUiProviderPayloadValue(ONE);
    const two = webUiProviderPayloadValue(TWO);
    const three = webUiProviderPayloadValue(THREE);
    assert.deepEqual(one, [ONE]);
    assert.equal(two.length, 2);
    assert.deepEqual([...three], [
      "A ",
      "Volunteer",
      " is not a title. It is a sign of responsibility — one that society often underestimates.",
    ]);

    const keys = [KEY_ONE, KEY_TWO, KEY_THREE];
    const payload = { [KEY_ONE]: one, [KEY_TWO]: two, [KEY_THREE]: three };
    const schema = webUiProviderResponseSchema({ keys, payload });
    assert.equal(schema.type, "object");
    assert.deepEqual(schema.required, keys);
    assert.deepEqual(schema.propertyOrdering, keys);
    assert.deepEqual(schema.properties[KEY_ONE], {
      type: "array",
      minItems: 1,
      maxItems: 1,
      items: { type: "string" },
    });
    assert.equal(schema.properties[KEY_TWO]?.minItems, 2);
    assert.equal(schema.properties[KEY_TWO]?.maxItems, 2);
    assert.equal(schema.properties[KEY_THREE]?.minItems, 3);
    assert.equal(schema.properties[KEY_THREE]?.maxItems, 3);
    assert.equal(schema.properties[KEY_THREE]?.items.type, "string");
  });

  it("puts that schema on the Gemini request and omits it when the caller has none", () => {
    const schema = webUiProviderResponseSchema({
      keys: [KEY_THREE],
      payload: { [KEY_THREE]: webUiProviderPayloadValue(THREE) },
    });
    const withSchema = buildGeminiGenerationConfig({
      maxOutputTokens: 4096,
      responseSchema: schema,
    });
    assert.equal(withSchema.responseMimeType, "application/json");
    assert.equal(withSchema.responseSchema, schema);
    const plain = buildGeminiGenerationConfig({ maxOutputTokens: 4096 });
    assert.equal("responseSchema" in plain, false);
    assert.equal("responseMimeType" in plain, false);
  });

  it("sends the schema with a batch and reconstructs a correct 3-span reply", async () => {
    let seen: TranslationProviderRequest | null = null;
    const result = await translateWebUiProviderBatch({
      locale: "eo",
      englishFlat: { [KEY_ONE]: ONE, [KEY_THREE]: THREE },
      keys: [KEY_ONE, KEY_THREE],
      terminologyContext: "",
      translator: async (request) => {
        seen = request;
        return echoRequest(request);
      },
    });
    assert.ok(seen);
    const request: TranslationProviderRequest = seen;
    const schema = request.responseSchema as {
      properties: Record<string, { minItems: number; maxItems: number }>;
    };
    assert.equal(schema.properties[KEY_ONE]?.minItems, 1);
    assert.equal(schema.properties[KEY_ONE]?.maxItems, 1);
    assert.equal(schema.properties[KEY_THREE]?.minItems, 3);
    assert.equal(schema.properties[KEY_THREE]?.maxItems, 3);
    assert.equal(
      result.values[KEY_THREE],
      reconstructWebUiMessageFromProviderSpans(THREE, webUiProviderPayloadValue(THREE)),
    );
    assert.equal(
      result.values[KEY_THREE],
      "A <emphasis>Volunteer</emphasis> is not a title. It is a sign of responsibility — one that society often underestimates.",
    );
  });

  it("rejects expected 3 / actual 2 and returns no translated values", async () => {
    await assert.rejects(
      () =>
        translateWebUiProviderBatch({
          locale: "eo",
          englishFlat: { [KEY_ONE]: ONE, [KEY_THREE]: THREE },
          keys: [KEY_ONE, KEY_THREE],
          terminologyContext: "",
          translator: async (request) => echoRequest(request, KEY_THREE),
        }),
      (error: unknown) => {
        assert.ok(error instanceof WebUiProviderSpanCountError);
        assert.equal(error.catalogKey, KEY_THREE);
        assert.equal(error.expectedSpanCount, 3);
        assert.equal(error.actualSpanCount, 2);
        return true;
      },
    );
    assert.throws(
      () => reconstructWebUiMessageFromProviderSpans(THREE, ["A Volunteer", " rest"]),
      (error: unknown) => {
        assert.ok(error instanceof WebUiProviderSpanCountError);
        assert.equal(error.expectedSpanCount, 3);
        assert.equal(error.actualSpanCount, 2);
        return true;
      },
    );
  });
});

describe("shape 4 reopens an obsolete terminal block once", () => {
  let nowMs = Date.now();
  let calls = 0;
  let seenKeys: string[] = [];
  let shorten = false;

  beforeEach(async () => {
    nowMs = Date.now();
    calls = 0;
    seenKeys = [];
    shorten = false;
    setLocalizationProviderClockForTests(() => nowMs);
    setLocalizationProviderPacingIntervalMsForTests(10_000);
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
      participantId: "participant-admin-span-v4",
    }));
  });

  afterEach(() => {
    setLocalizationProviderClockForTests(null);
    setLocalizationProviderPacingIntervalMsForTests(null);
    setLanguageActivationJobProcessDepsForTests(null);
    setLanguageActivationJobAdminAssertOverrideForTests(null);
    resetLanguageActivationJobSchedulerForTests();
    resetThinGeminiProviderStateForTests();
    setThinGeminiProviderStateForceMemoryForTests(false);
  });

  async function registryEo(): Promise<LanguageRegistryRecord> {
    return createLanguageRegistryRecord({
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
  }

  async function seedTerminal(input: {
    readonly providerShapeVersion: number;
    readonly structureRecoveryCycleCount: number;
  }) {
    const corpus = loadPublicWebUiEnglishCorpus();
    const planned = planWebUiDraftBatches(corpus.flat);
    const first = planned[0];
    const second = planned[1];
    assert.ok(first);
    assert.ok(second);
    const includePaths = [...first.keys, ...second.keys];
    const subset = loadPublicWebUiEnglishCorpus(includePaths);
    const replay = planWebUiDraftBatches(subset.flat);
    assert.equal(replay[0]?.id, first.id);
    assert.equal(replay[1]?.id, second.id);
    const sourceHash = hashWebUiEnglishFlatMap(subset.flat);
    const record = await registryEo();
    const stamp = new Date(nowMs).toISOString();
    const jobId = `lang-act-eo-span-v4-${input.providerShapeVersion}`;
    const checkpointId = `webui-act-span-v4-${input.providerShapeVersion}`;
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: async () => {
        throw new Error("CT/PLP activate must not run before WEB_UI is ready.");
      },
      webUiPreparationDeps: {
        includePaths,
        now: () => new Date(nowMs).toISOString(),
        loadLiveTerminology: async () => "",
        readProviderCooldown: async () => ({ active: false, cooldownUntil: null }),
        translator: async (request) => {
          calls += 1;
          const parsed = JSON.parse(request.text) as Record<string, unknown>;
          seenKeys = Object.keys(parsed);
          const schema = request.responseSchema as {
            properties: Record<string, { minItems: number; maxItems: number }>;
          };
          for (const key of Object.keys(parsed)) {
            const count = (parsed[key] as unknown[]).length;
            assert.equal(schema.properties[key]?.minItems, count);
            assert.equal(schema.properties[key]?.maxItems, count);
          }
          return echoRequest(request, shorten ? second.keys[0] : undefined);
        },
      },
    });
    await upsertWebUiActivationBatch({
      checkpointId,
      batchId: first.id,
      phase: "primary",
      namespace: first.namespace,
      keys: first.keys,
      values: Object.fromEntries(first.keys.map((key) => [key, "kept-valid"])),
      status: "ok",
      attempts: 1,
      reason: null,
      updatedAt: stamp,
    });
    await upsertWebUiActivationBatch({
      checkpointId,
      batchId: second.id,
      phase: "primary",
      namespace: second.namespace,
      keys: second.keys,
      values: {},
      status: "pending",
      attempts: 1,
      reason: WEB_UI_STRUCTURE_BLOCKED_REASON,
      updatedAt: stamp,
    });
    await upsertWebUiActivationCheckpoint({
      checkpointId,
      jobId,
      locale: "eo",
      generation: 1,
      sourceHash,
      terminologyMode: "live",
      phase: "structure_blocked",
      leafCount: subset.requiredPaths.length,
      batchCount: 702,
      completedBatchCount: 617,
      failedBatchCount: 0,
      qualityBatchCount: 0,
      qualityCompletedBatchCount: 0,
      suspiciousPathCount: 0,
      englishName: "Esperanto",
      nativeName: "Esperanto",
      textDirection: "ltr",
      detail: "Automatic translation is blocked by a structural defect.",
      createdAt: stamp,
      updatedAt: stamp,
      nextAttemptAt: null,
      structureRetryCount: 6,
      providerShapeVersion: input.providerShapeVersion,
      providerShapeFailureCount: 6,
      structureRecoveryCycleCount: input.structureRecoveryCycleCount,
      structureRecoveryBlockedBatchId: second.id,
      preparationContract: "partial_reuse_v1",
    });
    const domains = emptyPendingDomains();
    await saveLanguageActivationJob({
      jobId,
      locale: "eo",
      languageId: record.languageId,
      generation: 1,
      status: "running",
      domains: {
        ...domains,
        webUi: {
          ...domains.webUi,
          status: "in_progress",
          dataReady: false,
          preparationPhase: "structure_blocked",
          checkpointId,
          sourceHash,
          totalBatches: 702,
          completedBatches: 617,
          providerFailure: false,
        },
      },
      lastError: null,
      diagnosticSummary: "running",
      createdAt: stamp,
      updatedAt: stamp,
      startedAt: stamp,
      completedAt: null,
      createdByParticipantId: "participant-admin-span-v4",
      searchEnabledSnapshot: false,
      seoIndexingEnabledSnapshot: false,
    });
    return { jobId, checkpointId, first, second };
  }

  it("reopens provider shape 3 cycle 2, keeps completed batches, and calls the provider once", async () => {
    assert.equal(
      isRecoverableWebUiActivationCheckpoint({
        phase: "structure_blocked",
        providerShapeVersion: 3,
        providerShapeFailureCount: 6,
        structureRecoveryCycleCount: 2,
      }),
      true,
    );
    const seeded = await seedTerminal({
      providerShapeVersion: 3,
      structureRecoveryCycleCount: 2,
    });
    const job = await processLanguageActivationJob(seeded.jobId, { webUiTick: true });
    resetLanguageActivationJobSchedulerForTests();
    assert.equal(calls, 1);
    assert.deepEqual(seenKeys.sort(), [...seeded.second.keys].sort());
    assert.equal(seenKeys.includes(seeded.first.keys[0] ?? ""), false);
    assert.equal(job.status, "running");
    const checkpoint = await getWebUiActivationCheckpointByJobId(seeded.jobId);
    assert.equal(checkpoint?.providerShapeVersion, 4);
    assert.equal(checkpoint?.completedBatchCount, 618);
    assert.equal(checkpoint?.batchCount, 702);
    assert.equal(checkpoint?.structureFailure ?? null, null);
    assert.equal(checkpoint?.structureRecoveryCycleCount, 0);
    assert.equal(checkpoint?.providerShapeFailureCount, 0);
    assert.equal(checkpoint?.structureRecoveryBlockedBatchId ?? null, null);
    assert.notEqual(checkpoint?.phase, "structure_blocked");
    const kept = (await listWebUiActivationBatches(seeded.checkpointId, "primary")).find(
      (row) => row.batchId === seeded.first.id,
    );
    assert.equal(kept?.status, "ok");
    assert.equal(kept?.values[seeded.first.keys[0] ?? ""], "kept-valid");
    assert.equal(await getPublishedWebUiMessagePackByLocale("eo"), null);
  });

  it("stores nothing when the reopened batch still returns the wrong span count", async () => {
    shorten = true;
    const seeded = await seedTerminal({
      providerShapeVersion: 3,
      structureRecoveryCycleCount: 2,
    });
    await processLanguageActivationJob(seeded.jobId, { webUiTick: true });
    resetLanguageActivationJobSchedulerForTests();
    assert.equal(calls, 1);
    const blocked = (await listWebUiActivationBatches(seeded.checkpointId, "primary")).find(
      (row) => row.batchId === seeded.second.id,
    );
    assert.deepEqual(blocked?.values, {});
    assert.notEqual(blocked?.status, "ok");
    const kept = (await listWebUiActivationBatches(seeded.checkpointId, "primary")).find(
      (row) => row.batchId === seeded.first.id,
    );
    assert.equal(kept?.values[seeded.first.keys[0] ?? ""], "kept-valid");
    const checkpoint = await getWebUiActivationCheckpointByJobId(seeded.jobId);
    assert.equal(checkpoint?.completedBatchCount, 617);
    assert.equal(checkpoint?.providerShapeVersion, 4);
    assert.equal(await getPublishedWebUiMessagePackByLocale("eo"), null);
  });

  it("does not reopen a terminal block on the current shape", async () => {
    assert.equal(
      isRecoverableWebUiActivationCheckpoint({
        phase: "structure_blocked",
        providerShapeVersion: WEB_UI_PROVIDER_SHAPE_VERSION,
        providerShapeFailureCount: 6,
        structureRecoveryCycleCount: 2,
      }),
      false,
    );
    const seeded = await seedTerminal({
      providerShapeVersion: WEB_UI_PROVIDER_SHAPE_VERSION,
      structureRecoveryCycleCount: 2,
    });
    const listed = await listIncompleteWebUiActivationCheckpoints();
    assert.equal(listed.some((row) => row.checkpointId === seeded.checkpointId), false);
    const boot = await resumeIncompleteWebUiActivationJobsOnBoot();
    resetLanguageActivationJobSchedulerForTests();
    assert.equal(boot.scheduled, 0);
    await processLanguageActivationJob(seeded.jobId, { webUiTick: true });
    resetLanguageActivationJobSchedulerForTests();
    assert.equal(calls, 0);
    const checkpoint = await getWebUiActivationCheckpointByJobId(seeded.jobId);
    assert.equal(checkpoint?.phase, "structure_blocked");
    assert.equal(checkpoint?.completedBatchCount, 617);
    assert.equal(checkpoint?.providerShapeVersion, WEB_UI_PROVIDER_SHAPE_VERSION);
    assert.equal(checkpoint?.nextAttemptAt ?? null, null);
    assert.equal(checkpoint?.structureRecoveryCycleCount, 2);
  });
});
