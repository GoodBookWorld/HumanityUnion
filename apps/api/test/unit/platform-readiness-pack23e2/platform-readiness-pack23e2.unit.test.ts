/**
 * Pack 23E.2 — Admin Platform readiness API source contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(apiRoot, relativePath), "utf8");
}

describe("Pack 23E.2 — Admin Platform readiness API contracts", () => {
  it("Admin-only readiness route mounted; public checklist not reused as Admin surface", () => {
    const app = read("src/app.ts");
    assert.match(app, /\/api\/v1\/admin\/platform\/readiness/);
    assert.match(app, /adminPlatformReadinessRouter/);

    const routes = read("src/modules/closed-beta/admin-platform-readiness.routes.ts");
    assert.match(routes, /requireAuthenticationMiddleware/);
    assert.match(routes, /getAdminPlatformReadiness/);
  });

  it("projection asserts admin and never returns secret material", () => {
    const service = read("src/modules/closed-beta/admin-platform-readiness.service.ts");
    assert.match(service, /role !== "admin"/);
    assert.match(service, /isMongoConfigured/);
    assert.match(service, /collectInvalidEmailConfig/);
    assert.match(service, /collectInvalidMediaStorageConfig/);
    assert.match(service, /resolveAiAssistantConfig/);
    assert.doesNotMatch(service, /apiKey:\s*config\.apiKey/);
    assert.doesNotMatch(service, /MONGODB_URI|JWT_ACCESS_SECRET|SMTP_PASSWORD|R2_SECRET_ACCESS_KEY/);
    assert.doesNotMatch(service, /checkMongoConnection|buildPlatformReadinessChecklist/);
  });

  it("does not duplicate Diagnostics live health", () => {
    const service = read("src/modules/closed-beta/admin-platform-readiness.service.ts");
    assert.match(service, /Configuration identity only/);
    assert.doesNotMatch(service, /outbox|latencyMs|uptimeSeconds/);
  });
});
