/**
 * RESET 05E.3 — shared thin_gemini request governor.
 *
 * - concurrency = 1
 * - configurable minimum spacing between provider HTTP requests
 * - durable quota cooldown respected before any Gemini call
 * - no startup burst (first request waits min spacing from process start)
 *
 * All ThinGeminiMediaPlpTransport.translate calls must go through this.
 */

import { TranslationProviderError } from "../translation.config.js";
import { PLP_PROVIDER_FAILURE_SUBTYPE } from "./provider-response-contract.js";
import {
  activateThinGeminiProviderCooldown,
  getThinGeminiCooldownSnapshot,
  type ThinGeminiCooldownSnapshot,
} from "./thin-gemini-provider-state.js";
import {
  isQuotaExhaustionTransport,
  type PlpProviderQuotaClass,
} from "./gemini-quota-forensics.js";
import type { TranslationProviderTransportMeta } from "../translation.config.js";

const DEFAULT_MIN_SPACING_MS = 1_500;
const MAX_MIN_SPACING_MS = 60_000;

let inFlight = 0;
const waitQueue: Array<() => void> = [];
/** Process-start baseline — prevents immediate burst after API restart. */
let lastRequestCompletedAtMs = Date.now();
let observedPeak = 0;

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
  return inFlight;
}

export function getThinGeminiGovernorPeakConcurrencyForTests(): number {
  return observedPeak;
}

export function resetThinGeminiGovernorForTests(options?: {
  readonly clearStartupGuard?: boolean;
}): void {
  inFlight = 0;
  observedPeak = 0;
  waitQueue.length = 0;
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

async function acquireGovernorSlot(): Promise<void> {
  await new Promise<void>((resolve) => {
    const tryAcquire = () => {
      if (inFlight < 1) {
        inFlight = 1;
        observedPeak = Math.max(observedPeak, inFlight);
        resolve();
        return;
      }
      waitQueue.push(tryAcquire);
    };
    tryAcquire();
  });
}

function releaseGovernorSlot(): void {
  inFlight = Math.max(0, inFlight - 1);
  const next = waitQueue.shift();
  if (next) {
    next();
  }
}

function cooldownBlockedError(
  snapshot: ThinGeminiCooldownSnapshot,
): TranslationProviderError {
  const remaining = Math.max(1, snapshot.remainingSeconds);
  const transport: TranslationProviderTransportMeta = {
    httpStatus: null,
    httpClass: null,
    errorClass: "PROVIDER_COOLDOWN",
    errorCode: null,
    retryAfterSeconds: remaining,
    geminiErrorStatus: "RESOURCE_EXHAUSTED",
    geminiErrorReason: snapshot.cooldownReason ?? "PROVIDER_COOLDOWN",
    quotaClass: snapshot.quotaClass,
    quotaMetric: snapshot.quotaMetric,
    quotaLimitId: snapshot.quotaLimitId,
    quotaRetryDelaySeconds: remaining,
  };
  return new TranslationProviderError(
    "rate_limited",
    "Gemini provider cooldown active",
    PLP_PROVIDER_FAILURE_SUBTYPE.HTTP_FAILURE,
    transport,
  );
}

/**
 * Run a thin Gemini HTTP attempt under the shared governor.
 * Activates durable cooldown on quota exhaustion errors.
 */
export async function withThinGeminiGovernor<T>(
  run: () => Promise<T>,
): Promise<T> {
  await acquireGovernorSlot();
  try {
    const snapshot = await getThinGeminiCooldownSnapshot();
    if (snapshot.active) {
      throw cooldownBlockedError(snapshot);
    }

    const spacingMs = resolveThinGeminiMinSpacingMs();
    if (spacingMs > 0 && lastRequestCompletedAtMs > 0) {
      const elapsed = Date.now() - lastRequestCompletedAtMs;
      if (elapsed < spacingMs) {
        await sleep(spacingMs - elapsed);
      }
    }

    // Re-check after spacing wait — another process may have activated cooldown.
    const afterWait = await getThinGeminiCooldownSnapshot();
    if (afterWait.active) {
      throw cooldownBlockedError(afterWait);
    }

    try {
      const result = await run();
      lastRequestCompletedAtMs = Date.now();
      return result;
    } catch (error) {
      lastRequestCompletedAtMs = Date.now();
      if (error instanceof TranslationProviderError) {
        const meta = error.transport;
        if (
          meta &&
          isQuotaExhaustionTransport({
            httpStatus: meta.httpStatus,
            errorClass: meta.errorClass,
            geminiErrorStatus: meta.geminiErrorStatus,
            quotaClass: meta.quotaClass,
          })
        ) {
          await activateThinGeminiProviderCooldown({
            quotaClass: (meta.quotaClass as PlpProviderQuotaClass | null) ?? null,
            quotaMetric: meta.quotaMetric ?? null,
            quotaLimitId: meta.quotaLimitId ?? null,
            quotaRetryDelaySeconds:
              meta.quotaRetryDelaySeconds ?? meta.retryAfterSeconds ?? null,
            reason:
              meta.geminiErrorStatus === "RESOURCE_EXHAUSTED"
                ? "RESOURCE_EXHAUSTED"
                : "HTTP_429",
          });
        }
      }
      throw error;
    }
  } finally {
    releaseGovernorSlot();
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
