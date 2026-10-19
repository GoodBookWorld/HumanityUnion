/**
 * Active outbox health. Lifetime failed counts stay visible elsewhere and
 * are not an input. Failure time is failedAt or the in-process dispatch
 * error time, never enqueue createdAt.
 *
 * The same thresholds are applied by the Admin Outbox card. Keep the two
 * copies aligned: 15 minutes overdue, 24 hours recent.
 */

export const OUTBOX_DUE_PENDING_WARNING_MS = 15 * 60 * 1000;
export const OUTBOX_RECENT_FAILURE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type OutboxActiveReason =
  | "DISPATCHER_STOPPED"
  | "DISPATCHER_DISABLED"
  | "OVERDUE_PENDING"
  | "RECENT_FAILURE"
  | "DISPATCH_ERROR";

export type OutboxOperationalSeverity = "healthy" | "warning" | "critical" | "unknown";

export interface OutboxOperationInput {
  readonly configured: boolean;
  readonly enabled: boolean;
  readonly running: boolean;
  readonly stats: { readonly pending: number; readonly failed: number } | null;
  readonly oldestDuePendingCreatedAt: string | null;
  readonly newestFailedAt: string | null;
  readonly lastDispatchErrorAt: string | null;
  readonly nowMs?: number;
}

export interface OutboxOperationAssessment {
  readonly severity: OutboxOperationalSeverity;
  /**
   * Public and Admin API status. A stopped idle dispatcher and a disabled
   * dispatcher stay on the diagnostics card without degrading the API.
   */
  readonly degradesApi: boolean;
  readonly reasons: readonly OutboxActiveReason[];
}

function parsedIso(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function isRecent(atMs: number, nowMs: number): boolean {
  const age = nowMs - atMs;
  return age >= -60_000 && age <= OUTBOX_RECENT_FAILURE_WINDOW_MS;
}

export function assessOutboxOperations(input: OutboxOperationInput): OutboxOperationAssessment {
  if (!input.configured) {
    return { severity: "warning", degradesApi: false, reasons: [] };
  }
  if (input.stats == null) {
    return { severity: "unknown", degradesApi: false, reasons: [] };
  }

  const now = input.nowMs ?? Date.now();
  const reasons: OutboxActiveReason[] = [];
  let severity: "healthy" | "warning" | "critical" = "healthy";
  const dueAt = parsedIso(input.oldestDuePendingCreatedAt);
  const duePending = dueAt != null;

  if (!input.running) {
    if (duePending) {
      reasons.push("DISPATCHER_STOPPED");
      severity = "critical";
    } else if (input.enabled) {
      reasons.push("DISPATCHER_STOPPED");
      severity = "warning";
    } else {
      reasons.push("DISPATCHER_DISABLED");
      severity = "warning";
    }
  } else if (
    input.enabled &&
    dueAt != null &&
    now - dueAt >= OUTBOX_DUE_PENDING_WARNING_MS
  ) {
    reasons.push("OVERDUE_PENDING");
    severity = "warning";
  }

  const failedAt = parsedIso(input.newestFailedAt);
  if (failedAt != null && isRecent(failedAt, now)) {
    reasons.push("RECENT_FAILURE");
    if (severity === "healthy") {
      severity = "warning";
    }
  }

  const errorAt = parsedIso(input.lastDispatchErrorAt);
  if (errorAt != null && isRecent(errorAt, now)) {
    reasons.push("DISPATCH_ERROR");
    if (severity === "healthy") {
      severity = "warning";
    }
  }

  const degradesApi = reasons.some(
    (reason) =>
      reason === "OVERDUE_PENDING" ||
      reason === "RECENT_FAILURE" ||
      reason === "DISPATCH_ERROR" ||
      (reason === "DISPATCHER_STOPPED" && severity === "critical"),
  );

  return { severity, degradesApi, reasons };
}
