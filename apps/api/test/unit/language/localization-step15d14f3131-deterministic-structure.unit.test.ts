/**
 * STEP F.3.13.1 — WEB_UI structure is reconstructed outside the provider.
 * Deterministic translator only. No Gemini.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/index.js";
import {
  runLocalizationProviderRequest,
  setLocalizationProviderClockForTests,
  setLocalizationProviderPacingIntervalMsForTests,
} from "../../../src/modules/language/localization-provider-governor.js";
import { isLanguageActivationWebUiReadyForHistoricalEnqueue } from "../../../src/modules/language/language-localization-activation/language-activation-job.domains.js";
import {
  processLanguageActivationJob,
  resetLanguageActivationJobSchedulerForTests,
  resetLanguageActivationJobStoreForTests,
  setLanguageActivationJobAdminAssertOverrideForTests,
  setLanguageActivationJobForceMemoryForTests,
  setLanguageActivationJobProcessDepsForTests,
  startOrResumeLanguageActivationJob,
} from "../../../src/modules/language/language-localization-activation/index.js";
import {
  resetThinGeminiProviderStateForTests,
  setThinGeminiProviderStateForceMemoryForTests,
} from "../../../src/modules/language/media-plp-materializer/thin-gemini-provider-state.js";
import { TranslationProviderError } from "../../../src/modules/language/translation.config.js";
import type { TranslationProviderRequest } from "../../../src/modules/language/translation-provider.js";
import {
  getWebUiActivationCheckpointByJobId,
  listWebUiActivationBatches,
  resetWebUiActivationCheckpointStoreForTests,
  setWebUiActivationCheckpointForceMemoryForTests,
  upsertWebUiActivationBatch,
  upsertWebUiActivationCheckpoint,
} from "../../../src/modules/web-ui-message-packs/web-ui-activation-checkpoint.repository.js";
import {
  assertStructureMatches,
  hashWebUiEnglishFlatMap,
  loadPublicWebUiEnglishCorpus,
  planWebUiDraftBatches,
  translateWebUiProviderBatch,
} from "../../../src/modules/web-ui-message-packs/web-ui-draft-builder.js";
import {
  reconstructWebUiMessageFromProviderSpans,
  segmentWebUiMessageForProvider,
  webUiProviderPayloadValue,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-structure-protect.js";
import {
  WEB_UI_PROVIDER_SHAPE_VERSION,
  WEB_UI_STRUCTURE_BLOCKED_REASON,
  WEB_UI_STRUCTURE_PACING_REASON,
} from "../../../src/modules/web-ui-message-packs/web-ui-provider-output-structure.js";
import {
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";

const LAST_N_DAYS = "Last {count} days";
const OVER_TIME =
  "{actions} civic actions across {days} active civic days in the last {window} days.";
const BATCH_52_KEYS = [
  "civicActivity.backToHome",
  "civicActivity.charts.activeCivicDays",
  "civicActivity.charts.civicActions",
  "civicActivity.charts.hideDetails",
  "civicActivity.charts.lastNDays",
  "civicActivity.charts.overTimeAria",
] as const;
const SOURCE_HASH = "0a980a20425d5e06cf3e2810feff59f940b716b7aae31effdc8b8226764f5fb1";
const BATCH_52_ID = "46cecf57798fcf0a";

function payloadText(value: string | readonly string[]): string {
  return JSON.stringify(value);
}

describe("F.3.13.1 deterministic WEB_UI structure", () => {
  it("1–13 spans, reconstruction, validation, and batch 52 payload", async () => {
    const plain = webUiProviderPayloadValue("Back to Home");
    assert.equal(plain, "Back to Home");
    assert.equal(reconstructWebUiMessageFromProviderSpans("Back to Home", "回首頁"), "回首頁");

    const one = webUiProviderPayloadValue(LAST_N_DAYS);
    assert.deepEqual(one, ["Last ", " days"]);
    assert.equal(payloadText(one).includes("{count}"), false);
    assert.equal(payloadText(one).includes("⟦w"), false);
    assert.equal(
      reconstructWebUiMessageFromProviderSpans(LAST_N_DAYS, ["最近 ", " 天"]),
      "最近 {count} 天",
    );

    const many = webUiProviderPayloadValue(OVER_TIME);
    assert.ok(Array.isArray(many));
    assert.equal(payloadText(many).includes("{actions}"), false);
    assert.equal(payloadText(many).includes("{days}"), false);
    assert.equal(payloadText(many).includes("{window}"), false);
    assert.equal(payloadText(many).includes("⟦w"), false);
    const restored = reconstructWebUiMessageFromProviderSpans(OVER_TIME, [
      " 次公民行動，跨越 ",
      " 個活躍公民日，在最近 ",
      " 天。",
    ]);
    assert.match(restored, /\{actions\}/);
    assert.match(restored, /\{days\}/);
    assert.match(restored, /\{window\}/);
    assert.equal(restored.indexOf("{actions}"), 0);

    const renamed = reconstructWebUiMessageFromProviderSpans(LAST_N_DAYS, ["Last {total} ", " days"]);
    assert.match(renamed, /\{count\}/);
    assert.throws(
      () => assertStructureMatches(LAST_N_DAYS, renamed),
      /Placeholders do not match English\./,
    );

    const omitted = reconstructWebUiMessageFromProviderSpans(LAST_N_DAYS, ["Last ", " days"]);
    assert.match(omitted, /\{count\}/);
    assert.doesNotThrow(() => assertStructureMatches(LAST_N_DAYS, omitted));

    const duplicated = reconstructWebUiMessageFromProviderSpans(LAST_N_DAYS, [
      "Last {count} ",
      " days",
    ]);
    assert.throws(
      () => assertStructureMatches(LAST_N_DAYS, duplicated),
      /Placeholders do not match English\./,
    );

    const swappedWords = reconstructWebUiMessageFromProviderSpans(LAST_N_DAYS, [" days", "Last "]);
    assert.equal(swappedWords, " days{count}Last ");
    assert.doesNotThrow(() => assertStructureMatches(LAST_N_DAYS, swappedWords));

    const richEnglish = "<link>Sign in</link> to post a comment.";
    const richPayload = webUiProviderPayloadValue(richEnglish);
    assert.equal(payloadText(richPayload).includes("<link>"), false);
    assert.equal(payloadText(richPayload).includes("⟦w"), false);
    const rich = reconstructWebUiMessageFromProviderSpans(richEnglish, ["登入", " 以發表評論。"]);
    assert.match(rich, /<link>/);
    assert.match(rich, /<\/link>/);
    assert.doesNotThrow(() => assertStructureMatches(richEnglish, rich));

    const brandEnglish = "Questions about {siteName}?";
    const brandPayload = webUiProviderPayloadValue(brandEnglish);
    assert.equal(payloadText(brandPayload).includes("{siteName}"), false);
    assert.equal(payloadText(brandPayload).includes("__HU_BRAND_SITE_NAME__"), false);
    assert.equal(payloadText(brandPayload).includes("⟦w"), false);
    const brand = reconstructWebUiMessageFromProviderSpans(brandEnglish, ["關於 ", " 的問題？"]);
    assert.match(brand, /\{siteName\}/);
    assert.doesNotThrow(() => assertStructureMatches(brandEnglish, brand));

    const corpus = loadPublicWebUiEnglishCorpus();
    assert.equal(hashWebUiEnglishFlatMap(corpus.flat), SOURCE_HASH);
    const plans = planWebUiDraftBatches(corpus.flat);
    assert.equal(plans[52]?.id, BATCH_52_ID);
    assert.deepEqual(plans[52]?.keys, [...BATCH_52_KEYS]);

    let providerCalls = 0;
    let requestText = "";
    const translated = await translateWebUiProviderBatch({
      locale: "eo",
      englishFlat: Object.fromEntries(BATCH_52_KEYS.map((key) => [key, corpus.flat[key] ?? ""])),
      keys: BATCH_52_KEYS,
      terminologyContext: "Glossary:",
      translator: async (request) => {
        providerCalls += 1;
        requestText = request.text;
        const parsed = JSON.parse(request.text) as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(parsed)) {
          if (Array.isArray(value)) {
            out[key] = value.map((span) => `「${String(span)}」`);
          } else {
            out[key] = `「${String(value)}」`;
          }
        }
        return {
          translatedText: JSON.stringify(out),
          providerId: "deterministic",
          isPlaceholder: false,
        };
      },
    });
    assert.equal(providerCalls, 1);
    assert.equal(requestText.includes("⟦w"), false);
    assert.equal(requestText.includes("{count}"), false);
    assert.equal(requestText.includes("{actions}"), false);
    assert.equal(requestText.includes("{days}"), false);
    assert.equal(requestText.includes("{window}"), false);
    assert.match(translated.values["civicActivity.charts.lastNDays"] ?? "", /\{count\}/);
    assert.match(translated.values["civicActivity.charts.overTimeAria"] ?? "", /\{actions\}/);
    assert.match(translated.values["civicActivity.charts.overTimeAria"] ?? "", /\{days\}/);
    assert.match(translated.values["civicActivity.charts.overTimeAria"] ?? "", /\{window\}/);
    assert.equal(translated.values["civicActivity.backToHome"], "「Back to Home」");

    await assert.rejects(
      () =>
        translateWebUiProviderBatch({
          locale: "eo",
          englishFlat: { "civicActivity.charts.lastNDays": LAST_N_DAYS },
          keys: ["civicActivity.charts.lastNDays"],
          terminologyContext: "",
          translator: async () => ({
            translatedText: JSON.stringify({
              "civicActivity.charts.lastNDays": ["Last {total} ", " days"],
            }),
            providerId: "deterministic",
            isPlaceholder: false,
          }),
        }),
      /Placeholders do not match English\./,
    );

    const onePlan = segmentWebUiMessageForProvider(LAST_N_DAYS);
    const otherPlan = segmentWebUiMessageForProvider(OVER_TIME);
    assert.equal(onePlan.slots[0], "{count}");
    assert.equal(otherPlan.slots[0], "{actions}");
    assert.notEqual(onePlan.slots[0], otherPlan.slots[0]);
  });
});

describe("F.3.13.1 activation checkpoint and bounds", () => {
  let nowMs = Date.now();

  beforeEach(async () => {
    nowMs = Date.now();
    setLocalizationProviderClockForTests(() => nowMs);
    setLocalizationProviderPacingIntervalMsForTests(0);
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
      participantId: "participant-admin-f3131",
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

  function install(input: {
    readonly includePaths: readonly string[];
    readonly translator: (request: TranslationProviderRequest) => Promise<{
      readonly translatedText: string;
      readonly providerId: "deterministic";
      readonly isPlaceholder: false;
    }>;
  }) {
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: async () => {
        throw new Error("CT/PLP activate must not run before WEB_UI is ready.");
      },
      webUiPreparationDeps: {
        includePaths: input.includePaths,
        now: () => new Date(nowMs).toISOString(),
        loadLiveTerminology: async () => "",
        translator: input.translator,
      },
    });
  }

  function echoSpans(request: TranslationProviderRequest, corrupt: boolean) {
    const parsed = JSON.parse(request.text) as Record<string, unknown>;
    const translated: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (Array.isArray(value)) {
        const spans = value.map((span) => String(span));
        if (corrupt) {
          const index = spans.findIndex((span) => span.length > 0);
          if (index >= 0) spans[index] = `${spans[index]} {renamed}`;
        }
        translated[key] = spans;
      } else {
        translated[key] = corrupt ? `${String(value)} {renamed}` : `「${String(value)}」`;
      }
    }
    return {
      translatedText: JSON.stringify(translated),
      providerId: "deterministic" as const,
      isPlaceholder: false as const,
    };
  }

  it("16–18 old structure_retry advances once, then the same shape blocks", async () => {
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
    let calls = 0;
    install({
      includePaths: BATCH_52_KEYS,
      translator: async (request) => {
        calls += 1;
        return echoSpans(request, true);
      },
    });

    let job = await processLanguageActivationJob(started.job.jobId, { webUiTick: true });
    assert.equal(calls, 2);
    assert.equal(job.domains.webUi.preparationPhase, "structure_retry");
    assert.equal(job.domains.webUi.completedBatches, 0);
    resetLanguageActivationJobSchedulerForTests();
    const created = await getWebUiActivationCheckpointByJobId(started.job.jobId);
    assert.ok(created);
    await upsertWebUiActivationBatch({
      checkpointId: created!.checkpointId,
      batchId: "preserved-completed",
      phase: "primary",
      namespace: "common",
      keys: ["common.save"],
      values: { "common.save": "保存" },
      status: "ok",
      attempts: 1,
      reason: null,
      updatedAt: new Date(nowMs).toISOString(),
    });
    await upsertWebUiActivationCheckpoint({
      ...created!,
      phase: "structure_retry",
      completedBatchCount: 0,
      structureRetryCount: 40,
      providerShapeVersion: null,
      providerShapeFailureCount: null,
      nextAttemptAt: new Date(nowMs - 1_000).toISOString(),
      detail: "Automatic retry scheduled. No operator action required.",
    });
    const beforeRetry = await getWebUiActivationCheckpointByJobId(started.job.jobId);
    assert.equal(beforeRetry?.structureRetryCount, 40);
    assert.equal(beforeRetry?.providerShapeVersion ?? null, null);

    job = await processLanguageActivationJob(started.job.jobId, { webUiTick: true });
    assert.equal(calls, 4);
    assert.equal(job.status, "running");
    assert.equal(job.domains.webUi.providerFailure, false);
    assert.equal(job.domains.webUi.preparationPhase, "structure_retry");
    assert.equal(job.domains.webUi.completedBatches, 0);
    const mid = await getWebUiActivationCheckpointByJobId(started.job.jobId);
    assert.equal(mid?.providerShapeVersion, WEB_UI_PROVIDER_SHAPE_VERSION);
    assert.equal(mid?.providerShapeFailureCount, 2);
    assert.equal(mid?.structureRetryCount, 41);
    const stillOk = await listWebUiActivationBatches(mid!.checkpointId, "primary");
    assert.equal(stillOk.find((row) => row.batchId === "preserved-completed")?.status, "ok");

    let guard = 0;
    while (job.domains.webUi.preparationPhase !== "structure_blocked" && guard < 4) {
      guard += 1;
      const waiting = await getWebUiActivationCheckpointByJobId(started.job.jobId);
      resetLanguageActivationJobSchedulerForTests();
      nowMs = Date.parse(waiting?.nextAttemptAt ?? "") + 1_000;
      job = await processLanguageActivationJob(started.job.jobId, { webUiTick: true });
    }
    assert.equal(calls, 8);
    assert.equal(job.status, "running");
    assert.equal(job.domains.webUi.providerFailure, false);
    assert.equal(job.domains.webUi.preparationPhase, "structure_blocked");
    assert.equal(job.domains.webUi.nextAttemptAt ?? null, null);
    assert.match(job.domains.webUi.detail ?? "", /structural defect/);
    assert.doesNotMatch(job.domains.webUi.detail ?? "", /rate limit/i);
    const blocked = await getWebUiActivationCheckpointByJobId(started.job.jobId);
    assert.equal(blocked?.phase, "structure_blocked");
    assert.equal(blocked?.nextAttemptAt ?? null, null);
    assert.equal(blocked?.providerShapeFailureCount, 6);
    assert.equal(blocked?.structureRetryCount, 43);
    const pending = await listWebUiActivationBatches(blocked!.checkpointId, "primary");
    assert.equal(pending.find((row) => row.batchId === "preserved-completed")?.status, "ok");
    assert.equal(
      pending.find((row) => row.reason === WEB_UI_STRUCTURE_BLOCKED_REASON)?.status,
      "pending",
    );

    const callsAtBlock = calls;
    job = await processLanguageActivationJob(started.job.jobId, { webUiTick: true });
    assert.equal(calls, callsAtBlock);
    assert.equal(job.domains.webUi.preparationPhase, "structure_blocked");
    assert.equal(
      isLanguageActivationWebUiReadyForHistoricalEnqueue({
        webUi: job.domains.webUi,
        publicWebUiDataReady: false,
        participantWebUiDataReady: false,
      }),
      false,
    );
  });

  it("19 pacing wait does not consume the structure-failure counter", async () => {
    setLocalizationProviderPacingIntervalMsForTests(10_000);
    const record = await createLanguageRegistryRecord({
      locale: "ia",
      englishName: "Interlingua",
      nativeName: "Interlingua",
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
    let calls = 0;
    install({
      includePaths: ["civicActivity.charts.lastNDays"],
      translator: (request) =>
        runLocalizationProviderRequest(async () => {
          calls += 1;
          return echoSpans(request, true);
        }),
    });
    const job = await processLanguageActivationJob(started.job.jobId, { webUiTick: true });
    assert.equal(calls, 1);
    assert.equal(job.domains.webUi.preparationPhase, "primary");
    assert.equal(job.domains.webUi.providerFailure, false);
    const checkpoint = await getWebUiActivationCheckpointByJobId(started.job.jobId);
    assert.equal(checkpoint?.providerShapeFailureCount ?? 0, 0);
    assert.equal(checkpoint?.structureRetryCount ?? 0, 0);
    assert.notEqual(checkpoint?.phase, "structure_blocked");
    const batches = await listWebUiActivationBatches(checkpoint!.checkpointId, "primary");
    assert.equal(batches.some((row) => row.reason === WEB_UI_STRUCTURE_PACING_REASON), true);
  });

  it("20 transient cooldown stays on Gate E", async () => {
    const record = await createLanguageRegistryRecord({
      locale: "ie",
      englishName: "Interlingue",
      nativeName: "Interlingue",
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
    install({
      includePaths: ["common.save"],
      translator: async () => {
        throw new TranslationProviderError("rate_limited", "HTTP 429");
      },
    });
    const job = await processLanguageActivationJob(started.job.jobId, { webUiTick: true });
    assert.equal(job.domains.webUi.preparationPhase, "provider_cooldown");
    assert.equal(job.domains.webUi.providerFailure, false);
    assert.equal(job.domains.webUi.lastTransientFailure, "rate_limited");
    const checkpoint = await getWebUiActivationCheckpointByJobId(started.job.jobId);
    assert.equal(checkpoint?.phase, "provider_cooldown");
    assert.equal(checkpoint?.providerShapeFailureCount ?? 0, 0);
    assert.equal(checkpoint?.structureRetryCount ?? 0, 0);
  });
});
