/**
 * Pack 08K.2.1 — safe content-translation failure metadata + validation reason codes.
 *
 * Never includes source/translated bodies, prompts, or secrets.
 */

import type { ContentTranslationSourceKind, LanguageCode } from "@hu/types";

import { TranslationProviderError } from "./translation.config.js";

/** Bumped when validation/diagnostics contract changes in a retry-relevant way. */
export const CONTENT_TRANSLATION_VALIDATION_CONTRACT_VERSION = "v1" as const;

/**
 * Architecture basis strings that may unlock historical retries.
 * Do not invent bases without a matching code condition.
 */
export const CONTENT_TRANSLATION_ARCHITECTURE_RETRY_BASIS = {
  HISTORICAL_FAILURE_SEMANTICS_UNKNOWN_LEGACY_v1:
    "HISTORICAL_FAILURE_SEMANTICS_UNKNOWN_LEGACY_v1",
  VALIDATION_DIAGNOSTICS_CONTRACT_v1: "VALIDATION_DIAGNOSTICS_CONTRACT_v1",
  COLLECTIVE_DECISION_HYDRATE_SYNC_08K2: "COLLECTIVE_DECISION_HYDRATE_SYNC_08K2",
} as const;

export type ContentTranslationArchitectureRetryBasis =
  (typeof CONTENT_TRANSLATION_ARCHITECTURE_RETRY_BASIS)[keyof typeof CONTENT_TRANSLATION_ARCHITECTURE_RETRY_BASIS];

/**
 * Validation reason codes — each maps to a concrete validator condition.
 */
export type ContentTranslationValidationReasonCode =
  | "UNCHANGED_SOURCE_PROSE"
  | "UNCHANGED_CIVIC_TITLE"
  | "EMPTY_TRANSLATION"
  | "INVALID_PROVIDER_PAYLOAD"
  | "INVALID_RICH_TEXT_STRUCTURE"
  | "MISSING_REQUIRED_PATH"
  | "UNEXPECTED_PATH"
  | "STRUCTURE_MISMATCH"
  | "TARGET_LANGUAGE_MISMATCH"
  | "OTHER_VALIDATION_FAILURE"
  | "UNKNOWN_LEGACY";

export type ContentTranslationSafeFailureMetadata = {
  readonly schema: "content_translation_failure_meta_v1";
  readonly validationContractVersion: typeof CONTENT_TRANSLATION_VALIDATION_CONTRACT_VERSION;
  readonly failureClass: string;
  readonly failureReasonCode: ContentTranslationValidationReasonCode | string;
  readonly sourceKind: ContentTranslationSourceKind | string;
  readonly sourceRecordId: string;
  readonly sourceVersion: string | null;
  readonly targetLocale: LanguageCode | string | null;
  readonly failedAt: string;
  readonly retryabilityHint: string | null;
};

const META_PREFIX = "CT_FAIL_META_V1:";

export class ContentTranslationValidationError extends TranslationProviderError {
  readonly reasonCode: ContentTranslationValidationReasonCode;

  constructor(
    reasonCode: ContentTranslationValidationReasonCode,
    message: string,
    providerCode: "bad_request" | "malformed_response" = "bad_request",
  ) {
    super(providerCode, message);
    this.name = "ContentTranslationValidationError";
    this.reasonCode = reasonCode;
  }
}

export function encodeContentTranslationFailureMetadata(
  meta: ContentTranslationSafeFailureMetadata,
): string {
  return `${META_PREFIX}${JSON.stringify(meta)}`;
}

export function parseContentTranslationFailureMetadata(
  lastError: string | null | undefined,
): ContentTranslationSafeFailureMetadata | null {
  if (typeof lastError !== "string" || !lastError.startsWith(META_PREFIX)) {
    return null;
  }
  try {
    const raw = JSON.parse(lastError.slice(META_PREFIX.length)) as Record<string, unknown>;
    if (raw.schema !== "content_translation_failure_meta_v1") {
      return null;
    }
    return {
      schema: "content_translation_failure_meta_v1",
      validationContractVersion:
        typeof raw.validationContractVersion === "string"
          ? (raw.validationContractVersion as typeof CONTENT_TRANSLATION_VALIDATION_CONTRACT_VERSION)
          : CONTENT_TRANSLATION_VALIDATION_CONTRACT_VERSION,
      failureClass: typeof raw.failureClass === "string" ? raw.failureClass : "UNKNOWN",
      failureReasonCode:
        typeof raw.failureReasonCode === "string" ? raw.failureReasonCode : "UNKNOWN_LEGACY",
      sourceKind: typeof raw.sourceKind === "string" ? raw.sourceKind : "unknown",
      sourceRecordId: typeof raw.sourceRecordId === "string" ? raw.sourceRecordId : "",
      sourceVersion: typeof raw.sourceVersion === "string" ? raw.sourceVersion : null,
      targetLocale: typeof raw.targetLocale === "string" ? raw.targetLocale : null,
      failedAt: typeof raw.failedAt === "string" ? raw.failedAt : "",
      retryabilityHint: typeof raw.retryabilityHint === "string" ? raw.retryabilityHint : null,
    };
  } catch {
    return null;
  }
}

/**
 * Map a thrown error onto a safe validation reason code when applicable.
 */
export function resolveValidationReasonCodeFromError(
  error: unknown,
): ContentTranslationValidationReasonCode | null {
  if (error instanceof ContentTranslationValidationError) {
    return error.reasonCode;
  }
  if (!(error instanceof TranslationProviderError)) {
    return null;
  }
  if (error.code === "malformed_response") {
    const message = error.message.toLowerCase();
    if (message.includes("malformed structured")) {
      return "INVALID_PROVIDER_PAYLOAD";
    }
    if (message.includes("civic title") || message.includes("heading field")) {
      return "UNCHANGED_CIVIC_TITLE";
    }
    if (message.includes("unchanged source")) {
      return "UNCHANGED_SOURCE_PROSE";
    }
    if (message.includes("empty")) {
      return "EMPTY_TRANSLATION";
    }
    return "INVALID_PROVIDER_PAYLOAD";
  }
  if (error.code === "bad_request") {
    const message = error.message.toLowerCase();
    if (message.includes("source content was not found")) {
      return null;
    }
    if (message.includes("without current materialization")) {
      return "UNKNOWN_LEGACY";
    }
    return "OTHER_VALIDATION_FAILURE";
  }
  return null;
}

/**
 * Classify a raw outbox lastError string when structured metadata is absent.
 */
export function classifyLegacyOutboxLastError(lastError: string | null | undefined): {
  readonly failureClass: string;
  readonly failureReasonCode: ContentTranslationValidationReasonCode;
} {
  const message = (lastError ?? "").toLowerCase();
  if (!message) {
    return { failureClass: "UNKNOWN", failureReasonCode: "UNKNOWN_LEGACY" };
  }
  if (message.includes("source unavailable")) {
    return { failureClass: "SOURCE_UNAVAILABLE", failureReasonCode: "UNKNOWN_LEGACY" };
  }
  if (message.includes("timeout")) {
    return { failureClass: "PROVIDER_TIMEOUT", failureReasonCode: "UNKNOWN_LEGACY" };
  }
  if (message.includes("malformed")) {
    return { failureClass: "PROVIDER_INVALID_RESPONSE", failureReasonCode: "INVALID_PROVIDER_PAYLOAD" };
  }
  if (
    message.includes("without current materialization") ||
    message.includes("validation") ||
    message.includes("prose") ||
    message.includes("title") ||
    message.includes("bad_request")
  ) {
    // Pack 08K.2.1 — pre-metadata terminal warm failures collapse to UNKNOWN_LEGACY.
    return { failureClass: "VALIDATION_FAILED", failureReasonCode: "UNKNOWN_LEGACY" };
  }
  return { failureClass: "UNKNOWN", failureReasonCode: "UNKNOWN_LEGACY" };
}
