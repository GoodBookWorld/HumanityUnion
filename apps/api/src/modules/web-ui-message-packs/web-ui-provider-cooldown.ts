/**
 * Step 15C.10 / 15D.7.4 — durable WEB_UI provider cooldown for transient failures.
 *
 * Caps wait at 300s. Caps automatic cooldown entries so outages cannot loop forever.
 * Retry-After deferred (WEB_UI Gemini path does not expose it).
 */

import type { WebUiActivationTransientFailure } from "@hu/types";

import { TranslationProviderError } from "../language/translation.config.js";

/** Maximum consecutive cooldown entries before terminal failed (operator may Retry). */
export const WEB_UI_TRANSIENT_COOLDOWN_BUDGET = 5;

/**
 * Step 15C.10 — conservative fallback cooldown for WEB_UI transient provider failures.
 * Caps at 300s.
 */
export function webUiProviderCooldownSeconds(transientFailureCount: number): number {
  if (transientFailureCount <= 1) {
    return 60;
  }
  if (transientFailureCount === 2) {
    return 120;
  }
  return 300;
}

/** @deprecated Prefer `isWebUiTransientProviderError` — kept for 15C.10 call sites/tests. */
export function isWebUiRateLimitedError(error: unknown): boolean {
  return error instanceof TranslationProviderError && error.code === "rate_limited";
}

/**
 * Step 15D.7.4 — typed transient provider failures eligible for durable cooldown.
 * Uses TranslationProviderError codes only (no Gemini string matching).
 */
export function isWebUiTransientProviderError(error: unknown): boolean {
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
 * Map a transient provider error to the durable checkpoint failure kind.
 * `network_failure` shares the unavailable operator path.
 */
export function classifyWebUiTransientFailure(
  error: unknown,
): WebUiActivationTransientFailure | null {
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

/** True when another cooldown would exceed the automatic recovery budget. */
export function isWebUiTransientCooldownBudgetExhausted(
  transientFailureCount: number,
): boolean {
  return transientFailureCount >= WEB_UI_TRANSIENT_COOLDOWN_BUDGET;
}

export function computeWebUiCooldownNextAttemptAt(input: {
  readonly nowIso: string;
  readonly transientFailureCount: number;
}): string {
  const waitSec = webUiProviderCooldownSeconds(input.transientFailureCount);
  const baseMs = Date.parse(input.nowIso);
  const from = Number.isFinite(baseMs) ? baseMs : Date.now();
  return new Date(from + waitSec * 1000).toISOString();
}

/** Operator-facing checkpoint detail while waiting (no secrets / payloads). */
export function webUiProviderCooldownDetail(
  kind: WebUiActivationTransientFailure,
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

/** Terminal copy after transient budget exhaustion (Retry Activation allowed). */
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
