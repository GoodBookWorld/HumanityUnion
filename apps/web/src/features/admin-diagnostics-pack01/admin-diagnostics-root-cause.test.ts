/**
 * HU-DIAG.04B — Admin diagnostics root-cause display.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildTechnicalHealthSnapshot,
  deriveOutboxStatus,
} from "../administration/admin-diagnostics-model";
import {
  emailUnhealthyEvidence,
  formatOutboxFailureSummaryLines,
  type AdminOutboxFailureSummaryView,
} from "../administration/admin-diagnostics-root-cause";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

function summaryFixture(
  overrides: Partial<AdminOutboxFailureSummaryView> = {},
): AdminOutboxFailureSummaryView {
  return {
    countsAvailable: true,
    totalFailed: 8,
    pendingCount: 2,
    dispatcher: { running: true, enabled: true, configured: true },
    lastDispatchAt: "2024-05-01T00:00:00.000Z",
    sample: {
      order: "oldest",
      label: "oldest 3",
      scannedCount: 3,
      scanCap: 500,
      limited: true,
      coverageNote:
        "Breakdowns are based on a limited sample of the oldest 3 failed rows. Scanned 3 of 8 failed rows. This is not full coverage.",
    },
    byEventName: [{ key: "PetitionSigned", count: 3 }],
    byAggregateType: [{ key: "PetitionSignature", count: 3 }],
    byFailureCategory: [
      { key: "CONNECTION", count: 2 },
      { key: "UNKNOWN", count: 1 },
    ],
    breakdown: {
      groupLimit: 10,
      eventNameTruncated: false,
      aggregateTypeTruncated: false,
      failureCategoryTruncated: false,
      limitNote: "Breakdowns list at most the first 10 groups.",
    },
    attempts: {
      scope: "scanned_sample",
      min: 1,
      max: 4,
      sum: 6,
      count: 2,
      missingCount: 1,
      note: "Attempt statistics are based on the limited oldest-row sample (scanned 3 of 8), not the full failed set.",
    },
    timestamps: {
      oldestFailedEnqueuedAt: "2023-12-01T00:00:00.000Z",
      newestFailedEnqueuedAt: "2024-06-01T00:00:00.000Z",
      actualFailureAt: null,
      oldestFailedEnqueuedAtLabel: "Failed-row enqueue time",
      newestFailedEnqueuedAtLabel: "Failed-row enqueue time",
      actualFailureLabel: "Actual failure time",
      lastDispatchLabel: "Last dispatcher cycle",
    },
    impact: {
      classification: "mixed",
      text: "Some shown categories have a known publish failure. Remaining UNKNOWN categories have unknown operational impact.",
    },
    ...overrides,
  };
}

describe("HU-DIAG.04B — root-cause display", () => {
  it("labels email evidence as the last successful check and keeps failure time empty", () => {
    const evidence = emailUnhealthyEvidence({
      provider: "smtp",
      healthy: false,
      configured: true,
      lastSuccessAt: "2024-01-15T12:00:00.000Z",
      lastFailureCategory: "timeout",
    });
    const success = evidence.find((item) => item.kind === "last_successful_check");
    const failure = evidence.find((item) => item.kind === "actual_failure_time");
    assert.equal(success?.label, "Last successful check");
    assert.equal(success?.at, "2024-01-15T12:00:00.000Z");
    assert.doesNotMatch(success?.label ?? "", /failure/i);
    assert.equal(failure?.at, null);
    assert.equal(failure?.label, "Actual failure time");

    const snapshot = buildTechnicalHealthSnapshot({
      health: {
        status: "degraded",
        ready: true,
        emailUnhealthyReason: "TIMEOUT",
        email: {
          provider: "smtp",
          healthy: false,
          configured: true,
          lastSuccessAt: "2024-01-15T12:00:00.000Z",
        },
        mongodb: { connected: true, latencyMs: 4, error: null },
        outbox: {
          enabled: true,
          configured: true,
          running: true,
          stats: { pending: 0, published: 1, failed: 0 },
          lastError: null,
        },
      },
      ready: { ready: true },
      healthError: null,
      readyError: null,
      initiativeWarningCount: 0,
      initiativeError: null,
    });
    const email = snapshot.services.find((check) => check.id === "email");
    const cause = email?.rootCauses?.[0];
    assert.equal(cause?.failingCheck, "email.healthy");
    assert.equal(cause?.failureCategory, "TIMEOUT");
    assert.equal(
      cause?.evidence.find((item) => item.at === "2024-01-15T12:00:00.000Z")?.label,
      "Last successful check",
    );
    assert.equal(cause?.evidence.find((item) => item.kind === "actual_failure_time")?.at, null);
    assert.match(cause?.operationalImpact ?? "", /email/i);
    assert.match(cause?.recommendedAction ?? "", /does not send mail/);
  });

  it("shows scan limits, group truncation, and distinct timestamps", () => {
    const lines = formatOutboxFailureSummaryLines(summaryFixture());
    assert.match(lines.sampleLabel, /oldest 3/);
    assert.doesNotMatch(lines.sampleLabel, /top/i);
    assert.match(lines.coverageNote ?? "", /Scanned 3 of 8/);
    assert.match(lines.coverageNote ?? "", /limited sample/);
    assert.match(lines.coverageNote ?? "", /not full coverage/);
    assert.match(lines.eventTypes, /PetitionSigned/);
    assert.match(lines.categories, /CONNECTION/);
    assert.match(lines.categories, /UNKNOWN/);
    assert.match(lines.oldestEnqueue, /Failed-row enqueue time/);
    assert.match(lines.newestEnqueue, /Failed-row enqueue time/);
    assert.equal(lines.actualFailure, "Actual failure time: unavailable");
    assert.match(lines.lastDispatch, /Last dispatcher cycle/);
    assert.doesNotMatch(lines.lastDispatch, /email failure/i);
    assert.match(lines.impact, /unknown/);
    assert.match(lines.dispatcher, /running/);
    assert.match(lines.dispatcher, /enabled/);

    const truncated = formatOutboxFailureSummaryLines(
      summaryFixture({
        sample: {
          order: "oldest",
          label: "oldest 11",
          scannedCount: 11,
          scanCap: 500,
          limited: false,
          coverageNote: null,
        },
        breakdown: {
          groupLimit: 10,
          eventNameTruncated: true,
          aggregateTypeTruncated: false,
          failureCategoryTruncated: false,
          limitNote:
            "Only the first 10 groups are shown. The failed-row scan is complete, and further groups are omitted.",
        },
      }),
    );
    assert.match(truncated.limitNote, /first 10 groups/);
    assert.match(truncated.limitNote, /scan is complete/);
    assert.equal(truncated.coverageNote, null);
  });

  it("does not treat missing stats or optional fields as zero failures", () => {
    const unavailable = deriveOutboxStatus({
      outbox: {
        enabled: true,
        configured: true,
        running: true,
        stats: null,
        lastError: null,
      },
    });
    assert.equal(unavailable.status, "unknown");
    assert.doesNotMatch(`${unavailable.summary} ${unavailable.detail ?? ""}`, /Failed 0/);

    const snapshot = buildTechnicalHealthSnapshot({
      health: {
        status: "healthy",
        ready: true,
        mongodb: { connected: true },
        email: { healthy: false },
        outbox: { enabled: true, configured: true, running: true, stats: null },
      },
      ready: { ready: true },
      healthError: null,
      readyError: null,
      initiativeWarningCount: 0,
      initiativeError: null,
    });
    const email = snapshot.services.find((check) => check.id === "email");
    assert.equal(email?.rootCauses?.[0]?.failureCategory, "UNKNOWN");
    assert.equal(email?.rootCauses?.[0]?.evidence[0]?.at, null);
    assert.equal(snapshot.outbox.rootCauses?.[0]?.failureCategory, "STATS_UNAVAILABLE");
    assert.match(snapshot.outbox.rootCauses?.[0]?.operationalImpact ?? "", /not reported as zero/);

    const missingSummary = formatOutboxFailureSummaryLines(
      summaryFixture({
        countsAvailable: false,
        totalFailed: null,
        pendingCount: null,
        lastDispatchAt: null,
        timestamps: {
          oldestFailedEnqueuedAt: null,
          newestFailedEnqueuedAt: null,
          actualFailureAt: null,
          oldestFailedEnqueuedAtLabel: "Failed-row enqueue time",
          newestFailedEnqueuedAtLabel: "Failed-row enqueue time",
          actualFailureLabel: "Actual failure time",
          lastDispatchLabel: "Last dispatcher cycle",
        },
        attempts: {
          scope: "unavailable",
          min: null,
          max: null,
          sum: null,
          count: 0,
          missingCount: 0,
          note: "Attempt statistics are unavailable because outbox counts were not returned.",
        },
      }),
    );
    assert.match(missingSummary.failedCount, /unavailable/);
    assert.doesNotMatch(missingSummary.failedCount, /Failed rows: 0/);
    assert.match(missingSummary.pending, /unavailable/);
    assert.match(missingSummary.oldestEnqueue, /unavailable/);
    assert.match(missingSummary.actualFailure, /unavailable/);
    assert.match(missingSummary.lastDispatch, /unavailable/);
  });

  it("keeps historical failed rows visible without making them Critical", () => {
    const disabled = buildTechnicalHealthSnapshot({
      health: {
        status: "healthy",
        ready: true,
        outboxFailedCountReason: null,
        mongodb: { connected: true, latencyMs: 1, error: null },
        email: { provider: "smtp", healthy: true, configured: true },
        outbox: {
          enabled: false,
          configured: true,
          running: false,
          stats: { pending: 0, published: 4, failed: 2 },
          lastError: null,
        },
      },
      ready: { ready: true },
      healthError: null,
      readyError: null,
      initiativeWarningCount: 0,
      initiativeError: null,
    });
    assert.equal(disabled.outbox.status, "warning");
    assert.equal(disabled.outbox.rootCauses?.[0]?.failureCategory, "DISPATCHER_DISABLED");
    const historical = disabled.outbox.rootCauses?.find(
      (cause) => cause.failureCategory === "HISTORICAL_FAILED_ROWS",
    );
    assert.match(historical?.operationalImpact ?? "", /not, by itself/);
    assert.equal(disabled.overall, "warning");

    const retained = buildTechnicalHealthSnapshot({
      health: {
        status: "healthy",
        ready: true,
        mongodb: { connected: true, latencyMs: 1, error: null },
        email: { provider: "smtp", healthy: true, configured: true },
        outbox: {
          enabled: true,
          configured: true,
          running: true,
          stats: { pending: 0, published: 4, failed: 6306 },
          lastError: null,
          newestFailedAt: null,
        },
      },
      ready: { ready: true },
      healthError: null,
      readyError: null,
      initiativeWarningCount: 0,
      initiativeError: null,
    });
    assert.equal(retained.outbox.status, "healthy");
    assert.equal(retained.overall, "healthy");
    assert.equal(retained.outbox.rootCauses?.[0]?.failureCategory, "HISTORICAL_FAILED_ROWS");
    assert.match(retained.outbox.detail ?? "", /Failed 6306/);
  });

  it("renders root cause and the outbox summary without retry controls", () => {
    const section = readWeb("features/administration/components/AdminDiagnosticsSection.tsx");
    assert.match(section, /formatOutboxFailureSummaryLines/);
    assert.match(section, /RootCauseFacts/);
    assert.match(section, /Failing check/);
    assert.match(section, /Failure category/);
    assert.match(section, /Operational impact/);
    assert.match(section, /coverageNote/);
    assert.match(section, /limitNote/);
    assert.match(section, /fetchAdminOutboxFailureSummary/);
    assert.doesNotMatch(
      section,
      /retryAll|retry-all|onRetry|onPurge|onReplay|markPublished|Send test email/i,
    );
    assert.doesNotMatch(section, /method:\s*"(POST|DELETE|PATCH|PUT)"/);
    assert.doesNotMatch(section, /<button[^>]*>\s*Retry/i);
  });
});
