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
  /** Pack 08K.2.6 — one-time diagnostic retry of pre-08K.2.5 collapsed VALIDATION_FAILED. */
  EXACT_FAILURE_REASON_PROPAGATION_08K25: "EXACT_FAILURE_REASON_PROPAGATION_08K25",
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

export type ContentTranslationLocaleFailureRecord = {
  readonly targetLocale: LanguageCode | string;
  readonly failureClass: string;
  readonly failureReasonCode: ContentTranslationValidationReasonCode | string;
  readonly retryabilityHint: string | null;
};

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
  /**
   * Pack 08K.2.3 — per-locale terminal outcomes when a presentation warm
   * fans out multiple locales. Never includes bodies/prompts/secrets.
   */
  readonly localeFailures?: readonly ContentTranslationLocaleFailureRecord[];
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

/**
 * Pack 08K.2.5 — never persist the generic string "VALIDATION_FAILED" as a
 * failureReasonCode. That string is a failureClass only.
 * Unclassified / collapsed codes become OTHER_VALIDATION_FAILURE.
 */
export function normalizeExactValidationReasonCode(
  reasonCode: string | null | undefined,
  fallback: ContentTranslationValidationReasonCode = "OTHER_VALIDATION_FAILURE",
): string {
  if (
    reasonCode == null ||
    reasonCode === "" ||
    reasonCode === "VALIDATION_FAILED"
  ) {
    return fallback;
  }
  return reasonCode;
}

/**
 * Resolve a persisted reason code from materialization classification.
 * Never returns the generic reasonCode "VALIDATION_FAILED".
 */
export function resolvePersistedFailureReasonCode(input: {
  readonly failureReasonCode: string | null | undefined;
  readonly failureClass: string;
}): string {
  const normalized = normalizeExactValidationReasonCode(
    input.failureReasonCode,
    input.failureClass === "PROVIDER_INVALID_RESPONSE"
      ? "INVALID_PROVIDER_PAYLOAD"
      : input.failureClass === "VALIDATION_FAILED"
        ? "OTHER_VALIDATION_FAILURE"
        : "UNKNOWN_LEGACY",
  );
  return normalized;
}

export function encodeContentTranslationFailureMetadata(
  meta: ContentTranslationSafeFailureMetadata,
): string {
  const failureReasonCode = normalizeExactValidationReasonCode(
    meta.failureReasonCode,
  );
  const localeFailures = meta.localeFailures?.map((row) => ({
    ...row,
    failureReasonCode: normalizeExactValidationReasonCode(row.failureReasonCode),
  }));
  const encoded: ContentTranslationSafeFailureMetadata = {
    ...meta,
    failureReasonCode,
    ...(localeFailures?.length ? { localeFailures } : {}),
  };
  return `${META_PREFIX}${JSON.stringify(encoded)}`;
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
    const localeFailures = Array.isArray(raw.localeFailures)
      ? raw.localeFailures
          .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
          .map((row) => ({
            targetLocale:
              typeof row.targetLocale === "string" ? row.targetLocale : "",
            failureClass:
              typeof row.failureClass === "string" ? row.failureClass : "UNKNOWN",
            failureReasonCode:
              typeof row.failureReasonCode === "string"
                ? row.failureReasonCode
                : "UNKNOWN_LEGACY",
            retryabilityHint:
              typeof row.retryabilityHint === "string" ? row.retryabilityHint : null,
          }))
          .filter((row) => row.targetLocale.length > 0)
      : undefined;
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
      ...(localeFailures?.length ? { localeFailures } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * Resolve locale-specific failure fields from CT_FAIL_META_V1 (or null).
 */
export function resolveLocaleFailureFromMetadata(
  meta: ContentTranslationSafeFailureMetadata | null,
  targetLocale: LanguageCode | string,
): {
  readonly failureClass: string | null;
  readonly failureReasonCode: string | null;
  readonly retryabilityHint: string | null;
  readonly failedAt: string | null;
  readonly attributed: boolean;
} {
  if (!meta) {
    return {
      failureClass: null,
      failureReasonCode: null,
      retryabilityHint: null,
      failedAt: null,
      attributed: false,
    };
  }
  const locale = String(targetLocale);
  const fromList = meta.localeFailures?.find((row) => row.targetLocale === locale);
  if (fromList) {
    return {
      failureClass: fromList.failureClass,
      failureReasonCode: fromList.failureReasonCode,
      retryabilityHint: fromList.retryabilityHint,
      failedAt: meta.failedAt || null,
      attributed: true,
    };
  }
  if (meta.targetLocale === null || meta.targetLocale === locale) {
    return {
      failureClass: meta.failureClass,
      failureReasonCode: meta.failureReasonCode,
      retryabilityHint: meta.retryabilityHint,
      failedAt: meta.failedAt || null,
      attributed: true,
    };
  }
  return {
    failureClass: null,
    failureReasonCode: null,
    retryabilityHint: null,
    failedAt: meta.failedAt || null,
    attributed: false,
  };
}

/**
 * Modern terminal codes that may be retried under an explicit policy only.
 */
export function isExplicitlyRetryableModernFailure(input: {
  readonly failureClass: string | null;
  readonly failureReasonCode: string | null;
}): boolean {
  if (input.failureClass === "SOURCE_UNAVAILABLE") {
    return true;
  }
  if (input.failureReasonCode === "INVALID_PROVIDER_PAYLOAD") {
    return true;
  }
  return false;
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
