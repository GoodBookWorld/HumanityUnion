/**
 * Admin diagnostics root-cause identifiers.
 * Predicates are the existing health-route rules (Mongo, email, outbox failed
 * count, readiness checklist failures). This module does not define new
 * health thresholds.
 */

import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "./administration.errors.js";

export const ADMIN_DIAGNOSTICS_DEGRADED_REASONS = [
  "MONGODB_DISCONNECTED",
  "EMAIL_UNHEALTHY",
  "OUTBOX_FAILED_COUNT",
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
  outboxStats: { failed: number } | null;
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
 * "fail", and the outbox predicate below.
 * Outbox degrades health only when it is configured, enabled, stats are
 * present, and the failed count is greater than zero. A disabled or
 * unconfigured outbox is not an active degradation cause, including when
 * historical failed rows exist. Missing stats are not treated as zero.
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
  const outboxDegraded =
    input.outboxConfigured &&
    input.outboxEnabled &&
    input.outboxStats !== null &&
    input.outboxStats.failed > 0;

  const degradedReasons: AdminDiagnosticsDegradedReason[] = [];
  if (!input.mongoConnected) {
    degradedReasons.push("MONGODB_DISCONNECTED");
  }
  if (!input.emailHealthy) {
    degradedReasons.push("EMAIL_UNHEALTHY");
  }
  if (outboxDegraded) {
    degradedReasons.push("OUTBOX_FAILED_COUNT");
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
    outboxFailedCountReason: outboxDegraded ? "OUTBOX_FAILED_COUNT" : null,
    failedReadinessCheckIds,
    mongodbDisconnectedReason: input.mongoConnected ? null : "MONGODB_DISCONNECTED",
  };
}
