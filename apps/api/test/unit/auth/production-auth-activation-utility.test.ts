import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  resolveProductionAuthActivationAllowlist,
} from "../../../src/modules/production-auth-activation/allowlist.js";
import {
  PRODUCTION_AUTH_ACTIVATION_CONFIRM_VALUE,
  resolveProductionAuthActivationMode,
  runProductionAuthActivation,
} from "../../../src/modules/production-auth-activation/index.js";
import { APPROVED_PRODUCTION_ADMIN } from "../../../src/modules/production-admin-bootstrap/constants.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../../..");

function readRepo(relative: string): string {
  return readFileSync(path.join(repoRoot, relative), "utf8");
}

describe("Production auth activation utility — dry-run / gates", () => {
  it("allowlist uses userIds only (no emails) and includes Volody as admin", () => {
    const list = resolveProductionAuthActivationAllowlist({});
    assert.ok(list.length >= 5);
    assert.equal(
      list.some(
        (row) =>
          row.userId === APPROVED_PRODUCTION_ADMIN.userId &&
          row.expectedAuthRole === "admin",
      ),
      true,
    );
    assert.equal(JSON.stringify(list).includes("@"), false);
  });

  it("mode requires dedicated CONFIRM", () => {
    assert.equal(
      resolveProductionAuthActivationMode({ execute: true, confirm: "NO" }),
      "dry-run",
    );
    assert.equal(
      resolveProductionAuthActivationMode({
        execute: true,
        confirm: PRODUCTION_AUTH_ACTIVATION_CONFIRM_VALUE,
      }),
      "execute",
    );
  });

  it("dry-run plans password-reset without sending; skips verified/disabled; idempotent", async () => {
    const adminId = APPROVED_PRODUCTION_ADMIN.userId;
    const memberId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const users = new Map([
      [
        adminId,
        {
          userId: adminId,
          role: "admin" as const,
          status: "active" as const,
          emailVerificationStatus: "pending" as const,
        },
      ],
      [
        memberId,
        {
          userId: memberId,
          role: "member" as const,
          status: "active" as const,
          emailVerificationStatus: "verified" as const,
        },
      ],
    ]);

    let sendCount = 0;
    const report = await runProductionAuthActivation({
      destinationDatabase: "hu_test_auth_activation",
      execute: false,
      allowTestIsolation: true,
      allowlist: [
        {
          userId: adminId,
          label: "Volody",
          source: "admin_bootstrap",
          expectedAuthRole: "admin",
        },
        {
          userId: memberId,
          label: "Already",
          source: "env_extra",
          expectedAuthRole: "member",
        },
      ],
      findUser: async (userId) => {
        const row = users.get(userId);
        if (!row) return null;
        return {
          ...row,
          email: "redacted@example.com",
          passwordHash: "$2b$12$not-a-real-hash",
          displayName: "x",
          memberId: "m",
          createdAt: "2020-01-01T00:00:00.000Z",
          updatedAt: "2020-01-01T00:00:00.000Z",
        };
      },
      sendPasswordReset: async () => {
        sendCount += 1;
        return { sent: true };
      },
    });

    assert.equal(report.mode, "dry-run");
    assert.equal(report.overallStatus, "DRY_RUN_OK");
    assert.equal(report.counts.wouldSend, 1);
    assert.equal(report.counts.skippedAlreadyVerified, 1);
    assert.equal(report.sideEffects.emailsQueued, 0);
    assert.equal(sendCount, 0);
    assert.equal(report.sideEffects.passwordMaterialWritten, 0);
    assert.equal(report.sideEffects.rolesChanged, 0);

    const execute = await runProductionAuthActivation({
      destinationDatabase: "hu_test_auth_activation",
      execute: true,
      confirm: PRODUCTION_AUTH_ACTIVATION_CONFIRM_VALUE,
      allowTestIsolation: true,
      allowlist: [
        {
          userId: adminId,
          label: "Volody",
          source: "admin_bootstrap",
          expectedAuthRole: "admin",
        },
      ],
      findUser: async (userId) => {
        const row = users.get(userId);
        if (!row) return null;
        return {
          ...row,
          email: "redacted@example.com",
          passwordHash: "$2b$12$not-a-real-hash",
          displayName: "x",
          memberId: "m",
          createdAt: "2020-01-01T00:00:00.000Z",
          updatedAt: "2020-01-01T00:00:00.000Z",
        };
      },
      sendPasswordReset: async () => {
        sendCount += 1;
        return { sent: true };
      },
    });
    assert.equal(execute.counts.sent, 1);
    assert.equal(sendCount, 1);

    // Idempotent skip once verified
    users.set(adminId, {
      ...users.get(adminId)!,
      emailVerificationStatus: "verified",
    });
    const again = await runProductionAuthActivation({
      destinationDatabase: "hu_test_auth_activation",
      execute: true,
      confirm: PRODUCTION_AUTH_ACTIVATION_CONFIRM_VALUE,
      allowTestIsolation: true,
      allowlist: [
        {
          userId: adminId,
          label: "Volody",
          source: "admin_bootstrap",
          expectedAuthRole: "admin",
        },
      ],
      findUser: async (userId) => {
        const row = users.get(userId);
        if (!row) return null;
        return {
          ...row,
          email: "redacted@example.com",
          passwordHash: "$2b$12$not-a-real-hash",
          displayName: "x",
          memberId: "m",
          createdAt: "2020-01-01T00:00:00.000Z",
          updatedAt: "2020-01-01T00:00:00.000Z",
        };
      },
      sendPasswordReset: async () => {
        sendCount += 1;
        return { sent: true };
      },
    });
    assert.equal(again.counts.skippedAlreadyVerified, 1);
    assert.equal(sendCount, 1);
  });

  it("skips role mismatch without escalating privileges", async () => {
    const report = await runProductionAuthActivation({
      destinationDatabase: "hu_test_auth_activation",
      execute: true,
      confirm: PRODUCTION_AUTH_ACTIVATION_CONFIRM_VALUE,
      allowTestIsolation: true,
      allowlist: [
        {
          userId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          label: "Mismatch",
          source: "env_extra",
          expectedAuthRole: "admin",
        },
      ],
      findUser: async () => ({
        userId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        email: "redacted@example.com",
        passwordHash: "$2b$12$not-a-real-hash",
        displayName: "x",
        role: "member",
        status: "active",
        memberId: "m",
        emailVerificationStatus: "pending",
        createdAt: "2020-01-01T00:00:00.000Z",
        updatedAt: "2020-01-01T00:00:00.000Z",
      }),
      sendPasswordReset: async () => ({ sent: true }),
    });
    assert.equal(report.counts.skippedRoleMismatch, 1);
    assert.equal(report.counts.sent, 0);
  });

  it("Admin UI/API gates use auth_users.role, not member.roles", () => {
    const isAdmin = readRepo("apps/web/src/features/administration/is-admin-role.ts");
    assert.match(isAdmin, /role === "admin"/);
    const nav = readRepo("apps/web/src/features/initiatives/components/WorkspaceNavigation.tsx");
    assert.match(nav, /isAdminAccountRole\(user\.role\)/);
    assert.doesNotMatch(nav, /member\.roles/);
    const gate = readRepo(
      "apps/web/src/features/administration/components/AdminAccessGate.tsx",
    );
    assert.match(gate, /isAdminAccountRole/);
    const confirm = readRepo(
      "apps/api/src/modules/member/application/confirm-member-registration.service.ts",
    );
    assert.match(confirm, /completeIdempotentReplay|markAuthUserEmailVerified/);
    assert.match(
      confirm,
      /emailVerificationStatus !== "verified"/,
    );
  });
});
