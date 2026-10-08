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
 */

import { normalizeLanguageRegistryLocaleKey } from "@hu/types";

import {
  CONTENT_TRANSLATION_ARCHITECTURE_RETRY_BASIS,
  CONTENT_TRANSLATION_STRUCTURED_OUTPUT_CONTRACT,
  SEMANTIC_RESIDUAL_DEFER_STREAK_CAP,
  semanticResidualDeferDelayMs,
} from "./content-translation-failure-metadata.js";

export const INVALID_PROVIDER_PAYLOAD_REASON = "INVALID_PROVIDER_PAYLOAD" as const;

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
      payloadAttributedToLocale(attempt, targetLocale),
  );
  const historical = matching.filter((attempt) => !isSchemaEraAttempt(attempt));
  const schemaEra = matching.filter((attempt) => isSchemaEraAttempt(attempt));
  const countedFailures = historical.length + schemaEra.length;
  const recoveryGranted = input.attempts.some((attempt) =>
    recoveryAlreadyGranted(attempt, targetLocale, sourceVersion),
  );

  if (countedFailures === 0 && !recoveryGranted) {
    return { outcome: "not_applicable", countedFailures: 0 };
  }

  const cap = SEMANTIC_RESIDUAL_DEFER_STREAK_CAP;
  if (schemaEra.length >= cap || countedFailures >= cap) {
    const historicalOnlyExhausted =
      historical.length >= cap && schemaEra.length === 0 && !recoveryGranted;
    if (historicalOnlyExhausted) {
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
