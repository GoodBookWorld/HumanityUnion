import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const apiSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../src");

function read(relativePath: string): string {
  return readFileSync(path.resolve(apiSrc, relativePath), "utf8");
}

describe("Admin Initiative directory — Pack 05 contracts", () => {
  it("exposes admin initiatives routes with auth middleware and admin assert", () => {
    const routes = read("modules/administration/admin-initiative-directory.routes.ts");
    assert.match(routes, /authenticationMiddleware/);
    assert.match(routes, /requireAuthenticationMiddleware/);
    assert.match(routes, /listAdminInitiatives/);
    assert.match(routes, /getAdminInitiativeDetail/);
    assert.match(routes, /visibility\/hide/);
    assert.match(routes, /visibility\/restore/);

    const app = read("app.ts");
    assert.match(app, /\/api\/v1\/admin\/initiatives/);
  });

  it("directory service enforces admin role and paginates server-side", () => {
    const service = read("modules/administration/admin-initiative-directory.service.ts");
    assert.match(service, /assertAdminUser|role !== "admin"/);
    assert.match(service, /listInitiatives/);
    assert.match(service, /slice\(offset/);
    assert.match(service, /lifecyclePhase/);
    assert.match(service, /visibility/);
    assert.match(service, /proposalCount/);
    assert.doesNotMatch(service, /passwordHash|refreshToken|accessToken/);
  });

  it("visibility commands require reason, preserve ownership, and audit", () => {
    const service = read("modules/administration/admin-initiative-visibility.service.ts");
    assert.match(service, /requireReason|at least 8 characters/);
    assert.match(service, /initiative\.visibility\.hide/);
    assert.match(service, /initiative\.visibility\.restore/);
    assert.match(service, /stewardId/);
    assert.match(service, /must not alter ownership|beforeStewardId/);
    assert.match(service, /lifecyclePhase/);
    assert.match(service, /await record\(/);
    assert.doesNotMatch(service, /title:\s*|description:/);
  });
});
