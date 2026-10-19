/**
 * Root-cause presentation for Admin diagnostics.
 * Maps health fields and the Admin outbox summary. Actual failure time comes
 * from failedAt when a row was failed after tracking began. Enqueue time is
 * labeled separately and is not treated as the failure time.
 */

import type { ApiHealthPayload, DiagnosticCheck } from "./admin-diagnostics-model";

export interface DiagnosticEvidenceTimestamp {
  readonly kind:
    | "last_successful_check"
    | "failed_row_enqueued_at"
    | "actual_failure_time"
    | "last_dispatcher_cycle"
    | "unavailable";
  readonly label: string;
  readonly at: string | null;
}

export interface DiagnosticRootCause {
  readonly failingCheck: string;
  readonly failureCategory: string;
  readonly evidence: readonly DiagnosticEvidenceTimestamp[];
  readonly operationalImpact: string;
  readonly recommendedAction: string;
}

export interface AdminOutboxFailureGroupView {
  readonly key: string;
  readonly count: number;
}

export interface AdminOutboxFailureSummaryView {
  readonly countsAvailable: boolean;
  readonly totalFailed: number | null;
  readonly pendingCount: number | null;
  readonly dispatcher: {
    readonly running: boolean;
    readonly enabled: boolean;
    readonly configured: boolean;
  };
  readonly lastDispatchAt: string | null;
  readonly sample: {
    readonly order: "oldest";
    readonly label: string;
    readonly scannedCount: number;
    readonly scanCap: number;
    readonly limited: boolean;
    readonly coverageNote: string | null;
  };
  readonly byEventName: readonly AdminOutboxFailureGroupView[];
  readonly byAggregateType: readonly AdminOutboxFailureGroupView[];
  readonly byFailureCategory: readonly AdminOutboxFailureGroupView[];
  readonly breakdown: {
    readonly groupLimit: number;
    readonly eventNameTruncated: boolean;
    readonly aggregateTypeTruncated: boolean;
    readonly failureCategoryTruncated: boolean;
    readonly limitNote: string;
  };
  readonly attempts: {
    readonly scope: "scanned_sample" | "unavailable";
    readonly min: number | null;
    readonly max: number | null;
    readonly sum: number | null;
    readonly count: number;
    readonly missingCount: number;
    readonly note: string | null;
  };
  readonly timestamps: {
    readonly oldestFailedEnqueuedAt: string | null;
    readonly newestFailedEnqueuedAt: string | null;
    readonly actualFailureAt: string | null;
    readonly oldestFailedEnqueuedAtLabel: string;
    readonly newestFailedEnqueuedAtLabel: string;
    readonly actualFailureLabel: string;
    readonly lastDispatchLabel: string;
  };
  readonly impact: {
    readonly classification: "known" | "unknown" | "mixed" | "none" | "unavailable";
    readonly text: string;
  };
}

const UNAVAILABLE_EVIDENCE: DiagnosticEvidenceTimestamp = {
  kind: "unavailable",
  label: "Evidence timestamp unavailable",
  at: null,
};

const ACTUAL_FAILURE_UNAVAILABLE: DiagnosticEvidenceTimestamp = {
  kind: "actual_failure_time",
  label: "Actual failure time",
  at: null,
};

function lastSuccessfulCheck(at: string | null | undefined): DiagnosticEvidenceTimestamp | null {
  if (!at?.trim()) {
    return null;
  }
  return {
    kind: "last_successful_check",
    label: "Last successful check",
    at,
  };
}

export function emailUnhealthyEvidence(
  email: ApiHealthPayload["email"] | null | undefined,
): DiagnosticEvidenceTimestamp[] {
  const success = lastSuccessfulCheck(email?.lastSuccessAt);
  return success ? [success, ACTUAL_FAILURE_UNAVAILABLE] : [ACTUAL_FAILURE_UNAVAILABLE];
}

function mongoRootCause(health: ApiHealthPayload): DiagnosticRootCause {
  return {
    failingCheck: "mongodb.connected",
    failureCategory: health.mongodbDisconnectedReason ?? "MONGODB_DISCONNECTED",
    evidence: [UNAVAILABLE_EVIDENCE],
    operationalImpact:
      "Durable storage is unavailable. The API is not ready for traffic that requires MongoDB.",
    recommendedAction: "Restore MongoDB connectivity. This page does not repair the database.",
  };
}

function emailRootCause(health: ApiHealthPayload): DiagnosticRootCause {
  return {
    failingCheck: "email.healthy",
    failureCategory: health.emailUnhealthyReason ?? "UNKNOWN",
    evidence: emailUnhealthyEvidence(health.email),
    operationalImpact: "Transactional email may fail until the provider is healthy.",
    recommendedAction:
      "Review the email provider using the safe failure category. This page does not send mail or reveal credentials.",
  };
}

function readinessRootCause(health: ApiHealthPayload): DiagnosticRootCause {
  const ids = health.failedReadinessCheckIds ?? [];
  return {
    failingCheck: `readiness.checklist: ${ids.join(", ")}`,
    failureCategory: "READINESS_CHECK_FAILED",
    evidence: [UNAVAILABLE_EVIDENCE],
    operationalImpact: "One or more platform readiness checks are failing.",
    recommendedAction:
      "Resolve the failing checklist items. This page does not change configuration.",
  };
}

function outboxStatsUnavailableCause(): DiagnosticRootCause {
  return {
    failingCheck: "outbox.stats",
    failureCategory: "STATS_UNAVAILABLE",
    evidence: [UNAVAILABLE_EVIDENCE],
    operationalImpact:
      "Failed-event counts are unavailable, so outbox health cannot be confirmed. The failed count is not reported as zero.",
    recommendedAction: "Restore outbox statistics before treating the failed count as zero.",
  };
}

function outboxFailedCause(
  health: ApiHealthPayload,
  summary: AdminOutboxFailureSummaryView | null,
): DiagnosticRootCause {
  const evidence: DiagnosticEvidenceTimestamp[] = [];
  const oldest = summary?.timestamps.oldestFailedEnqueuedAt;
  const newest = summary?.timestamps.newestFailedEnqueuedAt;
  if (oldest) {
    evidence.push({
      kind: "failed_row_enqueued_at",
      label: summary?.timestamps.oldestFailedEnqueuedAtLabel ?? "Failed-row enqueue time",
      at: oldest,
    });
  }
  if (newest && newest !== oldest) {
    evidence.push({
      kind: "failed_row_enqueued_at",
      label: summary?.timestamps.newestFailedEnqueuedAtLabel ?? "Failed-row enqueue time",
      at: newest,
    });
  }
  if (health.outbox?.newestFailedAt) {
    evidence.push({
      kind: "actual_failure_time",
      label: "Actual failure time",
      at: health.outbox.newestFailedAt,
    });
  } else {
    evidence.push(ACTUAL_FAILURE_UNAVAILABLE);
  }
  const singleCategory =
    summary && summary.byFailureCategory.length === 1
      ? summary.byFailureCategory[0]?.key
      : undefined;
  const countWarning =
    "Historical failed rows stay visible. The lifetime count is not, by itself, an API degradation or a Platform Health critical.";
  return {
    failingCheck: "outbox.stats.failed",
    failureCategory: singleCategory ?? "HISTORICAL_FAILED_ROWS",
    evidence,
    operationalImpact: summary?.impact.text
      ? `${countWarning} ${summary.impact.text}`
      : countWarning,
    recommendedAction:
      "Review the failed event types and categories. This page does not retry or repair outbox records.",
  };
}

function dispatcherStoppedCause(health: ApiHealthPayload): DiagnosticRootCause {
  const lastDispatch = health.outbox?.lastDispatchAt;
  return {
    failingCheck: "outbox.running",
    failureCategory: "DISPATCHER_NOT_RUNNING",
    evidence: lastDispatch
      ? [
          {
            kind: "last_dispatcher_cycle",
            label: "Last dispatcher cycle",
            at: lastDispatch,
          },
        ]
      : [UNAVAILABLE_EVIDENCE],
    operationalImpact: "Pending events are not being dispatched.",
    recommendedAction: "Confirm the outbox dispatcher is enabled on the API process.",
  };
}

export function deriveComponentRootCauses(input: {
  check: Pick<DiagnosticCheck, "id" | "status">;
  health: ApiHealthPayload | null;
  outboxFailures: AdminOutboxFailureSummaryView | null;
}): DiagnosticRootCause[] {
  if (!input.health) {
    return [];
  }
  if (input.check.id === "outbox") {
    return outboxRootCauses(input.health, input.outboxFailures);
  }
  if (input.check.status === "healthy" || input.check.status === "not_available") {
    return [];
  }

  const health = input.health;
  if (input.check.id === "mongodb" && health.mongodb?.connected === false) {
    return [mongoRootCause(health)];
  }

  if (input.check.id === "email" && health.email && health.email.healthy === false) {
    return [emailRootCause(health)];
  }

  if (input.check.id === "api") {
    const causes: DiagnosticRootCause[] = [];
    if ((health.failedReadinessCheckIds?.length ?? 0) > 0) {
      causes.push(readinessRootCause(health));
    }
    if (health.ready === false) {
      causes.push({
        failingCheck: "health.ready",
        failureCategory: "NOT_READY",
        evidence: [UNAVAILABLE_EVIDENCE],
        operationalImpact: "The API is not ready for traffic.",
        recommendedAction: "Restore MongoDB connectivity before sending production traffic.",
      });
    }
    return causes;
  }

  return [];
}

function outboxRootCauses(
  health: ApiHealthPayload,
  summary: AdminOutboxFailureSummaryView | null,
): DiagnosticRootCause[] {
  if (!health.outbox) {
    return [];
  }
  if (!health.outbox.configured) {
    return [
      {
        failingCheck: "outbox.configured",
        failureCategory: "NOT_CONFIGURED",
        evidence: [UNAVAILABLE_EVIDENCE],
        operationalImpact:
          "The outbox is not configured. A pending count of zero does not make this Healthy.",
        recommendedAction: "Configure MongoDB for the outbox before treating dispatch as healthy.",
      },
    ];
  }
  const stats = health.outbox.stats;
  if (stats == null) {
    return [outboxStatsUnavailableCause()];
  }

  const causes: DiagnosticRootCause[] = [];
  const duePending = Boolean(health.outbox.oldestDuePendingCreatedAt);
  if (health.outbox.running !== true && (health.outbox.enabled === true || duePending)) {
    causes.push(dispatcherStoppedCause(health));
  } else if (health.outbox.running !== true && health.outbox.enabled !== true) {
    causes.push({
      failingCheck: "outbox.enabled",
      failureCategory: "DISPATCHER_DISABLED",
      evidence: [UNAVAILABLE_EVIDENCE],
      operationalImpact:
        "The dispatcher is disabled. A pending count of zero does not make this Healthy.",
      recommendedAction: "Enable the outbox dispatcher before treating dispatch as healthy.",
    });
  }
  if (
    health.outbox.running === true &&
    health.outbox.enabled === true &&
    health.outbox.oldestDuePendingCreatedAt
  ) {
    const dueAt = Date.parse(health.outbox.oldestDuePendingCreatedAt);
    if (Number.isFinite(dueAt) && Date.now() - dueAt >= 15 * 60 * 1000) {
      causes.push({
        failingCheck: "outbox.oldestDuePendingCreatedAt",
        failureCategory: "OVERDUE_PENDING",
        evidence: [
          {
            kind: "failed_row_enqueued_at",
            label: "Oldest due pending enqueue time",
            at: health.outbox.oldestDuePendingCreatedAt,
          },
        ],
        operationalImpact: "Due outbox work has been waiting at least 15 minutes.",
        recommendedAction: "Confirm the dispatcher is draining due pending rows.",
      });
    }
  }
  if (health.outbox.newestFailedAt) {
    const failedAt = Date.parse(health.outbox.newestFailedAt);
    if (Number.isFinite(failedAt) && Date.now() - failedAt <= 24 * 60 * 60 * 1000) {
      causes.push({
        failingCheck: "outbox.newestFailedAt",
        failureCategory: "RECENT_FAILURE",
        evidence: [
          {
            kind: "actual_failure_time",
            label: "Actual failure time",
            at: health.outbox.newestFailedAt,
          },
        ],
        operationalImpact: "A row was marked failed within the last 24 hours.",
        recommendedAction: "Review the newest failure in Event Infrastructure. This page does not retry it.",
      });
    }
  }
  const dispatchErrorAt = health.outbox.lastDispatchErrorAt
    ? Date.parse(health.outbox.lastDispatchErrorAt)
    : Number.NaN;
  const recentDispatchError =
    health.outbox.lastDispatchErrorAt != null
      ? Number.isFinite(dispatchErrorAt) && Date.now() - dispatchErrorAt <= 24 * 60 * 60 * 1000
      : Boolean(health.outbox.lastError);
  if (recentDispatchError) {
    causes.push({
      failingCheck: "outbox.lastDispatchErrorAt",
      failureCategory: "DISPATCH_ERROR",
      evidence: health.outbox.lastDispatchErrorAt
        ? [
            {
              kind: "actual_failure_time",
              label: "Dispatcher error time",
              at: health.outbox.lastDispatchErrorAt,
            },
          ]
        : health.outbox.lastDispatchAt
          ? [
              {
                kind: "last_dispatcher_cycle",
                label: "Last dispatcher cycle",
                at: health.outbox.lastDispatchAt,
              },
            ]
          : [UNAVAILABLE_EVIDENCE],
      operationalImpact:
        "A dispatcher error was recorded in this process. The raw error is omitted.",
      recommendedAction:
        "Inspect dispatcher logs for the safe failure category. This page does not replay events.",
    });
  }
  if ((stats.failed ?? 0) > 0) {
    causes.push(outboxFailedCause(health, summary));
  }
  return causes;
}

function formatGroups(groups: readonly AdminOutboxFailureGroupView[]): string {
  if (groups.length === 0) {
    return "none";
  }
  return groups.map((group) => `${group.key} (${group.count})`).join(", ");
}

export interface OutboxFailureSummaryLines {
  readonly failedCount: string;
  readonly pending: string;
  readonly dispatcher: string;
  readonly sampleLabel: string;
  readonly coverageNote: string | null;
  readonly limitNote: string;
  readonly eventTypes: string;
  readonly aggregateTypes: string;
  readonly categories: string;
  readonly impact: string;
  readonly oldestEnqueue: string;
  readonly newestEnqueue: string;
  readonly actualFailure: string;
  readonly lastDispatch: string;
  readonly attempts: string;
}

export function formatOutboxFailureSummaryLines(
  summary: AdminOutboxFailureSummaryView,
): OutboxFailureSummaryLines {
  const failedCount = summary.countsAvailable
    ? `Failed rows: ${summary.totalFailed ?? 0}`
    : "Failed rows: unavailable";
  const pending =
    summary.pendingCount === null
      ? "Pending count: unavailable"
      : `Pending count: ${summary.pendingCount}`;
  const dispatcher = `Dispatcher: ${summary.dispatcher.running ? "running" : "not running"}, ${summary.dispatcher.enabled ? "enabled" : "disabled"}`;
  const attempts =
    summary.attempts.min === null || summary.attempts.max === null || summary.attempts.sum === null
      ? `Attempts: unavailable (${summary.attempts.missingCount} missing). ${summary.attempts.note ?? ""}`.trim()
      : `Attempts in sample: min ${summary.attempts.min}, max ${summary.attempts.max}, sum ${summary.attempts.sum}. ${summary.attempts.note ?? ""}`.trim();

  return {
    failedCount,
    pending,
    dispatcher,
    sampleLabel: `Sample: ${summary.sample.label}`,
    coverageNote: summary.sample.coverageNote,
    limitNote: summary.breakdown.limitNote,
    eventTypes: `Failed event types: ${formatGroups(summary.byEventName)}`,
    aggregateTypes: `Aggregate types: ${formatGroups(summary.byAggregateType)}`,
    categories: `Failure categories: ${formatGroups(summary.byFailureCategory)}`,
    impact: `Impact (${summary.impact.classification}): ${summary.impact.text}`,
    oldestEnqueue: summary.timestamps.oldestFailedEnqueuedAt
      ? `${summary.timestamps.oldestFailedEnqueuedAtLabel}: ${summary.timestamps.oldestFailedEnqueuedAt}`
      : `${summary.timestamps.oldestFailedEnqueuedAtLabel}: unavailable`,
    newestEnqueue: summary.timestamps.newestFailedEnqueuedAt
      ? `${summary.timestamps.newestFailedEnqueuedAtLabel}: ${summary.timestamps.newestFailedEnqueuedAt}`
      : `${summary.timestamps.newestFailedEnqueuedAtLabel}: unavailable`,
    actualFailure: summary.timestamps.actualFailureAt
      ? `${summary.timestamps.actualFailureLabel}: ${summary.timestamps.actualFailureAt}`
      : `${summary.timestamps.actualFailureLabel}: unavailable`,
    lastDispatch: summary.lastDispatchAt
      ? `${summary.timestamps.lastDispatchLabel}: ${summary.lastDispatchAt}`
      : `${summary.timestamps.lastDispatchLabel}: unavailable`,
    attempts,
  };
}
