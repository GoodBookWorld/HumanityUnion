/**
 * HU-ACCOUNT-DELETE-01B — participant deletion lifecycle.
 * Uses injected stores and mocked mail. No Production database and no outbound email.
 */
process.env.NODE_TEST_ENV = "true";
process.env.ACCOUNT_DELETION_ENABLED = "true";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { afterEach, describe, it } from "node:test";
import type { Request, Response } from "express";

import {
  AccountDeletionPendingError,
  AuthValidationError,
  InvalidCredentialsError,
  UserDisabledError,
} from "../../../src/modules/auth/auth.errors.js";
import { hashPassword } from "../../../src/modules/auth/auth-password.js";
import { loginAuthUser } from "../../../src/modules/auth/auth.service.js";
import {
  requireActiveAccountForMutationsMiddleware,
  setAuthUserLookupOverrideForTests,
} from "../../../src/modules/auth/auth-active-account-gate.js";
import {
  clearAuthRateLimitBucketsForTests,
  createAuthRateLimiter,
} from "../../../src/modules/auth/auth-rate-limit.js";
import {
  setFindAuthUserByEmailForTests,
} from "../../../src/modules/auth/auth-user.repository.js";
import type { AuthUserRecord } from "../../../src/modules/auth/auth-user.types.js";
import {
  AccountDeletionRejectedError,
  confirmAccountDeletion,
  confirmAccountDeletionCancellation,
  requestAccountDeletion,
  requestAccountDeletionCancellation,
  runAccountDeletionFinalizationTick,
  type AccountDeletionDeps,
} from "../../../src/modules/account-deletion/account-deletion.service.js";
import {
  ACCOUNT_DELETION_CLEARED_PROFILE_FIELDS,
  buildClosedProfileUpdate,
} from "../../../src/modules/account-deletion/account-deletion.profile.js";
import {
  ACCOUNT_DELETION_CANCEL_FAILURE_MESSAGE,
  ACCOUNT_DELETION_CANCEL_REQUEST_MESSAGE,
  ACCOUNT_DELETION_RECOVERY_WINDOW_MS,
  ACCOUNT_DELETION_REMINDER_LEAD_MS,
  CIVIC_DISPLAY_NAME_RETENTION,
  deletionDeadlineFromConfirmation,
  isReservedDeletionEmail,
  reservedDeletionEmail,
} from "../../../src/modules/account-deletion/account-deletion.state.js";
import {
  renderAccountDeletionFinalizedEmail,
  renderAccountDeletionReminderEmail,
} from "../../../src/modules/email/email.templates.js";
import { registerAuthUser } from "../../../src/modules/auth/auth.service.js";

const ROOT = new URL("../../../src/", import.meta.url);

function readSrc(path: string): string {
  return readFileSync(new URL(path, ROOT), "utf8");
}

function user(partial: Partial<AuthUserRecord> = {}): AuthUserRecord {
  return {
    userId: "user-1",
    email: "member@example.com",
    passwordHash: "hash",
    displayName: "Civic Name",
    role: "member",
    status: "active",
    memberId: "member-1",
    emailVerificationStatus: "verified",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function createHarness(initial: AuthUserRecord) {
  let current = structuredClone(initial);
  const sent: Array<{ template: string; to: string; deadline?: string }> = [];
  const revoked: string[] = [];
  const closed: string[] = [];
  const audits: string[] = [];
  const codes = new Map<string, { code: string; purpose: string; consumed: boolean }>();
  let clock = Date.parse("2026-03-01T00:00:00.000Z");
  let sendFinalizedThrows = false;
  let reminderFailures = 0;
  let noticeWrites = 0;

  const deps: AccountDeletionDeps = {
    now: () => new Date(clock).toISOString(),
    findById: async (userId) => (current.userId === userId ? structuredClone(current) : null),
    findByEmail: async (email) =>
      current.email === email.trim().toLowerCase() ? structuredClone(current) : null,
    verifyPassword: async (password, hash) => password === "correct" && hash === current.passwordHash,
    hasActiveRrpAppointment: async () => false,
    hasActiveEditorGrant: async () => false,
    issueCode: async (input) => {
      const code = input.purpose === "account_deletion_confirm" ? "111111" : "222222";
      const confirmationId = randomUUID();
      codes.set(confirmationId, { code, purpose: input.purpose, consumed: false });
      for (const entry of codes.values()) {
        if (entry.purpose === input.purpose && entry !== codes.get(confirmationId)) {
          entry.consumed = true;
        }
      }
      return { code, confirmationId, expiresMinutes: 10 };
    },
    consumeCode: async (input) => {
      const match = [...codes.entries()].find(
        ([, entry]) =>
          !entry.consumed && entry.purpose === input.purpose && entry.code === input.code.trim(),
      );
      if (!match) {
        return false;
      }
      match[1].consumed = true;
      return true;
    },
    discardCode: async (confirmationId) => {
      const entry = codes.get(confirmationId);
      if (entry) {
        entry.consumed = true;
      }
    },
    sendCode: async (input) => {
      sent.push({ template: `code:${input.action}`, to: input.to });
      return { emailSent: true, emailId: `mail-${sent.length}` };
    },
    sendScheduled: async (input) => {
      sent.push({ template: "scheduled", to: input.to });
      return { emailSent: true, emailId: `mail-${sent.length}` };
    },
    sendCancelled: async (input) => {
      sent.push({ template: "cancelled", to: input.to });
      return { emailSent: true };
    },
    sendFinalized: async (input) => {
      sent.push({ template: "finalized", to: input.to });
      if (sendFinalizedThrows) {
        sendFinalizedThrows = false;
        throw new Error("smtp down");
      }
      return { emailSent: !input.to.endsWith("@fail.test"), emailId: `mail-${sent.length}` };
    },
    sendReminder: async (input) => {
      if (reminderFailures > 0) {
        reminderFailures -= 1;
        sent.push({ template: "reminder-failed", to: input.to, deadline: input.deadlineAt });
        throw new Error("smtp down");
      }
      sent.push({ template: "reminder", to: input.to, deadline: input.deadlineAt });
      return { emailSent: true, emailId: `reminder-${sent.length}` };
    },
    listReminderCandidates: async (nowIso, reminderDueByIso) => {
      const deletion = current.accountDeletion;
      if (
        current.status !== "active" ||
        deletion?.phase !== "pending" ||
        !deletion.deadlineAt ||
        deletion.reminderStatus === "sent" ||
        !(deletion.deadlineAt > nowIso && deletion.deadlineAt <= reminderDueByIso)
      ) {
        return [];
      }
      return [structuredClone(current)];
    },
    claimReminder: async (input) => {
      const deletion = current.accountDeletion;
      if (
        !deletion ||
        deletion.phase !== "pending" ||
        !deletion.deadlineAt ||
        !(deletion.deadlineAt > input.nowIso && deletion.deadlineAt <= input.reminderDueByIso) ||
        (deletion.reminderStatus !== undefined && deletion.reminderStatus !== "failed")
      ) {
        return null;
      }
      current = {
        ...current,
        updatedAt: input.nowIso,
        accountDeletion: { ...deletion, reminderStatus: "sending" },
      };
      return structuredClone(current);
    },
    setReminderStatus: async (input) => {
      if (!current.accountDeletion || current.accountDeletion.reminderStatus !== "sending") {
        return;
      }
      current = {
        ...current,
        accountDeletion: { ...current.accountDeletion, reminderStatus: input.status },
      };
    },
    releaseStaleReminder: async (input) => {
      const deletion = current.accountDeletion;
      if (
        !deletion ||
        deletion.reminderStatus !== "sending" ||
        current.updatedAt > input.claimedBeforeIso
      ) {
        return false;
      }
      current = {
        ...current,
        accountDeletion: { ...deletion, reminderStatus: "failed" },
      };
      return true;
    },
    markAwaiting: async (input) => {
      if (current.userId !== input.userId || current.status !== "active" || current.role !== "member") {
        return null;
      }
      const phase = current.accountDeletion?.phase;
      if (phase === "pending" || phase === "finalized") {
        return null;
      }
      current = {
        ...current,
        updatedAt: input.requestedAt,
        accountDeletion: {
          requestId: input.requestId,
          phase: "awaiting_confirmation",
          requestedAt: input.requestedAt,
          confirmationExpiresAt: input.confirmationExpiresAt,
        },
      };
      return structuredClone(current);
    },
    markPending: async (input) => {
      const deletion = current.accountDeletion;
      if (
        current.userId !== input.userId ||
        deletion?.phase !== "awaiting_confirmation" ||
        deletion.requestId !== input.requestId
      ) {
        return null;
      }
      current = {
        ...current,
        updatedAt: input.confirmedAt,
        accountDeletion: {
          ...deletion,
          phase: "pending",
          confirmedAt: input.confirmedAt,
          deadlineAt: input.deadlineAt,
        },
      };
      return structuredClone(current);
    },
    markCancelled: async (input) => {
      const deletion = current.accountDeletion;
      if (
        !deletion ||
        deletion.phase !== "pending" ||
        deletion.requestId !== input.requestId ||
        !deletion.deadlineAt ||
        deletion.deadlineAt <= input.nowIso ||
        current.status !== "active"
      ) {
        return null;
      }
      current = {
        ...current,
        accountDeletion: { ...deletion, phase: "cancelled", cancelledAt: input.cancelledAt },
      };
      return structuredClone(current);
    },
    recordScheduledNotice: async (input) => {
      if (current.accountDeletion && !current.accountDeletion.scheduledNoticeEmailId) {
        current = {
          ...current,
          accountDeletion: { ...current.accountDeletion, scheduledNoticeEmailId: input.emailId },
        };
      }
    },
    listCandidates: async (nowIso) => {
      const deletion = current.accountDeletion;
      if (!deletion || current.status !== "active") {
        return [];
      }
      if (deletion.phase === "pending" && deletion.deadlineAt && deletion.deadlineAt <= nowIso) {
        return [structuredClone(current)];
      }
      if (deletion.phase === "finalized" && !deletion.profileClosedAt) {
        return [structuredClone(current)];
      }
      return [];
    },
    claimFinalNotice: async () => {
      const deletion = current.accountDeletion;
      if (!deletion || deletion.phase !== "pending" || deletion.finalNoticeStatus) {
        return null;
      }
      current = {
        ...current,
        updatedAt: new Date(clock).toISOString(),
        accountDeletion: { ...deletion, finalNoticeStatus: "sending" },
      };
      return structuredClone(current);
    },
    setFinalNoticeStatus: async (input) => {
      noticeWrites += 1;
      if (noticeWrites === 1 && input.status === "failed" && sent.at(-1)?.template === "finalized-crash") {
        throw new Error("crash before notice status");
      }
      if (!current.accountDeletion) {
        return;
      }
      current = {
        ...current,
        accountDeletion: { ...current.accountDeletion, finalNoticeStatus: input.status },
      };
    },
    skipStaleFinalNotice: async (input) => {
      const deletion = current.accountDeletion;
      if (
        !deletion ||
        deletion.finalNoticeStatus !== "sending" ||
        current.updatedAt > input.claimedBeforeIso
      ) {
        return false;
      }
      current = {
        ...current,
        accountDeletion: { ...deletion, finalNoticeStatus: "skipped" },
      };
      return true;
    },
    finalizeRecord: async (input) => {
      const deletion = current.accountDeletion;
      if (
        !deletion ||
        deletion.phase !== "pending" ||
        !deletion.deadlineAt ||
        deletion.deadlineAt > input.nowIso ||
        (deletion.finalNoticeStatus !== "sent" &&
          deletion.finalNoticeStatus !== "failed" &&
          deletion.finalNoticeStatus !== "skipped")
      ) {
        return null;
      }
      const previousEmail = current.email;
      current = {
        ...current,
        email: input.reservedEmail,
        passwordHash: input.passwordHash,
        pendingEmail: undefined,
        accountDeletion: {
          ...deletion,
          phase: "finalized",
          finalizedAt: input.nowIso,
          previousEmailHash: input.previousEmailHash,
        },
      };
      assert.notEqual(current.email, previousEmail);
      assert.equal(current.userId, initial.userId);
      assert.equal(current.memberId, initial.memberId);
      return structuredClone(current);
    },
    markProfileClosed: async (input) => {
      if (current.accountDeletion) {
        current = {
          ...current,
          accountDeletion: { ...current.accountDeletion, profileClosedAt: input.closedAt },
        };
      }
    },
    closeProfile: async (userId) => {
      closed.push(userId);
    },
    revokeSessions: async (userId) => {
      revoked.push(userId);
    },
    invalidateAuthMaterial: async (userId) => {
      revoked.push(`material:${userId}`);
    },
    hashReplacementPassword: async () => "replaced-hash",
    audit: (input) => {
      audits.push(input.action);
      assert.doesNotMatch(input.afterSummary, /@/);
    },
    createRequestId: () => "request-1",
    noticeReclaimMs: 0,
  };

  return {
    deps,
    sent,
    revoked,
    closed,
    audits,
    codes,
    get user() {
      return current;
    },
    advance(ms: number) {
      clock += ms;
    },
    failNextFinalMail() {
      sendFinalizedThrows = true;
    },
    failNextReminder() {
      reminderFailures += 1;
    },
  };
}

function mockRes(): Response & { statusCode: number; body: unknown } {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as Response & { statusCode: number; body: unknown };
}

describe("account deletion lifecycle", { concurrency: false }, () => {
  afterEach(() => {
    setFindAuthUserByEmailForTests(null);
    setAuthUserLookupOverrideForTests(null);
    clearAuthRateLimitBucketsForTests();
  });

  it("rejects the wrong password before a code is issued", async () => {
    const harness = createHarness(user());
    await assert.rejects(
      () => requestAccountDeletion({ userId: "user-1", currentPassword: "nope" }, harness.deps),
      (error: unknown) =>
        error instanceof AccountDeletionRejectedError && error.code === "invalid_password",
    );
    assert.equal(harness.sent.length, 0);
    assert.equal(harness.user.accountDeletion, undefined);
  });

  it("refuses confirmation after the email code expires and finalizes on the exact deadline", async () => {
    const expired = createHarness(user());
    await requestAccountDeletion({ userId: "user-1", currentPassword: "correct" }, expired.deps);
    const confirmationExpiresAt = expired.user.accountDeletion?.confirmationExpiresAt;
    assert.ok(confirmationExpiresAt);
    expired.advance(Date.parse(confirmationExpiresAt) - Date.parse(expired.deps.now()) + 1);
    await assert.rejects(
      () => confirmAccountDeletion({ userId: "user-1", code: "111111" }, expired.deps),
      (error: unknown) => error instanceof AccountDeletionRejectedError && error.code === "invalid_code",
    );
    assert.equal(expired.user.accountDeletion?.phase, "awaiting_confirmation");
    assert.equal(expired.user.accountDeletion?.deadlineAt, undefined);

    const boundary = createHarness(user());
    await requestAccountDeletion({ userId: "user-1", currentPassword: "correct" }, boundary.deps);
    const confirmed = await confirmAccountDeletion(
      { userId: "user-1", code: "111111" },
      boundary.deps,
    );
    const deadlineAt = confirmed.deadlineAt ?? "";
    await requestAccountDeletionCancellation("member@example.com", boundary.deps);
    boundary.advance(Date.parse(deadlineAt) - Date.parse(boundary.deps.now()));
    assert.equal(boundary.deps.now(), deadlineAt);
    await assert.rejects(
      () =>
        confirmAccountDeletionCancellation(
          { email: "member@example.com", currentPassword: "correct", code: "222222" },
          boundary.deps,
        ),
      (error: unknown) => error instanceof AccountDeletionRejectedError && error.code === "invalid_code",
    );
    const tick = await runAccountDeletionFinalizationTick(boundary.deps);
    assert.equal(tick.reminders, 0);
    assert.equal(tick.finalized, 1);
    assert.equal(boundary.user.accountDeletion?.phase, "finalized");
    assert.equal(boundary.user.email, reservedDeletionEmail("user-1"));
    assert.notEqual(boundary.user.passwordHash, "hash");
    const repository = readSrc("modules/account-deletion/account-deletion.repository.ts");
    const list = repository.slice(
      repository.indexOf("function listAccountDeletionFinalizationCandidates"),
      repository.indexOf("function claimAccountDeletionFinalNotice"),
    );
    assert.doesNotMatch(list, /status: "active",\s*\$or/);
    assert.match(list, /"accountDeletion.phase": "finalized"/);
  });

  it("does not start the 30-day window until the confirmation code is consumed", async () => {
    const harness = createHarness(user());
    const requested = await requestAccountDeletion(
      { userId: "user-1", currentPassword: "correct" },
      harness.deps,
    );
    assert.equal(requested.phase, "awaiting_confirmation");
    assert.equal(requested.deadlineAt, undefined);
    assert.equal(harness.sent[0]?.template, "code:confirm");

    await assert.rejects(
      () => confirmAccountDeletion({ userId: "user-1", code: "000000" }, harness.deps),
      (error: unknown) => error instanceof AccountDeletionRejectedError && error.code === "invalid_code",
    );

    const confirmed = await confirmAccountDeletion({ userId: "user-1", code: "111111" }, harness.deps);
    assert.equal(confirmed.phase, "pending");
    assert.equal(
      confirmed.deadlineAt,
      deletionDeadlineFromConfirmation("2026-03-01T00:00:00.000Z"),
    );
    assert.equal(
      Date.parse(confirmed.deadlineAt!) - Date.parse("2026-03-01T00:00:00.000Z"),
      ACCOUNT_DELETION_RECOVERY_WINDOW_MS,
    );
    assert.deepEqual(harness.revoked, ["user-1"]);
    assert.equal(harness.sent.filter((message) => message.template === "scheduled").length, 1);
  });

  it("does not extend the deadline when confirmation is repeated", async () => {
    const harness = createHarness(user());
    await requestAccountDeletion({ userId: "user-1", currentPassword: "correct" }, harness.deps);
    const first = await confirmAccountDeletion({ userId: "user-1", code: "111111" }, harness.deps);
    harness.advance(86_400_000);
    const second = await confirmAccountDeletion({ userId: "user-1", code: "111111" }, harness.deps);
    assert.equal(second.deadlineAt, first.deadlineAt);
    assert.equal(harness.sent.filter((message) => message.template === "scheduled").length, 1);
  });

  it("only one of two parallel confirmations can consume the code", async () => {
    const harness = createHarness(user());
    await requestAccountDeletion({ userId: "user-1", currentPassword: "correct" }, harness.deps);
    const results = await Promise.allSettled([
      confirmAccountDeletion({ userId: "user-1", code: "111111" }, harness.deps),
      confirmAccountDeletion({ userId: "user-1", code: "111111" }, harness.deps),
    ]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    assert.equal(fulfilled.length, 1);
    assert.equal(harness.user.accountDeletion?.phase, "pending");
  });

  it("cancels inside the window and refuses a disabled or expired recovery", async () => {
    const harness = createHarness(user());
    await requestAccountDeletion({ userId: "user-1", currentPassword: "correct" }, harness.deps);
    await confirmAccountDeletion({ userId: "user-1", code: "111111" }, harness.deps);

    const hidden = await requestAccountDeletionCancellation("missing@example.com", harness.deps);
    assert.equal(hidden.message, ACCOUNT_DELETION_CANCEL_REQUEST_MESSAGE);
    assert.equal(harness.sent.filter((message) => message.template === "code:cancel").length, 0);

    const requested = await requestAccountDeletionCancellation("member@example.com", harness.deps);
    assert.equal(requested.message, ACCOUNT_DELETION_CANCEL_REQUEST_MESSAGE);

    await assert.rejects(
      () =>
        confirmAccountDeletionCancellation(
          { email: "member@example.com", currentPassword: "wrong", code: "222222" },
          harness.deps,
        ),
      (error: unknown) =>
        error instanceof AccountDeletionRejectedError &&
        error.message === ACCOUNT_DELETION_CANCEL_FAILURE_MESSAGE,
    );

    const cancelled = await confirmAccountDeletionCancellation(
      { email: "member@example.com", currentPassword: "correct", code: "222222" },
      harness.deps,
    );
    assert.match(cancelled.message, /cancelled/i);
    assert.equal(harness.user.accountDeletion?.phase, "cancelled");
    assert.equal(harness.user.role, "member");

    harness.user.status = "disabled";
    harness.user.accountDeletion = {
      requestId: "request-2",
      phase: "pending",
      requestedAt: "2026-03-01T00:00:00.000Z",
      deadlineAt: "2026-04-01T00:00:00.000Z",
    };
    await assert.rejects(
      () =>
        confirmAccountDeletionCancellation(
          { email: "member@example.com", currentPassword: "correct", code: "222222" },
          harness.deps,
        ),
      AccountDeletionRejectedError,
    );
    assert.equal(harness.user.status, "disabled");
  });

  it("finalizes once after the deadline, survives a failed notice, and releases the email", async () => {
    const harness = createHarness(user());
    await requestAccountDeletion({ userId: "user-1", currentPassword: "correct" }, harness.deps);
    await confirmAccountDeletion({ userId: "user-1", code: "111111" }, harness.deps);
    const early = await runAccountDeletionFinalizationTick(harness.deps);
    assert.equal(early.finalized, 0);

    harness.advance(ACCOUNT_DELETION_RECOVERY_WINDOW_MS);
    harness.failNextFinalMail();
    const done = await runAccountDeletionFinalizationTick(harness.deps);
    assert.equal(done.finalized, 1);
    assert.equal(harness.user.accountDeletion?.phase, "finalized");
    assert.equal(harness.user.accountDeletion?.finalNoticeStatus, "failed");
    assert.equal(harness.user.email, reservedDeletionEmail("user-1"));
    assert.equal(isReservedDeletionEmail(harness.user.email), true);
    assert.equal(harness.user.passwordHash, "replaced-hash");
    assert.equal(
      harness.user.accountDeletion?.previousEmailHash,
      createHash("sha256").update("member@example.com").digest("hex"),
    );
    assert.equal(harness.user.userId, "user-1");
    assert.equal(harness.user.memberId, "member-1");
    assert.deepEqual(harness.closed, ["user-1"]);

    const again = await runAccountDeletionFinalizationTick(harness.deps);
    assert.equal(again.finalized, 0);
    assert.equal(harness.sent.filter((message) => message.template === "finalized").length, 1);
  });

  it("retries finalization after a restart without a second completion message", async () => {
    const harness = createHarness(user());
    await requestAccountDeletion({ userId: "user-1", currentPassword: "correct" }, harness.deps);
    await confirmAccountDeletion({ userId: "user-1", code: "111111" }, harness.deps);
    harness.advance(ACCOUNT_DELETION_RECOVERY_WINDOW_MS);
    harness.user.accountDeletion = {
      ...harness.user.accountDeletion!,
      finalNoticeStatus: "sending",
    };
    harness.user.updatedAt = "2026-01-01T00:00:00.000Z";
    const retried = await runAccountDeletionFinalizationTick(harness.deps);
    assert.equal(retried.finalized, 1);
    assert.equal(harness.user.accountDeletion?.finalNoticeStatus, "skipped");
    assert.equal(harness.sent.filter((message) => message.template === "finalized").length, 0);
  });

  it("rejects administrators, suspended accounts, active RRP appointments, and editor grants", async () => {
    const admin = createHarness(user({ role: "admin" }));
    await assert.rejects(
      () => requestAccountDeletion({ userId: "user-1", currentPassword: "correct" }, admin.deps),
      (error: unknown) => error instanceof AccountDeletionRejectedError && error.code === "admin",
    );

    const disabled = createHarness(user({ status: "disabled" }));
    await assert.rejects(
      () => requestAccountDeletion({ userId: "user-1", currentPassword: "correct" }, disabled.deps),
      (error: unknown) => error instanceof AccountDeletionRejectedError && error.code === "disabled",
    );

    const rrp = createHarness(user());
    rrp.deps.hasActiveRrpAppointment = async () => true;
    await assert.rejects(
      () => requestAccountDeletion({ userId: "user-1", currentPassword: "correct" }, rrp.deps),
      (error: unknown) =>
        error instanceof AccountDeletionRejectedError && error.code === "rrp_appointment",
    );

    const editor = createHarness(user());
    editor.deps.hasActiveEditorGrant = async () => true;
    await assert.rejects(
      () => requestAccountDeletion({ userId: "user-1", currentPassword: "correct" }, editor.deps),
      (error: unknown) => error instanceof AccountDeletionRejectedError && error.code === "editor_grant",
    );
  });

  it("keeps the civic display name and does not describe a civic or IM cascade", () => {
    const update = buildClosedProfileUpdate("2026-03-31T00:00:00.000Z");
    assert.equal(update.$set.status, "closed");
    assert.equal(update.$set.profileVisibility, "private");
    assert.equal("displayName" in update.$unset, false);
    assert.equal("publicName" in update.$unset, false);
    assert.ok(ACCOUNT_DELETION_CLEARED_PROFILE_FIELDS.includes("biography"));
    assert.equal(CIVIC_DISPLAY_NAME_RETENTION, "retain-live-profile-display-name-pending-policy-review");

    const service = readSrc("modules/account-deletion/account-deletion.service.ts");
    assert.doesNotMatch(service, /initiative|petition|blog\.|external-author-link|participant-suspension/);
    const repository = readSrc("modules/account-deletion/account-deletion.repository.ts");
    assert.match(repository, /accountDeletion\.phase": "awaiting_confirmation"/);
    assert.match(repository, /findOneAndUpdate/);
    const messages = readSrc("modules/direct-messaging/direct-messaging.routes.ts");
    assert.match(messages, /requireJwtAuthenticationMiddleware/);
    const registration = readSrc("modules/auth/auth-user.repository.ts");
    assert.match(registration, /userId: randomUUID\(\)/);
    const register = readSrc("modules/auth/auth.service.ts");
    assert.match(register, /const memberId = randomUUID\(\)/);
  });

  it("blocks pending deletion on login and on residual session reads", async () => {
    const passwordHash = await hashPassword("correct-password");
    const pending = user({
      passwordHash,
      accountDeletion: {
        requestId: "request-1",
        phase: "pending",
        requestedAt: "2026-03-01T00:00:00.000Z",
        deadlineAt: "2026-03-31T00:00:00.000Z",
      },
    });
    setFindAuthUserByEmailForTests(async () => pending);
    await assert.rejects(
      () => loginAuthUser({ email: pending.email, password: "wrong-password" }),
      InvalidCredentialsError,
    );
    await assert.rejects(
      () => loginAuthUser({ email: pending.email, password: "correct-password" }),
      AccountDeletionPendingError,
    );

    setAuthUserLookupOverrideForTests(async () => pending);
    const req = {
      method: "GET",
      path: "/api/v1/direct-messages/conversations",
      auth: { id: pending.userId, memberId: pending.memberId },
    } as unknown as Request;
    const res = mockRes();
    let nextCalled = false;
    await requireActiveAccountForMutationsMiddleware(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  });

  it("rejects a tombstone email at registration", async () => {
    await assert.rejects(
      () =>
        registerAuthUser({
          email: reservedDeletionEmail("user-1"),
          password: "password123",
          displayName: "New Person",
        }),
      AuthValidationError,
    );
  });

  it("rate limits deletion attempts", () => {
    const previous = process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS;
    process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS = "2";
    clearAuthRateLimitBucketsForTests();
    const limit = createAuthRateLimiter("account-deletion-request-test");
    const req = { headers: {}, socket: { remoteAddress: "127.0.0.1" } } as unknown as Request;
    let blocked = 0;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const res = mockRes();
      limit(req, res, () => undefined);
      if (res.statusCode === 429) {
        blocked += 1;
      }
    }
    if (previous === undefined) {
      delete process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS;
    } else {
      process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS = previous;
    }
    assert.equal(blocked, 1);
    const routes = readSrc("modules/account-deletion/account-deletion.routes.ts");
    const app = readSrc("app.ts");
    assert.match(routes, /createAuthRateLimiter\("account-deletion-request"\)/);
    assert.match(app, /browserOriginGuardMiddleware/);
    assert.match(app, /\/api\/v1\/account\/deletion/);
  });

  it("does not send a confirmation code when mail fails", async () => {
    const harness = createHarness(user());
    harness.deps.sendCode = async () => ({ emailSent: false, emailId: "failed" });
    await assert.rejects(
      () => requestAccountDeletion({ userId: "user-1", currentPassword: "correct" }, harness.deps),
      (error: unknown) => error instanceof AccountDeletionRejectedError && error.code === "mail_failed",
    );
    assert.equal(harness.user.accountDeletion, undefined);
  });

  it("sends one reminder three days before the deadline and does not move it", async () => {
    const harness = createHarness(user());
    await requestAccountDeletion({ userId: "user-1", currentPassword: "correct" }, harness.deps);
    await confirmAccountDeletion({ userId: "user-1", code: "111111" }, harness.deps);
    const deadline = harness.user.accountDeletion?.deadlineAt;
    harness.advance(ACCOUNT_DELETION_RECOVERY_WINDOW_MS - ACCOUNT_DELETION_REMINDER_LEAD_MS - 1);
    assert.equal((await runAccountDeletionFinalizationTick(harness.deps)).reminders, 0);
    harness.advance(1);
    const first = await runAccountDeletionFinalizationTick(harness.deps);
    const second = await runAccountDeletionFinalizationTick(harness.deps);
    assert.equal(first.reminders, 1);
    assert.equal(second.reminders, 0);
    assert.equal(harness.sent.filter((item) => item.template === "reminder").length, 1);
    assert.equal(harness.user.accountDeletion?.deadlineAt, deadline);
    assert.equal(harness.user.accountDeletion?.phase, "pending");
  });

  it("claims the reminder once when two ticks overlap", async () => {
    const harness = createHarness(user());
    await requestAccountDeletion({ userId: "user-1", currentPassword: "correct" }, harness.deps);
    await confirmAccountDeletion({ userId: "user-1", code: "111111" }, harness.deps);
    harness.advance(ACCOUNT_DELETION_RECOVERY_WINDOW_MS - ACCOUNT_DELETION_REMINDER_LEAD_MS);
    await Promise.all([
      runAccountDeletionFinalizationTick(harness.deps),
      runAccountDeletionFinalizationTick(harness.deps),
    ]);
    assert.equal(harness.sent.filter((item) => item.template === "reminder").length, 1);
  });

  it("retries a reminder left in sending by a restarted process", async () => {
    const harness = createHarness(user());
    await requestAccountDeletion({ userId: "user-1", currentPassword: "correct" }, harness.deps);
    await confirmAccountDeletion({ userId: "user-1", code: "111111" }, harness.deps);
    harness.advance(ACCOUNT_DELETION_RECOVERY_WINDOW_MS - ACCOUNT_DELETION_REMINDER_LEAD_MS);
    harness.user.accountDeletion = {
      ...harness.user.accountDeletion!,
      reminderStatus: "sending",
    };
    harness.user.updatedAt = "2020-01-01T00:00:00.000Z";
    assert.equal((await runAccountDeletionFinalizationTick(harness.deps)).reminders, 0);
    assert.equal(harness.user.accountDeletion?.reminderStatus, "failed");
    assert.equal((await runAccountDeletionFinalizationTick(harness.deps)).reminders, 1);
  });

  it("retries the reminder after SMTP failure and stops after a successful send", async () => {
    const harness = createHarness(user());
    await requestAccountDeletion({ userId: "user-1", currentPassword: "correct" }, harness.deps);
    await confirmAccountDeletion({ userId: "user-1", code: "111111" }, harness.deps);
    harness.advance(ACCOUNT_DELETION_RECOVERY_WINDOW_MS - ACCOUNT_DELETION_REMINDER_LEAD_MS);
    harness.failNextReminder();
    assert.equal((await runAccountDeletionFinalizationTick(harness.deps)).reminders, 0);
    assert.equal(harness.user.accountDeletion?.reminderStatus, "failed");
    assert.equal((await runAccountDeletionFinalizationTick(harness.deps)).reminders, 1);
    assert.equal((await runAccountDeletionFinalizationTick(harness.deps)).reminders, 0);
    assert.equal(harness.sent.filter((item) => item.template === "reminder").length, 1);
  });

  it("does not send the reminder after cancellation or after the deadline", async () => {
    const before = createHarness(user());
    await requestAccountDeletion({ userId: "user-1", currentPassword: "correct" }, before.deps);
    await confirmAccountDeletion({ userId: "user-1", code: "111111" }, before.deps);
    await requestAccountDeletionCancellation("member@example.com", before.deps);
    await confirmAccountDeletionCancellation(
      { email: "member@example.com", currentPassword: "correct", code: "222222" },
      before.deps,
    );
    before.advance(ACCOUNT_DELETION_RECOVERY_WINDOW_MS - ACCOUNT_DELETION_REMINDER_LEAD_MS);
    await runAccountDeletionFinalizationTick(before.deps);
    assert.equal(before.sent.filter((item) => item.template === "reminder").length, 0);

    const after = createHarness(user());
    await requestAccountDeletion({ userId: "user-1", currentPassword: "correct" }, after.deps);
    await confirmAccountDeletion({ userId: "user-1", code: "111111" }, after.deps);
    after.advance(ACCOUNT_DELETION_RECOVERY_WINDOW_MS - ACCOUNT_DELETION_REMINDER_LEAD_MS);
    await runAccountDeletionFinalizationTick(after.deps);
    await requestAccountDeletionCancellation("member@example.com", after.deps);
    await confirmAccountDeletionCancellation(
      { email: "member@example.com", currentPassword: "correct", code: "222222" },
      after.deps,
    );
    await runAccountDeletionFinalizationTick(after.deps);
    assert.equal(after.sent.filter((item) => item.template === "reminder").length, 1);
    assert.equal(after.user.accountDeletion?.phase, "cancelled");

    const late = createHarness(user());
    await requestAccountDeletion({ userId: "user-1", currentPassword: "correct" }, late.deps);
    await confirmAccountDeletion({ userId: "user-1", code: "111111" }, late.deps);
    late.advance(ACCOUNT_DELETION_RECOVERY_WINDOW_MS);
    const tick = await runAccountDeletionFinalizationTick(late.deps);
    assert.equal(tick.reminders, 0);
    assert.equal(tick.finalized, 1);
    assert.equal(late.sent.filter((item) => item.template === "reminder").length, 0);
  });

  it("keeps cancellation responses generic and refuses a direct call while the gate is off", async () => {
    const previous = process.env.ACCOUNT_DELETION_ENABLED;
    process.env.ACCOUNT_DELETION_ENABLED = "false";
    try {
      const harness = createHarness(user());
      await assert.rejects(
        () => requestAccountDeletion({ userId: "user-1", currentPassword: "correct" }, harness.deps),
        (error: unknown) => error instanceof AccountDeletionRejectedError && error.code === "unavailable",
      );
      const requested = await requestAccountDeletionCancellation("nobody@example.com", harness.deps);
      assert.equal(requested.message, ACCOUNT_DELETION_CANCEL_REQUEST_MESSAGE);
      await assert.rejects(
        () =>
          confirmAccountDeletionCancellation(
            { email: "nobody@example.com", currentPassword: "correct", code: "222222" },
            harness.deps,
          ),
        (error: unknown) => error instanceof AccountDeletionRejectedError && error.code === "invalid_code",
      );
      assert.equal(harness.sent.length, 0);
      const idle = await runAccountDeletionFinalizationTick(harness.deps);
      assert.deepEqual(idle, { finalized: 0, profilesClosed: 0, reminders: 0 });
    } finally {
      process.env.ACCOUNT_DELETION_ENABLED = previous;
    }
  });

  it("explains closure in the final notice and links the reminder to the recovery page", () => {
    const finalized = renderAccountDeletionFinalizedEmail({
      displayName: "Member",
      registerUrl: "https://www.huws.org/register",
    });
    const combined = `${finalized.subject}\n${finalized.text}\n${finalized.html}`;
    assert.match(combined, /previous Humanity Union account is closed/);
    assert.match(combined, /recovery period has ended/);
    assert.match(combined, /cannot be restored/);
    assert.match(combined, /register a new account/);
    assert.match(combined, /civic identity/);
    assert.match(combined, /https:\/\/www\.huws\.org\/register/);
    const reminder = renderAccountDeletionReminderEmail({
      displayName: "Member",
      deadlineAt: "2026-03-31T00:00:00.000Z",
      restoreUrl: "https://www.huws.org/account/deletion/cancel",
      supportEmail: "info@huws.org",
    });
    const reminderText = `${reminder.subject}\n${reminder.text}\n${reminder.html}`;
    assert.match(reminderText, /Humanity Union/);
    assert.match(reminderText, /2026-03-31T00:00:00.000Z/);
    assert.match(reminderText, /does not restore the account/);
    assert.match(reminderText, /https:\/\/www\.huws\.org\/account\/deletion\/cancel/);
    assert.match(reminderText, /info@huws\.org/);
    assert.doesNotMatch(reminderText, /token=/);
  });
});
