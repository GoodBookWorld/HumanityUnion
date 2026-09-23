import { TranslationProviderError } from "../language/translation.config.js";

/**
 * Step 15C.10 — conservative fallback cooldown for WEB_UI rate limits.
 * Caps at 300s. Retry-After deferred (WEB_UI Gemini path does not expose it).
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

export function isWebUiRateLimitedError(error: unknown): boolean {
  return error instanceof TranslationProviderError && error.code === "rate_limited";
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
