/**
 * STEP 15D.14.E.2 — one localization provider-pressure plane.
 * Fake provider only. No Gemini HTTP.
 *
 * Contract:
 * - concurrency bound is per API process (`CONTENT_TRANSLATION_WORKER_CONCURRENCY`, default 1)
 * - provider pressure/cooldown is the durable thin-gemini/localization document (Mongo when configured)
 * - this is not a distributed semaphore
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { MEDIA_PLP_ENTITY_TYPE } from "@hu/types";

import {
  isActivationProviderTransientError,
} from "../../../src/modules/language/activation-provider-transient-recovery.js";
import { classifyContentTranslationWarmFailure } from "../../../src/modules/language/content-translation-warm-failure.js";
import {
  getContentTranslationWorkerPeakConcurrencyForTests,
  resetContentTranslationWorkerConcurrencyForTests,
  resolveContentTranslationWorkerConcurrency,
} from "../../../src/modules/language/content-translation-worker-concurrency.js";
import {
  localizationProviderPressureError,
  runLocalizationProviderRequest,
  setLocalizationProviderClockForTests,
  setLocalizationProviderPacingIntervalMsForTests,
} from "../../../src/modules/language/localization-provider-governor.js";
import {
  activateLocalizationProviderPressure,
  getThinGeminiCooldownSnapshot,
  readThinGeminiProviderState,
  resetThinGeminiProviderStateForTests,
  setThinGeminiProviderStateForceMemoryForTests,
} from "../../../src/modules/language/media-plp-materializer/thin-gemini-provider-state.js";
import {
  resetThinGeminiGovernorForTests,
  withThinGeminiGovernor,
} from "../../../src/modules/language/media-plp-materializer/thin-gemini-governor.js";
import {
  claimNextPlpAutoBuildWork,
  listPlpAutoBuildWorkForTests,
  resetPlpAutoBuildWorkStoreForTests,
  setPlpAutoBuildWorkForceMemoryForTests,
  upsertPendingPlpAutoBuildWork,
} from "../../../src/modules/language/published-localized-presentation/index.js";
import { TranslationProviderError } from "../../../src/modules/language/translation.config.js";
import {
  classifyWebUiTransientFailure,
  isWebUiTransientProviderError,
} from "../../../src/modules/web-ui-message-packs/web-ui-provider-cooldown.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const apiSrc = path.resolve(here, "../../../src");

let clockMs = Date.parse("2026-09-26T00:00:00.000Z");
const previousConcurrency = process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY;
const previousSpacing = process.env.HU_PLP_THIN_GEMINI_MIN_SPACING_MS;

function hold(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

beforeEach(() => {
  clockMs = Date.parse("2026-09-26T00:00:00.000Z");
  setLocalizationProviderClockForTests(() => clockMs);
  setThinGeminiProviderStateForceMemoryForTests(true);
  resetThinGeminiProviderStateForTests();
  resetContentTranslationWorkerConcurrencyForTests();
  resetThinGeminiGovernorForTests({ clearStartupGuard: true });
  setPlpAutoBuildWorkForceMemoryForTests(true);
  resetPlpAutoBuildWorkStoreForTests();
  process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY = "1";
  process.env.HU_PLP_THIN_GEMINI_MIN_SPACING_MS = "0";
  setLocalizationProviderPacingIntervalMsForTests(0);
});

afterEach(() => {
  setLocalizationProviderClockForTests(null);
  setLocalizationProviderPacingIntervalMsForTests(null);
  setThinGeminiProviderStateForceMemoryForTests(false);
  resetThinGeminiProviderStateForTests();
  resetContentTranslationWorkerConcurrencyForTests();
  resetThinGeminiGovernorForTests({ clearStartupGuard: true });
  setPlpAutoBuildWorkForceMemoryForTests(false);
  resetPlpAutoBuildWorkStoreForTests();
  if (previousConcurrency === undefined) {
    delete process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY;
  } else {
    process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY = previousConcurrency;
  }
  if (previousSpacing === undefined) {
    delete process.env.HU_PLP_THIN_GEMINI_MIN_SPACING_MS;
  } else {
    process.env.HU_PLP_THIN_GEMINI_MIN_SPACING_MS = previousSpacing;
  }
});

describe("STEP 15D.14.E.2 localization provider governor", () => {
  it("A+E. concurrency 1: CT, PLP, and an activation owner cannot overlap", async () => {
    assert.equal(resolveContentTranslationWorkerConcurrency(), 1);
    let inFlight = 0;
    let peak = 0;

    const occupy = async (label: string) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await hold(40);
      inFlight -= 1;
      return label;
    };

    const results = await Promise.all([
      runLocalizationProviderRequest(() => occupy("ct")),
      withThinGeminiGovernor(() => occupy("plp")),
      runLocalizationProviderRequest(() => occupy("web_ui")),
    ]);

    assert.deepEqual(results.sort(), ["ct", "plp", "web_ui"]);
    assert.equal(peak, 1);
    assert.ok(getContentTranslationWorkerPeakConcurrencyForTests() <= 1);
  });

  it("B. a WEB_UI rate limit blocks CT, PLP, and Brand without further provider calls", async () => {
    let calls = 0;
    await assert.rejects(
      () =>
        runLocalizationProviderRequest(async () => {
          calls += 1;
          throw new TranslationProviderError("rate_limited", "Gemini HTTP 429");
        }),
      (error: unknown) => error instanceof TranslationProviderError && error.code === "rate_limited",
    );
    assert.equal(calls, 1);

    const stored = await readThinGeminiProviderState();
    assert.equal(stored?.pressureCategory, "rate_limited");
    assert.equal((await getThinGeminiCooldownSnapshot(clockMs)).active, true);

    await assert.rejects(
      () =>
        runLocalizationProviderRequest(async () => {
          calls += 1;
          return "ct";
        }),
      (error: unknown) =>
        error instanceof TranslationProviderError &&
        error.code === "rate_limited" &&
        error.transport?.errorClass === "PROVIDER_COOLDOWN",
    );
    await assert.rejects(
      () =>
        withThinGeminiGovernor(async () => {
          calls += 1;
          return "plp";
        }),
      (error: unknown) => error instanceof TranslationProviderError && error.code === "rate_limited",
    );
    await assert.rejects(
      () =>
        runLocalizationProviderRequest(async () => {
          calls += 1;
          return "brand";
        }),
      (error: unknown) => error instanceof TranslationProviderError && error.code === "rate_limited",
    );
    assert.equal(calls, 1);
  });

  it("C. pressure is not locale-specific: locale A blocks locale B", async () => {
    let calls = 0;
    await assert.rejects(() =>
      runLocalizationProviderRequest(async () => {
        calls += 1;
        throw new TranslationProviderError("rate_limited", "locale ka");
      }),
    );
    await assert.rejects(() =>
      runLocalizationProviderRequest(async () => {
        calls += 1;
        return "locale uk";
      }),
    );
    assert.equal(calls, 1);
    const source = readFileSync(
      path.join(apiSrc, "modules/language/localization-provider-governor.ts"),
      "utf8",
    );
    assert.equal(source.includes("locale"), false);
  });

  it("D. after nextAttemptAt the next request may run without Activate/Resume", async () => {
    let calls = 0;
    await assert.rejects(() =>
      runLocalizationProviderRequest(async () => {
        calls += 1;
        throw new TranslationProviderError("unavailable", "temporary");
      }),
    );
    const until = Date.parse((await readThinGeminiProviderState())!.cooldownUntil!);
    assert.ok(until > clockMs);
    clockMs = until + 1_000;
    const value = await runLocalizationProviderRequest(async () => {
      calls += 1;
      return "ready";
    });
    assert.equal(value, "ready");
    assert.equal(calls, 2);
  });

  it("success does not clear an active cooldown before nextAttemptAt", async () => {
    const armed = await activateLocalizationProviderPressure({
      category: "timeout",
      nowMs: clockMs,
    });
    await assert.rejects(() => runLocalizationProviderRequest(async () => "ok"));
    const still = await readThinGeminiProviderState();
    assert.equal(still?.cooldownUntil, armed.cooldownUntil);
    assert.equal((await getThinGeminiCooldownSnapshot(clockMs)).active, true);
  });

  it("provider failures record rate_limited, unavailable, timeout, and network_failure", async () => {
    const cases = ["rate_limited", "unavailable", "timeout", "network_failure"] as const;
    for (const code of cases) {
      resetThinGeminiProviderStateForTests();
      await assert.rejects(() =>
        runLocalizationProviderRequest(async () => {
          throw new TranslationProviderError(code, code);
        }),
      );
      assert.equal((await readThinGeminiProviderState())?.pressureCategory, code);
    }
  });

  it("repeated transient pressure extends cooldown and keeps the safe category", async () => {
    const first = await activateLocalizationProviderPressure({
      category: "network_failure",
      nowMs: clockMs,
    });
    const second = await activateLocalizationProviderPressure({
      category: "timeout",
      nowMs: clockMs + 1_000,
    });
    assert.ok(Date.parse(second.cooldownUntil!) >= Date.parse(first.cooldownUntil!));
    assert.equal(second.pressureStreak, 2);
    assert.equal(second.pressureCategory, "timeout");
    const blob = JSON.stringify(second);
    assert.equal(blob.includes("api-key"), false);
    assert.equal(blob.includes("generateContent"), false);
  });

  it("F. translateDraft does not call the provider during global cooldown", async () => {
    const {
      ensureLanguageRegistrySeeded,
      resetLanguageRegistryStoreForTests,
      resetTranslationProviderForTests,
      setLanguageRegistryForceMemoryForTests,
      setTranslationProviderForTests,
      translateDraft,
      updateLanguageRegistryRecord,
    } = await import("../../../src/modules/language/index.js");
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    await updateLanguageRegistryRecord("lang-uk", { enabled: true });

    let calls = 0;
    setTranslationProviderForTests({
      providerId: "deterministic",
      async translate() {
        calls += 1;
        return { translatedText: "should-not-run", providerId: "deterministic", isPlaceholder: false };
      },
    });
    await activateLocalizationProviderPressure({ category: "rate_limited", nowMs: clockMs });

    await assert.rejects(
      () =>
        translateDraft({
          sourceRecordId: "draft-e2",
          sourceVersion: "v1",
          sourceLanguage: "en",
          targetLanguage: "uk",
          draftContent: "Hello",
        }),
      (error: unknown) => error instanceof TranslationProviderError && error.code === "rate_limited",
    );
    assert.equal(calls, 0);

    resetTranslationProviderForTests();
    resetLanguageRegistryStoreForTests();
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("G. cooldown stays retryable for WEB_UI, Brand/Terminology, CT, and PLP work", async () => {
    const error = localizationProviderPressureError(60);
    assert.equal(isWebUiTransientProviderError(error), true);
    assert.equal(classifyWebUiTransientFailure(error), "rate_limited");
    assert.equal(isActivationProviderTransientError(error), true);
    assert.equal(classifyContentTranslationWarmFailure(error), "retryable");
    assert.match(error.message, /rate_limited/);

    await activateLocalizationProviderPressure({ category: "rate_limited", nowMs: Date.now() });
    const upsert = await upsertPendingPlpAutoBuildWork({
      entityType: MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
      entityId: "news-e2-cooldown",
      locale: "uk",
      canonicalVersion: "cv1",
      contentRevision: 1,
      trigger: "SYSTEM_RECOVERY",
      maxAttempts: 5,
    });
    assert.equal(await claimNextPlpAutoBuildWork(), null);
    const row = listPlpAutoBuildWorkForTests().find((item) => item.workKey === upsert.record.workKey);
    assert.equal(row?.status, "pending");
  });

  it("H. cooldown survives an in-memory governor reset (durable store, not the slot)", async () => {
    await activateLocalizationProviderPressure({
      category: "unavailable",
      nowMs: clockMs,
    });
    resetThinGeminiGovernorForTests({ clearStartupGuard: true });
    resetContentTranslationWorkerConcurrencyForTests();
    let calls = 0;
    await assert.rejects(() =>
      runLocalizationProviderRequest(async () => {
        calls += 1;
        return "booted";
      }),
    );
    assert.equal(calls, 0);
    const stored = await readThinGeminiProviderState();
    assert.equal(stored?.pressureCategory, "unavailable");
    assert.equal((await getThinGeminiCooldownSnapshot(clockMs)).active, true);
  });

  it("I. Lifecycle AI does not use the localization governor", () => {
    const lifecycle = readFileSync(
      path.join(apiSrc, "modules/lifecycle-ai/providers/gemini-lifecycle-ai-provider.ts"),
      "utf8",
    );
    const resolver = readFileSync(
      path.join(apiSrc, "modules/lifecycle-ai/resolve-lifecycle-ai-provider.ts"),
      "utf8",
    );
    const offlineDraft = readFileSync(
      path.join(apiSrc, "modules/web-ui-message-packs/web-ui-draft-builder.ts"),
      "utf8",
    );
    const qualityRetry = readFileSync(
      path.join(apiSrc, "modules/web-ui-message-packs/web-ui-quality-retry.ts"),
      "utf8",
    );
    const geminiProvider = readFileSync(
      path.join(apiSrc, "modules/language/providers/gemini-translation-provider.ts"),
      "utf8",
    );
    for (const source of [lifecycle, resolver, offlineDraft, qualityRetry, geminiProvider]) {
      assert.equal(source.includes("runLocalizationProviderRequest"), false);
      assert.equal(source.includes("localization-provider-governor"), false);
    }
    const governor = readFileSync(
      path.join(apiSrc, "modules/language/localization-provider-governor.ts"),
      "utf8",
    );
    assert.match(governor, /per API process|process-local/i);
    assert.match(governor, /not a distributed semaphore/i);
    const thin = readFileSync(
      path.join(apiSrc, "modules/language/media-plp-materializer/thin-gemini-governor.ts"),
      "utf8",
    );
    assert.equal(thin.includes("waitQueue"), false);
    assert.match(thin, /runLocalizationProviderRequest/);
  });
});
