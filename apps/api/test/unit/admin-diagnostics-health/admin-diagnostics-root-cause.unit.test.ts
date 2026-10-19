/**
 * HU-DIAG.04B — Admin diagnostics root cause and failed-outbox summary.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { AdministrationForbiddenError } from "../../../src/modules/administration/administration.errors.js";
import {
  FAILED_OUTBOX_BREAKDOWN_GROUP_LIMIT,
  FAILED_OUTBOX_SCAN_CAP,
  assembleAdminOutboxFailureSummary,
  buildFailedOutboxSummary,
  safeOutboxAggregateType,
  safeOutboxEventName,
  type FailedOutboxScanRow,
} from "../../../src/modules/administration/admin-diagnostics-outbox-failure-summary.js";
import {
  assessAdminDiagnosticsHealth,
  classifyAdminDiagnosticsActor,
  resolveAdminDiagnosticsHttpStatus,
} from "../../../src/modules/administration/admin-diagnostics-root-cause.js";
import { assessOutboxOperations } from "../../../src/infrastructure/outbox/outbox-operational-health.js";
import { failedAtForOutboxTransition } from "../../../src/infrastructure/outbox/outbox.repository.js";
import { FAILED_OUTBOX_DIAGNOSTIC_PROJECTION } from "../../../src/infrastructure/outbox/outbox.repository.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../..");

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

const SECRET_ERROR =
  '535 authentication failed for smtp user@example.com password=hunter2 payload={"token":"abc"} aggregateId=secret-agg';

function healthyProbes() {
  return {
    mongoConnected: true,
    emailHealthy: true,
    emailConfigured: true,
    emailLastFailureCategory: null,
    outboxConfigured: true,
    outboxEnabled: true,
    outboxStats: { failed: 0 },
    readiness: [{ id: "mongodb", status: "pass" }],
  };
}

function collectKeys(value: unknown, keys: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeys(item, keys);
    }
    return keys;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      keys.push(key);
      collectKeys(child, keys);
    }
  }
  return keys;
}

describe("HU-DIAG.04B — Admin authorization", () => {
  it("maps an authenticated non-admin actor to HTTP 403", () => {
    const decision = classifyAdminDiagnosticsActor({
      userId: "member-1",
      user: { status: "active", role: "member" },
    });
    assert.equal(decision, "forbidden");
    assert.equal(resolveAdminDiagnosticsHttpStatus(new AdministrationForbiddenError()), 403);
    assert.equal(
      classifyAdminDiagnosticsActor({
        userId: "admin-1",
        user: { status: "disabled", role: "admin" },
      }),
      "forbidden",
    );
    assert.equal(
      classifyAdminDiagnosticsActor({ userId: "  ", user: { status: "active", role: "admin" } }),
      "unauthorized",
    );
    assert.equal(resolveAdminDiagnosticsHttpStatus(new Error("nope")), 500);

    const routes = readRepo(
      "apps/api/src/modules/administration/admin-diagnostics-health.routes.ts",
    );
    assert.match(routes, /resolveAdminDiagnosticsHttpStatus/);
    assert.match(routes, /"\/outbox-failures"/);
    assert.doesNotMatch(routes, /outbox-failures[\s\S]{0,180}router\.(post|patch|put|delete)/i);
  });
});

describe("HU-DIAG.04B — health reasons reuse existing predicates", () => {
  it("keeps stats=null from degrading health or implying zero failures", async () => {
    const assessment = assessAdminDiagnosticsHealth({
      ...healthyProbes(),
      outboxStats: null,
    });
    assert.equal(assessment.status, "healthy");
    assert.equal(assessment.outboxFailedCountReason, null);
    assert.equal(
      assessment.degradedReasons.some((reason) => reason.startsWith("OUTBOX_")),
      false,
    );

    let reads = 0;
    const summary = await assembleAdminOutboxFailureSummary({
      health: {
        enabled: true,
        configured: true,
        running: false,
        stats: null,
        lastDispatchAt: "2024-01-02T03:04:05.000Z",
      },
      scanCap: FAILED_OUTBOX_SCAN_CAP,
      readOldestFailedRows: async () => {
        reads += 1;
        return [];
      },
      readEnqueueBounds: async () => {
        reads += 1;
        return { oldestCreatedAt: null, newestCreatedAt: null };
      },
    });
    assert.equal(reads, 0);
    assert.equal(summary.countsAvailable, false);
    assert.equal(summary.totalFailed, null);
    assert.equal(summary.pendingCount, null);
    assert.match(summary.sample.coverageNote ?? "", /not reported as zero/);
    assert.equal(summary.impact.classification, "unavailable");
  });

  it("reports safe degraded reasons, readiness ids, and email categories", () => {
    const assessment = assessAdminDiagnosticsHealth({
      mongoConnected: false,
      emailHealthy: false,
      emailConfigured: true,
      emailLastFailureCategory: "auth_failure",
      outboxConfigured: true,
      outboxEnabled: true,
      outboxStats: { failed: 3 },
      readiness: [
        { id: "jwt", status: "fail" },
        { id: "assistant", status: "warn" },
        { id: "user@example.com", status: "fail" },
        { id: "mongodb", status: "pass" },
      ],
    });

    assert.deepEqual(assessment.degradedReasons, [
      "MONGODB_DISCONNECTED",
      "EMAIL_UNHEALTHY",
      "READINESS_CHECK_FAILED",
    ]);
    assert.equal(assessment.mongodbDisconnectedReason, "MONGODB_DISCONNECTED");
    assert.equal(assessment.emailUnhealthyReason, "AUTH_FAILURE");
    assert.equal(assessment.outboxFailedCountReason, null);
    assert.deepEqual(assessment.failedReadinessCheckIds, ["jwt", "UNKNOWN"]);
    assert.equal(assessment.status, "degraded");
    assert.doesNotMatch(JSON.stringify(assessment), /user@example.com|password|mongodb:\/\//i);
  });

  it("does not degrade on historical failed rows and does degrade on active faults", () => {
    const now = Date.parse("2026-10-19T00:00:00.000Z");
    const historical = assessAdminDiagnosticsHealth({
      ...healthyProbes(),
      outboxStats: { pending: 0, failed: 6306 },
      newestFailedAt: null,
      nowMs: now,
    });
    assert.equal(historical.status, "healthy");
    assert.equal(historical.outboxFailedCountReason, null);
    assert.deepEqual(historical.degradedReasons, []);

    const recent = assessAdminDiagnosticsHealth({
      ...healthyProbes(),
      outboxStats: { pending: 0, failed: 6306 },
      newestFailedAt: "2026-10-18T12:00:00.000Z",
      nowMs: now,
    });
    assert.equal(recent.status, "degraded");
    assert.deepEqual(recent.degradedReasons, ["OUTBOX_RECENT_FAILURE"]);

    const stoppedDue = assessAdminDiagnosticsHealth({
      ...healthyProbes(),
      outboxRunning: false,
      outboxStats: { pending: 1, failed: 0 },
      oldestDuePendingCreatedAt: "2026-10-18T23:00:00.000Z",
      nowMs: now,
    });
    assert.deepEqual(stoppedDue.degradedReasons, ["OUTBOX_DISPATCHER_STOPPED"]);

    const overdue = assessAdminDiagnosticsHealth({
      ...healthyProbes(),
      outboxRunning: true,
      outboxStats: { pending: 1, failed: 0 },
      oldestDuePendingCreatedAt: "2026-10-18T23:00:00.000Z",
      nowMs: now,
    });
    assert.deepEqual(overdue.degradedReasons, ["OUTBOX_OVERDUE_PENDING"]);

    const dispatchError = assessAdminDiagnosticsHealth({
      ...healthyProbes(),
      outboxStats: { pending: 0, failed: 0 },
      lastDispatchErrorAt: "2026-10-18T23:30:00.000Z",
      nowMs: now,
    });
    assert.deepEqual(dispatchError.degradedReasons, ["OUTBOX_DISPATCH_ERROR"]);

    const stoppedIdle = assessOutboxOperations({
      configured: true,
      enabled: true,
      running: false,
      stats: { pending: 0, failed: 6306 },
      oldestDuePendingCreatedAt: null,
      newestFailedAt: null,
      lastDispatchErrorAt: null,
      nowMs: now,
    });
    assert.equal(stoppedIdle.severity, "warning");
    assert.equal(stoppedIdle.degradesApi, false);

    const unconfigured = assessOutboxOperations({
      configured: false,
      enabled: false,
      running: false,
      stats: { pending: 0, failed: 0 },
      oldestDuePendingCreatedAt: null,
      newestFailedAt: null,
      lastDispatchErrorAt: null,
    });
    assert.equal(unconfigured.severity, "warning");
    assert.equal(unconfigured.degradesApi, false);

    const missing = assessOutboxOperations({
      configured: true,
      enabled: true,
      running: true,
      stats: null,
      oldestDuePendingCreatedAt: null,
      newestFailedAt: null,
      lastDispatchErrorAt: null,
    });
    assert.equal(missing.severity, "unknown");
    assert.equal(missing.degradesApi, false);

    assert.equal(
      failedAtForOutboxTransition({
        existingStatus: "pending",
        nextStatus: "failed",
        nowIso: "2026-10-19T00:00:00.000Z",
      }),
      "2026-10-19T00:00:00.000Z",
    );
    assert.equal(
      failedAtForOutboxTransition({
        existingStatus: "failed",
        nextStatus: "failed",
        nowIso: "2026-10-19T01:00:00.000Z",
      }),
      null,
    );
    assert.equal(
      failedAtForOutboxTransition({
        existingStatus: "pending",
        nextStatus: "pending",
        nowIso: "2026-10-19T00:00:00.000Z",
      }),
      null,
    );
  });

  it("maps unknown email categories to UNKNOWN and ignores historical categories when healthy", () => {
    assert.equal(
      assessAdminDiagnosticsHealth({
        ...healthyProbes(),
        emailHealthy: false,
        emailConfigured: true,
        emailLastFailureCategory: "http_401 password=secret",
      }).emailUnhealthyReason,
      "UNKNOWN",
    );
    assert.equal(
      assessAdminDiagnosticsHealth({
        ...healthyProbes(),
        emailLastFailureCategory: "auth_failure",
      }).emailUnhealthyReason,
      null,
    );
    assert.equal(
      assessAdminDiagnosticsHealth({
        ...healthyProbes(),
        emailHealthy: false,
        emailConfigured: false,
        emailLastFailureCategory: "auth_failure",
      }).emailUnhealthyReason,
      "NOT_CONFIGURED",
    );
  });

  it("does not change the public health route", () => {
    const health = readRepo("apps/api/src/routes/health.routes.ts");
    assert.match(health, /isPublicMinimalHealthSurface/);
    assert.doesNotMatch(health, /degradedReasons|outbox-failures|emailUnhealthyReason/);
  });
});

describe("HU-DIAG.04B — failed outbox summary", () => {
  it("excludes raw errors, payloads, ids, and unsafe names from the response", () => {
    const summary = buildFailedOutboxSummary({
      rows: [
        {
          eventName: "PetitionSigned",
          aggregateType: "PetitionSignature",
          attempts: 2,
          createdAt: "2024-01-01T00:00:00.000Z",
          lastError: SECRET_ERROR,
        },
        {
          eventName: "user@example.com <script>",
          aggregateType: "mongodb://user:secret@host/db",
          attempts: 1,
          createdAt: "not-a-timestamp user@example.com",
          lastError: "something unrecognized",
        },
      ],
      totalFailed: 2,
      pendingCount: 4,
      dispatcher: { running: true, enabled: true, configured: true },
      lastDispatchAt: "2024-02-02T00:00:00.000Z",
      scanCap: FAILED_OUTBOX_SCAN_CAP,
      oldestEnqueuedAt: "2024-01-01T00:00:00.000Z",
      newestEnqueuedAt: "2024-03-03T00:00:00.000Z",
      boundsAvailable: true,
    });

    const keys = new Set(collectKeys(summary));
    for (const forbidden of [
      "lastError",
      "aggregateId",
      "eventId",
      "envelope",
      "payload",
      "correlationId",
      "outboxId",
    ]) {
      assert.equal(keys.has(forbidden), false, forbidden);
    }
    const serialized = JSON.stringify(summary);
    assert.doesNotMatch(serialized, /user@example.com|hunter2|secret-agg|mongodb:\/\/|<script>/);
    assert.equal(
      summary.byEventName.some((group) => group.key === "PetitionSigned"),
      true,
    );
    assert.equal(
      summary.byEventName.some((group) => group.key === "UNKNOWN"),
      true,
    );
    assert.equal(
      summary.byAggregateType.some((group) => group.key === "PetitionSignature"),
      true,
    );
    assert.equal(
      summary.byFailureCategory.some((group) => group.key === "AUTH_FAILURE"),
      true,
    );
    assert.equal(
      summary.byFailureCategory.some((group) => group.key === "UNKNOWN"),
      true,
    );
    assert.equal(safeOutboxEventName("MemberRegistered"), "MemberRegistered");
    assert.equal(safeOutboxEventName("MemberRegistered\npassword=secret"), "UNKNOWN");
    assert.equal(safeOutboxAggregateType("Member"), "Member");
    assert.equal(safeOutboxAggregateType("Member password=secret"), "UNKNOWN");
    assert.deepEqual(Object.keys(FAILED_OUTBOX_DIAGNOSTIC_PROJECTION).sort(), [
      "aggregateType",
      "attempts",
      "createdAt",
      "eventName",
      "lastError",
    ]);
  });

  it("labels a capped scan as the oldest rows and states scanned versus total", () => {
    const rows: FailedOutboxScanRow[] = [
      {
        eventName: "PetitionSigned",
        aggregateType: "PetitionSignature",
        attempts: 1,
        createdAt: "2024-01-01T00:00:00.000Z",
        lastError: "connection reset",
      },
      {
        eventName: "PetitionSigned",
        aggregateType: "PetitionSignature",
        attempts: 4,
        createdAt: "2024-01-02T00:00:00.000Z",
        lastError: "connection reset",
      },
      {
        eventName: "MemberRegistered",
        aggregateType: "Member",
        attempts: null,
        createdAt: "2024-01-03T00:00:00.000Z",
        lastError: null,
      },
    ];
    const summary = buildFailedOutboxSummary({
      rows,
      totalFailed: 8,
      pendingCount: 1,
      dispatcher: { running: true, enabled: true, configured: true },
      lastDispatchAt: "2024-04-01T00:00:00.000Z",
      scanCap: 3,
      oldestEnqueuedAt: "2023-12-01T00:00:00.000Z",
      newestEnqueuedAt: "2024-06-01T00:00:00.000Z",
      boundsAvailable: true,
    });

    assert.equal(summary.sample.limited, true);
    assert.equal(summary.sample.order, "oldest");
    assert.equal(summary.sample.label, "oldest 3");
    assert.equal(summary.sample.scannedCount, 3);
    assert.match(summary.sample.coverageNote ?? "", /limited sample/);
    assert.match(summary.sample.coverageNote ?? "", /Scanned 3 of 8/);
    assert.doesNotMatch(`${summary.sample.label} ${summary.sample.coverageNote}`, /top/i);
    assert.equal(summary.timestamps.oldestFailedEnqueuedAt, "2023-12-01T00:00:00.000Z");
    assert.equal(summary.timestamps.newestFailedEnqueuedAt, "2024-06-01T00:00:00.000Z");
    assert.notEqual(summary.timestamps.newestFailedEnqueuedAt, "2024-01-03T00:00:00.000Z");
    assert.equal(summary.timestamps.actualFailureAt, null);
    assert.equal(summary.timestamps.actualFailureLabel, "Actual failure time");
    assert.equal(summary.timestamps.oldestFailedEnqueuedAtLabel, "Failed-row enqueue time");
    assert.equal(summary.timestamps.lastDispatchLabel, "Last dispatcher cycle");
    assert.match(summary.attempts.note ?? "", /not the full failed set/);
    assert.equal(summary.attempts.missingCount, 1);
  });

  it("discloses the first-10 group limit when the scan itself is complete", () => {
    const names = [
      "ActivityClosed",
      "ActivityCreated",
      "ActivityRevised",
      "AdministrationAuditRecorded",
      "BlogAdminSubscriberMessageQueued",
      "BlogAuthorCapabilityGranted",
      "BlogPostArchived",
      "BlogPostChangesRequested",
      "BlogPostEditoriallyDeclined",
      "BlogPostPublished",
      "BlogPostSocialDistributionRequested",
    ];
    const summary = buildFailedOutboxSummary({
      rows: names.map((eventName) => ({
        eventName,
        aggregateType: "BlogPost",
        attempts: 1,
        createdAt: "2024-01-01T00:00:00.000Z",
        lastError: "handler rejected the event",
      })),
      totalFailed: names.length,
      pendingCount: 0,
      dispatcher: { running: true, enabled: true, configured: true },
      lastDispatchAt: null,
      scanCap: FAILED_OUTBOX_SCAN_CAP,
      oldestEnqueuedAt: "2024-01-01T00:00:00.000Z",
      newestEnqueuedAt: "2024-01-01T00:00:00.000Z",
      boundsAvailable: true,
    });

    assert.equal(summary.sample.limited, false);
    assert.equal(summary.sample.coverageNote, null);
    assert.equal(summary.byEventName.length, FAILED_OUTBOX_BREAKDOWN_GROUP_LIMIT);
    assert.equal(summary.breakdown.eventNameTruncated, true);
    assert.equal(
      summary.byEventName.some((group) => group.key === "BlogPostSocialDistributionRequested"),
      false,
    );
    assert.match(summary.breakdown.limitNote, /first 10 groups/);
    assert.match(summary.breakdown.limitNote, /scan is complete/);
    assert.doesNotMatch(summary.breakdown.limitNote, /top/i);
  });

  it("does not invent timestamps or attempt numbers when optional fields are missing", () => {
    const summary = buildFailedOutboxSummary({
      rows: [
        {
          eventName: "PetitionSigned",
          aggregateType: "PetitionSignature",
          attempts: null,
          createdAt: null,
          lastError: null,
        },
      ],
      totalFailed: 1,
      pendingCount: 0,
      dispatcher: { running: false, enabled: true, configured: true },
      lastDispatchAt: "not-a-time",
      scanCap: 500,
      oldestEnqueuedAt: null,
      newestEnqueuedAt: "yesterday",
      boundsAvailable: false,
    });

    assert.equal(summary.attempts.min, null);
    assert.equal(summary.attempts.max, null);
    assert.equal(summary.attempts.sum, null);
    assert.equal(summary.attempts.missingCount, 1);
    assert.equal(summary.timestamps.oldestFailedEnqueuedAt, null);
    assert.equal(summary.timestamps.newestFailedEnqueuedAt, null);
    assert.equal(summary.timestamps.actualFailureAt, null);
    assert.equal(summary.lastDispatchAt, null);
    assert.equal(summary.byFailureCategory[0]?.key, "UNKNOWN");
    assert.equal(summary.dispatcher.running, false);
    assert.equal(summary.dispatcher.enabled, true);
  });
});
