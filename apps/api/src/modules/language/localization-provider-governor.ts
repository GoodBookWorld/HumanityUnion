/**
 * Gate E — one localization provider-pressure plane.
 *
 * Concurrency is process-local (`CONTENT_TRANSLATION_WORKER_CONCURRENCY`, default 1).
 * Cooldown is the durable PLP/localization document and is visible to every API process.
 * This is not a distributed semaphore. Do not claim cross-process concurrency = 1.
 *
 * Every production localization provider request must enter `runLocalizationProviderRequest`
 * exactly once. Do not wrap that call in `withContentTranslationWorkerSlot` again.
 *
 * Lifecycle AI does not use this module.
 */

import {
  classifyActivationProviderTransientFailure,
  isActivationProviderTransientError,
} from "./activation-provider-transient-recovery.js";
import { withContentTranslationWorkerSlot } from "./content-translation-worker-concurrency.js";
import {
  activateLocalizationProviderPressure,
  getThinGeminiCooldownSnapshot,
  type LocalizationProviderPressureCategory,
} from "./media-plp-materializer/thin-gemini-provider-state.js";
import { TranslationProviderError } from "./translation.config.js";

let nowMs = (): number => Date.now();

/** Test clock. Production uses `Date.now`. */
export function setLocalizationProviderClockForTests(clock: (() => number) | null): void {
  nowMs = clock ?? (() => Date.now());
}

export function localizationProviderNowMs(): number {
  return nowMs();
}

export function localizationProviderPressureError(remainingSeconds: number): TranslationProviderError {
  const remaining = Math.max(1, remainingSeconds);
  return new TranslationProviderError(
    "rate_limited",
    `Localization provider cooldown active (rate_limited, ${remaining}s).`,
    undefined,
    {
      httpStatus: null,
      httpClass: null,
      errorClass: "PROVIDER_COOLDOWN",
      errorCode: null,
      retryAfterSeconds: remaining,
      geminiErrorStatus: null,
      geminiErrorReason: "PROVIDER_COOLDOWN",
      quotaClass: null,
      quotaMetric: null,
      quotaLimitId: null,
      quotaRetryDelaySeconds: remaining,
    },
  );
}

/**
 * Read-only view of the one shared Gate E cooldown.
 * Does not arm, extend, or clear pressure and does not call the provider.
 * An expired `cooldownUntil` is inactive.
 */
export type LocalizationProviderCooldownRead = {
  readonly active: boolean;
  readonly cooldownUntil: string | null;
  readonly pressureCategory: LocalizationProviderPressureCategory | null;
};

export async function readLocalizationProviderCooldown(): Promise<LocalizationProviderCooldownRead> {
  const inactive: LocalizationProviderCooldownRead = {
    active: false,
    cooldownUntil: null,
    pressureCategory: null,
  };
  let snapshot: Awaited<ReturnType<typeof getThinGeminiCooldownSnapshot>>;
  try {
    snapshot = await getThinGeminiCooldownSnapshot(nowMs());
  } catch {
    return inactive;
  }
  if (!snapshot.active) {
    return inactive;
  }
  return {
    active: true,
    cooldownUntil: snapshot.cooldownUntil,
    pressureCategory: snapshot.pressureCategory,
  };
}

async function pressureActive(): Promise<{ active: boolean; remainingSeconds: number }> {
  const snapshot = await getThinGeminiCooldownSnapshot(nowMs());
  return { active: snapshot.active, remainingSeconds: snapshot.remainingSeconds };
}

/**
 * Run one localization provider attempt.
 * Checks durable pressure before taking a slot and again immediately before the call.
 * Does not sleep out a cooldown while holding the slot.
 * A transient failure arms the shared cooldown, then the original error is rethrown
 * so the owner can keep its own retry state.
 */
export async function runLocalizationProviderRequest<T>(run: () => Promise<T>): Promise<T> {
  const before = await pressureActive();
  if (before.active) {
    throw localizationProviderPressureError(before.remainingSeconds);
  }

  return withContentTranslationWorkerSlot(async () => {
    const after = await pressureActive();
    if (after.active) {
      throw localizationProviderPressureError(after.remainingSeconds);
    }
    try {
      return await run();
    } catch (error) {
      if (isActivationProviderTransientError(error)) {
        const kind = classifyActivationProviderTransientFailure(error);
        const category: LocalizationProviderPressureCategory =
          error instanceof TranslationProviderError && error.code === "network_failure"
            ? "network_failure"
            : kind === "timeout"
              ? "timeout"
              : kind === "rate_limited"
                ? "rate_limited"
                : "unavailable";
        const retryAfter =
          error instanceof TranslationProviderError
            ? error.transport?.retryAfterSeconds ?? error.transport?.quotaRetryDelaySeconds ?? null
            : null;
        await activateLocalizationProviderPressure({
          category,
          nowMs: nowMs(),
          retryAfterSeconds: retryAfter,
        });
      }
      throw error;
    }
  });
}
