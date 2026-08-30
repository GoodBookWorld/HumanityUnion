/**
 * Admin Diagnostics — detailed infrastructure health (authenticated Admin only).
 * Public /api/v1/health remains minimal/redacted in production.
 */

import { environment } from "../../config/environment.js";
import { resolvePlatformMode } from "../../config/platform.config.js";
import { checkMongoConnection } from "../../infrastructure/mongodb/mongo-health.js";
import { getOutboxHealthStatus } from "../../infrastructure/outbox/outbox.dispatcher.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "../administration/administration.errors.js";
import { findAuthUserById } from "../auth/auth-user.repository.js";
import { getEmailProviderHealth } from "../email/email.service.js";

async function assertAdminActor(userId: string): Promise<void> {
  if (!userId.trim()) {
    throw new AdministrationUnauthorizedError("Authentication is required.");
  }
  const user = await findAuthUserById(userId);
  if (!user || user.status !== "active" || user.role !== "admin") {
    throw new AdministrationForbiddenError("Administrator access is required.");
  }
}

function sanitizeProbeMessage(message: string | null | undefined): string | null {
  if (!message?.trim()) return null;
  // Never leak connection strings / credentials if a probe embeds them.
  return message
    .replace(/mongodb(\+srv)?:\/\/[^\s"']+/gi, "[redacted-mongo-uri]")
    .replace(/[A-Za-z0-9+/_-]{24,}@[^\s"']+/g, "[redacted-credential]")
    .replace(/password=[^\s&"']+/gi, "password=[redacted]")
    .slice(0, 280);
}

export interface AdminDiagnosticsHealthPayload {
  status: "healthy" | "degraded";
  liveness: "alive";
  ready: boolean;
  platformMode: ReturnType<typeof resolvePlatformMode>;
  environment: string;
  mongodb: {
    connected: boolean;
    latencyMs: number | null;
    /** Database name only — never URI. */
    databaseConfigured: boolean;
    error: string | null;
  };
  email: {
    provider: string;
    healthy: boolean;
    configured: boolean;
    message: string | null;
    lastSuccessAt: string | null;
    lastFailureCategory: string | null;
  };
  outbox: {
    enabled: boolean;
    configured: boolean;
    running: boolean;
    stats: {
      pending: number;
      published: number;
      failed: number;
    } | null;
    lastDispatchAt: string | null;
    lastError: string | null;
  };
}

export async function getAdminDiagnosticsHealth(input: {
  actorUserId: string;
}): Promise<AdminDiagnosticsHealthPayload> {
  await assertAdminActor(input.actorUserId);

  const mongo = await checkMongoConnection();
  const email = await getEmailProviderHealth();
  const outbox = await getOutboxHealthStatus();

  const outboxDegraded =
    outbox.configured && outbox.enabled && outbox.stats !== null && outbox.stats.failed > 0;
  const status: "healthy" | "degraded" = mongo.connected
    ? email.healthy && !outboxDegraded
      ? "healthy"
      : "degraded"
    : "degraded";

  return {
    status,
    liveness: "alive",
    ready: mongo.connected,
    platformMode: resolvePlatformMode(),
    environment: environment.nodeEnv,
    mongodb: {
      connected: mongo.connected,
      latencyMs: mongo.latencyMs,
      databaseConfigured: Boolean(mongo.database),
      error: sanitizeProbeMessage(mongo.error),
    },
    email: {
      provider: email.provider,
      healthy: email.healthy,
      configured: email.configured,
      message: sanitizeProbeMessage(email.message),
      lastSuccessAt: email.lastSuccessAt ?? null,
      lastFailureCategory: email.lastFailureCategory ?? null,
    },
    outbox: {
      enabled: outbox.enabled,
      configured: outbox.configured,
      running: outbox.running,
      stats: outbox.stats
        ? {
            pending: outbox.stats.pending,
            published: outbox.stats.published,
            failed: outbox.stats.failed,
          }
        : null,
      lastDispatchAt: outbox.lastDispatchAt,
      lastError: sanitizeProbeMessage(outbox.lastError),
    },
  };
}
