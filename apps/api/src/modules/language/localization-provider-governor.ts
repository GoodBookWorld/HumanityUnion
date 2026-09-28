/**
 * Gate E — one localization provider-pressure plane.
 *
 * Concurrency is process-local (`CONTENT_TRANSLATION_WORKER_CONCURRENCY`, default 1).
 * Cooldown and the global pacing permit share the durable PLP/localization document
 * and are visible to every API process. Concurrency is not a request-rate limit
 * and is not a distributed semaphore. Do not claim cross-process concurrency = 1.
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
  localizationProviderPacingWindowOpen,
  readThinGeminiProviderState,
  tryAcquireLocalizationProviderPacingPermit,
  type LocalizationProviderPressureCategory,
} from "./media-plp-materializer/thin-gemini-provider-state.js";
import { TranslationProviderError } from "./translation.config.js";

/** Application safety gap between localization provider request starts. Not a quota guess. */
export const LOCALIZATION_PROVIDER_MIN_INTERVAL_MS_DEFAULT = 10_000;

const LOCALIZATION_PROVIDER_MIN_INTERVAL_MS_MAX = 900_000;

/**
 * Test-only interval. `null` uses env/default. `0` disables pacing so older
 * concurrency tests can overlap. Production never uses 0: a non-positive env
 * value falls back to the 10 second default.
 */
let pacingIntervalOverrideMs: number | null = null;

export function setLocalizationProviderPacingIntervalMsForTests(ms: number | null): void {
  pacingIntervalOverrideMs = ms;
}

export function resolveLocalizationProviderMinIntervalMs(
  envValue: string | undefined = process.env.LOCALIZATION_PROVIDER_MIN_INTERVAL_MS,
): number {
  if (pacingIntervalOverrideMs != null) {
    return pacingIntervalOverrideMs;
  }
  const raw = envValue?.trim();
  if (!raw) {
    return LOCALIZATION_PROVIDER_MIN_INTERVAL_MS_DEFAULT;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return LOCALIZATION_PROVIDER_MIN_INTERVAL_MS_DEFAULT;
  }
  return Math.min(parsed, LOCALIZATION_PROVIDER_MIN_INTERVAL_MS_MAX);
}

/**
 * Production and explicit tests use {@link resolveLocalizationProviderMinIntervalMs}.
 * node:test does not opt in, so older multi-call fixtures are not paced unless
 * they call `setLocalizationProviderPacingIntervalMsForTests`.
 */
function effectiveLocalizationProviderMinIntervalMs(): number {
  if (pacingIntervalOverrideMs != null) {
    return pacingIntervalOverrideMs;
  }
  if (
    typeof process.env.NODE_TEST_CONTEXT === "string" &&
    !process.env.LOCALIZATION_PROVIDER_MIN_INTERVAL_MS?.trim()
  ) {
    return 0;
  }
  return resolveLocalizationProviderMinIntervalMs();
}

/**
 * Waiting for the global pacing permit. Not a provider failure.
 * Does not use TranslationProviderError, so it is not rate_limited/timeout.
 */
export class LocalizationProviderPacingDeferredError extends Error {
  readonly nextAllowedAt: string;

  constructor(nextAllowedAt: string) {
    super("Localization provider pacing interval has not elapsed.");
    this.name = "LocalizationProviderPacingDeferredError";
    this.nextAllowedAt = nextAllowedAt;
  }
}

export function isLocalizationProviderPacingDeferredError(
  error: unknown,
): error is LocalizationProviderPacingDeferredError {
  return error instanceof LocalizationProviderPacingDeferredError;
}

export function laterLocalizationInstant(
  left: string | null | undefined,
  right: string | null | undefined,
): string | null {
  const leftMs = left ? Date.parse(left) : NaN;
  const rightMs = right ? Date.parse(right) : NaN;
  const leftOk = Number.isFinite(leftMs);
  const rightOk = Number.isFinite(rightMs);
  if (!leftOk && !rightOk) {
    return null;
  }
  if (!leftOk) {
    return right ?? null;
  }
  if (!rightOk) {
    return left ?? null;
  }
  return leftMs >= rightMs ? (left as string) : (right as string);
}

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

export type LocalizationProviderPacingRead = {
  readonly blocked: boolean;
  readonly nextProviderRequestAt: string | null;
  readonly intervalMs: number;
};

/** Read-only. Does not acquire a permit and does not call the provider. */
export async function readLocalizationProviderPacing(
  nowMs: number = localizationProviderNowMs(),
): Promise<LocalizationProviderPacingRead> {
  const intervalMs = effectiveLocalizationProviderMinIntervalMs();
  if (intervalMs <= 0) {
    return { blocked: false, nextProviderRequestAt: null, intervalMs: 0 };
  }
  let nextProviderRequestAt: string | null = null;
  let storedInterval: number | null = null;
  try {
    const state = await readThinGeminiProviderState();
    nextProviderRequestAt = state?.nextProviderRequestAt ?? null;
    storedInterval = state?.pacingIntervalMs ?? null;
  } catch {
    return { blocked: false, nextProviderRequestAt: null, intervalMs };
  }
  if (localizationProviderPacingWindowOpen(nextProviderRequestAt, nowMs)) {
    return { blocked: false, nextProviderRequestAt: null, intervalMs: storedInterval ?? intervalMs };
  }
  return {
    blocked: true,
    nextProviderRequestAt,
    intervalMs: storedInterval ?? intervalMs,
  };
}

/**
 * Earliest time a provider request may start.
 * Null means both the cooldown and the pacing window are clear.
 */
export async function readLocalizationProviderBlockedUntil(
  nowMs: number = localizationProviderNowMs(),
): Promise<string | null> {
  const cooldown = await readLocalizationProviderCooldown();
  const pacing = await readLocalizationProviderPacing(nowMs);
  const until = laterLocalizationInstant(
    cooldown.active ? cooldown.cooldownUntil : null,
    pacing.blocked ? pacing.nextProviderRequestAt : null,
  );
  if (!until) {
    return null;
  }
  const untilMs = Date.parse(until);
  if (!Number.isFinite(untilMs) || untilMs <= nowMs) {
    return null;
  }
  return until;
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

  const permit = await tryAcquireLocalizationProviderPacingPermit({
    nowMs: nowMs(),
    intervalMs: effectiveLocalizationProviderMinIntervalMs(),
  });
  if (!permit.acquired) {
    throw new LocalizationProviderPacingDeferredError(
      permit.nextAllowedAt ?? new Date(nowMs() + LOCALIZATION_PROVIDER_MIN_INTERVAL_MS_DEFAULT).toISOString(),
    );
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
