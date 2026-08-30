/**
 * Diagnostics Pack 01 — Admin Technical Health.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { DIAGNOSTICS_READ_ONLY_PATHS } from "../administration/admin-diagnostics-api";
import {
  aggregateOverallStatus,
  buildTechnicalHealthSnapshot,
  deriveEmailStatus,
  deriveLifecycleReconciliationStatus,
  deriveMongoStatus,
  deriveOutboxStatus,
  formatDiagnosticSeverityLabel,
  sanitizeOperatorMessage,
} from "../administration/admin-diagnostics-model";
import {
  ADMIN_PANEL_SECTIONS,
  resolveAdminPanelSectionId,
} from "../administration/admin-panel-sections";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Diagnostics Pack 01 — Admin access and navigation", () => {
  it("preserves AdminAccessGate on /admin/diagnostics", () => {
    const page = readWeb("app/admin/diagnostics/page.tsx");
    assert.match(page, /AdminAccessGate/);
    assert.match(page, /AdminDiagnosticsSection/);
  });

  it("adds Diagnostics beside SEO / Platform / Audit in Admin navigation", () => {
    const labels = ADMIN_PANEL_SECTIONS.map((section) => section.label);
    const seo = labels.indexOf("SEO");
    const diagnostics = labels.indexOf("Diagnostics");
    assert.ok(seo >= 0);
    assert.equal(diagnostics, seo + 1);
    assert.equal(resolveAdminPanelSectionId("/admin/diagnostics"), "diagnostics");
  });
});

describe("Diagnostics Pack 01 — status aggregation", () => {
  it("maps a healthy API payload to Healthy overall", () => {
    const snapshot = buildTechnicalHealthSnapshot({
      health: {
        status: "healthy",
        ready: true,
        mongodb: { connected: true, latencyMs: 12, error: null },
        email: { provider: "smtp", healthy: true, configured: true, message: "ok" },
        outbox: {
          enabled: true,
          configured: true,
          running: true,
          stats: { pending: 0, published: 1200, failed: 0 },
          lastError: null,
        },
      },
      ready: { ready: true },
      healthError: null,
      readyError: null,
      initiativeWarningCount: 0,
      initiativeError: null,
    });

    assert.equal(snapshot.overall, "healthy");
    assert.equal(snapshot.services.find((row) => row.id === "web")?.status, "healthy");
    assert.equal(snapshot.services.find((row) => row.id === "api")?.status, "healthy");
    assert.equal(snapshot.services.find((row) => row.id === "mongodb")?.status, "healthy");
    assert.equal(snapshot.services.find((row) => row.id === "email")?.status, "healthy");
    assert.equal(snapshot.outbox.status, "healthy");
  });

  it("marks overall Critical when a required service fails", () => {
    const snapshot = buildTechnicalHealthSnapshot({
      health: {
        status: "degraded",
        ready: false,
        mongodb: { connected: false, latencyMs: null, error: "MongoDB connection failed." },
        email: { provider: "smtp", healthy: true, configured: true, message: "ok" },
        outbox: {
          enabled: true,
          configured: true,
          running: true,
          stats: { pending: 0, published: 10, failed: 0 },
          lastError: null,
        },
      },
      ready: { ready: false },
      healthError: null,
      readyError: null,
      initiativeWarningCount: 0,
      initiativeError: null,
    });

    assert.equal(snapshot.overall, "critical");
    assert.equal(snapshot.services.find((row) => row.id === "mongodb")?.status, "critical");
    assert.equal(snapshot.services.find((row) => row.id === "api")?.status, "critical");
  });

  it("marks overall Warning for non-critical email degradation", () => {
    const snapshot = buildTechnicalHealthSnapshot({
      health: {
        status: "degraded",
        ready: true,
        mongodb: { connected: true, latencyMs: 8, error: null },
        email: {
          provider: "smtp",
          healthy: false,
          configured: true,
          message: "SMTP provider health check is not currently healthy.",
        },
        outbox: {
          enabled: true,
          configured: true,
          running: true,
          stats: { pending: 3, published: 900, failed: 0 },
          lastError: null,
        },
      },
      ready: { ready: true },
      healthError: null,
      readyError: null,
      initiativeWarningCount: 0,
      initiativeError: null,
    });

    assert.equal(snapshot.overall, "warning");
    assert.equal(snapshot.services.find((row) => row.id === "email")?.status, "warning");
    assert.equal(snapshot.outbox.status, "healthy");
  });

  it("keeps unavailable checks Unknown instead of Healthy", () => {
    assert.equal(aggregateOverallStatus(["healthy", "unknown"]), "warning");
    assert.equal(aggregateOverallStatus(["unknown", "unknown"]), "unknown");

    const snapshot = buildTechnicalHealthSnapshot({
      health: null,
      ready: null,
      healthError: "API unavailable",
      readyError: "API unavailable",
      initiativeWarningCount: null,
      initiativeError: "Initiatives unavailable",
    });

    assert.equal(snapshot.services.find((row) => row.id === "mongodb")?.status, "unknown");
    assert.equal(snapshot.services.find((row) => row.id === "email")?.status, "unknown");
    assert.equal(
      snapshot.integrity.find((row) => row.id === "initiative-integrity")?.status,
      "unknown",
    );
    assert.equal(
      snapshot.integrity.find((row) => row.id === "lifecycle-reconciliation")?.status,
      "not_available",
    );
  });
});

describe("Diagnostics Pack 01 — Mongo / Email / Outbox / Integrity rendering helpers", () => {
  it("renders Mongo connected and unavailable safely", () => {
    const healthy = deriveMongoStatus({
      mongodb: { connected: true, latencyMs: 5, error: null, database: "hu" },
    });
    assert.equal(healthy.status, "healthy");
    assert.match(healthy.detail ?? "", /5ms/);
    assert.doesNotMatch(healthy.summary + (healthy.detail ?? ""), /hu/);

    const down = deriveMongoStatus({
      mongodb: {
        connected: false,
        error: "mongodb://user:secret@localhost:27017/hu",
      },
    });
    assert.equal(down.status, "critical");
    assert.equal(down.detail, "Connection details omitted for safety.");
  });

  it("renders email healthy and warning states", () => {
    assert.equal(
      deriveEmailStatus({
        email: { provider: "resend", healthy: true, configured: true, message: "ok" },
      }).status,
      "healthy",
    );
    const warning = deriveEmailStatus({
      email: {
        provider: "smtp",
        healthy: false,
        configured: true,
        message: "SMTP provider health check is not currently healthy.",
      },
    });
    assert.equal(warning.status, "warning");
    assert.match(warning.detail ?? "", /SMTP provider health check/);
  });

  it("renders outbox pending/published/failed without treating published as unhealthy", () => {
    const healthyWithHistory = deriveOutboxStatus({
      outbox: {
        enabled: true,
        configured: true,
        running: true,
        stats: { pending: 2, published: 50_000, failed: 0 },
        lastError: null,
      },
    });
    assert.equal(healthyWithHistory.status, "healthy");
    assert.match(healthyWithHistory.detail ?? "", /Pending 2/);
    assert.match(healthyWithHistory.detail ?? "", /Published 50000/);
    assert.match(healthyWithHistory.detail ?? "", /Failed 0/);

    const failed = deriveOutboxStatus({
      outbox: {
        enabled: true,
        configured: true,
        running: true,
        stats: { pending: 0, published: 50_000, failed: 4 },
        lastError: null,
      },
    });
    assert.equal(failed.status, "critical");
  });

  it("renders Initiative integrity findings and deferred lifecycle reconciliation", () => {
    const snapshot = buildTechnicalHealthSnapshot({
      health: {
        status: "healthy",
        ready: true,
        mongodb: { connected: true, latencyMs: 1, error: null },
        email: { provider: "mock", healthy: true, configured: true, message: "ok" },
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
      initiativeWarningCount: 3,
      initiativeError: null,
    });

    const integrity = snapshot.integrity.find((row) => row.id === "initiative-integrity");
    assert.equal(integrity?.status, "warning");
    assert.match(integrity?.summary ?? "", /3 findings/);

    const lifecycle = snapshot.integrity.find((row) => row.id === "lifecycle-reconciliation");
    assert.equal(lifecycle?.status, "not_available");
    assert.match(lifecycle?.summary ?? "", /CLI-only/);
    assert.equal(
      formatDiagnosticSeverityLabel("not_available"),
      "Not available",
    );
  });

  it("treats lifecycle not_available as neutral (excluded from overall health)", () => {
    assert.equal(aggregateOverallStatus(["healthy", "not_available"]), "healthy");
    assert.equal(aggregateOverallStatus(["not_available"]), "unknown");
    assert.equal(aggregateOverallStatus(["healthy", "unknown"]), "warning");

    const withConflicts = deriveLifecycleReconciliationStatus({
      available: true,
      conflictCount: 2,
    });
    assert.equal(withConflicts.status, "warning");

    const deferred = deriveLifecycleReconciliationStatus();
    assert.equal(deferred.status, "not_available");
    assert.notEqual(deferred.status, "healthy");
    assert.notEqual(deferred.status, "unknown");
  });

  it("sanitizes secrets from operator messages", () => {
    assert.equal(
      sanitizeOperatorMessage("fail mongodb+srv://a:b@cluster/db"),
      "Connection details omitted for safety.",
    );
    assert.equal(
      sanitizeOperatorMessage("invalid password supplied"),
      "Sensitive detail omitted for safety.",
    );
  });
});

describe("Diagnostics Pack 01 — refresh and read-only safety", () => {
  it("refresh only uses read-only health endpoints", () => {
    assert.deepEqual([...DIAGNOSTICS_READ_ONLY_PATHS], [
      "/api/v1/admin/diagnostics/health",
      "/api/v1/health/ready",
      "/api/v1/admin/initiatives",
    ]);

    const api = readWeb("features/administration/admin-diagnostics-api.ts");
    const section = readWeb("features/administration/components/AdminDiagnosticsSection.tsx");
    assert.match(api, /\/api\/v1\/admin\/diagnostics\/health/);
    assert.match(api, /\/api\/v1\/health\/ready/);
    assert.match(api, /listAdminInitiatives/);
    assert.doesNotMatch(api, /fetchApiHealth[\s\S]*\/api\/v1\/health"/);
    assert.match(section, /Refresh/);
    assert.match(section, /refreshing/);
    assert.doesNotMatch(section, /method:\s*"POST"|method:\s*"DELETE"|method:\s*"PATCH"/);
  });

  it("does not expose destructive outbox or email actions", () => {
    const section = readWeb("features/administration/components/AdminDiagnosticsSection.tsx");
    assert.doesNotMatch(section, /retryAll|retry-all|onRetry|onPurge|onReplay|markPublished|Send test email/i);
    assert.doesNotMatch(section, /MONGODB_URI|SMTP_PASSWORD|API_KEY|connectionString/i);
    assert.doesNotMatch(section, /method:\s*"(POST|DELETE|PATCH|PUT)"/);
  });

  it("keeps a compact responsive Admin layout", () => {
    const css = readWeb("features/administration/components/admin-diagnostics.css");
    assert.match(css, /grid-template-columns:\s*repeat\(2/);
    assert.match(css, /@media \(max-width:\s*720px\)/);
    assert.match(css, /grid-template-columns:\s*1fr/);
    assert.doesNotMatch(css, /seo|traffic|subscribers/i);
  });
});
