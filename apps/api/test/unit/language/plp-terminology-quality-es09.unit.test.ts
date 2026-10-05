/**
 * ES.09 — terminology is a shared quality diagnostic, and an accepted provider
 * batch is durable before that assessment. No live provider calls.
 * The natural-language fixture is not a locale rule.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { buildProviderOwnedMachinePayload, plpBuildWorkKey } from "@hu/types";

import {
  LocalizationProviderPacingDeferredError,
  setLocalizationProviderClockForTests,
  setLocalizationProviderPacingIntervalMsForTests,
} from "../../../src/modules/language/localization-provider-governor.js";
import { resetLocalizationReconciliationDriverForTests } from "../../../src/modules/language/localization-reconciliation-driver.js";
import { callMediaPlpMaterializerProviderOnce } from "../../../src/modules/language/media-plp-materializer/provider-boundary.js";
import { planPlpProviderBatches } from "../../../src/modules/language/media-plp-materializer/provider-response-contract.js";
import {
  resetMediaPlpMaterializerCountersForTests,
  resetMediaPlpMaterializerProviderCallBudget,
  resetThinGeminiGovernorForTests,
  resetThinGeminiProviderStateForTests,
  setThinGeminiProviderStateForceMemoryForTests,
} from "../../../src/modules/language/media-plp-materializer/index.js";
import { tryAcquireLocalizationProviderPacingPermit } from "../../../src/modules/language/media-plp-materializer/thin-gemini-provider-state.js";
import {
  assessRequiredTerminologyProtection,
  terminologyQualityDiagnosticsForPublication,
} from "../../../src/modules/language/terminology-protection-contract.js";
import {
  resetTerminologyGlossaryStoreForTests,
  setTerminologyGlossaryForceMemoryForTests,
} from "../../../src/modules/language/terminology-glossary/terminology-glossary.repository.js";
import { upsertTerminologyGlossaryMemory } from "../../../src/modules/language/terminology-glossary/terminology-glossary.memory.store.js";
import { buildPlpBatchCheckpoint } from "../../../src/modules/language/published-localized-presentation/universal/plp-batch-checkpoint.js";
import { isObsoleteTerminologyHardGateFailure } from "../../../src/modules/language/published-localized-presentation/universal/plp-auto-build-failure.js";
import {
  PLP_MAX_RECOVERY_GENERATIONS,
  listPlpAutoBuildWorkForTests,
  persistPlpProviderSuccessCheckpoint,
  putPlpAutoBuildWorkForTests,
  resetPlpAutoBuildWorkStoreForTests,
  setPlpAutoBuildNowMsForTests,
  setPlpAutoBuildWorkForceMemoryForTests,
  upsertPendingPlpAutoBuildWork,
  type PlpAutoBuildWorkRecord,
} from "../../../src/modules/language/published-localized-presentation/universal/plp-auto-build-work.repository.js";
import type { TranslationProvider } from "../../../src/modules/language/translation-provider.js";

const NOW = Date.parse("2026-10-04T23:10:00.000Z");
const HERE = path.dirname(new URL(import.meta.url).pathname);

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

function envelope(length = 12) {
  return {
    httpStatus: 200,
    finishReason: "STOP",
    candidateCount: 1,
    textPartCount: 1,
    extractedLength: length,
  };
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
        envelope: envelope(),
      };
    },
  };
}

function fixedProvider(
  map: Readonly<Record<string, string>>,
  calls: { count: number },
): TranslationProvider {
  return {
    providerId: "deterministic",
    async translate(request) {
      calls.count += 1;
      const parsed = JSON.parse(request.text) as {
        translations: Array<{ key: string; value: string }>;
      };
      return {
        providerId: "deterministic",
        isPlaceholder: false,
        translatedText: JSON.stringify({
          translations: parsed.translations.map((entry) => ({
            key: entry.key,
            value: map[entry.value] ?? `${entry.value} ok`,
          })),
        }),
        envelope: envelope(40),
      };
    },
  };
}

function publishConcepts(): void {
  upsertTerminologyGlossaryMemory({
    conceptId: "participant",
    canonicalEnglishTerm: "Participant",
    category: "domain",
    status: "published",
    translations: { uk: { preferredTerm: "Participante", aliases: [] } },
    createdAt: "2026-10-03T16:31:33.577Z",
    updatedAt: "2026-10-03T16:31:33.577Z",
    updatedByParticipantId: null,
  });
  upsertTerminologyGlossaryMemory({
    conceptId: "initiative",
    canonicalEnglishTerm: "Initiative",
    category: "workflow_stage",
    status: "published",
    translations: { uk: { preferredTerm: "Iniciativa", aliases: [] } },
    createdAt: "2026-10-03T16:31:33.577Z",
    updatedAt: "2026-10-03T16:31:33.577Z",
    updatedByParticipantId: null,
  });
}

function planned(autoValues: Record<string, string>) {
  const { payload } = buildProviderOwnedMachinePayload(autoValues);
  return planPlpProviderBatches(payload);
}

function segmentsFor(
  batches: readonly (Readonly<Record<string, string>>)[],
  through: number,
): Record<string, string> {
  const segments: Record<string, string> = {};
  for (let index = 0; index < through; index += 1) {
    for (const [key, value] of Object.entries(batches[index] ?? {})) {
      segments[key] = `${value} ok`;
    }
  }
  return segments;
}

function failedRow(
  checkpoint: PlpAutoBuildWorkRecord["batchCheckpoint"],
  patch: Partial<PlpAutoBuildWorkRecord> = {},
): PlpAutoBuildWorkRecord {
  return {
    workKey: plpBuildWorkKey(IDENTITY),
    entityType: IDENTITY.entityType,
    entityId: IDENTITY.entityId,
    locale: IDENTITY.locale,
    canonicalVersion: IDENTITY.canonicalVersion,
    contentRevision: IDENTITY.contentRevision,
    trigger: IDENTITY.trigger,
    status: "failed",
    attempts: 5,
    maxAttempts: 5,
    lastError:
      "PROVIDER_INTEGRITY:TERMINOLOGY_PROTECTION_VIOLATION;PROVIDER_RESPONSE_SHAPE=OBJECT",
    failureCode: "PROVIDER_INTEGRITY",
    failureStage: "provider",
    retryable: false,
    enqueuedAt: new Date(NOW).toISOString(),
    claimedAt: null,
    completedAt: new Date(NOW).toISOString(),
    updatedAt: new Date(NOW).toISOString(),
    lastFailureAt: new Date(NOW).toISOString(),
    nextAttemptAt: null,
    recoveryGeneration: "2",
    batchCheckpoint: checkpoint,
    ...patch,
  };
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
  setTerminologyGlossaryForceMemoryForTests(true);
  resetTerminologyGlossaryStoreForTests();
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
  resetTerminologyGlossaryStoreForTests();
  setTerminologyGlossaryForceMemoryForTests(false);
  resetLocalizationReconciliationDriverForTests();
});

describe("ES.09 terminology quality and provider-success durability", () => {
  it("publishes natural morphology and case differences as diagnostics", async () => {
    publishConcepts();
    const pluralSource =
      "Participants may suggest sources through civic initiatives or support channels.";
    const caseSource = "Initiative starts today.";
    const residualSource = "Initiative remains in the title.";

    const run = async (
      source: string,
      translated: string,
    ) => {
      resetMediaPlpMaterializerProviderCallBudget();
      const calls = { count: 0 };
      let persistedBeforeAssessment = false;
      const result = await callMediaPlpMaterializerProviderOnce({
        provider: fixedProvider({ [source]: translated }, calls),
        locale: "uk",
        autoValues: { line: source },
        sourceRecordId: "civic_media_editorial:sample-editorial",
        sourceVersion: "v1",
        terminologyContext: "none",
        yieldAfterAcceptedBatch: true,
        persistAcceptedBatchCheckpoint: async (checkpoint) => {
          assert.equal(checkpoint.nextBatchIndex, checkpoint.batchCount);
          persistedBeforeAssessment = true;
        },
        onTerminologyQualityAssessed: () => {
          assert.equal(persistedBeforeAssessment, true);
        },
      });
      assert.equal(calls.count, 1);
      assert.equal(result.ok, true);
      if (!result.ok) {
        return [];
      }
      return result.terminologyDiagnostics.map(
        (item) => `${item.conceptId}:${item.reason}`,
      );
    };

    const plural = await run(pluralSource, "Los participantes pueden sugerir fuentes.");
    assert.ok(plural.includes("participant:missing_preferred"));

    const foldedCase = await run(caseSource, "iniciativa empieza hoy.");
    assert.ok(foldedCase.includes("initiative:missing_preferred"));

    const residual = await run(residualSource, "Iniciativa remains with Initiative.");
    assert.ok(residual.includes("initiative:residual_canonical"));
  });

  it("uses one publication policy for content translation and PLP", () => {
    const assessment = assessRequiredTerminologyProtection({
      concepts: [
        {
          conceptId: "participant",
          canonicalEnglishTerm: "Participant",
          category: "domain",
          status: "published",
          translations: { uk: { preferredTerm: "Participante", aliases: [] } },
          createdAt: "2026-10-03T16:31:33.577Z",
          updatedAt: "2026-10-03T16:31:33.577Z",
          updatedByParticipantId: null,
        },
      ],
      targetLocale: "uk",
      sourceText: "Participants may suggest sources.",
      translatedText: "Los participantes pueden sugerir fuentes.",
    });
    const diagnostics = terminologyQualityDiagnosticsForPublication(assessment);
    assert.equal(assessment.ok, false);
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0]?.reason, "missing_preferred");

    const ct = readFileSync(
      path.join(HERE, "../../../src/modules/language/content-translation.service.ts"),
      "utf8",
    );
    const plp = readFileSync(
      path.join(
        HERE,
        "../../../src/modules/language/media-plp-materializer/provider-boundary.ts",
      ),
      "utf8",
    );
    assert.equal(ct.includes("terminologyQualityDiagnosticsForPublication"), true);
    assert.equal(plp.includes("terminologyQualityDiagnosticsForPublication"), true);
    assert.equal(ct.includes("TERMINOLOGY_PROTECTION_VIOLATION"), false);
    const persistAt = plp.indexOf("await input.persistAcceptedBatchCheckpoint(checkpoint)");
    const assessAt = plp.lastIndexOf("terminologyQualityDiagnosticsForPublication");
    assert.ok(persistAt > 0 && assessAt > persistAt);
  });

  it("keeps Brand, missing-key, and structural failures hard", async () => {
    const brandValues = { line: "Hello team" };
    let brandPersisted = 0;
    const brand = await callMediaPlpMaterializerProviderOnce({
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
            envelope: envelope(8),
          };
        },
      },
      locale: "uk",
      autoValues: brandValues,
      sourceRecordId: "civic_media_editorial:sample-editorial",
      sourceVersion: "v1",
      terminologyContext: "none",
      yieldAfterAcceptedBatch: true,
      persistAcceptedBatchCheckpoint: async () => {
        brandPersisted += 1;
      },
    });
    assert.equal(brand.ok, false);
    if (brand.ok) return;
    assert.equal(brand.reason, "BRAND_TOKEN_PRESERVATION_FAILED");
    assert.equal(brandPersisted, 0);

    resetMediaPlpMaterializerProviderCallBudget();
    let missingPersisted = 0;
    const missing = await callMediaPlpMaterializerProviderOnce({
      provider: {
        providerId: "deterministic",
        async translate() {
          return {
            providerId: "deterministic",
            isPlaceholder: false,
            translatedText: JSON.stringify({ translations: [] }),
            envelope: envelope(2),
          };
        },
      },
      locale: "uk",
      autoValues: { line: "Hello team" },
      sourceRecordId: "civic_media_editorial:sample-editorial",
      sourceVersion: "v1",
      terminologyContext: "none",
      yieldAfterAcceptedBatch: true,
      persistAcceptedBatchCheckpoint: async () => {
        missingPersisted += 1;
      },
    });
    assert.equal(missing.ok, false);
    if (missing.ok) return;
    assert.equal(missing.reason, "PARTIAL");
    assert.equal(missingPersisted, 0);

    resetMediaPlpMaterializerProviderCallBudget();
    let structuralPersisted = 0;
    const structural = await callMediaPlpMaterializerProviderOnce({
      provider: {
        providerId: "deterministic",
        async translate() {
          return {
            providerId: "deterministic",
            isPlaceholder: false,
            translatedText: "[]",
            envelope: envelope(2),
          };
        },
      },
      locale: "uk",
      autoValues: { line: "Hello team" },
      sourceRecordId: "civic_media_editorial:sample-editorial",
      sourceVersion: "v1",
      terminologyContext: "none",
      yieldAfterAcceptedBatch: true,
      persistAcceptedBatchCheckpoint: async () => {
        structuralPersisted += 1;
      },
    });
    assert.equal(structural.ok, false);
    if (structural.ok) return;
    assert.equal(structural.reason, "PARSE_FAILURE");
    assert.equal(structuralPersisted, 0);
  });

  it("keeps a locally rejected final batch durable and republishes a complete checkpoint with no provider", async () => {
    const autoValues = { line: "Hello team" };
    const batches = planned(autoValues);
    putPlpAutoBuildWorkForTests(
      failedRow(null, {
        status: "running",
        attempts: 4,
        retryable: null,
        failureCode: null,
        lastError: null,
        recoveryGeneration: "2",
      }),
    );
    let calls = 0;
    const rejected = await callMediaPlpMaterializerProviderOnce({
      provider: {
        providerId: "deterministic",
        async translate(request) {
          calls += 1;
          const parsed = JSON.parse(request.text) as {
            translations: Array<{ key: string; value: string }>;
          };
          return {
            providerId: "deterministic",
            isPlaceholder: false,
            translatedText: JSON.stringify({
              translations: parsed.translations.map((entry) => ({
                key: entry.key,
                value: entry.value,
              })),
            }),
            envelope: envelope(8),
          };
        },
      },
      locale: "uk",
      autoValues,
      sourceRecordId: "civic_media_editorial:sample-editorial",
      sourceVersion: "v1",
      terminologyContext: "none",
      yieldAfterAcceptedBatch: true,
      persistAcceptedBatchCheckpoint: async (checkpoint) => {
        await persistPlpProviderSuccessCheckpoint({
          workKey: plpBuildWorkKey(IDENTITY),
          checkpoint,
        });
      },
    });
    assert.equal(rejected.ok, false);
    if (rejected.ok) return;
    assert.equal(rejected.reason, "WRONG_TARGET_LANGUAGE");
    assert.equal(calls, 1);
    const stored = listPlpAutoBuildWorkForTests()[0];
    assert.ok(stored?.batchCheckpoint);
    assert.equal(stored?.batchCheckpoint?.nextBatchIndex, stored?.batchCheckpoint?.batchCount);
    assert.equal(stored?.attempts, 4);
    assert.equal(stored?.recoveryGeneration, "2");

    let permits = 0;
    const replay = await callMediaPlpMaterializerProviderOnce({
      provider: {
        providerId: "deterministic",
        async translate() {
          permits += 1;
          await tryAcquireLocalizationProviderPacingPermit({
            nowMs: NOW,
            intervalMs: 10_000,
          });
          throw new Error("provider must not run");
        },
      },
      locale: "uk",
      autoValues,
      sourceRecordId: "civic_media_editorial:sample-editorial",
      sourceVersion: "v1",
      terminologyContext: "none",
      yieldAfterAcceptedBatch: true,
      batchCheckpoint: stored?.batchCheckpoint,
    });
    assert.equal(permits, 0);
    assert.equal(replay.ok, false);
    if (replay.ok) return;
    assert.equal(replay.reason, "WRONG_TARGET_LANGUAGE");

    const complete = buildPlpBatchCheckpoint({
      sourceVersion: "v1",
      nextBatchIndex: batches.length,
      batches,
      segments: segmentsFor(batches, batches.length),
    });
    assert.ok(complete);
    assert.equal(complete?.nextBatchIndex, complete?.batchCount);
    let publishPermits = 0;
    const published = await callMediaPlpMaterializerProviderOnce({
      provider: {
        providerId: "deterministic",
        async translate() {
          publishPermits += 1;
          await tryAcquireLocalizationProviderPacingPermit({
            nowMs: NOW,
            intervalMs: 10_000,
          });
          throw new Error("provider must not run");
        },
      },
      locale: "uk",
      autoValues,
      sourceRecordId: "civic_media_editorial:sample-editorial",
      sourceVersion: "v1",
      terminologyContext: "none",
      yieldAfterAcceptedBatch: true,
      batchCheckpoint: complete,
    });
    assert.equal(publishPermits, 0);
    assert.equal(published.ok, true);
  });

  it("adopts only an obsolete terminology hard gate and preserves the checkpoint", async () => {
    const autoValues = fields(24);
    const batches = planned(autoValues);
    assert.equal(batches.length, 4);
    const checkpoint = buildPlpBatchCheckpoint({
      sourceVersion: "v1",
      nextBatchIndex: 3,
      batches,
      segments: segmentsFor(batches, 3),
    });
    assert.ok(checkpoint);
    putPlpAutoBuildWorkForTests(failedRow(checkpoint));
    const adopted = await upsertPendingPlpAutoBuildWork({
      ...IDENTITY,
      reopenFailedSameVersion: true,
      checkpointBatches: batches,
    });
    assert.equal(adopted.deduped, false);
    assert.equal(adopted.record.status, "pending");
    assert.equal(adopted.record.attempts, 4);
    assert.equal(adopted.record.recoveryGeneration, "2");
    assert.equal(adopted.record.batchCheckpoint?.nextBatchIndex, 3);
    assert.equal(
      Object.keys(adopted.record.batchCheckpoint?.segments ?? {}).length,
      Object.keys(checkpoint?.segments ?? {}).length,
    );

    const seen: string[][] = [];
    let persistedAt = 0;
    const continued = await callMediaPlpMaterializerProviderOnce({
      provider: echoProvider(seen),
      locale: "uk",
      autoValues,
      sourceRecordId: "civic_media_editorial:sample-editorial",
      sourceVersion: "v1",
      terminologyContext: "none",
      yieldAfterAcceptedBatch: true,
      batchCheckpoint: adopted.record.batchCheckpoint,
      persistAcceptedBatchCheckpoint: async (next) => {
        persistedAt += 1;
        assert.equal(next.nextBatchIndex, 4);
        assert.equal(next.batchCount, 4);
      },
      onTerminologyQualityAssessed: () => {
        assert.equal(persistedAt, 1);
      },
    });
    assert.equal(seen.length, 1);
    assert.equal(continued.ok, true);
    const firstKeys = new Set<string>();
    for (let index = 0; index < 3; index += 1) {
      for (const key of Object.keys(batches[index] ?? {})) firstKeys.add(key);
    }
    for (const key of seen[0] ?? []) {
      assert.equal(firstKeys.has(key), false);
    }

    const unrelated = failedRow(checkpoint, {
      lastError: "PROVIDER_INTEGRITY:CONTENT_INTEGRITY_FAILURE;PROVIDER_RESPONSE_SHAPE=OBJECT",
      workKey: plpBuildWorkKey({ ...IDENTITY, entityId: "other-integrity" }),
      entityId: "other-integrity",
    });
    putPlpAutoBuildWorkForTests(unrelated);
    const integrity = await upsertPendingPlpAutoBuildWork({
      ...IDENTITY,
      entityId: "other-integrity",
      reopenFailedSameVersion: true,
      checkpointBatches: batches,
    });
    assert.equal(integrity.deduped, true);
    assert.equal(integrity.record.status, "failed");
    assert.equal(integrity.record.attempts, 5);

    const brand = failedRow(checkpoint, {
      lastError:
        "PROVIDER_INTEGRITY:BRAND_TOKEN_PRESERVATION_FAILED;PROVIDER_RESPONSE_SHAPE=OBJECT",
      workKey: plpBuildWorkKey({ ...IDENTITY, entityId: "brand-row" }),
      entityId: "brand-row",
    });
    putPlpAutoBuildWorkForTests(brand);
    const brandReopen = await upsertPendingPlpAutoBuildWork({
      ...IDENTITY,
      entityId: "brand-row",
      reopenFailedSameVersion: true,
      checkpointBatches: batches,
    });
    assert.equal(brandReopen.deduped, true);
    assert.equal(brandReopen.record.status, "failed");

    const structural = failedRow(checkpoint, {
      failureCode: "PROVIDER_PARTIAL",
      retryable: false,
      lastError: "PROVIDER_PARTIAL:MISSING_PATH;PROVIDER_PARTIAL_SUBREASON=MISSING_PATH",
      workKey: plpBuildWorkKey({ ...IDENTITY, entityId: "structural-row" }),
      entityId: "structural-row",
    });
    putPlpAutoBuildWorkForTests(structural);
    const structuralReopen = await upsertPendingPlpAutoBuildWork({
      ...IDENTITY,
      entityId: "structural-row",
      reopenFailedSameVersion: true,
      checkpointBatches: batches,
    });
    assert.equal(structuralReopen.deduped, true);
    assert.equal(structuralReopen.record.status, "failed");
    assert.equal(isObsoleteTerminologyHardGateFailure({
      failureCode: "PROVIDER_PARTIAL",
      retryable: false,
      safeReason: structural.lastError,
    }), false);
  });

  it("does not adopt a checkpoint whose fingerprint does not match the plan", async () => {
    const batches = planned(fields(12));
    const checkpoint = buildPlpBatchCheckpoint({
      sourceVersion: "v1",
      nextBatchIndex: 1,
      batches,
      segments: segmentsFor(batches, 1),
    });
    assert.ok(checkpoint);
    putPlpAutoBuildWorkForTests(
      failedRow({ ...checkpoint, planFingerprint: "a".repeat(32) }),
    );
    const result = await upsertPendingPlpAutoBuildWork({
      ...IDENTITY,
      reopenFailedSameVersion: true,
      checkpointBatches: batches,
    });
    assert.equal(result.deduped, true);
    assert.equal(result.record.status, "failed");
    assert.equal(result.record.attempts, 5);
    assert.equal(result.record.recoveryGeneration, "2");
  });

  it("keeps genuine provider recovery bounded and pacing off the attempt budget", async () => {
    const batches = planned(fields(12));
    const checkpoint = buildPlpBatchCheckpoint({
      sourceVersion: "v1",
      nextBatchIndex: 1,
      batches,
      segments: segmentsFor(batches, 1),
    });
    putPlpAutoBuildWorkForTests(
      failedRow(checkpoint, {
        failureCode: "PROVIDER_FAILURE",
        retryable: true,
        lastError: "PROVIDER_FAILURE;PROVIDER_FAILURE_SUBTYPE=HTTP_FAILURE",
        recoveryGeneration: "2",
      }),
    );
    const capped = await upsertPendingPlpAutoBuildWork({
      ...IDENTITY,
      reopenFailedSameVersion: true,
      checkpointBatches: batches,
    });
    assert.equal(capped.deduped, true);
    assert.equal(capped.record.status, "failed");
    assert.equal(capped.record.attempts, 5);
    assert.equal(capped.record.recoveryGeneration, "2");
    assert.equal(PLP_MAX_RECOVERY_GENERATIONS, 2);

    let persisted = 0;
    const paced = await callMediaPlpMaterializerProviderOnce({
      provider: {
        providerId: "deterministic",
        async translate() {
          throw new LocalizationProviderPacingDeferredError("2026-10-04T23:20:00.000Z");
        },
      },
      locale: "uk",
      autoValues: { line: "Hello team" },
      sourceRecordId: "civic_media_editorial:sample-editorial",
      sourceVersion: "v1",
      terminologyContext: "none",
      yieldAfterAcceptedBatch: true,
      persistAcceptedBatchCheckpoint: async () => {
        persisted += 1;
      },
    });
    assert.equal(paced.ok, false);
    if (paced.ok) return;
    assert.equal(paced.reason, "PROVIDER_PACING_DEFERRED");
    assert.equal(persisted, 0);
  });

  it("does not retransmit completed batches", async () => {
    const autoValues = fields(24);
    const seen: string[][] = [];
    let checkpoint = null as ReturnType<typeof buildPlpBatchCheckpoint>;
    for (let step = 0; step < 4; step += 1) {
      const result = await callMediaPlpMaterializerProviderOnce({
        provider: echoProvider(seen),
        locale: "uk",
        autoValues,
        sourceRecordId: "civic_media_editorial:sample-editorial",
        sourceVersion: "v1",
        terminologyContext: "none",
        yieldAfterAcceptedBatch: true,
        batchCheckpoint: checkpoint,
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
        checkpoint = result.batchCheckpoint ?? null;
      } else {
        assert.equal(result.ok, true);
      }
    }
    assert.equal(seen.length, 4);
  });

  it("wakes readiness after publication and has no locale-specific terminology rule", () => {
    const queue = readFileSync(
      path.join(
        HERE,
        "../../../src/modules/language/published-localized-presentation/universal/build-request-queue.ts",
      ),
      "utf8",
    );
    const completed = queue.indexOf('outcome.status === "COMPLETED"');
    const wake = queue.indexOf("wakeReadinessAfterPlpPublish(work.locale)", completed);
    assert.ok(completed > 0 && wake > completed);

    const roots = [
      "terminology-protection-contract.ts",
      "content-translation.service.ts",
      "media-plp-materializer/provider-boundary.ts",
      "published-localized-presentation/universal/plp-auto-build-failure.ts",
      "published-localized-presentation/universal/plp-auto-build-work.repository.ts",
      "published-localized-presentation/universal/editorial-build-trigger.ts",
    ];
    for (const relative of roots) {
      const source = readFileSync(
        path.join(HERE, "../../../src/modules/language", relative),
        "utf8",
      );
      assert.equal(source.includes("participantes"), false);
      assert.equal(/locale\s*===?\s*["']es["']/.test(source), false);
      assert.equal(source.includes("zh-Hant"), false);
      assert.equal(source.includes("zh-hant"), false);
    }
  });
});
