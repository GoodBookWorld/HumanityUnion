/**
 * Pack 02G Task 04 — warm consumer failure classification.
 */

import { TranslationProviderError } from "./translation.config.js";

export type ContentTranslationWarmFailureClass = "retryable" | "non_retryable";

export function classifyContentTranslationWarmFailure(
  error: unknown,
): ContentTranslationWarmFailureClass {
  if (error instanceof TranslationProviderError) {
    switch (error.code) {
      case "timeout":
      case "rate_limited":
      case "network_failure":
      case "unavailable":
      case "malformed_response":
        return "retryable";
      case "not_configured":
      case "safety_rejected":
      case "unsupported_language":
      case "forbidden":
      case "bad_request":
        return "non_retryable";
      default:
        return "retryable";
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (
      message.includes("econnreset") ||
      message.includes("etimedout") ||
      message.includes("eai_again") ||
      message.includes("socket hang up") ||
      message.includes("temporarily unavailable")
    ) {
      return "retryable";
    }
  }

  // Unknown infrastructure errors — prefer retry with outbox attempt bound.
  return "retryable";
}
