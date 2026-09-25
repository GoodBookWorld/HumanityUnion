/**
 * Step 15C.10 / 15D.7.4 / 15D.12.9 — durable WEB_UI provider cooldown for transient failures.
 *
 * Delegates classification and bounded backoff to the shared activation transient recovery
 * module. Transient conditions stay in durable cooldown (no terminal FAILED solely from
 * consecutive transient count).
 */

import type { WebUiActivationTransientFailure } from "@hu/types";

import { TranslationProviderError } from "../language/translation.config.js";
import {
  activationProviderCooldownDetail,
  activationProviderCooldownSeconds,
  classifyActivationProviderTransientFailure,
  computeActivationCooldownNextAttemptAt,
  isActivationProviderTransientError,
  ACTIVATION_TRANSIENT_COOLDOWN_MAX_SECONDS,
} from "../language/activation-provider-transient-recovery.js";

/** @deprecated Transient failures no longer terminalize from consecutive count (15D.12.9). */
export const WEB_UI_TRANSIENT_COOLDOWN_BUDGET = Number.POSITIVE_INFINITY;

/** Re-export shared max for tests / callers. */
export const WEB_UI_TRANSIENT_COOLDOWN_MAX_SECONDS =
  ACTIVATION_TRANSIENT_COOLDOWN_MAX_SECONDS;

/**
 * Bounded increasing cooldown for WEB_UI transient provider failures.
 */
export function webUiProviderCooldownSeconds(transientFailureCount: number): number {
  return activationProviderCooldownSeconds(transientFailureCount);
}

/** @deprecated Prefer `isWebUiTransientProviderError` — kept for 15C.10 call sites/tests. */
export function isWebUiRateLimitedError(error: unknown): boolean {
  return error instanceof TranslationProviderError && error.code === "rate_limited";
}

/**
 * Typed transient provider failures eligible for durable cooldown.
 * Uses TranslationProviderError codes only (no Gemini string matching).
 */
export function isWebUiTransientProviderError(error: unknown): boolean {
  return isActivationProviderTransientError(error);
}

/**
 * Map a transient provider error to the durable checkpoint failure kind.
 */
export function classifyWebUiTransientFailure(
  error: unknown,
): WebUiActivationTransientFailure | null {
  return classifyActivationProviderTransientFailure(error);
}

/**
 * @deprecated Always false — transient streak no longer exhausts to FAILED (15D.12.9).
 */
export function isWebUiTransientCooldownBudgetExhausted(
  _transientFailureCount: number,
): boolean {
  return false;
}

export function computeWebUiCooldownNextAttemptAt(input: {
  readonly nowIso: string;
  readonly transientFailureCount: number;
}): string {
  return computeActivationCooldownNextAttemptAt(input);
}

/** Operator-facing checkpoint detail while waiting (no secrets / payloads). */
export function webUiProviderCooldownDetail(
  kind: WebUiActivationTransientFailure,
): string {
  return activationProviderCooldownDetail(kind);
}

/**
 * @deprecated No longer used for normal transient recovery (15D.12.9).
 * Kept for permanent-path / historical test assertions only.
 */
export function webUiTransientBudgetExhaustedDetail(
  kind: WebUiActivationTransientFailure,
): string {
  switch (kind) {
    case "rate_limited":
      return "Public interface translation failed: provider rate limited repeatedly. Retry activation to continue.";
    case "unavailable":
      return "Public interface translation failed: provider temporarily unavailable repeatedly. Retry activation to continue.";
    case "timeout":
      return "Public interface translation failed: provider timed out repeatedly. Retry activation to continue.";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
