/**
 * Sequential directory moderation reuses the single-account suspension service.
 * A later failure does not undo an earlier account change, and a failed email
 * does not restore the previous status.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import type { AdministrationAuditAppendInput, AdministrationAuditRecord } from "@hu/types";

import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.types.js";
import { ParticipantSuspensionValidationError } from "../../../src/modules/participant-suspension/participant-suspension.errors.js";
import {
  resetParticipantSuspensionsMemoryForTests,
  setParticipantSuspensionForceMemoryForTests,
} from "../../../src/modules/participant-suspension/participant-suspension.repository.js";
import { resetParticipantSuspensionRateLimitsForTests } from "../../../src/modules/participant-suspension/participant-suspension.rate-limit.js";
import {
  restoreParticipantForAdmin,
  setParticipantSuspensionAdminAssertOverrideForTests,
  setParticipantSuspensionAuditRecorderOverrideForTests,
  setParticipantSuspensionAuthOverridesForTests,
  setParticipantSuspensionEmailOverridesForTests,
  setParticipantSuspensionNotificationOverrideForTests,
  suspendParticipantForAdmin,
} from "../../../src/modules/participant-suspension/participant-suspension.service.js";

const audits: AdministrationAuditAppendInput[] = [];
const authStatusByUserId = new Map<string, "active" | "disabled">();
const usersByMemberId = new Map<string, AuthUserRecord>();
const usersById = new Map<string, AuthUserRecord>();
const suspendedEmails: string[] = [];
const restoredEmails: string[] = [];

function makeAuthUser(
  overrides: Partial<AuthUserRecord> & Pick<AuthUserRecord, "userId" | "memberId">,
): AuthUserRecord {
  return {
    email: `${overrides.userId}@example.com`,
    passwordHash: "hash",
    displayName: overrides.displayName ?? overrides.userId,
    role: overrides.role ?? "member",
    status: overrides.status ?? "active",
    emailVerificationStatus: "verified",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  setParticipantSuspensionForceMemoryForTests(true);
  resetParticipantSuspensionsMemoryForTests();
  resetParticipantSuspensionRateLimitsForTests();
  audits.length = 0;
  suspendedEmails.length = 0;
  restoredEmails.length = 0;
  authStatusByUserId.clear();
  usersById.clear();
  usersByMemberId.clear();

  for (const user of [
    makeAuthUser({
      userId: "admin-1",
      memberId: "participant-admin",
      role: "admin",
      displayName: "Admin",
    }),
    makeAuthUser({ userId: "user-1", memberId: "participant-1", displayName: "One" }),
    makeAuthUser({ userId: "user-2", memberId: "participant-2", displayName: "Two" }),
    makeAuthUser({
      userId: "admin-2",
      memberId: "participant-admin-2",
      role: "admin",
      displayName: "Other admin",
    }),
  ]) {
    usersById.set(user.userId, user);
    usersByMemberId.set(user.memberId, user);
    authStatusByUserId.set(user.userId, user.status);
  }

  setParticipantSuspensionAdminAssertOverrideForTests(async (userId) => {
    const user = usersById.get(userId);
    if (!user || user.role !== "admin" || user.status !== "active") {
      throw new Error("Administrator access is required.");
    }
    return { userId: user.userId, memberId: user.memberId };
  });

  setParticipantSuspensionAuditRecorderOverrideForTests(async (input) => {
    audits.push(input);
    return {
      auditId: `audit-${audits.length}`,
      actorParticipantId: input.actorParticipantId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      scope: input.scope ?? { scopeType: "global" },
      createdAt: new Date().toISOString(),
    } satisfies AdministrationAuditRecord;
  });

  setParticipantSuspensionAuthOverridesForTests({
    findByMemberId: async (participantId) => usersByMemberId.get(participantId) ?? null,
    findById: async (userId) => usersById.get(userId) ?? null,
    updateStatus: async (userId, status) => {
      const existing = usersById.get(userId);
      if (!existing) {
        return null;
      }
      const next = { ...existing, status, updatedAt: new Date().toISOString() };
      usersById.set(userId, next);
      usersByMemberId.set(next.memberId, next);
      authStatusByUserId.set(userId, status);
      return next;
    },
    revokeSessions: async () => 1,
    updateProfileStatus: async () => ({ ok: true }),
  });

  setParticipantSuspensionEmailOverridesForTests({
    sendSuspended: async (input) => {
      suspendedEmails.push(input.to);
      if (input.to === "user-2@example.com") {
        return {
          emailId: "email-failed",
          emailSent: false,
          status: "failed",
          emailDeliveryError: "mailbox unavailable",
        };
      }
      return { emailId: "email-suspended", emailSent: true, status: "sent" };
    },
    sendRestored: async (input) => {
      restoredEmails.push(input.to);
      return { emailId: "email-restored", emailSent: true, status: "sent" };
    },
  });

  setParticipantSuspensionNotificationOverrideForTests(async () => ({ created: 0, skipped: 0 }));
});

afterEach(() => {
  setParticipantSuspensionForceMemoryForTests(false);
  setParticipantSuspensionAdminAssertOverrideForTests(null);
  setParticipantSuspensionAuditRecorderOverrideForTests(null);
  setParticipantSuspensionAuthOverridesForTests(null);
  setParticipantSuspensionEmailOverridesForTests(null);
  setParticipantSuspensionNotificationOverrideForTests(null);
  resetParticipantSuspensionsMemoryForTests();
  resetParticipantSuspensionRateLimitsForTests();
});

describe("Participant directory sequential moderation", () => {
  it("keeps an earlier suspension when a later account is ineligible", async () => {
    const calls: string[] = [];
    const outcomes: Array<"success" | "failed"> = [];

    for (const participantId of ["participant-1", "participant-admin-2"]) {
      calls.push(participantId);
      try {
        await suspendParticipantForAdmin({
          actorUserId: "admin-1",
          participantId,
          reasonCode: "security_or_account_integrity",
        });
        outcomes.push("success");
      } catch (error) {
        assert.ok(error instanceof ParticipantSuspensionValidationError);
        assert.match(error.message, /Administrator accounts cannot be suspended/);
        outcomes.push("failed");
      }
    }

    assert.deepEqual(calls, ["participant-1", "participant-admin-2"]);
    assert.deepEqual(outcomes, ["success", "failed"]);
    assert.equal(authStatusByUserId.get("user-1"), "disabled");
    assert.equal(authStatusByUserId.get("admin-2"), "active");
    assert.equal(audits.filter((row) => row.action === "participant.suspend").length, 1);
    assert.deepEqual(suspendedEmails, ["user-1@example.com"]);
  });

  it("keeps a disabled account when the suspension email fails, then restores it", async () => {
    const suspended = await suspendParticipantForAdmin({
      actorUserId: "admin-1",
      participantId: "participant-2",
      reasonCode: "spam_or_abusive_activity",
    });

    assert.equal(suspended.status, "disabled");
    assert.equal(suspended.emailQueued, false);
    assert.match(suspended.emailWarning ?? "", /mailbox unavailable/);
    assert.equal(authStatusByUserId.get("user-2"), "disabled");
    assert.equal(audits.filter((row) => row.action === "participant.suspend").length, 1);

    const restored = await restoreParticipantForAdmin({
      actorUserId: "admin-1",
      participantId: "participant-2",
    });

    assert.equal(restored.status, "active");
    assert.equal(restored.emailQueued, true);
    assert.equal(authStatusByUserId.get("user-2"), "active");
    assert.equal(audits.filter((row) => row.action === "participant.restore").length, 1);
    assert.deepEqual(restoredEmails, ["user-2@example.com"]);
  });
});
