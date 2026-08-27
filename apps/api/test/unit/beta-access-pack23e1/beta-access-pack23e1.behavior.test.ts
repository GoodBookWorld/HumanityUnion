/**
 * Pack 23E.1 — Beta Access production cleanup (in-memory behavioral tests).
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import type { AdministrationAuditAppendInput, AdministrationAuditRecord } from "@hu/types";

import {
  BetaInviteAdminRequiredError,
  BetaInviteNotFoundError,
  BetaInviteValidationError,
} from "../../../src/modules/beta-invite/beta-invite.errors.js";
import { resetBetaInvitesMemoryForTests } from "../../../src/modules/beta-invite/beta-invite.memory.store.js";
import {
  findBetaInviteById,
  insertBetaInvite,
  markBetaInviteUsed,
  setBetaInviteForceMemoryForTests,
} from "../../../src/modules/beta-invite/beta-invite.repository.js";
import {
  createBetaInviteForAdmin,
  listBetaInvitesForAdmin,
  revokeBetaInviteForAdmin,
  setBetaInviteAuditRecorderOverrideForTests,
  setBetaInviteManagerAssertOverrideForTests,
  validateAndConsumeBetaInvite,
} from "../../../src/modules/beta-invite/beta-invite.service.js";

const audits: AdministrationAuditAppendInput[] = [];

function installManagers(): void {
  setBetaInviteManagerAssertOverrideForTests(async (userId) => {
    if (userId === "member-1") {
      throw new BetaInviteAdminRequiredError();
    }
    if (userId === "editor-1") {
      return { userId: "editor-1", memberId: "participant-editor-1", authority: "editor" };
    }
    if (userId === "admin-a" || userId === "admin-b") {
      return {
        userId,
        memberId: `participant-${userId}`,
        authority: "admin",
      };
    }
    throw new BetaInviteAdminRequiredError();
  });
}

beforeEach(() => {
  setBetaInviteForceMemoryForTests(true);
  resetBetaInvitesMemoryForTests();
  audits.length = 0;
  installManagers();
  setBetaInviteAuditRecorderOverrideForTests(async (input) => {
    audits.push(input);
    return {
      auditId: `audit-${audits.length}`,
      actorParticipantId: input.actorParticipantId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      scope: input.scope ?? { scopeType: "global" },
      reason: input.reason,
      beforeSummary: input.beforeSummary,
      afterSummary: input.afterSummary,
      createdAt: new Date().toISOString(),
      correlationId: input.correlationId,
    } satisfies AdministrationAuditRecord;
  });
});

afterEach(() => {
  setBetaInviteForceMemoryForTests(false);
  setBetaInviteManagerAssertOverrideForTests(null);
  setBetaInviteAuditRecorderOverrideForTests(null);
  resetBetaInvitesMemoryForTests();
});

describe("Pack 23E.1 — Beta Access production cleanup", () => {
  it("1 — Admin sees all invites (admin-wide inventory)", async () => {
    const fromA = await createBetaInviteForAdmin({
      email: "a@example.com",
      createdBy: "admin-a",
    });
    const fromB = await createBetaInviteForAdmin({
      email: "b@example.com",
      createdBy: "admin-b",
    });

    const listed = await listBetaInvitesForAdmin("admin-a");
    const ids = new Set(listed.map((row) => row.inviteId));
    assert.equal(ids.has(fromA.invite.inviteId), true);
    assert.equal(ids.has(fromB.invite.inviteId), true);
    assert.ok(listed.every((row) => !("codeHash" in row)));
    assert.ok(listed.every((row) => typeof row.createdBy === "string"));
  });

  it("2 — unauthorized member denied; Editor remains creator-scoped", async () => {
    await assert.rejects(() => listBetaInvitesForAdmin("member-1"), BetaInviteAdminRequiredError);

    const own = await createBetaInviteForAdmin({
      email: "editor-own@example.com",
      createdBy: "editor-1",
    });
    const other = await createBetaInviteForAdmin({
      email: "editor-other@example.com",
      createdBy: "admin-a",
    });

    const editorList = await listBetaInvitesForAdmin("editor-1");
    const ids = new Set(editorList.map((row) => row.inviteId));
    assert.equal(ids.has(own.invite.inviteId), true);
    assert.equal(ids.has(other.invite.inviteId), false);
  });

  it("3 — pending invite can be revoked", async () => {
    const issued = await createBetaInviteForAdmin({
      email: "revoke-ok@example.com",
      createdBy: "admin-a",
    });
    const revoked = await revokeBetaInviteForAdmin({
      inviteId: issued.invite.inviteId,
      actorUserId: "admin-a",
    });
    assert.equal(revoked.status, "revoked");
    assert.ok(revoked.revokedAt);
  });

  it("4 — used invite cannot be revoked", async () => {
    const issued = await createBetaInviteForAdmin({
      email: "used@example.com",
      createdBy: "admin-a",
    });
    await markBetaInviteUsed(issued.invite.inviteId, new Date().toISOString());
    await assert.rejects(
      () =>
        revokeBetaInviteForAdmin({
          inviteId: issued.invite.inviteId,
          actorUserId: "admin-a",
        }),
      BetaInviteValidationError,
    );
  });

  it("5 — expired invite cannot be revived via revoke", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const expired = await insertBetaInvite({
      email: "expired@example.com",
      createdBy: "admin-a",
      expiresAt: past,
    });
    await assert.rejects(
      () =>
        revokeBetaInviteForAdmin({
          inviteId: expired.invite.inviteId,
          actorUserId: "admin-a",
        }),
      BetaInviteValidationError,
    );
    const stored = await findBetaInviteById(expired.invite.inviteId);
    assert.equal(stored?.status, "expired");
  });

  it("6 — revoked invite cannot be consumed", async () => {
    const issued = await createBetaInviteForAdmin({
      email: "consume@example.com",
      createdBy: "admin-a",
    });
    await revokeBetaInviteForAdmin({
      inviteId: issued.invite.inviteId,
      actorUserId: "admin-a",
    });
    await assert.rejects(
      () =>
        validateAndConsumeBetaInvite({
          email: "consume@example.com",
          inviteCode: issued.code,
        }),
      BetaInviteNotFoundError,
    );
  });

  it("7 — revoke is idempotent", async () => {
    const issued = await createBetaInviteForAdmin({
      email: "idem@example.com",
      createdBy: "admin-a",
    });
    const first = await revokeBetaInviteForAdmin({
      inviteId: issued.invite.inviteId,
      actorUserId: "admin-a",
    });
    const second = await revokeBetaInviteForAdmin({
      inviteId: issued.invite.inviteId,
      actorUserId: "admin-a",
    });
    assert.equal(first.status, "revoked");
    assert.equal(second.status, "revoked");
    assert.equal(second.inviteId, first.inviteId);
  });

  it("8 — create still returns one-time code and pending invite", async () => {
    const issued = await createBetaInviteForAdmin({
      email: "create@example.com",
      createdBy: "admin-a",
    });
    assert.equal(issued.invite.status, "pending");
    assert.ok(issued.code.length > 10);
    assert.equal("codeHash" in issued.invite, false);
  });

  it("11–12 — audit create and revoke events without secrets", async () => {
    const issued = await createBetaInviteForAdmin({
      email: "audit-secret@example.com",
      createdBy: "admin-a",
    });
    await revokeBetaInviteForAdmin({
      inviteId: issued.invite.inviteId,
      actorUserId: "admin-a",
    });

    const actions = audits.map((row) => row.action);
    assert.ok(actions.includes("beta.invite.create"));
    assert.ok(actions.includes("beta.invite.revoke"));

    for (const row of audits) {
      const blob = `${row.beforeSummary ?? ""} ${row.afterSummary ?? ""} ${row.reason ?? ""}`;
      assert.doesNotMatch(blob, /codeHash/i);
      assert.equal(blob.includes(issued.code), false);
      assert.doesNotMatch(blob, /audit-secret@example\.com/i);
    }
  });

  it("Editor cannot revoke another actor’s invite", async () => {
    const issued = await createBetaInviteForAdmin({
      email: "editor-deny@example.com",
      createdBy: "admin-a",
    });
    await assert.rejects(
      () =>
        revokeBetaInviteForAdmin({
          inviteId: issued.invite.inviteId,
          actorUserId: "editor-1",
        }),
      BetaInviteAdminRequiredError,
    );
  });
});
