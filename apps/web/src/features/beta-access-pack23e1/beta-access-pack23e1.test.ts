/**
 * Pack 23E.1 — Beta Access Admin UI / contract tests (web).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  betaInviteStatusClassName,
  canRevokeBetaInvite,
  countBetaInvitesByStatus,
  formatBetaInviteStatusLabel,
} from "../administration/beta-invite-labels.js";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(path.resolve(webSrc, relativePath), "utf8");
}

describe("Pack 23E.1 — Beta Access Admin UI contracts", () => {
  it("9 — Revoke UI only where pending", () => {
    assert.equal(canRevokeBetaInvite("pending"), true);
    assert.equal(canRevokeBetaInvite("used"), false);
    assert.equal(canRevokeBetaInvite("expired"), false);
    assert.equal(canRevokeBetaInvite("revoked"), false);

    const section = read("features/administration/components/AdminBetaAccessSection.tsx");
    assert.match(section, /canRevokeBetaInvite/);
    assert.match(section, /ConfirmDialog/);
    assert.match(section, /Revoke/);
    assert.doesNotMatch(section, /bulk revoke|Bulk revoke/i);
  });

  it("10 — status labels and chip classes", () => {
    assert.equal(formatBetaInviteStatusLabel("pending"), "Pending");
    assert.equal(formatBetaInviteStatusLabel("used"), "Used");
    assert.equal(formatBetaInviteStatusLabel("expired"), "Expired");
    assert.equal(formatBetaInviteStatusLabel("revoked"), "Revoked");

    assert.match(betaInviteStatusClassName("pending"), /status--pending/);
    assert.match(betaInviteStatusClassName("used"), /status--active/);
    assert.match(betaInviteStatusClassName("expired"), /status--blocked/);
    assert.match(betaInviteStatusClassName("revoked"), /status--blocked/);

    const counts = countBetaInvitesByStatus([
      { status: "pending" },
      { status: "pending" },
      { status: "used" },
      { status: "expired" },
      { status: "revoked" },
    ]);
    assert.deepEqual(counts, { pending: 2, used: 1, expired: 1, revoked: 1 });
  });

  it("13 — Admin DTO / API client never re-fetch invite secrets", () => {
    const api = read("features/administration/beta-invite-api.ts");
    assert.match(api, /\/api\/v1\/beta-invites/);
    assert.match(api, /revoke/);
    assert.doesNotMatch(api, /codeHash/);

    const types = readFileSync(
      path.resolve(webSrc, "../../../packages/types/src/domain/platform.ts"),
      "utf8",
    );
    assert.match(types, /"revoked"/);
    assert.doesNotMatch(types, /codeHash/);
  });

  it("14 — registration gate remains env-driven (no Admin mode toggle)", () => {
    const section = read("features/administration/components/AdminBetaAccessSection.tsx");
    assert.match(section, /Platform mode remains deployment configuration/i);
    assert.doesNotMatch(section, /setPlatformMode|PLATFORM_MODE\s*=/);
    assert.match(section, /registrationRequiresInvite/);

    const platformConfig = readFileSync(
      path.resolve(webSrc, "../../../apps/api/src/config/platform.config.ts"),
      "utf8",
    );
    assert.match(platformConfig, /isRegistrationInviteRequired/);
    assert.match(platformConfig, /ALLOW_PUBLIC_REGISTRATION/);
  });

  it("15 — post-launch copy + compact inventory UI", () => {
    const section = read("features/administration/components/AdminBetaAccessSection.tsx");
    assert.match(section, /Controlled-access invitations/);
    assert.match(section, /Invite status summary|Pending/);
    assert.match(section, /Create invitation/);
    assert.match(section, /Invitations/);
    assert.doesNotMatch(section, /Invites you created/);
    assert.doesNotMatch(section, /waitlist|campaign|CRM|CSV/i);
    assert.doesNotMatch(section, /resend/i);
  });

  it("audit action taxonomy includes beta invite mutations", () => {
    const adminTypes = readFileSync(
      path.resolve(webSrc, "../../../packages/types/src/domain/administration.ts"),
      "utf8",
    );
    assert.match(adminTypes, /"beta\.invite\.create"/);
    assert.match(adminTypes, /"beta\.invite\.revoke"/);
  });
});
