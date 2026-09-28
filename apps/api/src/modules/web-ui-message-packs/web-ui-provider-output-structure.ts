/**
 * STEP 15D.14.F.3.9 — retryable WEB_UI provider-output structure failures.
 *
 * A fresh provider response can repair these. They are not provider pressure
 * (rate limit, timeout, unavailable, network) and they do not arm Gate E.
 *
 * Deterministic source defects stay terminal. The English catalog is checked
 * before the provider is called; "English source already contains a protection
 * sentinel." is that case.
 */

/**
 * Provider payload shape for WEB_UI batches.
 * Absent or 0 is the historical sentinel representation.
 * 1 sends human-language spans and reconstructs structure locally.
 */
export const WEB_UI_PROVIDER_SHAPE_VERSION = 1;

/**
 * Reconstructed-structure failures allowed for one batch under one shape version.
 * Counts provider responses, not pacing waits. Generic, not locale-specific.
 */
export const WEB_UI_PROVIDER_SHAPE_STRUCTURE_FAILURE_BOUND = 6;

export const WEB_UI_STRUCTURE_RETRY_REASON = "retryable_provider_output_structure";

/** Same-version reconstructed structure failed until the bound. Provider calls stop. */
export const WEB_UI_STRUCTURE_BLOCKED_REASON = "web_ui_structure_blocked";

export const WEB_UI_STRUCTURE_BLOCKED_DETAIL =
  "Automatic translation is blocked by a structural defect. Invalid output was not published. No operator retry is required.";

/**
 * One structure-invalid response already happened. The next provider attempt
 * is waiting for the global pacing permit. Not a failure and not a structure
 * retry streak.
 */
export const WEB_UI_STRUCTURE_PACING_REASON = "awaiting_provider_pacing";

/** Operator copy. No locale name and no rate-limit wording. */
export const WEB_UI_STRUCTURE_RETRY_DETAIL =
  "Automatic retry scheduled. No operator action required.";

const SOURCE_SENTINEL_DEFECT = "English source already contains a protection sentinel.";

const RETRYABLE_PROVIDER_OUTPUT_MESSAGES = new Set([
  "Protection sentinels were reordered or renumbered.",
  "Protection sentinel index is missing.",
  "Unresolved protection sentinel remains.",
  "Message structure is unbalanced.",
  "Placeholders do not match English.",
  "Rich-text tags do not match English.",
  "Localized message braces are unbalanced.",
  "Localized placeholders do not match English.",
  "Localized rich-text tags do not match English.",
]);

const SENTINEL_COUNT_MISMATCH =
  /^Protection sentinel count \d+ does not match \d+\.$/;

/**
 * True only when a received, parseable provider payload violated a protected
 * structure rule that a later response of the same batch can satisfy.
 */
/** Failures already recorded for the current shape. An older shape counts as zero. */
export function webUiProviderShapeFailureCountForBound(input: {
  readonly providerShapeVersion?: number | null;
  readonly providerShapeFailureCount?: number | null;
}): number {
  if ((input.providerShapeVersion ?? 0) !== WEB_UI_PROVIDER_SHAPE_VERSION) {
    return 0;
  }
  return input.providerShapeFailureCount ?? 0;
}

export function isRetryableWebUiProviderOutputStructureFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  if (!message || message === SOURCE_SENTINEL_DEFECT) {
    return false;
  }
  if (RETRYABLE_PROVIDER_OUTPUT_MESSAGES.has(message)) {
    return true;
  }
  return SENTINEL_COUNT_MISMATCH.test(message);
}
