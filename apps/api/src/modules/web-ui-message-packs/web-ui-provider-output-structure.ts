import type { WebUiStructureFailureDiagnostic } from "@hu/types";

import {
  WebUiProviderPayloadShapeError,
  WebUiProviderSpanCountError,
} from "./web-ui-message-structure-protect.js";

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
 * 1 sends mixed plain strings and human-language span arrays.
 * 2 sends every leaf as an ordered span array and reopens checkpoints
 * blocked under an older shape.
 * 3 states the exact span count for each key and records that count on mismatch.
 * 4 also sends that count as Gemini responseSchema minItems/maxItems.
 * A structure_blocked checkpoint from an older shape reopens once under this
 * version. Its completed batches stay. A terminal block on this version does not.
 */
export const WEB_UI_PROVIDER_SHAPE_VERSION = 4;

const WEB_UI_ACTIVE_CHECKPOINT_PHASES = [
  "primary",
  "quality",
  "validating",
  "publishing",
  "provider_cooldown",
  "structure_retry",
] as const;

/**
 * Provider payload-shape and reconstructed-structure failures allowed for one
 * batch under one shape version. Counts provider responses, not pacing waits.
 * Generic, not locale-specific.
 */
export const WEB_UI_PROVIDER_SHAPE_STRUCTURE_FAILURE_BOUND = 6;

/**
 * Exhausted inner cycles allowed for one blocked streak, including the cycle
 * that first reached the inner bound. Cycle 2 may run after the outer backoff.
 * A third exhaustion does not schedule provider work.
 */
export const WEB_UI_STRUCTURE_RECOVERY_OUTER_MAX_CYCLES = 2;

/**
 * Durable wait after the first exhausted inner cycle, before the one later
 * same-version cycle. Separate from pacing, the inner ladder, and Gate E.
 */
export const WEB_UI_STRUCTURE_RECOVERY_BACKOFF_MS = 60 * 60 * 1000;

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

/**
 * Outer-cycle count for the current blocked streak.
 * A missing field on an already exhausted same-version block is cycle 1.
 * Any other missing field is 0. Does not read provider text.
 */
export function webUiStructureRecoveryCycleCount(record: {
  readonly phase?: string;
  readonly providerShapeVersion?: number | null;
  readonly providerShapeFailureCount?: number | null;
  readonly structureRetryCount?: number | null;
  readonly structureRecoveryCycleCount?: number | null;
}): number {
  if (typeof record.structureRecoveryCycleCount === "number") {
    return record.structureRecoveryCycleCount;
  }
  const sameOrNewerShape =
    (record.providerShapeVersion ?? 0) >= WEB_UI_PROVIDER_SHAPE_VERSION;
  const innerExhausted =
    (record.providerShapeFailureCount ?? 0) >= WEB_UI_PROVIDER_SHAPE_STRUCTURE_FAILURE_BOUND ||
    (record.structureRetryCount ?? 0) >= WEB_UI_PROVIDER_SHAPE_STRUCTURE_FAILURE_BOUND;
  if (record.phase === "structure_blocked" && sameOrNewerShape && innerExhausted) {
    return 1;
  }
  return 0;
}

/**
 * Same-version structure_blocked work that may still receive the one later cycle.
 * Cycle 2 is terminal. A block with no exhaustion evidence stays closed.
 */
export function isSameVersionStructureRecoveryOpen(record: {
  readonly phase: string;
  readonly providerShapeVersion?: number | null;
  readonly providerShapeFailureCount?: number | null;
  readonly structureRetryCount?: number | null;
  readonly structureRecoveryCycleCount?: number | null;
}): boolean {
  if (record.phase !== "structure_blocked") {
    return false;
  }
  if ((record.providerShapeVersion ?? 0) !== WEB_UI_PROVIDER_SHAPE_VERSION) {
    return false;
  }
  const cycle = webUiStructureRecoveryCycleCount(record);
  return cycle >= 1 && cycle < WEB_UI_STRUCTURE_RECOVERY_OUTER_MAX_CYCLES;
}

/**
 * Active phases stay recoverable. An older shape reopens immediately.
 * The current shape reopens only for an outer recovery cycle that is still open.
 */
export function isRecoverableWebUiActivationCheckpoint(record: {
  readonly phase: string;
  readonly providerShapeVersion?: number | null;
  readonly providerShapeFailureCount?: number | null;
  readonly structureRetryCount?: number | null;
  readonly structureRecoveryCycleCount?: number | null;
}): boolean {
  if ((WEB_UI_ACTIVE_CHECKPOINT_PHASES as readonly string[]).includes(record.phase)) {
    return true;
  }
  if (record.phase !== "structure_blocked") {
    return false;
  }
  if ((record.providerShapeVersion ?? 0) < WEB_UI_PROVIDER_SHAPE_VERSION) {
    return true;
  }
  return isSameVersionStructureRecoveryOpen(record);
}

export function incompleteWebUiActivationCheckpointMongoFilter(): Record<string, unknown> {
  return {
    $or: [
      { phase: { $in: [...WEB_UI_ACTIVE_CHECKPOINT_PHASES] } },
      {
        phase: "structure_blocked",
        $or: [
          { providerShapeVersion: { $exists: false } },
          { providerShapeVersion: null },
          { providerShapeVersion: { $lt: WEB_UI_PROVIDER_SHAPE_VERSION } },
          {
            providerShapeVersion: WEB_UI_PROVIDER_SHAPE_VERSION,
            structureRecoveryCycleCount: {
              $gte: 1,
              $lt: WEB_UI_STRUCTURE_RECOVERY_OUTER_MAX_CYCLES,
            },
          },
          {
            providerShapeVersion: WEB_UI_PROVIDER_SHAPE_VERSION,
            $and: [
              {
                $or: [
                  { structureRecoveryCycleCount: { $exists: false } },
                  { structureRecoveryCycleCount: null },
                ],
              },
              {
                $or: [
                  {
                    providerShapeFailureCount: {
                      $gte: WEB_UI_PROVIDER_SHAPE_STRUCTURE_FAILURE_BOUND,
                    },
                  },
                  {
                    structureRetryCount: {
                      $gte: WEB_UI_PROVIDER_SHAPE_STRUCTURE_FAILURE_BOUND,
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

const PROVIDER_SPAN_COUNT_MISMATCH =
  /^Provider span count \d+ does not match \d+\.$/;

/**
 * Classify a structure or payload-shape failure without keeping provider text.
 */
export function classifyWebUiStructureFailure(error: unknown): WebUiStructureFailureDiagnostic {
  const message = error instanceof Error ? error.message : "";
  if (
    message === "Provider span list must be an array of strings." ||
    message === "Provider translation value must be a string."
  ) {
    return diagnostic("provider_payload_type_mismatch");
  }
  if (error instanceof WebUiProviderSpanCountError || PROVIDER_SPAN_COUNT_MISMATCH.test(message)) {
    return spanCountDiagnostic(error);
  }
  if (
    message === "Protection extraction did not cover the message." ||
    message === "English source already contains a protection sentinel."
  ) {
    return diagnostic("deterministic_reconstruction_mismatch");
  }
  if (
    message === "Placeholders do not match English." ||
    message === "Localized placeholders do not match English."
  ) {
    return diagnostic("placeholder_mismatch");
  }
  if (
    message === "Message structure is unbalanced." ||
    message === "Localized message braces are unbalanced."
  ) {
    return diagnostic("icu_braces_mismatch");
  }
  if (
    message === "Rich-text tags do not match English." ||
    message === "Localized rich-text tags do not match English."
  ) {
    return diagnostic("tag_mismatch");
  }
  if (
    message === "Protection sentinels were reordered or renumbered." ||
    message === "Protection sentinel index is missing." ||
    message === "Unresolved protection sentinel remains." ||
    SENTINEL_COUNT_MISMATCH.test(message)
  ) {
    return diagnostic("protected_slot_mismatch");
  }
  return diagnostic("validation_failure_after_reconstruction");
}

function diagnostic(
  failureClass: WebUiStructureFailureDiagnostic["failureClass"],
): WebUiStructureFailureDiagnostic {
  return { failureClass, code: failureClass };
}

/**
 * The first leaf rejected in request order. Counts only — never span text.
 */
function spanCountDiagnostic(error: unknown): WebUiStructureFailureDiagnostic {
  if (!(error instanceof WebUiProviderSpanCountError)) {
    return diagnostic("provider_span_count_mismatch");
  }
  return {
    failureClass: "provider_span_count_mismatch",
    code: "provider_span_count_mismatch",
    catalogKey: error.catalogKey,
    expectedSpanCount: error.expectedSpanCount,
    actualSpanCount: error.actualSpanCount,
  };
}

/**
 * Provider returned the wrong JSON type or the wrong span-array length.
 * The payload stays invalid. Recovery is a later paced request, not truncation.
 */
export function isRecoverableWebUiProviderPayloadShapeMessage(
  message: string,
): boolean {
  return (
    message === "Provider span list must be an array of strings." ||
    message === "Provider translation value must be a string." ||
    PROVIDER_SPAN_COUNT_MISMATCH.test(message)
  );
}

export function isRecoverableWebUiProviderPayloadShapeFailure(error: unknown): boolean {
  if (error instanceof WebUiProviderPayloadShapeError) return true;
  return (
    error instanceof Error &&
    isRecoverableWebUiProviderPayloadShapeMessage(error.message)
  );
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
