import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../src");

function read(relativePath: string): string {
  return readFileSync(path.resolve(apiSrc, relativePath), "utf8");
}

describe("Admin Participant directory — Pack 03 contracts", () => {
  it("exposes GET /api/v1/admin/participants with auth middleware and admin assert", () => {
    const routes = read("modules/administration/admin-participant-directory.routes.ts");
    assert.match(routes, /authenticationMiddleware/);
    assert.match(routes, /requireAuthenticationMiddleware/);
    assert.match(routes, /listAdminParticipants/);

    const app = read("app.ts");
    assert.match(app, /\/api\/v1\/admin\/participants/);
  });

  it("service enforces admin role and never projects passwordHash", () => {
    const service = read("modules/administration/admin-participant-directory.service.ts");
    assert.match(service, /assertAdminUser|role !== "admin"/);
    assert.match(service, /listAuthUsersForAdmin/);
    assert.match(service, /findMembersByIdentityIds/);
    assert.match(service, /findMembershipsByUserIds/);
    assert.doesNotMatch(service, /passwordHash:/);
    assert.doesNotMatch(service, /refreshToken|accessToken/);
  });

  it("repository list supports pagination, search, status, role, sort", () => {
    const repo = read("modules/auth/auth-user.repository.ts");
    assert.match(repo, /listAuthUsersForAdmin/);
    assert.match(repo, /skip\(query\.offset\)/);
    assert.match(repo, /limit\(query\.limit\)/);
    assert.match(repo, /countDocuments/);
  });
});
