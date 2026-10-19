/**
 * Admin diagnostics root-cause identifiers.
 * Predicates are the existing health-route rules (Mongo, email, outbox failed
 * count, readiness checklist failures). This module does not define new
 * health thresholds.
 */

import { assessOutboxOperations } from "../../infrastructure/outbox/outbox-operational-health.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "./administration.errors.js";

export const ADMIN_DIAGNOSTICS_DEGRADED_REASONS = [
  "MONGODB_DISCONNECTED",
  "EMAIL_UNHEALTHY",
  "OUTBOX_DISPATCHER_STOPPED",
  "OUTBOX_OVERDUE_PENDING",
  "OUTBOX_RECENT_FAILURE",
  "OUTBOX_DISPATCH_ERROR",
  "READINESS_CHECK_FAILED",
] as const;

export type AdminDiagnosticsDegradedReason = (typeof ADMIN_DIAGNOSTICS_DEGRADED_REASONS)[number];

export const EMAIL_UNHEALTHY_REASONS = [
  "NOT_CONFIGURED",
  "AUTH_FAILURE",
  "TIMEOUT",
  "CONNECTION",
  "DNS",
  "RECIPIENT_REJECTED",
  "SENDER_REJECTED",
  "TEMPORARY_PROVIDER",
  "PROVIDER_ERROR",
  "TEST_RECIPIENT_BLOCKED",
  "PERMANENT_OR_UNKNOWN",
  "UNKNOWN",
] as const;

export type EmailUnhealthyReason = (typeof EMAIL_UNHEALTHY_REASONS)[number];

/** Ids emitted by buildPlatformReadinessChecklist. Unknown ids are not echoed. */
export const KNOWN_READINESS_CHECK_IDS = [
  "mongodb",
  "health",
  "jwt",
  "email",
  "notifications",
  "workspace",
  "search",
  "assistant",
  "deployment",
  "bootstrap-disabled",
  "https",
  "email-verification",
  "mongo-atlas",
  "env-validation",
  "debug-config",
] as const;

const KNOWN_READINESS_CHECK_ID_SET = new Set<string>(KNOWN_READINESS_CHECK_IDS);

const EMAIL_CATEGORY_TO_REASON: Readonly<Record<string, EmailUnhealthyReason>> = {
  not_configured: "NOT_CONFIGURED",
  auth_failure: "AUTH_FAILURE",
  timeout: "TIMEOUT",
  connection: "CONNECTION",
  dns: "DNS",
  recipient_rejected: "RECIPIENT_REJECTED",
  sender_rejected: "SENDER_REJECTED",
  temporary_provider: "TEMPORARY_PROVIDER",
  provider_error: "PROVIDER_ERROR",
  test_recipient_blocked: "TEST_RECIPIENT_BLOCKED",
  permanent_or_unknown: "PERMANENT_OR_UNKNOWN",
};

export type AdminDiagnosticsActorDecision = "unauthorized" | "forbidden" | "ok";

export function classifyAdminDiagnosticsActor(input: {
  userId: string;
  user: { status: string; role: string } | null | undefined;
}): AdminDiagnosticsActorDecision {
  if (!input.userId.trim()) {
    return "unauthorized";
  }
  if (!input.user || input.user.status !== "active" || input.user.role !== "admin") {
    return "forbidden";
  }
  return "ok";
}

export function assertAdminDiagnosticsActor(input: {
  userId: string;
  user: { status: string; role: string } | null | undefined;
}): void {
  const decision = classifyAdminDiagnosticsActor(input);
  if (decision === "unauthorized") {
    throw new AdministrationUnauthorizedError("Authentication is required.");
  }
  if (decision === "forbidden") {
    throw new AdministrationForbiddenError("Administrator access is required.");
  }
}

export function resolveAdminDiagnosticsHttpStatus(error: unknown): number {
  if (error instanceof AdministrationUnauthorizedError) {
    return 401;
  }
  if (error instanceof AdministrationForbiddenError) {
    return 403;
  }
  return 500;
}

export function selectFailedReadinessCheckIds(
  checklist: readonly { id?: unknown; status?: unknown }[],
): string[] {
  const ids: string[] = [];
  let unrecognized = false;

  for (const item of checklist) {
    if (item.status !== "fail") {
      continue;
    }
    if (typeof item.id === "string" && KNOWN_READINESS_CHECK_ID_SET.has(item.id)) {
      ids.push(item.id);
      continue;
    }
    unrecognized = true;
  }

  if (unrecognized && !ids.includes("UNKNOWN")) {
    ids.push("UNKNOWN");
  }

  return ids;
}

export function deriveEmailUnhealthyReason(input: {
  healthy: boolean;
  configured: boolean;
  lastFailureCategory?: string | null;
}): EmailUnhealthyReason | null {
  if (input.healthy) {
    return null;
  }
  if (!input.configured) {
    return "NOT_CONFIGURED";
  }
  const category = input.lastFailureCategory?.trim().toLowerCase() ?? "";
  if (!category) {
    return "UNKNOWN";
  }
  return EMAIL_CATEGORY_TO_REASON[category] ?? "UNKNOWN";
}

export interface AdminDiagnosticsHealthAssessmentInput {
  mongoConnected: boolean;
  emailHealthy: boolean;
  emailConfigured: boolean;
  emailLastFailureCategory?: string | null;
  outboxConfigured: boolean;
  outboxEnabled: boolean;
  /** Omitted callers are treated as running so a missing flag is not a stoppage. */
  outboxRunning?: boolean;
  outboxStats: { pending?: number; failed: number } | null;
  oldestDuePendingCreatedAt?: string | null;
  newestFailedAt?: string | null;
  lastDispatchErrorAt?: string | null;
  nowMs?: number;
  readiness: readonly { id?: unknown; status?: unknown }[];
}

export interface AdminDiagnosticsHealthAssessment {
  status: "healthy" | "degraded";
  degradedReasons: AdminDiagnosticsDegradedReason[];
  emailUnhealthyReason: EmailUnhealthyReason | null;
  outboxFailedCountReason: "OUTBOX_FAILED_COUNT" | null;
  failedReadinessCheckIds: string[];
  mongodbDisconnectedReason: "MONGODB_DISCONNECTED" | null;
}

/**
 * Production overall status uses the same predicates as GET /api/v1/health
 * once MongoDB is connected: email healthy, no readiness item with status
 * "fail", and an active outbox fault.
 * A lifetime failed count is not an active fault. Historical rows stay
 * visible on the diagnostics page and do not set a degraded reason.
 * Missing stats are not treated as zero. A disabled or unconfigured
 * dispatcher does not degrade this assessment by itself.
 * In production, a disconnected MongoDB degrades both surfaces. Outside
 * production, public /health can still report overall "healthy" while
 * MongoDB is disconnected. This Admin assessment still reports
 * MONGODB_DISCONNECTED in every environment. Component severity on the
 * diagnostics page treats that disconnection as critical.
 */
export function assessAdminDiagnosticsHealth(
  input: AdminDiagnosticsHealthAssessmentInput,
): AdminDiagnosticsHealthAssessment {
  const failedReadinessCheckIds = selectFailedReadinessCheckIds(input.readiness);
  const outbox = assessOutboxOperations({
    configured: input.outboxConfigured,
    enabled: input.outboxEnabled,
    running: input.outboxRunning ?? true,
    stats: input.outboxStats
      ? { pending: input.outboxStats.pending ?? 0, failed: input.outboxStats.failed }
      : null,
    oldestDuePendingCreatedAt: input.oldestDuePendingCreatedAt ?? null,
    newestFailedAt: input.newestFailedAt ?? null,
    lastDispatchErrorAt: input.lastDispatchErrorAt ?? null,
    nowMs: input.nowMs,
  });

  const degradedReasons: AdminDiagnosticsDegradedReason[] = [];
  if (!input.mongoConnected) {
    degradedReasons.push("MONGODB_DISCONNECTED");
  }
  if (!input.emailHealthy) {
    degradedReasons.push("EMAIL_UNHEALTHY");
  }
  if (outbox.degradesApi && outbox.reasons.includes("DISPATCHER_STOPPED")) {
    degradedReasons.push("OUTBOX_DISPATCHER_STOPPED");
  }
  if (outbox.degradesApi && outbox.reasons.includes("OVERDUE_PENDING")) {
    degradedReasons.push("OUTBOX_OVERDUE_PENDING");
  }
  if (outbox.degradesApi && outbox.reasons.includes("RECENT_FAILURE")) {
    degradedReasons.push("OUTBOX_RECENT_FAILURE");
  }
  if (outbox.degradesApi && outbox.reasons.includes("DISPATCH_ERROR")) {
    degradedReasons.push("OUTBOX_DISPATCH_ERROR");
  }
  if (failedReadinessCheckIds.length > 0) {
    degradedReasons.push("READINESS_CHECK_FAILED");
  }

  return {
    status: degradedReasons.length === 0 ? "healthy" : "degraded",
    degradedReasons,
    emailUnhealthyReason: deriveEmailUnhealthyReason({
      healthy: input.emailHealthy,
      configured: input.emailConfigured,
      lastFailureCategory: input.emailLastFailureCategory,
    }),
    outboxFailedCountReason: null,
    failedReadinessCheckIds,
    mongodbDisconnectedReason: input.mongoConnected ? null : "MONGODB_DISCONNECTED",
  };
}
