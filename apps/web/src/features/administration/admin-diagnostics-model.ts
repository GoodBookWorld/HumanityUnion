/**
 * Diagnostics Pack 01 — pure status derivation for Admin Technical Health.
 * Does not invent health scores; maps authoritative API fields to Admin statuses.
 */

import { deriveComponentRootCauses } from "./admin-diagnostics-root-cause";
import type {
  AdminOutboxFailureSummaryView,
  DiagnosticRootCause,
} from "./admin-diagnostics-root-cause";

export type DiagnosticSeverity = "healthy" | "warning" | "critical" | "unknown" | "not_available";

export interface DiagnosticCheck {
  readonly id: string;
  readonly label: string;
  readonly status: DiagnosticSeverity;
  readonly summary: string;
  readonly detail?: string;
  readonly rootCauses?: readonly DiagnosticRootCause[];
}

export interface ApiHealthPayload {
  readonly service?: string;
  readonly status?: string;
  readonly liveness?: string;
  readonly ready?: boolean;
  readonly uptimeSeconds?: number;
  readonly mongodb?: {
    readonly connected?: boolean;
    readonly latencyMs?: number | null;
    readonly error?: string | null;
    readonly database?: string | null;
  };
  readonly email?: {
    readonly provider?: string;
    readonly healthy?: boolean;
    readonly configured?: boolean;
    readonly message?: string;
    readonly lastSuccessAt?: string;
    readonly lastFailureCategory?: string;
  };
  readonly outbox?: {
    readonly enabled?: boolean;
    readonly configured?: boolean;
    readonly running?: boolean;
    readonly stats?: {
      readonly pending?: number;
      readonly published?: number;
      readonly failed?: number;
      readonly oldestPendingCreatedAt?: string | null;
    } | null;
    readonly lastDispatchAt?: string | null;
    readonly lastError?: string | null;
    readonly oldestDuePendingCreatedAt?: string | null;
    readonly newestFailedAt?: string | null;
    readonly lastDispatchErrorAt?: string | null;
  };
  readonly degradedReasons?: readonly string[];
  readonly emailUnhealthyReason?: string | null;
  readonly outboxFailedCountReason?: string | null;
  readonly failedReadinessCheckIds?: readonly string[];
  readonly mongodbDisconnectedReason?: string | null;
  readonly readiness?: {
    readonly failedChecks?: number;
    readonly checklist?: ReadonlyArray<{
      readonly id?: string;
      readonly label?: string;
      readonly status?: string;
      readonly detail?: string;
    }>;
  };
}

export interface ApiReadyPayload {
  readonly ready?: boolean;
}

/**
 * Overall aggregation:
 * - Critical if any required check is Critical
 * - Warning if any Warning (and no Critical)
 * - Healthy only when every included check is Healthy
 * - Unknown never becomes Healthy; Unknown alone → Unknown; Unknown + Healthy → Warning
 * - not_available is capability metadata and is excluded from overall health
 */
export function aggregateOverallStatus(checks: readonly DiagnosticSeverity[]): DiagnosticSeverity {
  const relevant = checks.filter((status) => status !== "not_available");
  if (relevant.length === 0) {
    return "unknown";
  }
  if (relevant.some((status) => status === "critical")) {
    return "critical";
  }
  if (relevant.some((status) => status === "warning")) {
    return "warning";
  }
  if (relevant.some((status) => status === "unknown")) {
    return relevant.every((status) => status === "unknown") ? "unknown" : "warning";
  }
  if (relevant.every((status) => status === "healthy")) {
    return "healthy";
  }
  return "unknown";
}

export function deriveWebStatus(): DiagnosticCheck {
  return {
    id: "web",
    label: "Web",
    status: "healthy",
    summary: "Admin UI is reachable",
    detail: "This page loaded successfully in the browser.",
  };
}

export function deriveApiStatus(input: {
  health: ApiHealthPayload | null;
  ready: ApiReadyPayload | null;
  healthError: string | null;
  readyError: string | null;
}): DiagnosticCheck {
  if (input.healthError || !input.health) {
    return {
      id: "api",
      label: "API",
      status: "critical",
      summary: "API unreachable",
      detail: sanitizeOperatorMessage(input.healthError) ?? "Health endpoint did not respond.",
    };
  }

  const readyFlag =
    input.ready?.ready ??
    (typeof input.health.ready === "boolean" ? input.health.ready : undefined);

  if (input.readyError && readyFlag === undefined) {
    return {
      id: "api",
      label: "API",
      status: "warning",
      summary: "API reachable; readiness unknown",
      detail: sanitizeOperatorMessage(input.readyError) ?? "Readiness probe did not respond.",
    };
  }

  if (readyFlag === false) {
    return {
      id: "api",
      label: "API",
      status: "critical",
      summary: "API not ready",
      detail: "Readiness probe reports the API is not ready for traffic.",
    };
  }

  if (input.health.status === "degraded") {
    return {
      id: "api",
      label: "API",
      status: "warning",
      summary: "API reachable but degraded",
      detail: "Liveness is up; one or more dependencies are unhealthy.",
    };
  }

  if (input.health.status === "healthy" || readyFlag === true) {
    return {
      id: "api",
      label: "API",
      status: "healthy",
      summary: "API reachable and ready",
      detail:
        typeof input.health.uptimeSeconds === "number"
          ? `Uptime ${input.health.uptimeSeconds}s`
          : undefined,
    };
  }

  return {
    id: "api",
    label: "API",
    status: "unknown",
    summary: "API health status unknown",
  };
}

export function deriveMongoStatus(health: ApiHealthPayload | null): DiagnosticCheck {
  if (!health?.mongodb) {
    return {
      id: "mongodb",
      label: "MongoDB",
      status: "unknown",
      summary: "MongoDB status unavailable",
      detail: "Health payload did not include MongoDB information.",
    };
  }

  if (health.mongodb.connected) {
    const latency =
      typeof health.mongodb.latencyMs === "number"
        ? `${health.mongodb.latencyMs}ms ping`
        : undefined;
    return {
      id: "mongodb",
      label: "MongoDB",
      status: "healthy",
      summary: "Connected",
      detail: latency,
    };
  }

  return {
    id: "mongodb",
    label: "MongoDB",
    status: "critical",
    summary: "Unavailable",
    detail: sanitizeOperatorMessage(health.mongodb.error) ?? "MongoDB is not connected.",
  };
}

export function deriveEmailStatus(health: ApiHealthPayload | null): DiagnosticCheck {
  if (!health?.email) {
    return {
      id: "email",
      label: "Email",
      status: "unknown",
      summary: "Email status unavailable",
    };
  }

  const provider = health.email.provider?.trim() || "provider";

  if (health.email.healthy) {
    return {
      id: "email",
      label: "Email",
      status: "healthy",
      summary: "Healthy",
      detail: `${provider}${health.email.lastSuccessAt ? ` · last success ${health.email.lastSuccessAt}` : ""}`,
    };
  }

  if (!health.email.configured) {
    return {
      id: "email",
      label: "Email",
      status: "warning",
      summary: "Unavailable",
      detail: sanitizeOperatorMessage(health.email.message) ?? "Email provider is not configured.",
    };
  }

  return {
    id: "email",
    label: "Email",
    status: "warning",
    summary: "Warning",
    detail:
      sanitizeOperatorMessage(health.email.message) ??
      (health.email.lastFailureCategory
        ? `Failure category: ${health.email.lastFailureCategory}`
        : "Email provider health check is not currently healthy."),
  };
}

/** Keep aligned with apps/api outbox-operational-health.ts. */
export const OUTBOX_DUE_PENDING_WARNING_MS = 15 * 60 * 1000;
export const OUTBOX_RECENT_FAILURE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type OutboxCardReason =
  | "DISPATCHER_STOPPED"
  | "DISPATCHER_DISABLED"
  | "OVERDUE_PENDING"
  | "RECENT_FAILURE"
  | "DISPATCH_ERROR";

function parsedIso(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function isRecentOutboxInstant(atMs: number, nowMs: number): boolean {
  const age = nowMs - atMs;
  return age >= -60_000 && age <= OUTBOX_RECENT_FAILURE_WINDOW_MS;
}

export function assessOutboxCard(input: {
  readonly configured: boolean;
  readonly enabled: boolean;
  readonly running: boolean;
  readonly statsPresent: boolean;
  readonly oldestDuePendingCreatedAt: string | null;
  readonly newestFailedAt: string | null;
  readonly lastDispatchErrorAt: string | null;
  readonly nowMs: number;
}): { readonly status: DiagnosticSeverity; readonly reasons: readonly OutboxCardReason[] } {
  if (!input.configured) {
    return { status: "warning", reasons: [] };
  }
  if (!input.statsPresent) {
    return { status: "unknown", reasons: [] };
  }

  const reasons: OutboxCardReason[] = [];
  let status: DiagnosticSeverity = "healthy";
  const dueAt = parsedIso(input.oldestDuePendingCreatedAt);
  const duePending = dueAt != null;

  if (!input.running) {
    if (duePending) {
      reasons.push("DISPATCHER_STOPPED");
      status = "critical";
    } else if (input.enabled) {
      reasons.push("DISPATCHER_STOPPED");
      status = "warning";
    } else {
      reasons.push("DISPATCHER_DISABLED");
      status = "warning";
    }
  } else if (input.enabled && dueAt != null && input.nowMs - dueAt >= OUTBOX_DUE_PENDING_WARNING_MS) {
    reasons.push("OVERDUE_PENDING");
    status = "warning";
  }

  const failedAt = parsedIso(input.newestFailedAt);
  if (failedAt != null && isRecentOutboxInstant(failedAt, input.nowMs)) {
    reasons.push("RECENT_FAILURE");
    if (status === "healthy") {
      status = "warning";
    }
  }

  const errorAt = parsedIso(input.lastDispatchErrorAt);
  if (errorAt != null && isRecentOutboxInstant(errorAt, input.nowMs)) {
    reasons.push("DISPATCH_ERROR");
    if (status === "healthy") {
      status = "warning";
    }
  }

  return { status, reasons };
}

export function deriveOutboxStatus(
  health: ApiHealthPayload | null,
  nowMs: number = Date.now(),
): DiagnosticCheck {
  if (!health?.outbox) {
    return {
      id: "outbox",
      label: "Outbox",
      status: "unknown",
      summary: "Outbox status unavailable",
    };
  }

  const stats = health.outbox.stats;
  if (!health.outbox.configured || stats == null) {
    return {
      id: "outbox",
      label: "Outbox",
      status: health.outbox.configured ? "unknown" : "warning",
      summary: health.outbox.configured ? "Stats unavailable" : "Not configured",
    };
  }

  const pending = stats.pending ?? 0;
  const published = stats.published ?? 0;
  const failed = stats.failed ?? 0;
  const counts = `Pending ${pending} · Published ${published} · Failed ${failed}`;
  const dispatchErrorAt =
    health.outbox.lastDispatchErrorAt ??
    (health.outbox.lastError ? new Date(nowMs).toISOString() : null);
  const assessment = assessOutboxCard({
    configured: true,
    enabled: health.outbox.enabled === true,
    running: health.outbox.running === true,
    statsPresent: true,
    oldestDuePendingCreatedAt: health.outbox.oldestDuePendingCreatedAt ?? null,
    newestFailedAt: health.outbox.newestFailedAt ?? null,
    lastDispatchErrorAt: dispatchErrorAt,
    nowMs,
  });

  const historicalNote =
    failed > 0 && assessment.status === "healthy"
      ? " · Historical failed rows retained"
      : "";

  if (assessment.status === "critical") {
    return {
      id: "outbox",
      label: "Outbox",
      status: "critical",
      summary: "Dispatcher stopped with due work",
      detail: `${counts}${historicalNote}`,
    };
  }

  if (assessment.reasons.includes("OVERDUE_PENDING")) {
    return {
      id: "outbox",
      label: "Outbox",
      status: "warning",
      summary: "Due work is overdue",
      detail: counts,
    };
  }

  if (assessment.reasons.includes("RECENT_FAILURE")) {
    return {
      id: "outbox",
      label: "Outbox",
      status: "warning",
      summary: "Recent dispatch failure",
      detail: counts,
    };
  }

  if (assessment.reasons.includes("DISPATCH_ERROR")) {
    return {
      id: "outbox",
      label: "Outbox",
      status: "warning",
      summary: "Dispatcher error recorded",
      detail: counts,
    };
  }

  if (assessment.reasons.includes("DISPATCHER_STOPPED")) {
    return {
      id: "outbox",
      label: "Outbox",
      status: "warning",
      summary: "Dispatcher not running",
      detail: counts,
    };
  }

  if (assessment.reasons.includes("DISPATCHER_DISABLED")) {
    return {
      id: "outbox",
      label: "Outbox",
      status: "warning",
      summary: "Dispatcher disabled",
      detail: `${counts}${failed > 0 ? " · Historical failed rows retained" : ""}`,
    };
  }

  return {
    id: "outbox",
    label: "Outbox",
    status: "healthy",
    summary: pending > 0 ? "Healthy with pending backlog" : "Healthy",
    detail: `${counts}${historicalNote}`,
  };
}

export function deriveInitiativeIntegrityStatus(input: {
  warningCount: number | null;
  error: string | null;
  samples?: readonly { initiativeId: string; title: string }[] | null;
}): DiagnosticCheck {
  if (input.error || input.warningCount === null) {
    return {
      id: "initiative-integrity",
      label: "Initiative integrity",
      status: "unknown",
      summary: "Check not performed",
      detail: sanitizeOperatorMessage(input.error) ?? "Integrity inventory could not be loaded.",
    };
  }

  if (input.warningCount > 0) {
    const sampleText =
      input.samples && input.samples.length > 0
        ? ` Examples: ${input.samples
            .map((sample) => `${sample.title} (${sample.initiativeId})`)
            .join("; ")}.`
        : "";
    return {
      id: "initiative-integrity",
      label: "Initiative integrity",
      status: "warning",
      summary: `${input.warningCount} finding${input.warningCount === 1 ? "" : "s"}`,
      detail: `Review Initiative directory for integrity warnings.${sampleText}`,
    };
  }

  return {
    id: "initiative-integrity",
    label: "Initiative integrity",
    status: "healthy",
    summary: "No integrity warnings in directory sample",
    detail: "Based on Admin Initiatives directory integrityStatus.",
  };
}

/**
 * Lifecycle reconciliation is CLI/staging tooling only at runtime.
 * When a future safe Admin API contract supplies conflict counts, pass them here
 * so real conflicts still surface as warning/critical — never invent Healthy.
 */
export function deriveLifecycleReconciliationStatus(input?: {
  readonly available?: boolean;
  readonly conflictCount?: number | null;
}): DiagnosticCheck {
  if (input?.available === true && typeof input.conflictCount === "number") {
    if (input.conflictCount > 0) {
      return {
        id: "lifecycle-reconciliation",
        label: "Lifecycle reconciliation",
        status: input.conflictCount >= 10 ? "critical" : "warning",
        summary: `${input.conflictCount} reconciliation conflict${input.conflictCount === 1 ? "" : "s"}`,
        detail: "Reported by the runtime reconciliation contract.",
      };
    }

    return {
      id: "lifecycle-reconciliation",
      label: "Lifecycle reconciliation",
      status: "healthy",
      summary: "No reconciliation conflicts",
      detail: "Reported by the runtime reconciliation contract.",
    };
  }

  return lifecycleReconciliationDeferredCheck();
}

export function lifecycleReconciliationDeferredCheck(): DiagnosticCheck {
  return {
    id: "lifecycle-reconciliation",
    label: "Lifecycle reconciliation",
    status: "not_available",
    summary: "CLI-only / staging reconciliation tooling",
    detail: "Not available via Admin API. Conflict counts are not safely exposed at runtime.",
  };
}

/** Strip connection strings / credential-looking fragments from operator messages. */
export function sanitizeOperatorMessage(value: string | null | undefined): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  const trimmed = value.trim();
  if (/mongodb(\+srv)?:\/\//i.test(trimmed) || /:\/\/[^/\s]+:[^/\s]+@/i.test(trimmed)) {
    return "Connection details omitted for safety.";
  }

  if (/password|secret|credential|api[_-]?key/i.test(trimmed)) {
    return "Sensitive detail omitted for safety.";
  }

  return trimmed.length > 240 ? `${trimmed.slice(0, 237)}…` : trimmed;
}

export function buildTechnicalHealthSnapshot(input: {
  health: ApiHealthPayload | null;
  ready: ApiReadyPayload | null;
  healthError: string | null;
  readyError: string | null;
  initiativeWarningCount: number | null;
  initiativeError: string | null;
  initiativeSamples?: readonly { initiativeId: string; title: string }[] | null;
  outboxFailures?: AdminOutboxFailureSummaryView | null;
}): {
  overall: DiagnosticSeverity;
  services: DiagnosticCheck[];
  outbox: DiagnosticCheck;
  integrity: DiagnosticCheck[];
} {
  const web = deriveWebStatus();
  const api = deriveApiStatus({
    health: input.health,
    ready: input.ready,
    healthError: input.healthError,
    readyError: input.readyError,
  });
  const mongo = deriveMongoStatus(input.healthError ? null : input.health);
  const email = deriveEmailStatus(input.healthError ? null : input.health);
  const outbox = deriveOutboxStatus(input.healthError ? null : input.health);
  const initiativeIntegrity = deriveInitiativeIntegrityStatus({
    warningCount: input.initiativeWarningCount,
    error: input.initiativeError,
    samples: input.initiativeSamples,
  });
  const lifecycle = deriveLifecycleReconciliationStatus();

  const healthForCauses = input.healthError ? null : input.health;
  const outboxFailures = input.outboxFailures ?? null;
  const withCauses = (check: DiagnosticCheck): DiagnosticCheck => {
    const rootCauses = deriveComponentRootCauses({
      check,
      health: healthForCauses,
      outboxFailures,
    });
    return rootCauses.length > 0 ? { ...check, rootCauses } : check;
  };

  const services = [web, api, mongo, email].map(withCauses);
  const integrity = [initiativeIntegrity, lifecycle];
  const outboxWithCauses = withCauses(outbox);

  // Overall uses platform-required services + outbox + initiative integrity.
  // Lifecycle not_available is capability metadata and is excluded from overall.
  const overall = aggregateOverallStatus([
    web.status,
    api.status,
    mongo.status,
    email.status,
    outbox.status,
    initiativeIntegrity.status,
    lifecycle.status,
  ]);

  return { overall, services, outbox: outboxWithCauses, integrity };
}

export function formatDiagnosticSeverityLabel(status: DiagnosticSeverity): string {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "warning":
      return "Warning";
    case "critical":
      return "Critical";
    case "unknown":
      return "Unknown";
    case "not_available":
      return "Not available";
  }
}
