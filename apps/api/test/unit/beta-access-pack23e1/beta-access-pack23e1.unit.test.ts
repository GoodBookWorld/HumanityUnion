/**
 * Pack 23E.1 — Beta Access source contracts (no Mongo required).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { isRegistrationInviteRequired } from "../../../src/config/platform.config.js";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(apiRoot, relativePath), "utf8");
}

describe("Pack 23E.1 — Beta Access source contracts", () => {
  it("routes expose create, list, and revoke without public leaks", () => {
    const routes = read("src/modules/beta-invite/beta-invite.routes.ts");
    assert.match(routes, /createBetaInviteForAdmin/);
    assert.match(routes, /listBetaInvitesForAdmin/);
    assert.match(routes, /revokeBetaInviteForAdmin/);
    assert.match(routes, /\/:inviteId\/revoke/);
    assert.match(routes, /requireAuthenticationMiddleware/);
  });

  it("service scopes Admin inventory vs Editor creator list; audits create/revoke", () => {
    const service = read("src/modules/beta-invite/beta-invite.service.ts");
    assert.match(service, /listAllBetaInvites/);
    assert.match(service, /listBetaInvitesByCreator/);
    assert.match(service, /authority === "admin"/);
    assert.match(service, /beta\.invite\.create/);
    assert.match(service, /beta\.invite\.revoke/);
    assert.doesNotMatch(service, /codeHash.*afterSummary|afterSummary.*codeHash/);
    assert.match(service, /summarizeInviteTransition/);
  });

  it("14 — public registration gate remains env-driven", () => {
    const previousMode = process.env.PLATFORM_MODE;
    const previousAllow = process.env.ALLOW_PUBLIC_REGISTRATION;
    try {
      process.env.PLATFORM_MODE = "beta";
      delete process.env.ALLOW_PUBLIC_REGISTRATION;
      assert.equal(isRegistrationInviteRequired(), true);

      process.env.PLATFORM_MODE = "production";
      process.env.ALLOW_PUBLIC_REGISTRATION = "true";
      assert.equal(isRegistrationInviteRequired(), false);

      process.env.ALLOW_PUBLIC_REGISTRATION = "false";
      assert.equal(isRegistrationInviteRequired(), true);
    } finally {
      if (previousMode === undefined) {
        delete process.env.PLATFORM_MODE;
      } else {
        process.env.PLATFORM_MODE = previousMode;
      }
      if (previousAllow === undefined) {
        delete process.env.ALLOW_PUBLIC_REGISTRATION;
      } else {
        process.env.ALLOW_PUBLIC_REGISTRATION = previousAllow;
      }
    }
  });

  it("Admin public projection omits codeHash", () => {
    const service = read("src/modules/beta-invite/beta-invite.service.ts");
    assert.match(service, /function toPublicInvite/);
    assert.doesNotMatch(service, /codeHash:\s*invite\.codeHash/);
  });
});
