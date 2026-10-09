/**
 * Same-version cumulative budget for INVALID_PROVIDER_PAYLOAD.
 *
 * Identity is sourceKind + sourceRecordId + targetLocale + sourceVersion.
 * localizationInputVersion is not required. Attempts are already scoped to
 * the source aggregate by the caller.
 *
 * Historical failures (no schema-era marker) that already reached the streak
 * cap before the structured-output contract shipped receive one recovery
 * enqueue. A later schema-era failure, or an attempt already stamped with
 * the recovery basis, does not grant another.
 *
 * EMPTY_TRANSLATION rows stored with deferred_semantic_retry share this
 * identity budget. They do not receive the pre-contract recovery enqueue.
 */

import { normalizeLanguageRegistryLocaleKey } from "@hu/types";

import {
  CONTENT_TRANSLATION_ARCHITECTURE_RETRY_BASIS,
  CONTENT_TRANSLATION_STRUCTURED_OUTPUT_CONTRACT,
  SEMANTIC_RESIDUAL_DEFER_RETRY_HINT,
  SEMANTIC_RESIDUAL_DEFER_STREAK_CAP,
  semanticResidualDeferDelayMs,
} from "./content-translation-failure-metadata.js";

export const INVALID_PROVIDER_PAYLOAD_REASON = "INVALID_PROVIDER_PAYLOAD" as const;

/**
 * Stored code for a Gemini empty-candidate response that was mapped to a
 * semantic terminal failure. Counted in this budget only with the defer hint.
 */
export const HISTORICAL_EMPTY_PROVIDER_REASON = "EMPTY_TRANSLATION" as const;

export const CT_STRUCTURED_OUTPUT_SCHEMA_RETRY_BASIS =
  CONTENT_TRANSLATION_ARCHITECTURE_RETRY_BASIS.CT_STRUCTURED_OUTPUT_SCHEMA_v1;

export type InvalidProviderPayloadRetryAttempt = {
  readonly status: "pending" | "published" | "failed";
  readonly architectureRetryBasis: string | null;
  readonly sourceVersion: string | null;
  readonly targetLocales: readonly string[] | null;
  readonly attemptAt: string;
  readonly failureReasonCode: string | null;
  readonly failureTargetLocale: string | null;
  /** Set on stored EMPTY_TRANSLATION rows that may share this budget. */
  readonly retryabilityHint?: string | null;
  readonly localeFailures?: readonly {
    readonly targetLocale: string;
    readonly failureReasonCode: string;
  }[] | null;
  readonly structuredOutputContract: string | null;
};

export type InvalidProviderPayloadRetryDecision =
  | { readonly outcome: "not_applicable"; readonly countedFailures: 0 }
  | {
      readonly outcome: "due";
      readonly countedFailures: number;
    }
  | {
      readonly outcome: "waiting";
      readonly countedFailures: number;
      readonly retryEligibleAt: string;
    }
  | {
      readonly outcome: "recover_once";
      readonly countedFailures: number;
      readonly architectureRetryBasis: typeof CT_STRUCTURED_OUTPUT_SCHEMA_RETRY_BASIS;
    }
  | { readonly outcome: "exhausted"; readonly countedFailures: number };

function sameLocale(left: string | null | undefined, right: string): boolean {
  if (!left || !right) {
    return false;
  }
  try {
    return normalizeLanguageRegistryLocaleKey(left) === normalizeLanguageRegistryLocaleKey(right);
  } catch {
    return left.trim() === right.trim();
  }
}

function payloadAttributedToLocale(
  attempt: InvalidProviderPayloadRetryAttempt,
  targetLocale: string,
): boolean {
  if (
    attempt.failureReasonCode === INVALID_PROVIDER_PAYLOAD_REASON &&
    sameLocale(attempt.failureTargetLocale, targetLocale)
  ) {
    return true;
  }
  if (
    attempt.localeFailures?.some(
      (row) =>
        row.failureReasonCode === INVALID_PROVIDER_PAYLOAD_REASON &&
        sameLocale(row.targetLocale, targetLocale),
    )
  ) {
    return true;
  }
  if (
    attempt.failureReasonCode === INVALID_PROVIDER_PAYLOAD_REASON &&
    !attempt.failureTargetLocale &&
    (!attempt.localeFailures || attempt.localeFailures.length === 0)
  ) {
    const locales = attempt.targetLocales ?? [];
    return locales.length === 1 && sameLocale(locales[0], targetLocale);
  }
  return false;
}

/**
 * Gemini empty-candidate failures persisted as EMPTY_TRANSLATION plus the
 * semantic defer hint. Other EMPTY_TRANSLATION rows stay outside this budget.
 */
function historicalEmptyProviderAttributed(
  attempt: InvalidProviderPayloadRetryAttempt,
  targetLocale: string,
): boolean {
  if (attempt.retryabilityHint !== SEMANTIC_RESIDUAL_DEFER_RETRY_HINT) {
    return false;
  }
  if (
    attempt.failureReasonCode === HISTORICAL_EMPTY_PROVIDER_REASON &&
    sameLocale(attempt.failureTargetLocale, targetLocale)
  ) {
    return true;
  }
  if (
    attempt.localeFailures?.some(
      (row) =>
        row.failureReasonCode === HISTORICAL_EMPTY_PROVIDER_REASON &&
        sameLocale(row.targetLocale, targetLocale),
    )
  ) {
    return true;
  }
  if (
    attempt.failureReasonCode === HISTORICAL_EMPTY_PROVIDER_REASON &&
    !attempt.failureTargetLocale &&
    (!attempt.localeFailures || attempt.localeFailures.length === 0)
  ) {
    const locales = attempt.targetLocales ?? [];
    return locales.length === 1 && sameLocale(locales[0], targetLocale);
  }
  return false;
}

function countsTowardPayloadBudget(
  attempt: InvalidProviderPayloadRetryAttempt,
  targetLocale: string,
): boolean {
  return (
    payloadAttributedToLocale(attempt, targetLocale) ||
    historicalEmptyProviderAttributed(attempt, targetLocale)
  );
}

function isSchemaEraAttempt(attempt: InvalidProviderPayloadRetryAttempt): boolean {
  return (
    attempt.structuredOutputContract === CONTENT_TRANSLATION_STRUCTURED_OUTPUT_CONTRACT ||
    attempt.architectureRetryBasis === CT_STRUCTURED_OUTPUT_SCHEMA_RETRY_BASIS
  );
}

function recoveryAlreadyGranted(
  attempt: InvalidProviderPayloadRetryAttempt,
  targetLocale: string,
  sourceVersion: string,
): boolean {
  if (attempt.architectureRetryBasis !== CT_STRUCTURED_OUTPUT_SCHEMA_RETRY_BASIS) {
    return false;
  }
  const version = attempt.sourceVersion?.trim() ?? "";
  if (version && version !== sourceVersion) {
    return false;
  }
  const locales = attempt.targetLocales ?? [];
  return locales.some((locale) => sameLocale(locale, targetLocale));
}

/**
 * Decide whether another provider call is allowed for this identity.
 * `attempts` must already belong to sourceKind + sourceRecordId.
 */
export function selectInvalidProviderPayloadRetry(input: {
  readonly sourceKind: string;
  readonly sourceRecordId: string;
  readonly targetLocale: string;
  readonly sourceVersion: string;
  readonly attempts: readonly InvalidProviderPayloadRetryAttempt[];
  readonly nowMs?: number;
}): InvalidProviderPayloadRetryDecision {
  const sourceKind = input.sourceKind.trim();
  const sourceRecordId = input.sourceRecordId.trim();
  const targetLocale = input.targetLocale.trim();
  const sourceVersion = input.sourceVersion.trim();
  if (!sourceKind || !sourceRecordId || !targetLocale || !sourceVersion) {
    return { outcome: "not_applicable", countedFailures: 0 };
  }

  const nowMs = input.nowMs ?? Date.now();
  const matching = input.attempts.filter(
    (attempt) =>
      attempt.status === "failed" &&
      (attempt.sourceVersion?.trim() ?? "") === sourceVersion &&
      countsTowardPayloadBudget(attempt, targetLocale),
  );
  const historical = matching.filter((attempt) => !isSchemaEraAttempt(attempt));
  const schemaEra = matching.filter((attempt) => isSchemaEraAttempt(attempt));
  const historicalPayload = historical.filter((attempt) =>
    payloadAttributedToLocale(attempt, targetLocale),
  );
  const historicalEmptyProvider = historical.filter((attempt) =>
    historicalEmptyProviderAttributed(attempt, targetLocale),
  );
  const countedFailures = historical.length + schemaEra.length;
  const recoveryGranted = input.attempts.some((attempt) =>
    recoveryAlreadyGranted(attempt, targetLocale, sourceVersion),
  );

  if (countedFailures === 0 && !recoveryGranted) {
    return { outcome: "not_applicable", countedFailures: 0 };
  }

  const cap = SEMANTIC_RESIDUAL_DEFER_STREAK_CAP;
  if (schemaEra.length >= cap || countedFailures >= cap) {
    const historicalPayloadOnlyExhausted =
      historicalPayload.length >= cap &&
      historicalEmptyProvider.length === 0 &&
      schemaEra.length === 0 &&
      !recoveryGranted;
    if (historicalPayloadOnlyExhausted) {
      return {
        outcome: "recover_once",
        countedFailures,
        architectureRetryBasis: CT_STRUCTURED_OUTPUT_SCHEMA_RETRY_BASIS,
      };
    }
    return { outcome: "exhausted", countedFailures };
  }

  if (recoveryGranted && historical.length >= cap && schemaEra.length === 0) {
    return { outcome: "exhausted", countedFailures };
  }

  const latestMs = matching.reduce((max, attempt) => {
    const parsed = Date.parse(attempt.attemptAt);
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, Number.NEGATIVE_INFINITY);
  if (Number.isFinite(latestMs)) {
    const eligibleAtMs = latestMs + semanticResidualDeferDelayMs(countedFailures);
    if (nowMs < eligibleAtMs) {
      return {
        outcome: "waiting",
        countedFailures,
        retryEligibleAt: new Date(eligibleAtMs).toISOString(),
      };
    }
  }

  return { outcome: "due", countedFailures };
}
