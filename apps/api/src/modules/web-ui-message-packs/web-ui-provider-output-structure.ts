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
 */
export const WEB_UI_PROVIDER_SHAPE_VERSION = 3;

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
 * Active phases stay recoverable. structure_blocked is recoverable only when
 * the deployed shape version is newer than the version that exhausted the bound.
 */
export function isRecoverableWebUiActivationCheckpoint(record: {
  readonly phase: string;
  readonly providerShapeVersion?: number | null;
}): boolean {
  if ((WEB_UI_ACTIVE_CHECKPOINT_PHASES as readonly string[]).includes(record.phase)) {
    return true;
  }
  if (record.phase !== "structure_blocked") {
    return false;
  }
  return (record.providerShapeVersion ?? 0) < WEB_UI_PROVIDER_SHAPE_VERSION;
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
