/**
 * Pack 02G Task 04 / Pack 08K.2 — warm consumer failure classification.
 *
 * Pack 08K.2 adds machine-readable residual diagnostic classes (safe — no
 * source/translated bodies, prompts, or secrets).
 */

import { TranslationProviderError } from "./translation.config.js";
import {
  ContentTranslationValidationError,
  parseContentTranslationFailureMetadata,
  resolveValidationReasonCodeFromError,
} from "./content-translation-failure-metadata.js";

export type ContentTranslationWarmFailureClass = "retryable" | "non_retryable";

/**
 * Safe residual diagnostic failure classes for operator explain-residuals.
 * Never include participant prose or provider payloads.
 */
export type ContentTranslationMaterializationFailureClass =
  | "PROVIDER_REJECTED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_INVALID_RESPONSE"
  | "VALIDATION_FAILED"
  | "SOURCE_UNAVAILABLE"
  | "SOURCE_VERSION_MISMATCH"
  | "PERSISTENCE_FAILED"
  | "UNSUPPORTED_SOURCE"
  | "MISSING_AFTER_DISPATCH"
  | "UNKNOWN";

export type ContentTranslationFailureRetryability =
  | "retryable"
  | "retryable_after_source_change"
  | "non_retryable_until_code_or_content_change"
  | "unknown";

export function classifyContentTranslationWarmFailure(
  error: unknown,
): ContentTranslationWarmFailureClass {
  const diagnostic = classifyContentTranslationMaterializationFailure(error);
  if (
    diagnostic.retryability === "retryable" ||
    diagnostic.retryability === "retryable_after_source_change"
  ) {
    return "retryable";
  }
  if (diagnostic.retryability === "non_retryable_until_code_or_content_change") {
    return "non_retryable";
  }
  // Prefer retry for unknown infrastructure errors (outbox attempt bound).
  return "retryable";
}

/**
 * Map errors → safe residual diagnostic class + retry policy.
 * Does not read or return any content bodies.
 */
export function classifyContentTranslationMaterializationFailure(error: unknown): {
  readonly failureClass: ContentTranslationMaterializationFailureClass;
  readonly retryability: ContentTranslationFailureRetryability;
  readonly providerErrorCode: string | null;
  readonly failureReasonCode: string | null;
} {
  if (error instanceof Error) {
    const meta = parseContentTranslationFailureMetadata(error.message);
    if (meta) {
      return {
        failureClass: meta.failureClass as ContentTranslationMaterializationFailureClass,
        retryability:
          (meta.retryabilityHint as ContentTranslationFailureRetryability) ?? "unknown",
        providerErrorCode:
          error instanceof TranslationProviderError ? error.code : null,
        failureReasonCode: meta.failureReasonCode,
      };
    }
  }

  if (error instanceof ContentTranslationValidationError) {
    const nonRetryableReasons = new Set([
      "UNCHANGED_SOURCE_PROSE",
      "UNCHANGED_CIVIC_TITLE",
      "EMPTY_TRANSLATION",
      "INVALID_RICH_TEXT_STRUCTURE",
      "MISSING_REQUIRED_PATH",
      "UNEXPECTED_PATH",
      "STRUCTURE_MISMATCH",
      "TARGET_LANGUAGE_MISMATCH",
      "OTHER_VALIDATION_FAILURE",
    ]);
    return {
      failureClass: "VALIDATION_FAILED",
      retryability: nonRetryableReasons.has(error.reasonCode)
        ? "non_retryable_until_code_or_content_change"
        : error.reasonCode === "INVALID_PROVIDER_PAYLOAD"
          ? "retryable"
          : "unknown",
      providerErrorCode: error.code,
      failureReasonCode: error.reasonCode,
    };
  }

  const reasonCode = resolveValidationReasonCodeFromError(error);
  if (reasonCode === "INVALID_PROVIDER_PAYLOAD") {
    return {
      failureClass: "PROVIDER_INVALID_RESPONSE",
      retryability: "retryable",
      providerErrorCode:
        error instanceof TranslationProviderError ? error.code : null,
      failureReasonCode: reasonCode,
    };
  }
  if (reasonCode && reasonCode !== "UNKNOWN_LEGACY") {
    return {
      failureClass: "VALIDATION_FAILED",
      retryability: "non_retryable_until_code_or_content_change",
      providerErrorCode:
        error instanceof TranslationProviderError ? error.code : null,
      failureReasonCode: reasonCode,
    };
  }

  if (error instanceof TranslationProviderError) {
    switch (error.code) {
      case "timeout":
        return {
          failureClass: "PROVIDER_TIMEOUT",
          retryability: "retryable",
          providerErrorCode: error.code,
          failureReasonCode: null,
        };
      case "rate_limited":
      case "network_failure":
      case "unavailable":
        return {
          failureClass:
            error.message.toLowerCase().includes("source unavailable")
              ? "SOURCE_UNAVAILABLE"
              : "PROVIDER_TIMEOUT",
          retryability: "retryable",
          providerErrorCode: error.code,
          failureReasonCode: null,
        };
      case "malformed_response":
        return {
          failureClass: "PROVIDER_INVALID_RESPONSE",
          retryability: "retryable",
          providerErrorCode: error.code,
          failureReasonCode: "INVALID_PROVIDER_PAYLOAD",
        };
      case "safety_rejected":
        return {
          failureClass: "PROVIDER_REJECTED",
          retryability: "non_retryable_until_code_or_content_change",
          providerErrorCode: error.code,
          failureReasonCode: null,
        };
      case "unsupported_language":
      case "forbidden":
      case "not_configured":
        return {
          failureClass: "UNSUPPORTED_SOURCE",
          retryability: "non_retryable_until_code_or_content_change",
          providerErrorCode: error.code,
          failureReasonCode: null,
        };
      case "bad_request": {
        return {
          failureClass: "VALIDATION_FAILED",
          retryability: "non_retryable_until_code_or_content_change",
          providerErrorCode: error.code,
          failureReasonCode: "OTHER_VALIDATION_FAILURE",
        };
      }
      default:
        return {
          failureClass: "UNKNOWN",
          retryability: "retryable",
          providerErrorCode: error.code,
          failureReasonCode: null,
        };
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
      return {
        failureClass: "PROVIDER_TIMEOUT",
        retryability: "retryable",
        providerErrorCode: null,
        failureReasonCode: null,
      };
    }
    if (message.includes("persist") || message.includes("mongo") || message.includes("write")) {
      return {
        failureClass: "PERSISTENCE_FAILED",
        retryability: "retryable",
        providerErrorCode: null,
        failureReasonCode: null,
      };
    }
    if (message.includes("unsupported") || message.includes("sourcekind")) {
      return {
        failureClass: "UNSUPPORTED_SOURCE",
        retryability: "non_retryable_until_code_or_content_change",
        providerErrorCode: null,
        failureReasonCode: null,
      };
    }
  }

  // Pack 08K.2.5 — truly unclassified exceptions become OTHER_VALIDATION_FAILURE
  // (never the generic reasonCode "VALIDATION_FAILED").
  return {
    failureClass: "VALIDATION_FAILED",
    retryability: "non_retryable_until_code_or_content_change",
    providerErrorCode: null,
    failureReasonCode: "OTHER_VALIDATION_FAILURE",
  };
}

/**
 * Explicit retry policy for residual TERMINAL_FAILED identities.
 * Does not clear failure state — operator must re-enqueue deliberately.
 */
export function resolveContentTranslationFailureRetryPolicy(input: {
  readonly failureClass: ContentTranslationMaterializationFailureClass;
  readonly liveSourceVersion: string | null;
  readonly failedSourceVersion: string | null;
}): {
  readonly retryability: ContentTranslationFailureRetryability;
  readonly mayScheduleNewWarm: boolean;
  readonly reason: string;
} {
  if (
    input.failedSourceVersion &&
    input.liveSourceVersion &&
    input.failedSourceVersion !== input.liveSourceVersion
  ) {
    return {
      retryability: "retryable_after_source_change",
      mayScheduleNewWarm: true,
      reason: "SOURCE_VERSION_MISMATCH — live sourceVersion differs from failed attempt.",
    };
  }

  switch (input.failureClass) {
    case "PROVIDER_TIMEOUT":
    case "PROVIDER_INVALID_RESPONSE":
    case "PERSISTENCE_FAILED":
    case "SOURCE_UNAVAILABLE":
    case "MISSING_AFTER_DISPATCH":
      return {
        retryability: "retryable",
        mayScheduleNewWarm: true,
        reason: `${input.failureClass} is transient or pipeline-recoverable after code/hydrate fix.`,
      };
    case "PROVIDER_REJECTED":
    case "VALIDATION_FAILED":
    case "UNSUPPORTED_SOURCE":
      return {
        retryability: "non_retryable_until_code_or_content_change",
        mayScheduleNewWarm: false,
        reason: `${input.failureClass} requires content or code change before retry.`,
      };
    case "SOURCE_VERSION_MISMATCH":
      return {
        retryability: "retryable_after_source_change",
        mayScheduleNewWarm: true,
        reason: "New sourceVersion may be warmed; obsolete failure is not authoritative.",
      };
    default:
      return {
        retryability: "unknown",
        mayScheduleNewWarm: false,
        reason: "UNKNOWN failure — do not auto-clear; inspect outbox lastError class only.",
      };
  }
}
