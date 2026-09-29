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
  | "TERMINOLOGY_PROTECTION_VIOLATION"
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
  /**
   * F.3.19 — earliest time this source version may be selected again after a
   * semantic/validity rejection. Stored on the outbox lastError. Not a Gate E
   * provider cooldown and not a completion marker.
   */
  readonly retryEligibleAt?: string | null;
  /** Localization input version at the failed attempt, when known. */
  readonly localizationInputVersion?: string | null;
};

const META_PREFIX = "CT_FAIL_META_V1:";

export class ContentTranslationValidationError extends TranslationProviderError {
  readonly reasonCode: ContentTranslationValidationReasonCode;

  readonly localizationInputVersion: string | null;

  constructor(
    reasonCode: ContentTranslationValidationReasonCode,
    message: string,
    providerCode: "bad_request" | "malformed_response" = "bad_request",
    localizationInputVersion: string | null = null,
  ) {
    super(providerCode, message);
    this.name = "ContentTranslationValidationError";
    this.reasonCode = reasonCode;
    this.localizationInputVersion = localizationInputVersion;
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
      ...(typeof raw.retryEligibleAt === "string" && raw.retryEligibleAt.length > 0
        ? { retryEligibleAt: raw.retryEligibleAt }
        : {}),
      ...(typeof raw.localizationInputVersion === "string" && raw.localizationInputVersion.length > 0
        ? { localizationInputVersion: raw.localizationInputVersion }
        : {}),
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
 * Same-version structural/semantic failures. These stay terminal even when a
 * fallback reason or a retryable hint is also present.
 */
export const WARM_SAME_VERSION_TERMINAL_VALIDATION_REASONS = [
  "UNCHANGED_SOURCE_PROSE",
  "UNCHANGED_CIVIC_TITLE",
  "EMPTY_TRANSLATION",
  "MISSING_REQUIRED_PATH",
  "INVALID_RICH_TEXT_STRUCTURE",
  "OTHER_VALIDATION_FAILURE",
  "UNEXPECTED_PATH",
  "STRUCTURE_MISMATCH",
  "TARGET_LANGUAGE_MISMATCH",
  "TERMINOLOGY_PROTECTION_VIOLATION",
] as const;

/**
 * Semantic/validity rejections. These are not provider transport failures and
 * must not arm Gate E. Selection uses a bounded residual defer instead.
 */
export const SEMANTIC_RESIDUAL_DEFER_REASON_CODES = [
  "TERMINOLOGY_PROTECTION_VIOLATION",
  "UNCHANGED_SOURCE_PROSE",
  "UNCHANGED_CIVIC_TITLE",
  "EMPTY_TRANSLATION",
  "INVALID_RICH_TEXT_STRUCTURE",
  "MISSING_REQUIRED_PATH",
  "UNEXPECTED_PATH",
  "STRUCTURE_MISMATCH",
  "TARGET_LANGUAGE_MISMATCH",
  "OTHER_VALIDATION_FAILURE",
] as const;

export type SemanticResidualDeferReasonCode =
  (typeof SEMANTIC_RESIDUAL_DEFER_REASON_CODES)[number];

/** First semantic rejection waits 10 minutes; the delay doubles per same-version streak. */
export const SEMANTIC_RESIDUAL_DEFER_BASE_MS = 10 * 60 * 1000;
/** Cap so a failing identity becomes eligible again and is never skipped forever. */
export const SEMANTIC_RESIDUAL_DEFER_MAX_MS = 6 * 60 * 60 * 1000;
export const SEMANTIC_RESIDUAL_DEFER_STREAK_CAP = 8;

export const SEMANTIC_RESIDUAL_DEFER_RETRY_HINT = "deferred_semantic_retry";

export function isSemanticResidualDeferReason(
  reasonCode: string | null | undefined,
): reasonCode is SemanticResidualDeferReasonCode {
  return (
    typeof reasonCode === "string" &&
    (SEMANTIC_RESIDUAL_DEFER_REASON_CODES as readonly string[]).includes(reasonCode)
  );
}

/**
 * Bounded backoff. Streak 1 = 10 minutes, then 20, 40, 80, 160, 320 minutes,
 * capped at 6 hours. The identity remains residual work for the whole window.
 */
export function semanticResidualDeferDelayMs(streak: number): number {
  const bounded = Math.min(
    SEMANTIC_RESIDUAL_DEFER_STREAK_CAP,
    Math.max(1, Math.floor(streak)),
  );
  const delay = SEMANTIC_RESIDUAL_DEFER_BASE_MS * 2 ** (bounded - 1);
  return Math.min(SEMANTIC_RESIDUAL_DEFER_MAX_MS, delay);
}

export function semanticResidualRetryEligibleAtIso(input: {
  readonly failedAtMs: number;
  readonly streak: number;
}): string {
  return new Date(input.failedAtMs + semanticResidualDeferDelayMs(input.streak)).toISOString();
}

/**
 * Selection skip. Inactive when the source version changed, when both recorded
 * localization input versions differ, or when retryEligibleAt has passed.
 */
export function isSemanticResidualDeferActive(input: {
  readonly metadata: ContentTranslationSafeFailureMetadata | null;
  readonly liveSourceVersion: string | null;
  readonly liveLocalizationInputVersion?: string | null;
  readonly nowMs?: number;
}): boolean {
  const meta = input.metadata;
  if (!meta?.retryEligibleAt || !isSemanticResidualDeferReason(meta.failureReasonCode)) {
    return false;
  }
  if (
    input.liveSourceVersion &&
    meta.sourceVersion &&
    meta.sourceVersion !== input.liveSourceVersion
  ) {
    return false;
  }
  if (
    input.liveLocalizationInputVersion &&
    meta.localizationInputVersion &&
    meta.localizationInputVersion !== input.liveLocalizationInputVersion
  ) {
    return false;
  }
  const eligibleAt = Date.parse(meta.retryEligibleAt);
  if (!Number.isFinite(eligibleAt)) {
    return false;
  }
  return eligibleAt > (input.nowMs ?? Date.now());
}

/**
 * A current presentation-eligible replacement is not deferred.
 * Defer applies only to a residual that is otherwise selectable.
 */
export function shouldDeferResidualSelection(input: {
  readonly ready: boolean;
  readonly metadata: ContentTranslationSafeFailureMetadata | null;
  readonly liveSourceVersion: string | null;
  readonly liveLocalizationInputVersion?: string | null;
  readonly nowMs?: number;
}): boolean {
  if (!input.ready) {
    return false;
  }
  return isSemanticResidualDeferActive(input);
}

const WARM_RETRYABLE_INFRASTRUCTURE_CLASSES = new Set([
  "PROVIDER_TIMEOUT",
  "PROVIDER_INVALID_RESPONSE",
  "PERSISTENCE_FAILED",
  "MISSING_AFTER_DISPATCH",
  "SOURCE_UNAVAILABLE",
]);

const WARM_CONSERVATIVE_TERMINAL_CLASSES = new Set([
  "PROVIDER_REJECTED",
  "VALIDATION_FAILED",
  "UNSUPPORTED_SOURCE",
]);

export type SameVersionWarmFailureRetryDecision = "retryable" | "terminal";

function isWarmFailureReasonFallback(reason: string | null | undefined): boolean {
  return reason == null || reason.trim() === "" || reason === "UNKNOWN_LEGACY";
}

/**
 * Canonical same-version retry decision.
 * Structured infrastructure classes and an explicit retryable hint win over
 * UNKNOWN_LEGACY. Validation reason codes stay terminal. Missing evidence stays terminal.
 */
export function decideSameVersionWarmFailureRetry(input: {
  readonly failureClass: string | null;
  readonly failureReasonCode: string | null;
  readonly retryabilityHint?: string | null;
}): SameVersionWarmFailureRetryDecision {
  const reason = input.failureReasonCode;
  if (
    reason != null &&
    (WARM_SAME_VERSION_TERMINAL_VALIDATION_REASONS as readonly string[]).includes(reason)
  ) {
    return "terminal";
  }
  if (input.failureClass != null && WARM_RETRYABLE_INFRASTRUCTURE_CLASSES.has(input.failureClass)) {
    return "retryable";
  }
  if (reason === "INVALID_PROVIDER_PAYLOAD") {
    return "retryable";
  }
  if (
    input.retryabilityHint === "retryable" &&
    isWarmFailureReasonFallback(reason) &&
    !(input.failureClass != null && WARM_CONSERVATIVE_TERMINAL_CLASSES.has(input.failureClass))
  ) {
    return "retryable";
  }
  return "terminal";
}

/**
 * Modern failures that may be retried for the same sourceVersion.
 * Delegates to decideSameVersionWarmFailureRetry so preflight and materialization
 * policy do not keep separate lists.
 */
export function isExplicitlyRetryableModernFailure(input: {
  readonly failureClass: string | null;
  readonly failureReasonCode: string | null;
  readonly retryabilityHint?: string | null;
}): boolean {
  return decideSameVersionWarmFailureRetry(input) === "retryable";
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
