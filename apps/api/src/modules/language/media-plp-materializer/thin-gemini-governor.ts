/**
 * RESET 05E.3 — PLP spacing and quota forensics in front of the localization governor.
 *
 * Concurrency is NOT owned here. `runLocalizationProviderRequest` is the only slot.
 * This module keeps minimum spacing (outside the slot) and, after a quota failure,
 * extends the same durable cooldown with quota duration. It is not a second lane.
 */

import {
  getContentTranslationWorkerInFlightForTests,
  getContentTranslationWorkerPeakConcurrencyForTests,
  resetContentTranslationWorkerConcurrencyForTests,
} from "../content-translation-worker-concurrency.js";
import {
  localizationProviderNowMs,
  localizationProviderPressureError,
  runLocalizationProviderRequest,
} from "../localization-provider-governor.js";
import { TranslationProviderError } from "../translation.config.js";
import {
  activateThinGeminiProviderCooldown,
  getThinGeminiCooldownSnapshot,
} from "./thin-gemini-provider-state.js";
import {
  isQuotaExhaustionTransport,
  type PlpProviderQuotaClass,
} from "./gemini-quota-forensics.js";

const DEFAULT_MIN_SPACING_MS = 1_500;
const MAX_MIN_SPACING_MS = 60_000;

/** Process-start baseline — prevents immediate burst after API restart. */
let lastRequestCompletedAtMs = Date.now();

export function resolveThinGeminiMinSpacingMs(
  envValue: string | undefined = process.env.HU_PLP_THIN_GEMINI_MIN_SPACING_MS,
): number {
  const raw = envValue?.trim();
  if (!raw) {
    return DEFAULT_MIN_SPACING_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_MIN_SPACING_MS;
  }
  return Math.min(parsed, MAX_MIN_SPACING_MS);
}

export function getThinGeminiGovernorInFlightForTests(): number {
  return getContentTranslationWorkerInFlightForTests();
}

export function getThinGeminiGovernorPeakConcurrencyForTests(): number {
  return getContentTranslationWorkerPeakConcurrencyForTests();
}

export function resetThinGeminiGovernorForTests(options?: {
  readonly clearStartupGuard?: boolean;
}): void {
  resetContentTranslationWorkerConcurrencyForTests();
  if (options?.clearStartupGuard) {
    lastRequestCompletedAtMs = 0;
  } else {
    lastRequestCompletedAtMs = Date.now();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isActualQuotaHttpFailure(error: unknown): error is TranslationProviderError {
  if (!(error instanceof TranslationProviderError) || !error.transport) {
    return false;
  }
  const meta = error.transport;
  if (meta.errorClass === "PROVIDER_COOLDOWN" && meta.httpStatus == null && !meta.quotaClass) {
    return false;
  }
  return isQuotaExhaustionTransport({
    httpStatus: meta.httpStatus,
    errorClass: meta.errorClass,
    geminiErrorStatus: meta.geminiErrorStatus,
    quotaClass: meta.quotaClass,
  });
}

/**
 * PLP HTTP attempt. Spacing happens before the shared slot.
 * Quota failures extend the same durable cooldown the localization governor writes.
 */
export async function withThinGeminiGovernor<T>(run: () => Promise<T>): Promise<T> {
  const snapshot = await getThinGeminiCooldownSnapshot(localizationProviderNowMs());
  if (snapshot.active) {
    throw localizationProviderPressureError(snapshot.remainingSeconds);
  }

  const spacingMs = resolveThinGeminiMinSpacingMs();
  if (spacingMs > 0 && lastRequestCompletedAtMs > 0) {
    const elapsed = Date.now() - lastRequestCompletedAtMs;
    if (elapsed < spacingMs) {
      await sleep(spacingMs - elapsed);
    }
  }

  try {
    return await runLocalizationProviderRequest(async () => {
      try {
        const result = await run();
        lastRequestCompletedAtMs = Date.now();
        return result;
      } catch (error) {
        lastRequestCompletedAtMs = Date.now();
        throw error;
      }
    });
  } catch (error) {
    if (isActualQuotaHttpFailure(error)) {
      const meta = error.transport!;
      await activateThinGeminiProviderCooldown({
        nowMs: localizationProviderNowMs(),
        quotaClass: (meta.quotaClass as PlpProviderQuotaClass | null) ?? null,
        quotaMetric: meta.quotaMetric ?? null,
        quotaLimitId: meta.quotaLimitId ?? null,
        quotaRetryDelaySeconds: meta.quotaRetryDelaySeconds ?? meta.retryAfterSeconds ?? null,
        reason: meta.geminiErrorStatus === "RESOURCE_EXHAUSTED" ? "RESOURCE_EXHAUSTED" : "HTTP_429",
      });
    }
    throw error;
  }
}

/** Test helper: expose spacing gate without HTTP. */
export async function waitThinGeminiGovernorSpacingForTests(): Promise<void> {
  const spacingMs = resolveThinGeminiMinSpacingMs();
  if (spacingMs > 0 && lastRequestCompletedAtMs > 0) {
    const elapsed = Date.now() - lastRequestCompletedAtMs;
    if (elapsed < spacingMs) {
      await sleep(spacingMs - elapsed);
    }
  }
  lastRequestCompletedAtMs = Date.now();
}
