/**
 * ES.07 — durable PLP batch progress.
 * No live provider calls. Identity is uk / sample-editorial, not Spanish.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  buildProviderOwnedMachinePayload,
  emptyLanguageLocalizationCountBucket,
  type LanguageActivationJobRecord,
  type LanguageLocalizationReadinessReport,
} from "@hu/types";

import { emptyPendingDomains } from "../../../src/modules/language/language-localization-activation/language-activation-job.domains.js";
import { applySuppliedReadinessToRunningActivation } from "../../../src/modules/language/language-localization-activation/language-activation-job.service.js";
import {
  saveLanguageActivationJob,
  setLanguageActivationJobForceMemoryForTests,
} from "../../../src/modules/language/language-localization-activation/language-activation-job.repository.js";
import { resetLanguageActivationJobStoreForTests } from "../../../src/modules/language/language-localization-activation/language-activation-job.repository.js";
import {
  setLocalizationProviderClockForTests,
  setLocalizationProviderPacingIntervalMsForTests,
} from "../../../src/modules/language/localization-provider-governor.js";
import {
  resetLocalizationReconciliationDriverForTests,
  setLocalizationReconciliationDriverDepsForTests,
  peekLocalizationReconciliationDriverStateForTests,
  wakeReadinessAfterPlpPublish,
} from "../../../src/modules/language/localization-reconciliation-driver.js";
import { callMediaPlpMaterializerProviderOnce } from "../../../src/modules/language/media-plp-materializer/provider-boundary.js";
import {
  resetThinGeminiGovernorForTests,
  resetThinGeminiProviderStateForTests,
  setThinGeminiProviderStateForceMemoryForTests,
  resetMediaPlpMaterializerCountersForTests,
  resetMediaPlpMaterializerProviderCallBudget,
  ThinGeminiMediaPlpTransport,
} from "../../../src/modules/language/media-plp-materializer/index.js";
import { planPlpProviderBatches } from "../../../src/modules/language/media-plp-materializer/provider-response-contract.js";
import { setTerminologyGlossaryForceMemoryForTests } from "../../../src/modules/language/terminology-glossary/terminology-glossary.repository.js";
import { resolveTranslationConfig } from "../../../src/modules/language/translation.config.js";
import { setWebUiMessagePackForceMemoryForTests } from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";
import type { TranslationProvider } from "../../../src/modules/language/translation-provider.js";
import {
  buildPlpBatchCheckpoint,
  PLP_BATCH_CHECKPOINT_MAX_SEGMENT_CHARS,
  PLP_BATCH_CHECKPOINT_MAX_TOTAL_CHARS,
  resolvePlpBatchResume,
} from "../../../src/modules/language/published-localized-presentation/universal/plp-batch-checkpoint.js";
import {
  claimNextPlpAutoBuildWork,
  listPlpAutoBuildWorkForTests,
  markPlpAutoBuildWorkFailed,
  persistPlpBatchCheckpointYield,
  putPlpAutoBuildWorkForTests,
  resetPlpAutoBuildWorkStoreForTests,
  setPlpAutoBuildNowMsForTests,
  setPlpAutoBuildWorkForceMemoryForTests,
  upsertPendingPlpAutoBuildWork,
  type PlpAutoBuildWorkRecord,
} from "../../../src/modules/language/published-localized-presentation/universal/plp-auto-build-work.repository.js";

const NOW = Date.parse("2026-10-04T21:45:00.000Z");

const IDENTITY = {
  entityType: "civic_media_editorial",
  entityId: "sample-editorial",
  locale: "uk",
  canonicalVersion: "v1",
  contentRevision: 1,
  trigger: "ADMIN_REBUILD" as const,
  maxAttempts: 5,
};

function fields(count: number): Record<string, string> {
  const values: Record<string, string> = {};
  for (let index = 0; index < count; index += 1) {
    values[`field${String(index).padStart(2, "0")}`] = `alpha ${index}`;
  }
  return values;
}

function echoProvider(seen: string[][]): TranslationProvider {
  return {
    providerId: "deterministic",
    async translate(request) {
      const parsed = JSON.parse(request.text) as {
        translations: Array<{ key: string; value: string }>;
      };
      seen.push(parsed.translations.map((entry) => entry.key));
      return {
        providerId: "deterministic",
        isPlaceholder: false,
        translatedText: JSON.stringify({
          translations: parsed.translations.map((entry) => ({
            key: entry.key,
            value: `${entry.value} ok`,
          })),
        }),
        envelope: {
          httpStatus: 200,
          finishReason: "STOP",
          candidateCount: 1,
          textPartCount: 1,
          extractedLength: 12,
        },
      };
    },
  };
}

function row(): PlpAutoBuildWorkRecord {
  const found = listPlpAutoBuildWorkForTests().find(
    (entry) => entry.entityId === IDENTITY.entityId && entry.locale === IDENTITY.locale,
  );
  assert.ok(found);
  return found;
}

function readyReport(): LanguageLocalizationReadinessReport {
  return {
    engineReady: true,
    languageDataReady: true,
    state: "READY",
    ct: emptyLanguageLocalizationCountBucket(),
    plpMedia: emptyLanguageLocalizationCountBucket(),
  } as LanguageLocalizationReadinessReport;
}

beforeEach(() => {
  process.env.HU_PLP_THIN_GEMINI_MIN_SPACING_MS = "0";
  setThinGeminiProviderStateForceMemoryForTests(true);
  resetThinGeminiProviderStateForTests();
  resetThinGeminiGovernorForTests({ clearStartupGuard: true });
  setLocalizationProviderClockForTests(() => NOW);
  setLocalizationProviderPacingIntervalMsForTests(null);
  resetMediaPlpMaterializerCountersForTests();
  resetMediaPlpMaterializerProviderCallBudget();
  setPlpAutoBuildWorkForceMemoryForTests(true);
  resetPlpAutoBuildWorkStoreForTests();
  setPlpAutoBuildNowMsForTests(NOW);
  setLanguageActivationJobForceMemoryForTests(true);
  resetLanguageActivationJobStoreForTests();
  setTerminologyGlossaryForceMemoryForTests(true);
  setWebUiMessagePackForceMemoryForTests(true);
  resetLocalizationReconciliationDriverForTests();
});

afterEach(() => {
  delete process.env.HU_PLP_THIN_GEMINI_MIN_SPACING_MS;
  setLocalizationProviderClockForTests(null);
  setLocalizationProviderPacingIntervalMsForTests(null);
  resetThinGeminiProviderStateForTests();
  setThinGeminiProviderStateForceMemoryForTests(false);
  resetThinGeminiGovernorForTests({ clearStartupGuard: true });
  resetPlpAutoBuildWorkStoreForTests();
  setPlpAutoBuildWorkForceMemoryForTests(false);
  setPlpAutoBuildNowMsForTests(null);
  resetLanguageActivationJobStoreForTests();
  setLanguageActivationJobForceMemoryForTests(false);
  setTerminologyGlossaryForceMemoryForTests(false);
  setWebUiMessagePackForceMemoryForTests(false);
  resetLocalizationReconciliationDriverForTests();
});

describe("ES.07 durable PLP batch progress", () => {
  it("advances one batch at a time and does not retransmit completed batches", async () => {
    const autoValues = fields(24);
    const { payload } = buildProviderOwnedMachinePayload(autoValues);
    const batches = planPlpProviderBatches(payload);
    assert.equal(batches.length, 4);
    const seen: string[][] = [];
    const provider = echoProvider(seen);
    let checkpoint = null as ReturnType<typeof buildPlpBatchCheckpoint>;
    for (let step = 0; step < 4; step += 1) {
      const restarted = checkpoint
        ? (JSON.parse(JSON.stringify(checkpoint)) as NonNullable<typeof checkpoint>)
        : null;
      const result = await callMediaPlpMaterializerProviderOnce({
        provider,
        locale: "uk",
        autoValues,
        sourceRecordId: "civic_media_editorial:sample-editorial",
        sourceVersion: "v1",
        terminologyContext: "none",
        yieldAfterAcceptedBatch: true,
        batchCheckpoint: restarted,
      });
      const keys = seen[step] ?? [];
      for (let earlier = 0; earlier < step; earlier += 1) {
        for (const key of seen[earlier] ?? []) {
          assert.equal(keys.includes(key), false);
        }
      }
      if (step < 3) {
        assert.equal(result.ok, false);
        if (result.ok) return;
        assert.equal(result.reason, "PROVIDER_BATCH_PROGRESS");
        assert.ok(result.batchCheckpoint);
        assert.equal(result.batchCheckpoint?.nextBatchIndex, step + 1);
        assert.equal(Object.keys(result.batchCheckpoint?.segments ?? {}).length, (step + 1) * 6);
        assert.equal(JSON.stringify(result.batchCheckpoint).includes("candidates"), false);
        checkpoint = result.batchCheckpoint ?? null;
      } else {
        assert.equal(result.ok, true);
        if (!result.ok) return;
        assert.equal(Object.keys(result.values).length, 24);
      }
    }
    assert.equal(seen.length, 4);
  });

  it("pacing after batch 0 checkpoints segments and refunds the attempt", async () => {
    setLocalizationProviderPacingIntervalMsForTests(60_000);
    const autoValues = fields(12);
    let httpCalls = 0;
    const transport = new ThinGeminiMediaPlpTransport(
      {
        ...resolveTranslationConfig(),
        provider: "gemini",
        geminiApiKey: "test-key-not-real",
        geminiModel: "gemini-2.0-flash",
        timeoutMs: 5_000,
      },
      async (_url, init) => {
        httpCalls += 1;
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          contents?: Array<{ parts?: Array<{ text?: string }> }>;
        };
        const requestText = body.contents?.[0]?.parts?.[0]?.text ?? "";
        const parsed = JSON.parse(requestText) as {
          translations: Array<{ key: string; value: string }>;
        };
        return new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: "STOP",
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        translations: parsed.translations.map((entry) => ({
                          key: entry.key,
                          value: `${entry.value} ok`,
                        })),
                      }),
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    );
    const result = await callMediaPlpMaterializerProviderOnce({
      provider: transport,
      locale: "uk",
      autoValues,
      sourceRecordId: "civic_media_editorial:sample-editorial",
      sourceVersion: "v1",
      terminologyContext: "none",
      PROVIDER_TRANSPORT: "thin_gemini",
      yieldAfterAcceptedBatch: true,
    });
    assert.equal(httpCalls, 1);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "PROVIDER_BATCH_PROGRESS");
    assert.ok(result.pacingUntil);
    assert.ok(result.batchCheckpoint);
    await upsertPendingPlpAutoBuildWork(IDENTITY);
    setLocalizationProviderClockForTests(() => NOW + 60_001);
    setPlpAutoBuildNowMsForTests(NOW + 60_001);
    const claimed = await claimNextPlpAutoBuildWork();
    assert.ok(claimed);
    await persistPlpBatchCheckpointYield({
      workKey: claimed.workKey,
      attempts: claimed.attempts,
      checkpoint: result.batchCheckpoint!,
      pacingUntil: result.pacingUntil ?? null,
    });
    const waiting = row();
    assert.equal(waiting.status, "pending");
    assert.equal(waiting.attempts, 0);
    assert.equal(waiting.recoveryGeneration, null);
    assert.equal(waiting.nextAttemptAt, result.pacingUntil);
    assert.equal(waiting.batchCheckpoint?.nextBatchIndex, 1);
    setLocalizationProviderClockForTests(() => NOW);
    setPlpAutoBuildNowMsForTests(NOW);
    assert.equal(await claimNextPlpAutoBuildWork(), null);
  });

  it("a same-version provider failure keeps prior batches and a capped failure stays terminal", async () => {
    const autoValues = fields(12);
    const { payload } = buildProviderOwnedMachinePayload(autoValues);
    const batches = planPlpProviderBatches(payload);
    const checkpoint = buildPlpBatchCheckpoint({
      sourceVersion: "v1",
      nextBatchIndex: 1,
      batches,
      segments: Object.fromEntries(
        Object.keys(batches[0] ?? {}).map((key) => [key, `${key} ok`]),
      ),
    });
    assert.ok(checkpoint);
    await upsertPendingPlpAutoBuildWork(IDENTITY);
    putPlpAutoBuildWorkForTests({
      ...row(),
      attempts: 2,
      recoveryGeneration: "1",
      batchCheckpoint: checkpoint,
    });
    const claimed = await claimNextPlpAutoBuildWork();
    assert.ok(claimed);
    await markPlpAutoBuildWorkFailed({
      workKey: claimed.workKey,
      attempts: claimed.attempts,
      maxAttempts: claimed.maxAttempts,
      failure: {
        failureCode: "PROVIDER_FAILURE",
        retryable: true,
        stage: "provider",
        safeReason: "PROVIDER_FAILURE",
      },
    });
    const retried = row();
    assert.equal(retried.status, "pending");
    assert.equal(retried.batchCheckpoint?.nextBatchIndex, 1);
    assert.equal(
      resolvePlpBatchResume({
        sourceVersion: "v1",
        batches,
        checkpoint: retried.batchCheckpoint,
      }).nextBatchIndex,
      1,
    );

    putPlpAutoBuildWorkForTests({
      ...retried,
      status: "pending",
      attempts: 5,
      recoveryGeneration: "2",
      nextAttemptAt: null,
    });
    const last = await claimNextPlpAutoBuildWork();
    assert.equal(last, null);
  });

  it("a new source version discards the checkpoint", async () => {
    await upsertPendingPlpAutoBuildWork(IDENTITY);
    const checkpoint = buildPlpBatchCheckpoint({
      sourceVersion: "v1",
      nextBatchIndex: 1,
      batches: [{ field00: "alpha" }],
      segments: { field00: "alpha ok" },
    });
    assert.ok(checkpoint);
    putPlpAutoBuildWorkForTests({ ...row(), batchCheckpoint: checkpoint });
    const reopened = await upsertPendingPlpAutoBuildWork({
      ...IDENTITY,
      canonicalVersion: "v2",
    });
    assert.equal(reopened.record.batchCheckpoint, null);
    assert.equal(reopened.record.attempts, 0);
    assert.equal(reopened.record.recoveryGeneration, null);
  });

  it("rejects an oversized checkpoint and does not keep raw provider bodies", () => {
    const huge = "x".repeat(PLP_BATCH_CHECKPOINT_MAX_SEGMENT_CHARS + 1);
    const rejected = buildPlpBatchCheckpoint({
      sourceVersion: "v1",
      nextBatchIndex: 1,
      batches: [{ field00: "alpha" }],
      segments: { field00: huge },
    });
    assert.equal(rejected, null);
    const accepted = buildPlpBatchCheckpoint({
      sourceVersion: "v1",
      nextBatchIndex: 1,
      batches: [{ field00: "alpha" }],
      segments: { field00: "alpha ok" },
    });
    assert.ok(accepted);
    assert.deepEqual(Object.keys(accepted).sort(), [
      "batchCount",
      "nextBatchIndex",
      "planFingerprint",
      "segments",
      "sourceVersion",
    ]);
    assert.ok(PLP_BATCH_CHECKPOINT_MAX_TOTAL_CHARS < 1_000_000);
  });

  it("keeps Brand token validation on final assembly", async () => {
    const autoValues = { line: "Hello {siteName} team" };
    const seen: string[][] = [];
    const good = await callMediaPlpMaterializerProviderOnce({
      provider: echoProvider(seen),
      locale: "uk",
      autoValues,
      sourceRecordId: "civic_media_editorial:sample-editorial",
      sourceVersion: "v1",
      terminologyContext: "none",
      yieldAfterAcceptedBatch: true,
    });
    assert.equal(good.ok, true);
    if (!good.ok) return;
    assert.match(good.values.line ?? "", /\{siteName\}/);

    resetMediaPlpMaterializerProviderCallBudget();
    const bad = await callMediaPlpMaterializerProviderOnce({
      provider: {
        providerId: "deterministic",
        async translate(request) {
          const parsed = JSON.parse(request.text) as {
            translations: Array<{ key: string; value: string }>;
          };
          return {
            providerId: "deterministic",
            isPlaceholder: false,
            translatedText: JSON.stringify({
              translations: parsed.translations.map((entry) => ({
                key: entry.key,
                value: `{siteName} ${entry.value}`,
              })),
            }),
            envelope: {
              httpStatus: 200,
              finishReason: "STOP",
              candidateCount: 1,
              textPartCount: 1,
              extractedLength: 8,
            },
          };
        },
      },
      locale: "uk",
      autoValues,
      sourceRecordId: "civic_media_editorial:sample-editorial",
      sourceVersion: "v1",
      terminologyContext: "none",
      yieldAfterAcceptedBatch: true,
    });
    assert.equal(bad.ok, false);
    if (bad.ok) return;
    assert.equal(bad.reason, "BRAND_TOKEN_PRESERVATION_FAILED");
  });

  it("wakes reconciliation and can complete a running activation when readiness is READY", async () => {
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => null,
    });
    wakeReadinessAfterPlpPublish("uk");
    const state = peekLocalizationReconciliationDriverStateForTests();
    assert.ok(state.inFlight.includes("uk"));
    await new Promise((resolve) => setTimeout(resolve, 30));

    const domains = emptyPendingDomains();
    const readyDomains = {
      ...domains,
      brand: { ...domains.brand, status: "ready" as const },
      terminology: { ...domains.terminology, status: "ready" as const },
      webUi: {
        ...domains.webUi,
        status: "ready" as const,
        dataReady: true,
        preparationPhase: "ready" as const,
      },
    };
    const job: LanguageActivationJobRecord = {
      jobId: "lang-act-uk-es07",
      locale: "uk",
      languageId: "lang-uk",
      generation: 1,
      status: "running",
      domains: readyDomains,
      lastError: null,
      diagnosticSummary: "running",
      createdAt: new Date(NOW).toISOString(),
      updatedAt: new Date(NOW).toISOString(),
      startedAt: new Date(NOW).toISOString(),
      completedAt: null,
      createdByParticipantId: null,
      searchEnabledSnapshot: false,
      seoIndexingEnabledSnapshot: false,
    };
    await saveLanguageActivationJob(job);
    const saved = await applySuppliedReadinessToRunningActivation({
      locale: "uk",
      readiness: readyReport(),
      domains: readyDomains,
    });
    assert.equal(saved?.status, "completed");
  });
});
