/**
 * Pack 25B.1 — Admin Membership filter accepts application_completed (API side).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const apiSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../src");

function read(relativePath: string): string {
  return readFileSync(path.resolve(apiSrc, relativePath), "utf8");
}

describe("Pack 25B.1 — Admin Membership filter API contracts", () => {
  it("MEMBERSHIP_STATUSES includes application_completed for query validation", () => {
    const routes = read("modules/administration/admin-participant-directory.routes.ts");
    assert.match(routes, /MEMBERSHIP_STATUSES/);
    assert.match(routes, /"application_completed"/);
    assert.match(routes, /"application_started"/);
  });

  it("directory service filters by exact membership status allowlist", () => {
    const service = read("modules/administration/admin-participant-directory.service.ts");
    assert.match(service, /if \(input\.membershipStatus\)/);
    assert.match(service, /findUserIdsByMembershipStatus\(input\.membershipStatus\)/);
  });

  it("repository uses exact status match (submitted ≠ started)", () => {
    const repo = read("modules/membership/membership.repository.ts");
    const fn = repo.slice(repo.indexOf("findUserIdsByMembershipStatus"));
    assert.match(fn, /find\(\{\s*status\s*\}/);
    assert.doesNotMatch(fn.slice(0, 400), /\$in:\s*\[/);
  });

  it("domain status names remain application_started / application_completed", () => {
    const service = read("modules/membership/membership.service.ts");
    assert.match(service, /"application_completed"/);
    assert.match(service, /"application_started"/);
  });
});
