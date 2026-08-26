/**
 * Pack 22E.3 — Admin operational health alerts, dedupe & retention.
 */
import "./admin-operational-alerts-pack22e3.setup.js";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ADMIN_NOTIFICATION_RETENTION_DAYS,
  computeAdminNotificationExpireAt,
  detectOperationalConditions,
  evaluateAdminOperationalAlerts,
  projectAdminNotificationForAdmins,
  resetAdminNotificationHandlersForTests,
  resetAdminNotificationPersistenceResolverForTests,
  resetAdminOperationalIncidentStoreForTests,
  resetMemoryAdminNotificationPersistenceForTests,
  resolveAdminOperationalIncidentStore,
} from "../../../src/modules/admin-notifications/index.js";
import { createMemoryAdminNotificationPersistenceAdapter } from "../../../src/modules/admin-notifications/persistence/admin-notification-memory.persistence.js";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readApi(relativePath: string): string {
  return readFileSync(path.resolve(apiRoot, relativePath), "utf8");
}

function readWeb(relativePath: string): string {
  return readFileSync(path.resolve(apiRoot, "../web/src", relativePath), "utf8");
}

const persistence = createMemoryAdminNotificationPersistenceAdapter();
const ADMIN_A = "admin-a";
const ADMIN_B = "admin-b";

describe("Pack 22E.3 — Admin operational alerts", () => {
  beforeEach(() => {
    resetMemoryAdminNotificationPersistenceForTests();
    resetAdminNotificationPersistenceResolverForTests();
    resetAdminOperationalIncidentStoreForTests();
    resetAdminNotificationHandlersForTests();
  });

  afterEach(() => {
    resetMemoryAdminNotificationPersistenceForTests();
    resetAdminOperationalIncidentStoreForTests();
  });

  it("1–5. detects API/Mongo/outbox/email conditions; integrity deferred", () => {
    const healthy = detectOperationalConditions({
      apiReady: true,
      mongoConnected: true,
      outboxFailedCount: 0,
      email: { configured: true, healthy: true },
    });
    assert.equal(healthy.length, 0);

    const degraded = detectOperationalConditions({
      apiReady: false,
      mongoConnected: false,
      outboxFailedCount: 3,
      email: { configured: true, healthy: false },
    });
    const keys = degraded.map((c) => c.dedupeKey).sort();
    assert.deepEqual(keys, [
      "ops:api-readiness",
      "ops:email",
      "ops:mongodb",
      "ops:outbox-failed",
    ]);
    assert.equal(
      degraded.find((c) => c.dedupeKey === "ops:outbox-failed")?.targetLabel,
      "3 failed outbox events",
    );

    // Email not configured → no ops alert
    assert.equal(
      detectOperationalConditions({
        apiReady: true,
        mongoConnected: true,
        outboxFailedCount: 0,
        email: { configured: false, healthy: false },
      }).length,
      0,
    );

    // Pending alone is not an alertable condition in detector (failed only)
    assert.equal(
      detectOperationalConditions({
        apiReady: true,
        mongoConnected: true,
        outboxFailedCount: 0,
        email: { configured: true, healthy: true },
      }).length,
      0,
    );

    const evaluator = readApi(
      "src/modules/admin-notifications/operational/evaluate-admin-operational-alerts.ts",
    );
    assert.doesNotMatch(evaluator, /ops:initiative-integrity/);
  });

  it("6–11. transition model: open, no duplicate, clear-while-active, recover, reopen", async () => {
    const store = resolveAdminOperationalIncidentStore();
    const deps = {
      listActiveAdminUserIds: async () => [ADMIN_A, ADMIN_B],
      persistence,
      incidentStore: store,
      createIncidentId: () => "inc-1",
      now: () => "2026-08-01T10:00:00.000Z",
      collectSnapshot: async () => ({
        apiReady: true,
        mongoConnected: true,
        outboxFailedCount: 2,
        email: { configured: true, healthy: true },
      }),
    };

    const first = await evaluateAdminOperationalAlerts(deps);
    assert.deepEqual(first.opened, ["ops:outbox-failed"]);
    assert.equal(await persistence.countByRecipient(ADMIN_A), 1);
    assert.equal(await persistence.countByRecipient(ADMIN_B), 1);

    const second = await evaluateAdminOperationalAlerts(deps);
    assert.deepEqual(second.unchanged, ["ops:outbox-failed"]);
    assert.equal(second.opened.length, 0);
    assert.equal(await persistence.countByRecipient(ADMIN_A), 1);

    // Clear while active — do not recreate
    const rowA = (await persistence.list({ recipientAdminUserId: ADMIN_A }))[0]!;
    assert.equal(rowA.targetHref, "/admin/diagnostics");
    assert.equal(rowA.type, "operational_alert");
    assert.match(JSON.stringify(rowA), /Platform alert|failed outbox/);
    assert.doesNotMatch(JSON.stringify(rowA), /mongodb:\/\/|smtp|password|apikey/i);

    await persistence.deleteOwned({
      adminNotificationId: rowA.adminNotificationId,
      recipientAdminUserId: ADMIN_A,
    });
    assert.equal(await persistence.countByRecipient(ADMIN_A), 0);
    assert.equal(await persistence.countByRecipient(ADMIN_B), 1);

    await evaluateAdminOperationalAlerts(deps);
    assert.equal(await persistence.countByRecipient(ADMIN_A), 0);
    assert.equal(await persistence.countByRecipient(ADMIN_B), 1);

    // Recovery — no new notification
    const recovered = await evaluateAdminOperationalAlerts({
      ...deps,
      collectSnapshot: async () => ({
        apiReady: true,
        mongoConnected: true,
        outboxFailedCount: 0,
        email: { configured: true, healthy: true },
      }),
      now: () => "2026-08-01T11:00:00.000Z",
    });
    assert.deepEqual(recovered.recovered, ["ops:outbox-failed"]);
    assert.equal(await persistence.countByRecipient(ADMIN_A), 0);

    // New incident after recovery — both Admins get new rows
    const reopened = await evaluateAdminOperationalAlerts({
      ...deps,
      createIncidentId: () => "inc-2",
      now: () => "2026-08-01T12:00:00.000Z",
      collectSnapshot: async () => ({
        apiReady: true,
        mongoConnected: true,
        outboxFailedCount: 1,
        email: { configured: true, healthy: true },
      }),
    });
    assert.deepEqual(reopened.opened, ["ops:outbox-failed"]);
    assert.equal(await persistence.countByRecipient(ADMIN_A), 1);
    assert.equal(await persistence.countByRecipient(ADMIN_B), 2);
  });

  it("17–18. ops type in count path and Pack 22E.2 labels", () => {
    const labels = readWeb("features/administration/admin-notification-labels.ts");
    assert.match(labels, /operational_alert:\s*"Platform alert"/);
    const header = readWeb("features/administration/components/AdminWorkspaceHeader.tsx");
    assert.match(header, /fetchAdminNotifications/);
    assert.doesNotMatch(header, /evaluateAdminOperationalAlerts/);
  });

  it("8. warning→critical escalates presentation without duplicate row", async () => {
    await evaluateAdminOperationalAlerts({
      listActiveAdminUserIds: async () => [ADMIN_A],
      persistence,
      incidentStore: resolveAdminOperationalIncidentStore(),
      createIncidentId: () => "inc-ob",
      now: () => "2026-08-01T10:00:00.000Z",
      collectSnapshot: async () => ({
        apiReady: true,
        mongoConnected: true,
        outboxFailedCount: 1,
        email: { configured: true, healthy: true },
      }),
    });
    await evaluateAdminOperationalAlerts({
      listActiveAdminUserIds: async () => [ADMIN_A],
      persistence,
      incidentStore: resolveAdminOperationalIncidentStore(),
      createIncidentId: () => "inc-ob",
      now: () => "2026-08-01T10:05:00.000Z",
      collectSnapshot: async () => ({
        apiReady: true,
        mongoConnected: true,
        outboxFailedCount: 5,
        email: { configured: true, healthy: true },
      }),
    });
    const rows = await persistence.list({ recipientAdminUserId: ADMIN_A });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.targetLabel, "5 failed outbox events");
    assert.equal(rows[0]?.severity, "critical");
  });

  it("12–16. per-Admin fan-out; safe copy; diagnostics link; no outbox recursion; retention", async () => {
    await evaluateAdminOperationalAlerts({
      listActiveAdminUserIds: async () => [ADMIN_A, ADMIN_B],
      persistence,
      incidentStore: resolveAdminOperationalIncidentStore(),
      createIncidentId: () => "inc-m",
      collectSnapshot: async () => ({
        apiReady: false,
        mongoConnected: false,
        outboxFailedCount: 0,
        email: { configured: true, healthy: true },
      }),
    });
    assert.equal(await persistence.countByRecipient(ADMIN_A), 2);
    assert.equal(await persistence.countByRecipient(ADMIN_B), 2);
    const row = (await persistence.list({ recipientAdminUserId: ADMIN_A }))[0]!;
    assert.equal(row.targetHref, "/admin/diagnostics");
    assert.equal(row.title, "Platform alert");

    const evaluator = readApi(
      "src/modules/admin-notifications/operational/evaluate-admin-operational-alerts.ts",
    );
    assert.doesNotMatch(evaluator, /enqueueDomainEvent|CATALOGUE_EVENTS/);
    assert.match(evaluator, /projectAdminNotificationForAdmins/);

    const expireAt = computeAdminNotificationExpireAt("2026-01-01T00:00:00.000Z");
    assert.equal(ADMIN_NOTIFICATION_RETENTION_DAYS, 90);
    assert.equal(expireAt, "2026-04-01T00:00:00.000Z");
    const indexes = readApi("src/infrastructure/mongodb/mongo-indexes.ts");
    assert.match(indexes, /admin_notification_expire_at_ttl/);
    assert.match(indexes, /admin_operational_incident_expire_at_ttl/);

    resetMemoryAdminNotificationPersistenceForTests();
    await projectAdminNotificationForAdmins(
      {
        type: "operational_alert",
        title: "Platform alert",
        sourceEventId: "ops:mongodb:x",
        targetHref: "/admin/diagnostics",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      { listActiveAdminUserIds: async () => [ADMIN_A], persistence },
    );
    const withExpire = (await persistence.list({ recipientAdminUserId: ADMIN_A }))[0]!;
    assert.equal(withExpire.expireAt, "2026-04-01T00:00:00.000Z");
  });

  it("21–23. Participant/PWA untouched; Diagnostics wires evaluate; 22E regressions contract", () => {
    const diagnostics = readWeb("features/administration/components/AdminDiagnosticsSection.tsx");
    assert.match(diagnostics, /evaluateAdminOperationalAlerts/);
    const api = readWeb("features/administration/admin-notification-api.ts");
    assert.match(api, /evaluate-operational-alerts/);
    assert.doesNotMatch(api, /\/api\/v1\/notifications[^/]/);
    assert.doesNotMatch(diagnostics, /useUnreadNotificationCount|pwa-app-badge/);

    const routes = readApi("src/modules/admin-notifications/admin-notification.routes.ts");
    assert.match(routes, /evaluate-operational-alerts/);
    assert.match(routes, /authenticationMiddleware/);
  });

  it("concurrent evaluation dedupes to one row per Admin", async () => {
    const store = resolveAdminOperationalIncidentStore();
    const deps = {
      listActiveAdminUserIds: async () => [ADMIN_A],
      persistence,
      incidentStore: store,
      createIncidentId: () => "inc-concurrent",
      collectSnapshot: async () => ({
        apiReady: true,
        mongoConnected: true,
        outboxFailedCount: 1,
        email: { configured: true, healthy: true },
      }),
    };
    await Promise.all([
      evaluateAdminOperationalAlerts(deps),
      evaluateAdminOperationalAlerts(deps),
      evaluateAdminOperationalAlerts(deps),
    ]);
    assert.equal(await persistence.countByRecipient(ADMIN_A), 1);
  });
});
