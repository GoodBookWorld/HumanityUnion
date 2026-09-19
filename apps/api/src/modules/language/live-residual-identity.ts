/**
 * Shared live residual classification.
 * Readiness counts and residual retry selection both use this boundary.
 * Historical translation rows are not an input: only the exact live sourceVersion matters.
 */

export type LiveResidualIdentityBucket =
  | "CURRENT"
  | "RETRY_READY_MISSING"
  | "RETRY_READY_STALE"
  | "BLOCKED_FAILED_ATTEMPT"
  | "ACTIVE_WORK"
  | "SOURCE_OR_PREFLIGHT_BLOCKED";

export function classifyLiveResidualIdentity(input: {
  readonly liveCurrent: boolean;
  readonly liveStale: boolean;
  readonly preflightReady: boolean;
  readonly readyState: string;
  readonly terminalFailureForCurrentVersion: boolean;
}): LiveResidualIdentityBucket {
  if (input.liveCurrent || input.readyState === "CURRENT") {
    return "CURRENT";
  }
  if (input.preflightReady && input.liveStale) {
    return "RETRY_READY_STALE";
  }
  if (input.preflightReady) {
    return "RETRY_READY_MISSING";
  }
  if (input.terminalFailureForCurrentVersion) {
    return "BLOCKED_FAILED_ATTEMPT";
  }
  if (input.readyState === "ACTIVE_WORK") {
    return "ACTIVE_WORK";
  }
  return "SOURCE_OR_PREFLIGHT_BLOCKED";
}

/** Actionable live translation work residual retry can enqueue. */
export function isActionableLiveResidualBucket(
  bucket: LiveResidualIdentityBucket,
): boolean {
  return bucket === "RETRY_READY_MISSING" || bucket === "RETRY_READY_STALE";
}
