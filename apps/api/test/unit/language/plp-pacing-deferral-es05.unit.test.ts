/**
 * ES.05 — pacing deferral is a durable wait, not an unknown provider shape.
 * No live provider calls.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  emptyLanguageLocalizationCountBucket,
  MEDIA_PLP_ENTITY_TYPE,
  type LanguageLocalizationReadinessReport,
} from "@hu/types";

import {
  CIVIC_MEDIA_FAQ,
  CIVIC_MEDIA_OVERVIEW,
} from "../../../src/modules/civic-media-center/content/sections.js";
import {
  setLocalizationProviderClockForTests,
  setLocalizationProviderPacingIntervalMsForTests,
} from "../../../src/modules/language/localization-provider-governor.js";
import {
  ACTIVATION_AUTOMATIC_EXHAUSTED_DETAIL,
  classifyActivationAutomaticProgress,
  deriveActivationJobStatus,
  emptyPendingDomains,
} from "../../../src/modules/language/language-localization-activation/language-activation-job.domains.js";
import {
  callMediaPlpMaterializerProviderOnce,
  resetMediaPlpMaterializerCountersForTests,
  resetMediaPlpMaterializerProviderCallBudget,
  resetThinGeminiGovernorForTests,
  resetThinGeminiProviderStateForTests,
  setThinGeminiProviderStateForceMemoryForTests,
  ThinGeminiMediaPlpTransport,
} from "../../../src/modules/language/media-plp-materializer/index.js";
import { tryAcquireLocalizationProviderPacingPermit } from "../../../src/modules/language/media-plp-materializer/thin-gemini-provider-state.js";
import { resolveTranslationConfig } from "../../../src/modules/language/translation.config.js";
import {
  asMediaPlpPresentationNode,
  buildCanonicalEditorialPresentation,
  collectAutoPaths,
  isCollectedPathMachineEligible,
  resolveFieldPolicyForEntityType,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import { mapProviderBoundaryReasonToFailure } from "../../../src/modules/language/published-localized-presentation/universal/plp-auto-build-failure.js";
import {
  claimNextPlpAutoBuildWork,
  listPlpAutoBuildWorkForTests,
  markPlpAutoBuildWorkFailed,
  PLP_MAX_RECOVERY_GENERATIONS,
  putPlpAutoBuildWorkForTests,
  resetPlpAutoBuildWorkStoreForTests,
  setPlpAutoBuildNowMsForTests,
  setPlpAutoBuildWorkForceMemoryForTests,
  upsertPendingPlpAutoBuildWork,
  type PlpAutoBuildWorkRecord,
} from "../../../src/modules/language/published-localized-presentation/universal/plp-auto-build-work.repository.js";

const NOW = Date.parse("2026-10-04T05:45:00.000Z");

const IDENTITY = {
  entityType: "civic_media_editorial",
  entityId: "sample-editorial",
  locale: "uk",
  canonicalVersion: "v1",
  contentRevision: 1,
  trigger: "ADMIN_REBUILD" as const,
  maxAttempts: 5,
};

const LEGACY_MISLABEL =
  "PROVIDER_FAILURE;PROVIDER_RESPONSE_SHAPE=INVALID;PROVIDER_FAILURE_SUBTYPE=UNKNOWN_PROVIDER_SHAPE;PROVIDER_FINISH_REASON=STOP;PROVIDER_CANDIDATE_COUNT=1;PROVIDER_TEXT_PART_COUNT=1;PROVIDER_EXTRACTED_LENGTH=896;PROVIDER_EXPECTED_KEY_COUNT=18;PROVIDER_RETURNED_KEY_COUNT=6;PROVIDER_MISSING_KEY_COUNT=12;PROVIDER_BATCH_INDEX=0;PROVIDER_BATCH_COUNT=4";

const BARE_UNKNOWN =
  "PROVIDER_FAILURE;PROVIDER_RESPONSE_SHAPE=INVALID;PROVIDER_FAILURE_SUBTYPE=UNKNOWN_PROVIDER_SHAPE";

function editorialAutoValues(): Record<string, string> {
  const tree = asMediaPlpPresentationNode(
    buildCanonicalEditorialPresentation({
      overview: CIVIC_MEDIA_OVERVIEW,
      faq: [...CIVIC_MEDIA_FAQ],
    }),
  );
  const policy = resolveFieldPolicyForEntityType(
    MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
  );
  const values: Record<string, string> = {};
  for (const node of collectAutoPaths(tree)) {
    if (isCollectedPathMachineEligible(node.path, policy)) {
      values[node.path] = node.value;
    }
  }
  return values;
}

function geminiConfig() {
  return {
    ...resolveTranslationConfig(),
    provider: "gemini" as const,
    geminiApiKey: "test-key-not-real",
    geminiModel: "gemini-2.0-flash",
    timeoutMs: 5_000,
  };
}

function geminiStop(text: string): Response {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          finishReason: "STOP",
          content: { parts: [{ text }] },
        },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function row(): PlpAutoBuildWorkRecord {
  const found = listPlpAutoBuildWorkForTests().find(
    (entry) => entry.entityId === IDENTITY.entityId && entry.locale === IDENTITY.locale,
  );
  assert.ok(found);
  return found;
}

function ownersReady() {
  const domains = emptyPendingDomains();
  return {
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
}

function readiness(plpWorkItems: number, state: LanguageLocalizationReadinessReport["state"]) {
  return {
    engineReady: true,
    languageDataReady: state === "READY",
    state,
    ct: emptyLanguageLocalizationCountBucket(),
    plpMedia: {
      ...emptyLanguageLocalizationCountBucket(),
      missing: plpWorkItems > 0 ? plpWorkItems : 0,
      workItemsRequired: plpWorkItems,
    },
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
});

afterEach(() => {
  delete process.env.HU_PLP_THIN_GEMINI_MIN_SPACING_MS;
  setLocalizationProviderClockForTests(null);
  setLocalizationProviderPacingIntervalMsForTests(null);
  resetThinGeminiProviderStateForTests();
  setThinGeminiProviderStateForceMemoryForTests(false);
  resetThinGeminiGovernorForTests({ clearStartupGuard: true });
  resetMediaPlpMaterializerCountersForTests();
  resetPlpAutoBuildWorkStoreForTests();
  setPlpAutoBuildWorkForceMemoryForTests(false);
  setPlpAutoBuildNowMsForTests(null);
});

describe("ES.05 pacing deferral", () => {
  it("1-2. later-batch pacing deferral is a durable wait, not UNKNOWN_PROVIDER_SHAPE", async () => {
    setLocalizationProviderPacingIntervalMsForTests(60_000);
    const autoValues = editorialAutoValues();
    let httpCalls = 0;
    const transport = new ThinGeminiMediaPlpTransport(geminiConfig(), async (_url, init) => {
      httpCalls += 1;
      const body = JSON.parse(String(init?.body ?? "{}")) as {
        contents?: Array<{ parts?: Array<{ text?: string }> }>;
      };
      const requestText = body.contents?.[0]?.parts?.[0]?.text ?? "";
      const parsed = JSON.parse(requestText) as {
        translations: Array<{ key: string; value: string }>;
      };
      return geminiStop(
        JSON.stringify({
          translations: parsed.translations.map((entry) => ({
            key: entry.key,
            value: `ok ${entry.value}`,
          })),
        }),
      );
    });

    const result = await callMediaPlpMaterializerProviderOnce({
      provider: transport,
      locale: "uk",
      autoValues,
      sourceRecordId: "civic_media_editorial:sample-editorial",
      sourceVersion: "v-test",
      PROVIDER_TRANSPORT: "thin_gemini",
    });

    assert.equal(httpCalls, 1);
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "PROVIDER_PACING_DEFERRED");
    assert.match(result.message, /^PROVIDER_PACING_WAIT;PACING_UNTIL=/);
    assert.doesNotMatch(result.message, /UNKNOWN_PROVIDER_SHAPE/);
    assert.doesNotMatch(result.message, /PROVIDER_RESPONSE_SHAPE=INVALID/);
    const failure = mapProviderBoundaryReasonToFailure({
      reason: result.reason,
      message: result.message,
    });
    assert.equal(failure.pacingDefer, true);
    assert.ok(failure.pacingUntil);
    setLocalizationProviderPacingIntervalMsForTests(null);
    resetThinGeminiProviderStateForTests();

    await upsertPendingPlpAutoBuildWork(IDENTITY);
    const claimed = await claimNextPlpAutoBuildWork();
    assert.ok(claimed);
    await markPlpAutoBuildWorkFailed({
      workKey: claimed.workKey,
      attempts: claimed.attempts,
      maxAttempts: claimed.maxAttempts,
      failure,
    });
    const waiting = row();
    assert.equal(waiting.status, "pending");
    assert.equal(waiting.lastError, "PROVIDER_PACING_WAIT");
    assert.equal(waiting.attempts, 0);
    assert.equal(waiting.recoveryGeneration, null);
    assert.equal(waiting.nextAttemptAt, failure.pacingUntil);
  });

  it("3-6. pacing does not burn attempts or recovery, and waits for eligibility", async () => {
    await upsertPendingPlpAutoBuildWork(IDENTITY);
    putPlpAutoBuildWorkForTests({
      ...row(),
      attempts: 2,
      recoveryGeneration: "1",
    });
    for (let cycle = 0; cycle < 4; cycle += 1) {
      const due = NOW + cycle * 60_000;
      setPlpAutoBuildNowMsForTests(due);
      const claimed = await claimNextPlpAutoBuildWork();
      assert.ok(claimed, `claim ${cycle}`);
      const before = claimed.attempts;
      const until = new Date(due + 60_000).toISOString();
      await markPlpAutoBuildWorkFailed({
        workKey: claimed.workKey,
        attempts: claimed.attempts,
        maxAttempts: claimed.maxAttempts,
        failure: {
          failureCode: "PROVIDER_FAILURE",
          retryable: true,
          stage: "provider",
          safeReason: "PROVIDER_PACING_WAIT",
          pacingDefer: true,
          pacingUntil: until,
        },
      });
      const waiting = row();
      assert.equal(waiting.status, "pending");
      assert.equal(waiting.attempts, before - 1);
      assert.equal(waiting.recoveryGeneration, "1");
      assert.equal(waiting.nextAttemptAt, until);
      assert.equal(await claimNextPlpAutoBuildWork(), null);
      assert.ok(waiting.attempts < waiting.maxAttempts);
    }
    setPlpAutoBuildNowMsForTests(NOW + 4 * 60_000 + 1);
    const continued = await claimNextPlpAutoBuildWork();
    assert.ok(continued);
    assert.equal(continued.status, "running");
  });

  it("5. governor eligibility blocks the provider call", async () => {
    setLocalizationProviderPacingIntervalMsForTests(60_000);
    await tryAcquireLocalizationProviderPacingPermit({
      nowMs: NOW,
      intervalMs: 60_000,
    });
    let httpCalls = 0;
    const transport = new ThinGeminiMediaPlpTransport(geminiConfig(), async () => {
      httpCalls += 1;
      return geminiStop('{"translations":[]}');
    });
    const blocked = await callMediaPlpMaterializerProviderOnce({
      provider: transport,
      locale: "uk",
      autoValues: { overviewTitle: "Title" },
      sourceRecordId: "civic_media_editorial:sample-editorial",
      sourceVersion: "v-test",
      PROVIDER_TRANSPORT: "thin_gemini",
    });
    assert.equal(httpCalls, 0);
    assert.equal(blocked.ok, false);
    if (blocked.ok) return;
    assert.equal(blocked.reason, "PROVIDER_PACING_DEFERRED");

    setLocalizationProviderClockForTests(() => NOW + 60_001);
    resetMediaPlpMaterializerCountersForTests();
    resetMediaPlpMaterializerProviderCallBudget();
    const open = await callMediaPlpMaterializerProviderOnce({
      provider: transport,
      locale: "uk",
      autoValues: { overviewTitle: "Title" },
      sourceRecordId: "civic_media_editorial:sample-editorial",
      sourceVersion: "v-test",
      PROVIDER_TRANSPORT: "thin_gemini",
    });
    assert.equal(httpCalls, 1);
    assert.equal(open.ok, false);
  });

  it("7-8. a real unknown-shape failure still uses the ES.03 cap", async () => {
    await upsertPendingPlpAutoBuildWork(IDENTITY);
    const claimed = await claimNextPlpAutoBuildWork();
    assert.ok(claimed);
    putPlpAutoBuildWorkForTests({ ...row(), attempts: 4, status: "pending" });
    const last = await claimNextPlpAutoBuildWork();
    assert.equal(last?.attempts, 5);
    await markPlpAutoBuildWorkFailed({
      workKey: last!.workKey,
      attempts: 5,
      maxAttempts: 5,
      failure: {
        failureCode: "PROVIDER_FAILURE",
        retryable: true,
        stage: "provider",
        safeReason: BARE_UNKNOWN,
      },
    });
    const cooled = row();
    assert.equal(cooled.status, "pending");
    assert.equal(cooled.recoveryGeneration, "0");
    assert.equal(cooled.attempts, 5);
    assert.ok(cooled.nextAttemptAt);

    putPlpAutoBuildWorkForTests({
      ...cooled,
      status: "failed",
      recoveryGeneration: "2",
      nextAttemptAt: null,
      attempts: 5,
      lastError: BARE_UNKNOWN,
      failureCode: "PROVIDER_FAILURE",
      retryable: true,
    });
    const reopened = await upsertPendingPlpAutoBuildWork({
      ...IDENTITY,
      reopenFailedSameVersion: true,
    });
    assert.equal(reopened.deduped, true);
    assert.equal(reopened.record.status, "failed");
    assert.equal(reopened.record.recoveryGeneration, "2");
    assert.equal(PLP_MAX_RECOVERY_GENERATIONS, 2);
  });

  it("9-10. only the legacy pacing mislabel is adopted", async () => {
    await upsertPendingPlpAutoBuildWork(IDENTITY);
    const base = row();
    putPlpAutoBuildWorkForTests({
      ...base,
      status: "failed",
      attempts: 5,
      recoveryGeneration: "2",
      nextAttemptAt: null,
      retryable: true,
      failureCode: "PROVIDER_FAILURE",
      failureStage: "provider",
      lastError: LEGACY_MISLABEL,
    });
    const bare = await upsertPendingPlpAutoBuildWork({
      ...IDENTITY,
      reopenFailedSameVersion: false,
    });
    assert.equal(bare.deduped, true);
    assert.equal(bare.record.status, "failed");

    const adopted = await upsertPendingPlpAutoBuildWork({
      ...IDENTITY,
      reopenFailedSameVersion: true,
    });
    assert.equal(adopted.deduped, false);
    assert.equal(adopted.record.status, "pending");
    assert.equal(adopted.record.attempts, 4);
    assert.equal(adopted.record.recoveryGeneration, "2");
    assert.ok(adopted.record.nextAttemptAt);

    putPlpAutoBuildWorkForTests({
      ...adopted.record,
      status: "failed",
      attempts: 5,
      nextAttemptAt: null,
      lastError: BARE_UNKNOWN,
    });
    const kept = await upsertPendingPlpAutoBuildWork({
      ...IDENTITY,
      reopenFailedSameVersion: true,
    });
    assert.equal(kept.deduped, true);
    assert.equal(kept.record.status, "failed");
    assert.equal(kept.record.attempts, 5);
  });

  it("11-13. activation stays running while work can progress and fails only when it cannot", () => {
    const domains = ownersReady();
    const open = readiness(1, "BACKFILL_REQUIRED");
    const waiting = classifyActivationAutomaticProgress({
      readiness: open,
      plpWork: [
        {
          status: "pending",
          attempts: 0,
          maxAttempts: 5,
          retryable: true,
          recoveryGeneration: "1",
          nextAttemptAt: new Date(NOW + 60_000).toISOString(),
          failureCode: "PROVIDER_FAILURE",
          lastError: "PROVIDER_PACING_WAIT",
          entityType: "civic_media_editorial",
        },
      ],
    });
    assert.equal(waiting, "progress");
    assert.equal(
      deriveActivationJobStatus({
        readiness: open,
        domains,
        ctEnqueueAttempted: true,
        plpEnqueueAttempted: true,
        automaticProgress: waiting,
      }),
      "running",
    );

    const exhausted = classifyActivationAutomaticProgress({
      readiness: open,
      plpWork: [
        {
          status: "failed",
          attempts: 5,
          maxAttempts: 5,
          retryable: true,
          recoveryGeneration: "2",
          nextAttemptAt: null,
          failureCode: "PROVIDER_FAILURE",
          lastError: BARE_UNKNOWN,
          entityType: "civic_media_editorial",
        },
      ],
    });
    assert.equal(exhausted, "exhausted");
    assert.equal(
      deriveActivationJobStatus({
        readiness: open,
        domains,
        ctEnqueueAttempted: true,
        plpEnqueueAttempted: true,
        automaticProgress: exhausted,
      }),
      "failed",
    );
    assert.equal(
      ACTIVATION_AUTOMATIC_EXHAUSTED_DETAIL,
      "Automatic localization cannot progress.",
    );

    const ready = readiness(0, "READY");
    assert.equal(
      deriveActivationJobStatus({
        readiness: { ...ready, languageDataReady: true },
        domains,
        ctEnqueueAttempted: true,
        plpEnqueueAttempted: true,
        automaticProgress: "exhausted",
      }),
      "completed",
    );
  });

  it("an unclassified throw after a successful batch still records the old shape signature", async () => {
    let calls = 0;
    const transport = {
      providerId: "deterministic" as const,
      setMaxRequestsForBatching() {},
      async translate(request: { text: string }) {
        calls += 1;
        const parsed = JSON.parse(request.text) as {
          translations: Array<{ key: string; value: string }>;
        };
        const translatedText = JSON.stringify({
          translations: parsed.translations.map((entry) => ({
            key: entry.key,
            value: `ok ${entry.value}`,
          })),
        });
        if (calls > 1) {
          throw new Error("unclassified provider throw");
        }
        return {
          translatedText,
          providerId: "deterministic" as const,
          isPlaceholder: false,
          envelope: {
            httpStatus: 200,
            finishReason: "STOP",
            candidateCount: 1,
            textPartCount: 1,
            extractedLength: translatedText.length,
            failureSubtype: null,
            errorClass: null,
            errorCode: null,
            retryAfterSeconds: null,
            geminiErrorStatus: null,
            geminiErrorReason: null,
          },
        };
      },
    };
    const result = await callMediaPlpMaterializerProviderOnce({
      provider: transport,
      locale: "uk",
      autoValues: editorialAutoValues(),
      sourceRecordId: "civic_media_editorial:sample-editorial",
      sourceVersion: "v-test",
      PROVIDER_TRANSPORT: "thin_gemini",
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.reason, "PROVIDER_FAILURE");
    assert.match(result.message, /UNKNOWN_PROVIDER_SHAPE/);
    assert.match(result.message, /PROVIDER_RESPONSE_SHAPE=INVALID/);
    assert.match(result.message, /PROVIDER_FINISH_REASON=STOP/);
    assert.match(result.message, /PROVIDER_CANDIDATE_COUNT=1/);
    assert.equal(result.forensics?.PROVIDER_RETURNED_KEY_COUNT, 6);
    assert.equal(result.forensics?.PROVIDER_BATCH_COUNT, 4);
  });
});
