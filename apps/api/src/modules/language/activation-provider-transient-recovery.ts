/**
 * Step 15D.12.9 — universal durable transient recovery for Activate Localization.
 *
 * Shared by Brand, Terminology, and WEB_UI. Classification uses TranslationProviderError
 * codes only (no Gemini string matching above the provider layer).
 *
 * Transient provider conditions enter durable cooldown with bounded increasing delay.
 * They must not terminalize activation solely because a small consecutive count was reached.
 */

import type { WebUiActivationTransientFailure } from "@hu/types";

import { TranslationProviderError } from "./translation.config.js";

/** Alias for activation-wide transient kinds (same allowlist as WEB_UI). */
export type ActivationProviderTransientFailure = WebUiActivationTransientFailure;

/** Hard cap on durable cooldown wait (seconds). Matches PLP rate-window max. */
export const ACTIVATION_TRANSIENT_COOLDOWN_MAX_SECONDS = 900;

/**
 * Bounded increasing cooldown for consecutive transient failures.
 * Early streaks preserve 15C.10 / 15D.7.4 timings; later streaks grow to the cap.
 */
export function activationProviderCooldownSeconds(
  transientFailureCount: number,
): number {
  if (transientFailureCount <= 1) {
    return 60;
  }
  if (transientFailureCount === 2) {
    return 120;
  }
  if (transientFailureCount === 3) {
    return 300;
  }
  if (transientFailureCount === 4) {
    return 600;
  }
  return ACTIVATION_TRANSIENT_COOLDOWN_MAX_SECONDS;
}

/**
 * True when the error is a provider-transient eligible for durable cooldown.
 * Uses TranslationProviderError codes only.
 */
export function isActivationProviderTransientError(error: unknown): boolean {
  if (!(error instanceof TranslationProviderError)) {
    return false;
  }
  return (
    error.code === "rate_limited" ||
    error.code === "unavailable" ||
    error.code === "timeout" ||
    error.code === "network_failure"
  );
}

/**
 * Map a transient provider error to the durable failure kind.
 * `network_failure` shares the unavailable operator path.
 */
export function classifyActivationProviderTransientFailure(
  error: unknown,
): ActivationProviderTransientFailure | null {
  if (!(error instanceof TranslationProviderError)) {
    return null;
  }
  if (error.code === "rate_limited") {
    return "rate_limited";
  }
  if (error.code === "timeout") {
    return "timeout";
  }
  if (error.code === "unavailable" || error.code === "network_failure") {
    return "unavailable";
  }
  return null;
}

export function computeActivationCooldownNextAttemptAt(input: {
  readonly nowIso: string;
  readonly transientFailureCount: number;
}): string {
  const waitSec = activationProviderCooldownSeconds(input.transientFailureCount);
  const baseMs = Date.parse(input.nowIso);
  const from = Number.isFinite(baseMs) ? baseMs : Date.now();
  return new Date(from + waitSec * 1000).toISOString();
}

/** Operator-facing detail while waiting (no secrets / payloads). */
export function activationProviderCooldownDetail(
  kind: ActivationProviderTransientFailure,
): string {
  switch (kind) {
    case "rate_limited":
      return "Waiting for translation provider — rate limit.";
    case "unavailable":
      return "Translation provider is temporarily unavailable. Automatic retry scheduled.";
    case "timeout":
      return "Translation provider timed out. Automatic retry scheduled.";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function isActivationCooldownDue(input: {
  readonly nextAttemptAt: string | null | undefined;
  readonly nowMs?: number;
}): boolean {
  if (!input.nextAttemptAt) {
    return true;
  }
  const dueMs = Date.parse(input.nextAttemptAt);
  if (!Number.isFinite(dueMs)) {
    return true;
  }
  const now = input.nowMs ?? Date.now();
  return dueMs <= now;
}
