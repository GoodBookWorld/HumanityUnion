/**
 * Production Completion Pack 01 — Admin diagnostics health + integrity contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../..");

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Production Completion Pack 01 — Admin diagnostics health", () => {
  it("mounts authenticated Admin diagnostics health under /api/v1/admin/diagnostics", () => {
    const app = readRepo("apps/api/src/app.ts");
    assert.match(app, /\/api\/v1\/admin\/diagnostics/);
    assert.match(app, /adminDiagnosticsHealthRouter/);

    const routes = readRepo(
      "apps/api/src/modules/administration/admin-diagnostics-health.routes.ts",
    );
    assert.match(routes, /authenticationMiddleware/);
    assert.match(routes, /requireAuthenticationMiddleware/);
    assert.match(routes, /getAdminDiagnosticsHealth/);
    assert.match(routes, /"\/health"/);
  });

  it("Admin diagnostics service reuses probes and never returns URI/credentials", () => {
    const service = readRepo(
      "apps/api/src/modules/administration/admin-diagnostics-health.service.ts",
    );
    assert.match(service, /checkMongoConnection/);
    assert.match(service, /getEmailProviderHealth/);
    assert.match(service, /getOutboxHealthStatus/);
    assert.match(service, /assertAdminActor|role !== "admin"/);
    assert.doesNotMatch(service, /MONGODB_URI\s*:/);
    assert.match(service, /databaseConfigured/);
    assert.match(service, /sanitizeProbeMessage|redacted/);
  });

  it("public health remains redacted in production while Admin surface is separate", () => {
    const health = readRepo("apps/api/src/routes/health.routes.ts");
    assert.match(health, /isPublicMinimalHealthSurface/);
    assert.match(health, /nodeEnv === "production"/);
    const webApi = readRepo("apps/web/src/features/administration/admin-diagnostics-api.ts");
    assert.match(webApi, /\/api\/v1\/admin\/diagnostics\/health/);
    assert.doesNotMatch(webApi, /const HEALTH_PATH = "\/api\/v1\/health"/);
  });

  it("removes dead impossible_public_archived integrity rule", () => {
    const directory = readRepo(
      "apps/api/src/modules/administration/admin-initiative-directory.service.ts",
    );
    assert.doesNotMatch(directory, /impossible_public_archived/);
    assert.match(directory, /missing_steward_reference/);
    assert.match(directory, /lifecyclePhase === "draft".*status === "archived"|draft.*archived/s);
  });
});
