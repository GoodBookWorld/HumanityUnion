/**
 * Pure classification for the temporary ka residual identity diagnostic.
 * No Mongo, no provider, no enqueue.
 */

import { classifyLiveResidualIdentity } from "../modules/language/live-residual-identity.js";

export const KA_RESIDUAL_DIAGNOSTIC_LOCALE = "ka" as const;

export const KA_RESIDUAL_DIAGNOSTIC_KINDS = [
  "initiative",
  "discussion_comment",
  "improvement_proposal",
  "initiative_revision",
  "decision_session",
  "collective_decision",
  "implementation_commitment",
  "implementation_tracking",
] as const;

export type KaResidualDiagnosticKind = (typeof KA_RESIDUAL_DIAGNOSTIC_KINDS)[number];

export const KA_RESIDUAL_DIAGNOSTIC_REQUIRED_DATABASE = "humanity_union_staging";

export type KaResidualOperationalBucket =
  | "currentExactLiveVersion"
  | "retryReadyMissing"
  | "retryReadyStale"
  | "blockedFailedAttempt"
  | "sourceOrPreflightBlocked";

export interface KaResidualKindCounts {
  liveEligible: number;
  currentExactLiveVersion: number;
  retryReadyMissing: number;
  retryReadyStale: number;
  blockedFailedAttempt: number;
  sourceOrPreflightBlocked: number;
  historicalStaleButLiveCurrent: number;
}

export function emptyKaResidualKindCounts(): KaResidualKindCounts {
  return {
    liveEligible: 0,
    currentExactLiveVersion: 0,
    retryReadyMissing: 0,
    retryReadyStale: 0,
    blockedFailedAttempt: 0,
    sourceOrPreflightBlocked: 0,
    historicalStaleButLiveCurrent: 0,
  };
}

export function isKaResidualDiagnosticKind(
  sourceKind: string,
): sourceKind is KaResidualDiagnosticKind {
  return (KA_RESIDUAL_DIAGNOSTIC_KINDS as readonly string[]).includes(sourceKind);
}

/**
 * One live activation candidate. Historical stale rows are not a bucket when
 * the exact live sourceVersion is already CURRENT.
 */
export function classifyKaResidualIdentity(input: {
  readonly liveCurrent: boolean;
  readonly liveStale: boolean;
  readonly preflightReady: boolean;
  readonly readyState: string;
  readonly terminalFailureForCurrentVersion: boolean;
}): KaResidualOperationalBucket {
  const bucket = classifyLiveResidualIdentity(input);
  switch (bucket) {
    case "CURRENT":
      return "currentExactLiveVersion";
    case "RETRY_READY_MISSING":
      return "retryReadyMissing";
    case "RETRY_READY_STALE":
      return "retryReadyStale";
    case "BLOCKED_FAILED_ATTEMPT":
      return "blockedFailedAttempt";
    default:
      return "sourceOrPreflightBlocked";
  }
}

export function assertKaResidualDiagnosticSafetyGate(input: {
  readonly nodeEnv: string | undefined;
  readonly mongoDatabase: string | undefined;
  readonly readOnlyFlag: string | undefined;
}): { readonly ok: true } | { readonly ok: false; readonly refusalMessage: string } {
  if (input.readOnlyFlag !== "1") {
    return {
      ok: false,
      refusalMessage:
        "REFUSED: HU_READ_ONLY_DIAGNOSTIC=1 is required so seed, enqueue, and provider paths fail closed.",
    };
  }
  if (input.nodeEnv !== "production") {
    return {
      ok: false,
      refusalMessage: "REFUSED: diagnose-ka-residual-identities requires NODE_ENV=production.",
    };
  }
  const database = input.mongoDatabase?.trim() ?? "";
  if (database !== KA_RESIDUAL_DIAGNOSTIC_REQUIRED_DATABASE) {
    return {
      ok: false,
      refusalMessage: `REFUSED: database must be ${KA_RESIDUAL_DIAGNOSTIC_REQUIRED_DATABASE} (got ${database || "(unset)"}).`,
    };
  }
  return { ok: true };
}

const SAFE_FAILURE_CLASSES = new Set([
  "PROVIDER_REJECTED",
  "PROVIDER_TIMEOUT",
  "PROVIDER_INVALID_RESPONSE",
  "VALIDATION_FAILED",
  "SOURCE_UNAVAILABLE",
  "SOURCE_VERSION_MISMATCH",
  "PERSISTENCE_FAILED",
  "UNSUPPORTED_SOURCE",
  "MISSING_AFTER_DISPATCH",
  "UNKNOWN",
]);

const SAFE_RETRY_HINTS = new Set([
  "retryable",
  "retryable_after_source_change",
  "non_retryable_until_code_or_content_change",
  "unknown",
]);

const SAFE_ATTEMPT_REASONS = new Set([
  "public_mutation",
  "public_update",
  "operator_manual",
  "operator_backfill",
  "operator_residual_retry",
  "search_discovery_enable",
]);

function normalizeDiagnosticVersion(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed === "unloaded") {
    return null;
  }
  return trimmed;
}

export type KaBlockedAttemptVersionProvenance =
  | "failure_metadata"
  | "command_payload"
  | "none";

/**
 * Where the blocked attempt's sourceVersion was read from.
 * Never copies the live sourceVersion onto the attempt.
 * Metadata wins over the warm-command payload, matching resolveWarmAttemptSourceVersion.
 */
export function classifyBlockedAttemptVersionProvenance(input: {
  readonly metadataSourceVersion: string | null | undefined;
  readonly resolvedAttemptSourceVersion: string | null | undefined;
  readonly liveSourceVersion: string | null | undefined;
}): {
  readonly provenance: KaBlockedAttemptVersionProvenance;
  readonly versionEqualsLive: boolean;
} {
  const metadata = normalizeDiagnosticVersion(input.metadataSourceVersion);
  const resolved = normalizeDiagnosticVersion(input.resolvedAttemptSourceVersion);
  const live = normalizeDiagnosticVersion(input.liveSourceVersion);
  const provenance: KaBlockedAttemptVersionProvenance = metadata
    ? "failure_metadata"
    : resolved
      ? "command_payload"
      : "none";
  const owned = metadata ?? resolved;
  return {
    provenance,
    versionEqualsLive: Boolean(owned && live && owned === live),
  };
}

export function safeDiagnosticToken(
  value: string | null | undefined,
  allow: ReadonlySet<string>,
): string {
  if (typeof value !== "string") {
    return "absent";
  }
  return allow.has(value) ? value : "unlisted";
}

export function classifyBlockedAttemptLastErrorShape(
  lastError: string | null | undefined,
): "structured_metadata" | "unstructured" | "empty" {
  if (typeof lastError !== "string" || lastError.trim().length === 0) {
    return "empty";
  }
  if (lastError.startsWith("CT_FAIL_META_V1:")) {
    return "structured_metadata";
  }
  return "unstructured";
}

export function safeFailureClassToken(value: string | null | undefined): string {
  return safeDiagnosticToken(value, SAFE_FAILURE_CLASSES);
}

export function safeRetryHintToken(value: string | null | undefined): string {
  return safeDiagnosticToken(value, SAFE_RETRY_HINTS);
}

export function safeAttemptReasonToken(value: string | null | undefined): string {
  return safeDiagnosticToken(value, SAFE_ATTEMPT_REASONS);
}

export function sumKaResidualCounts(
  rows: readonly KaResidualKindCounts[],
): KaResidualKindCounts {
  const total = emptyKaResidualKindCounts();
  for (const row of rows) {
    total.liveEligible += row.liveEligible;
    total.currentExactLiveVersion += row.currentExactLiveVersion;
    total.retryReadyMissing += row.retryReadyMissing;
    total.retryReadyStale += row.retryReadyStale;
    total.blockedFailedAttempt += row.blockedFailedAttempt;
    total.sourceOrPreflightBlocked += row.sourceOrPreflightBlocked;
    total.historicalStaleButLiveCurrent += row.historicalStaleButLiveCurrent;
  }
  return total;
}
