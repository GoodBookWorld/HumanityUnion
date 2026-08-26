/**
 * Pack 22E.3 — evaluate platform health → Admin operational inbox (no outbox recursion).
 *
 * Trigger: Admin Diagnostics refresh calls evaluateAdminOperationalAlerts (idempotent).
 * Does NOT run on public /health probes or every Admin page load.
 */
import { randomUUID } from "node:crypto";

import type {
  AdminNotificationSeverity,
  AdminOpsDedupeKey,
  EmailProviderHealth,
} from "@hu/types";

import { checkMongoConnection } from "../../../infrastructure/mongodb/mongo-health.js";
import { getOutboxHealthStatus } from "../../../infrastructure/outbox/outbox.dispatcher.js";
import type { OutboxHealthStatus } from "../../../infrastructure/outbox/outbox.types.js";
import { getEmailProviderHealth } from "../../email/email.service.js";
import {
  ADMIN_NOTIFICATION_RETENTION_DAYS,
  projectAdminNotificationForAdmins,
  updateAdminNotificationsBySourceEventId,
  type AdminNotificationProjectionDeps,
} from "../admin-notification.service.js";
import {
  resolveAdminOperationalIncidentStore,
} from "./admin-operational-incident.store.js";
import type { AdminOperationalIncident } from "./admin-operational-incident.types.js";

export interface OperationalHealthSnapshot {
  apiReady: boolean;
  mongoConnected: boolean;
  outboxFailedCount: number;
  email: Pick<EmailProviderHealth, "configured" | "healthy">;
}

export interface DetectedOpsCondition {
  dedupeKey: AdminOpsDedupeKey;
  severity: AdminNotificationSeverity;
  targetLabel: string;
}

export interface EvaluateAdminOperationalAlertsResult {
  conditions: DetectedOpsCondition[];
  opened: string[];
  escalated: string[];
  recovered: string[];
  unchanged: string[];
}

export interface EvaluateAdminOperationalAlertsDeps extends AdminNotificationProjectionDeps {
  collectSnapshot?: () => Promise<OperationalHealthSnapshot>;
  incidentStore?: ReturnType<typeof resolveAdminOperationalIncidentStore>;
  now?: () => string;
  createIncidentId?: () => string;
}

const OPS_TITLE = "Platform alert";
const OPS_HREF = "/admin/diagnostics";

function incidentExpireAt(fromIso: string, days = ADMIN_NOTIFICATION_RETENTION_DAYS): string {
  const base = new Date(fromIso).getTime();
  const t = Number.isFinite(base) ? base : Date.now();
  return new Date(t + days * 24 * 60 * 60 * 1000).toISOString();
}

function sourceEventIdForIncident(dedupeKey: AdminOpsDedupeKey, incidentId: string): string {
  return `${dedupeKey}:${incidentId}`;
}

export function detectOperationalConditions(
  snapshot: OperationalHealthSnapshot,
): DetectedOpsCondition[] {
  const conditions: DetectedOpsCondition[] = [];

  if (!snapshot.apiReady) {
    conditions.push({
      dedupeKey: "ops:api-readiness",
      severity: "critical",
      targetLabel: "API readiness degraded",
    });
  }

  if (!snapshot.mongoConnected) {
    conditions.push({
      dedupeKey: "ops:mongodb",
      severity: "critical",
      targetLabel: "MongoDB unavailable",
    });
  }

  if (snapshot.outboxFailedCount > 0) {
    conditions.push({
      dedupeKey: "ops:outbox-failed",
      severity: "critical",
      targetLabel:
        snapshot.outboxFailedCount === 1
          ? "1 failed outbox event"
          : `${snapshot.outboxFailedCount} failed outbox events`,
    });
  }

  // Email: only when configured to operate and currently unhealthy.
  if (snapshot.email.configured && !snapshot.email.healthy) {
    conditions.push({
      dedupeKey: "ops:email",
      severity: "warning",
      targetLabel: "Email service unavailable",
    });
  }

  return conditions;
}

export async function collectLiveOperationalHealthSnapshot(): Promise<OperationalHealthSnapshot> {
  const mongo = await checkMongoConnection();
  const email = await getEmailProviderHealth();
  const outbox: OutboxHealthStatus = await getOutboxHealthStatus();
  const failed =
    outbox.configured && outbox.stats && typeof outbox.stats.failed === "number"
      ? outbox.stats.failed
      : 0;

  return {
    // Align with /health/ready: durable plane readiness = Mongo connected.
    apiReady: mongo.connected,
    mongoConnected: mongo.connected,
    outboxFailedCount: failed,
    email: { configured: email.configured, healthy: email.healthy },
  };
}

/**
 * Evaluate health → open/escalate/recover incidents → fan-out Admin inbox rows.
 * Direct projection write (no domain/outbox event) to avoid recursion.
 */
export async function evaluateAdminOperationalAlerts(
  deps: EvaluateAdminOperationalAlertsDeps = {},
): Promise<EvaluateAdminOperationalAlertsResult> {
  const now = deps.now?.() ?? new Date().toISOString();
  const snapshot = deps.collectSnapshot
    ? await deps.collectSnapshot()
    : await collectLiveOperationalHealthSnapshot();
  const conditions = detectOperationalConditions(snapshot);
  const store = deps.incidentStore ?? resolveAdminOperationalIncidentStore();
  const result: EvaluateAdminOperationalAlertsResult = {
    conditions,
    opened: [],
    escalated: [],
    recovered: [],
    unchanged: [],
  };
  const trackedKeys: AdminOpsDedupeKey[] = [
    "ops:api-readiness",
    "ops:mongodb",
    "ops:outbox-failed",
    "ops:email",
  ];

  for (const key of trackedKeys) {
    const existing = await store.findByDedupeKey(key);
    const condition = conditions.find((c) => c.dedupeKey === key);

    if (condition) {
      if (!existing || existing.state === "recovered") {
        const incidentId = deps.createIncidentId?.() ?? randomUUID();
        const incident: AdminOperationalIncident = {
          dedupeKey: key,
          incidentId,
          state: "active",
          severity: condition.severity,
          targetLabel: condition.targetLabel,
          openedAt: now,
          lastEvaluatedAt: now,
          expireAt: incidentExpireAt(now),
        };
        await store.upsert(incident);
        await projectAdminNotificationForAdmins(
          {
            type: "operational_alert",
            title: OPS_TITLE,
            targetLabel: condition.targetLabel,
            targetHref: OPS_HREF,
            sourceEventId: sourceEventIdForIncident(key, incidentId),
            dedupeKey: key,
            severity: condition.severity,
            createdAt: now,
          },
          deps,
        );
        result.opened.push(key);
        continue;
      }

      // Active incident: same severity → no new rows; escalate warning→critical if needed.
      const severityRank = (s: AdminNotificationSeverity) => (s === "critical" ? 2 : 1);
      const escalated =
        severityRank(condition.severity) > severityRank(existing.severity) ||
        condition.targetLabel !== existing.targetLabel;

      const next: AdminOperationalIncident = {
        ...existing,
        severity: condition.severity,
        targetLabel: condition.targetLabel,
        lastEvaluatedAt: now,
        expireAt: incidentExpireAt(existing.openedAt),
      };
      await store.upsert(next);

      if (escalated) {
        await updateAdminNotificationsBySourceEventId(
          {
            sourceEventId: sourceEventIdForIncident(key, existing.incidentId),
            title: OPS_TITLE,
            targetLabel: condition.targetLabel,
            severity: condition.severity,
          },
          deps,
        );
        result.escalated.push(key);
      } else {
        result.unchanged.push(key);
      }
      continue;
    }

    // Condition healthy: mark recovered if was active. Do not create recovery notifications.
    if (existing?.state === "active") {
      await store.upsert({
        ...existing,
        state: "recovered",
        recoveredAt: now,
        lastEvaluatedAt: now,
        expireAt: incidentExpireAt(now, 7),
      });
      result.recovered.push(key);
    } else if (existing) {
      await store.upsert({
        ...existing,
        lastEvaluatedAt: now,
      });
    }
  }

  return result;
}
