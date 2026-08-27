/**
 * Pack 24B — Participant suspension API (contracts + in-memory behavior).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { AdministrationAuditAppendInput, AdministrationAuditRecord } from "@hu/types";
import { PARTICIPANT_SUSPENSION_REASON_CODES } from "@hu/types";

import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.types.js";
import { renderEmailTemplate } from "../../../src/modules/email/email.templates.js";
import {
  ADMINISTRATION_AUDIT_ACTIONS,
  deriveAdminAuditCategory,
  resolveAdminAuditTargetHref,
} from "../../../src/modules/administration/admin-audit.projection.js";
import {
  findSuspensionById,
  hashSuspensionReviewToken,
  resetParticipantSuspensionsMemoryForTests,
  setParticipantSuspensionForceMemoryForTests,
} from "../../../src/modules/participant-suspension/participant-suspension.repository.js";
import { resetParticipantSuspensionRateLimitsForTests } from "../../../src/modules/participant-suspension/participant-suspension.rate-limit.js";
import {
  createActiveSuspensionForTests,
  restoreParticipantForAdmin,
  setParticipantSuspensionAdminAssertOverrideForTests,
  setParticipantSuspensionAuditRecorderOverrideForTests,
  setParticipantSuspensionAuthOverridesForTests,
  setParticipantSuspensionEmailOverridesForTests,
  setParticipantSuspensionNotificationOverrideForTests,
  submitSuspensionReview,
  suspendParticipantForAdmin,
} from "../../../src/modules/participant-suspension/participant-suspension.service.js";

const apiSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../src");

function read(relativePath: string): string {
  return readFileSync(path.resolve(apiSrc, relativePath), "utf8");
}

const audits: AdministrationAuditAppendInput[] = [];
const authStatusByUserId = new Map<string, "active" | "disabled">();
const profileStatusByUserId = new Map<string, "active" | "suspended">();
const revokedSessions: string[] = [];
let notifications: Array<{ type: string; title: string; targetHref?: string }> = [];

function makeAuthUser(overrides: Partial<AuthUserRecord> & Pick<AuthUserRecord, "userId" | "memberId">): AuthUserRecord {
  return {
    email: `${overrides.userId}@example.com`,
    passwordHash: "hash",
    displayName: overrides.displayName ?? overrides.userId,
    role: overrides.role ?? "member",
    status: overrides.status ?? authStatusByUserId.get(overrides.userId) ?? "active",
    emailVerificationStatus: "verified",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const usersByMemberId = new Map<string, AuthUserRecord>();
const usersById = new Map<string, AuthUserRecord>();

function seedUsers(): void {
  usersByMemberId.clear();
  usersById.clear();
  authStatusByUserId.clear();
  profileStatusByUserId.clear();

  const admin = makeAuthUser({
    userId: "admin-1",
    memberId: "participant-admin-1",
    role: "admin",
    displayName: "Admin One",
  });
  const member = makeAuthUser({
    userId: "user-1",
    memberId: "participant-1",
    role: "member",
    displayName: "Member One",
  });
  const otherAdmin = makeAuthUser({
    userId: "admin-2",
    memberId: "participant-admin-2",
    role: "admin",
    displayName: "Admin Two",
  });

  for (const user of [admin, member, otherAdmin]) {
    usersById.set(user.userId, user);
    usersByMemberId.set(user.memberId, user);
    authStatusByUserId.set(user.userId, user.status);
  }
}

beforeEach(() => {
  setParticipantSuspensionForceMemoryForTests(true);
  resetParticipantSuspensionsMemoryForTests();
  resetParticipantSuspensionRateLimitsForTests();
  audits.length = 0;
  revokedSessions.length = 0;
  notifications = [];
  seedUsers();

  setParticipantSuspensionAdminAssertOverrideForTests(async (userId) => {
    const user = usersById.get(userId);
    if (!user || user.role !== "admin") {
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
      reason: input.reason,
      beforeSummary: input.beforeSummary,
      afterSummary: input.afterSummary,
      createdAt: new Date().toISOString(),
      correlationId: input.correlationId,
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
      authStatusByUserId.set(userId, status);
      const next = { ...existing, status, updatedAt: new Date().toISOString() };
      usersById.set(userId, next);
      usersByMemberId.set(next.memberId, next);
      return next;
    },
    revokeSessions: async (userId) => {
      revokedSessions.push(userId);
      return 1;
    },
    updateProfileStatus: async (userId, status) => {
      profileStatusByUserId.set(userId, status);
      return { userId, status };
    },
  });

  setParticipantSuspensionEmailOverridesForTests({
    sendSuspended: async () => ({
      emailId: "email-suspended",
      emailSent: true,
      status: "sent",
    }),
    sendRestored: async () => ({
      emailId: "email-restored",
      emailSent: true,
      status: "sent",
    }),
  });

  setParticipantSuspensionNotificationOverrideForTests(async (input) => {
    notifications.push({
      type: input.type,
      title: input.title,
      targetHref: input.targetHref,
    });
    return { created: 1, skipped: 0 };
  });
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

describe("Pack 24B — Participant suspension (contracts)", () => {
  it("exposes only three suspension reason codes", () => {
    assert.deepEqual([...PARTICIPANT_SUSPENSION_REASON_CODES], [
      "community_standards_violation",
      "spam_or_abusive_activity",
      "security_or_account_integrity",
    ]);
  });

  it("wires auth status helper, mongo collection/indexes, and routes", () => {
    const authRepo = read("modules/auth/auth-user.repository.ts");
    assert.match(authRepo, /updateAuthUserAccountStatus/);

    const collections = read("infrastructure/mongodb/mongo-collections.ts");
    assert.match(collections, /participantSuspensions:\s*"participant_suspensions"/);

    const indexes = read("infrastructure/mongodb/mongo-indexes.ts");
    assert.match(indexes, /MONGO_COLLECTIONS\.participantSuspensions/);
    assert.match(indexes, /reviewTokenHash/);
    assert.match(indexes, /sparse:\s*true/);
    assert.match(indexes, /participant_suspension_id_unique/);

    const app = read("app.ts");
    assert.match(app, /\/api\/v1\/admin\/participants/);
    assert.match(app, /adminParticipantSuspensionRouter/);
    assert.match(app, /\/api\/v1\/public\/suspension-review/);

    const loginTwoStep = read("modules/auth/auth-login-two-step.service.ts");
    assert.match(loginTwoStep, /user\.status === "disabled"/);
    assert.match(loginTwoStep, /UserDisabledError/);
  });

  it("registers audit actions and participant category/href", () => {
    assert.ok(ADMINISTRATION_AUDIT_ACTIONS.includes("participant.suspend"));
    assert.ok(ADMINISTRATION_AUDIT_ACTIONS.includes("participant.restore"));
    assert.ok(ADMINISTRATION_AUDIT_ACTIONS.includes("participant.suspension_review.submit"));
    assert.equal(deriveAdminAuditCategory("participant.suspend"), "participants");
    assert.equal(resolveAdminAuditTargetHref("participant", "p-1"), "/admin/participants");
  });

  it("email templates use CTA link without textarea/form", () => {
    const suspended = renderEmailTemplate("participant_suspended", {
      displayName: "Alex",
      reasonLabel: "Community standards",
      reviewUrl: "https://example.test/account/suspension-review?token=abc",
    });
    assert.match(suspended.html, /Request a review/);
    assert.match(suspended.html, /suspension-review\?token=abc/);
    assert.doesNotMatch(suspended.html, /<textarea/i);
    assert.doesNotMatch(suspended.html, /<form/i);

    const restored = renderEmailTemplate("participant_restored", {
      displayName: "Alex",
      accountUrl: "https://example.test/login",
    });
    assert.match(restored.html, /restored/i);
    assert.doesNotMatch(restored.html, /<textarea/i);
  });

  it("directory enrichment attaches suspension summaries for disabled accounts", () => {
    const service = read("modules/administration/admin-participant-directory.service.ts");
    assert.match(service, /findActiveSuspensionSummariesByParticipantIds/);
    assert.match(service, /authUser\.status === "disabled"/);
  });
});

describe("Pack 24B — Participant suspension (memory behavior)", () => {
  it("suspend sets auth disabled, hashes token, audits without explanation body", async () => {
    const result = await suspendParticipantForAdmin({
      actorUserId: "admin-1",
      participantId: "participant-1",
      reasonCode: "community_standards_violation",
    });

    assert.equal(result.status, "disabled");
    assert.equal(authStatusByUserId.get("user-1"), "disabled");
    assert.equal(profileStatusByUserId.get("user-1"), "suspended");
    assert.deepEqual(revokedSessions, ["user-1"]);
    assert.equal(result.emailQueued, true);

    const stored = await findSuspensionById(result.suspensionId);
    assert.ok(stored);
    assert.equal(stored!.status, "active");
    assert.ok(stored!.reviewTokenHash);
    assert.doesNotMatch(JSON.stringify(stored), /rawReviewToken|base64url/);

    const suspendAudit = audits.find((row) => row.action === "participant.suspend");
    assert.ok(suspendAudit);
    assert.match(suspendAudit!.afterSummary ?? "", /reasonCode=community_standards_violation/);
    assert.doesNotMatch(suspendAudit!.afterSummary ?? "", /explanation/i);
    assert.equal(suspendAudit!.reason, undefined);
  });

  it("rejects unknown reason codes", async () => {
    await assert.rejects(
      () =>
        suspendParticipantForAdmin({
          actorUserId: "admin-1",
          participantId: "participant-1",
          reasonCode: "not_a_real_reason",
        }),
      /valid suspension reason/i,
    );
  });

  it("duplicate pending review returns existing request safely", async () => {
    const issued = await createActiveSuspensionForTests({
      participantId: "participant-1",
      userId: "user-1",
      reasonCode: "spam_or_abusive_activity",
      suspendedByParticipantId: "participant-admin-1",
      rawReviewToken: "test-review-token-pack24b",
    });

    const first = await submitSuspensionReview({
      token: issued.rawReviewToken,
      explanation: "This suspension appears to be a mistake based on context.",
      clientKey: "ip-1",
    });
    const second = await submitSuspensionReview({
      token: issued.rawReviewToken,
      explanation: "A second explanation that should not replace the first one.",
      clientKey: "ip-2",
    });

    assert.equal(first.requestId, second.requestId);
    assert.equal(first.status, "pending");

    const stored = await findSuspensionById(issued.suspension.suspensionId);
    assert.equal(stored?.reviewRequest?.explanation.includes("appears to be a mistake"), true);

    const reviewAudits = audits.filter(
      (row) => row.action === "participant.suspension_review.submit",
    );
    assert.equal(reviewAudits.length, 1);
    assert.doesNotMatch(reviewAudits[0]!.afterSummary ?? "", /explanation|mistake/i);
    assert.equal(notifications[0]?.type, "participant_suspension_review_requested");
    assert.equal(notifications[0]?.title, "Participant requested suspension review");
    assert.doesNotMatch(JSON.stringify(notifications), /mistake|explanation/i);

    // Token hash stored, raw token never persisted on record.
    assert.equal(
      stored?.reviewTokenHash,
      hashSuspensionReviewToken(issued.rawReviewToken),
    );
    assert.equal(JSON.stringify(stored).includes(issued.rawReviewToken), false);
  });

  it("restore reactivates auth and marks suspension restored", async () => {
    await suspendParticipantForAdmin({
      actorUserId: "admin-1",
      participantId: "participant-1",
      reasonCode: "security_or_account_integrity",
    });

    const restored = await restoreParticipantForAdmin({
      actorUserId: "admin-1",
      participantId: "participant-1",
    });

    assert.equal(restored.status, "active");
    assert.equal(authStatusByUserId.get("user-1"), "active");
    assert.equal(profileStatusByUserId.get("user-1"), "active");

    const stored = await findSuspensionById(restored.suspensionId);
    assert.equal(stored?.status, "restored");
    assert.ok(stored?.restoredAt);
    assert.ok(stored?.reviewTokenConsumedAt);

    assert.ok(audits.some((row) => row.action === "participant.restore"));
  });

  it("audit action list includes suspend, restore, and review submit", () => {
    assert.ok(ADMINISTRATION_AUDIT_ACTIONS.includes("participant.suspend"));
    assert.ok(ADMINISTRATION_AUDIT_ACTIONS.includes("participant.restore"));
    assert.ok(ADMINISTRATION_AUDIT_ACTIONS.includes("participant.suspension_review.submit"));
  });
});
