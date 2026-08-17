/**
 * Lifecycle Finalization Phase 02 addendum — optional lifecycle artifact lookup.
 *
 * Explicit outcomes (do not collapse these):
 * - ABSENT / NOT_CREATED_YET — promise resolved to null/empty (normal)
 * - PRESENT — promise resolved with a value
 * - INFRASTRUCTURE_FAILURE — promise rejected (provider/DB failure)
 *
 * Optional Mongo-only stage reads must not 500 the public Experience shell,
 * but infrastructure failure must NOT be reported as normal absence.
 *
 * Required Initiative identity / core projection paths must not use this helper.
 */

import { logger } from "../observability/logger.js";

export type OptionalLifecycleLookupClassification =
  | "PRESENT"
  | "ABSENT"
  | "NOT_CREATED_YET"
  | "INFRASTRUCTURE_FAILURE";

export interface OptionalLifecycleLookupResult<T> {
  readonly classification: OptionalLifecycleLookupClassification;
  /** Present when classification is PRESENT; otherwise null/fallback. */
  readonly value: T | null;
  /**
   * True only for INFRASTRUCTURE_FAILURE — Experience may continue, but the
   * section must be marked unavailable/degraded (not "not created yet").
   */
  readonly degraded: boolean;
  /** Public-safe reason code — never a raw stack/provider message. */
  readonly reasonCode: "not_created_yet" | "infrastructure_failure" | null;
}

function isAbsentValue<T>(value: T, absentSentinel: T): boolean {
  return value === absentSentinel || value === null || value === undefined;
}

/**
 * Settle an optional lifecycle lookup with explicit classification.
 * `absentSentinel` is the value that means "not created yet" (usually `null`).
 */
export async function settleOptionalLifecycleLookup<T>(
  label: string,
  promise: Promise<T>,
  absentSentinel: T,
): Promise<OptionalLifecycleLookupResult<T>> {
  try {
    const value = await promise;

    if (isAbsentValue(value, absentSentinel)) {
      return {
        classification: "NOT_CREATED_YET",
        value: null,
        degraded: false,
        reasonCode: "not_created_yet",
      };
    }

    return {
      classification: "PRESENT",
      value,
      degraded: false,
      reasonCode: null,
    };
  } catch (error) {
    logger.error("lifecycle.optional_lookup_infrastructure_failure", {
      label,
      classification: "INFRASTRUCTURE_FAILURE",
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      classification: "INFRASTRUCTURE_FAILURE",
      value: null,
      degraded: true,
      reasonCode: "infrastructure_failure",
    };
  }
}

/**
 * @deprecated Prefer {@link settleOptionalLifecycleLookup} which preserves
 * infrastructure-failure classification. This wrapper returns only the value
 * and must not be used when callers need absence vs infra distinction.
 */
export async function settleOptionalLookup<T>(
  label: string,
  promise: Promise<T>,
  fallback: T,
): Promise<T> {
  const settled = await settleOptionalLifecycleLookup(label, promise, fallback);
  if (settled.classification === "PRESENT") {
    return settled.value as T;
  }
  return fallback;
}
