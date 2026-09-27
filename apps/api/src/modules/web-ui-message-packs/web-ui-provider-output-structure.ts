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

export const WEB_UI_STRUCTURE_RETRY_REASON = "retryable_provider_output_structure";

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
