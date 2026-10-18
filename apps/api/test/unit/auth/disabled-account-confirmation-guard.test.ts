/**
 * HU-SEC-02A — a disabled account cannot finish email confirmation, receive a
 * session, request a login code, or recover access through password reset.
 * Login and refresh keep their existing rejections.
 *
 * Writes only when MONGODB_DATABASE is an owned hu_test_* database.
 * Full active confirmation runs when the selected hu_test_* database is a
 * replica set, because member registration uses a MongoDB transaction.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { MongoClient } from "mongodb";

import {
  AuthValidationError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  UserDisabledError,
} from "../../../src/modules/auth/auth.errors.js";
import {
  confirmRegistrationEmailCode,
  resendRegistrationConfirmationCode,
} from "../../../src/modules/auth/auth-email-confirmation.service.js";
import { deleteAuthSessionsByUserId } from "../../../src/modules/auth/auth-session.repository.js";
import {
  requestPasswordReset,
  requestPasswordResetForUserId,
  resetPasswordWithToken,
  validatePasswordResetToken,
} from "../../../src/modules/auth/auth-email.service.js";
import { verifyPassword } from "../../../src/modules/auth/auth-password.js";
import { resendLoginTwoStepCode } from "../../../src/modules/auth/auth-login-two-step.service.js";
import { loginAuthUser, refreshAuthSession } from "../../../src/modules/auth/auth.service.js";
import {
  deleteAuthUsersByEmailPrefix,
  findAuthUserById,
  insertAuthUser,
  markAuthUserEmailVerified,
  setAuthUserLoginEmailTwoStepEnabled,
  updateAuthUserAccountStatus,
} from "../../../src/modules/auth/auth-user.repository.js";
import {
  createEmailConfirmationCode,
  deleteEmailConfirmationCodesByUserIds,
  findActiveEmailConfirmationCode,
  getLastIssuedConfirmationCodeForTests,
} from "../../../src/modules/email/email-confirmation-code.repository.js";
import { hashRecipientEmail } from "../../../src/modules/email/email.templates.js";
import { drainEmailQueueForTests } from "../../../src/modules/email/email.queue.js";
import {
  createEmailVerificationToken,
  deleteEmailVerificationTokensByUserIds,
  findValidEmailVerificationToken,
} from "../../../src/modules/email/email.tokens.js";
import { MockEmailProvider } from "../../../src/modules/email/providers/mock.provider.js";
import { MONGO_COLLECTIONS } from "../../../src/infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../src/infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../src/infrastructure/mongodb/mongo-database.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { deleteMembersByMemberIdPrefix } from "../../../src/modules/member/infrastructure/member.repository.js";
import { findMemberByIdentityId } from "../../../src/modules/member/infrastructure/member.repository.js";
import { deleteMemberProfileByUserId } from "../../../src/modules/member-profile/member-profile.repository.js";
import { createMemberProfileForUser } from "../../../src/modules/member-profile/member-profile.service.js";

const RUN_ID = randomUUID();
const EMAIL_PREFIX = `sec02a-${RUN_ID}`;
const MEMBER_PREFIX = `sec02a-m-${RUN_ID}`;
const PURPOSE = "registration_email_confirmation" as const;

function ownedTestDatabase(): boolean {
  const name = process.env.MONGODB_DATABASE?.trim() ?? "";
  return /^hu_test_[a-zA-Z0-9_]+$/.test(name);
}

const mongoReady = isMongoConfigured() && ownedTestDatabase();

async function issuePendingCode(userId: string, email: string): Promise<string> {
  await createEmailConfirmationCode({
    userId,
    email,
    purpose: PURPOSE,
  });
  const code = getLastIssuedConfirmationCodeForTests(userId, PURPOSE);
  assert.ok(code, "A pending confirmation code must be stored.");
  return code;
}

async function countSessions(userId: string): Promise<number> {
  return getMongoCollection<{ userId: string }>(MONGO_COLLECTIONS.authSessions).countDocuments({
    userId,
  });
}

async function countConfirmationCodes(userId: string): Promise<number> {
  return getMongoCollection<{ userId: string }>(
    MONGO_COLLECTIONS.emailConfirmationCodes,
  ).countDocuments({ userId });
}

async function countResetTokens(userId: string): Promise<number> {
  return getMongoCollection<{ userId: string; purpose: string }>(
    MONGO_COLLECTIONS.emailVerificationTokens,
  ).countDocuments({ userId, purpose: "password_reset" });
}

async function countPasswordResetAudits(email: string): Promise<number> {
  return getMongoCollection<{ template: string; recipientHash: string }>(
    MONGO_COLLECTIONS.emailAuditRecords,
  ).countDocuments({
    template: "password_reset",
    recipientHash: hashRecipientEmail(email),
  });
}

function resetEmailsFor(email: string) {
  return MockEmailProvider.sentMessages.filter(
    (message) => message.template === "password_reset" && message.to === email,
  );
}

function tokenFromResetEmail(text: string): string {
  const match = text.match(/[?&]token=([^&\s]+)/);
  assert.ok(match?.[1], "The reset email must include a token.");
  return decodeURIComponent(match[1]);
}

async function insertPending(suffix: string, displayName: string) {
  const email = `${EMAIL_PREFIX}-${suffix}@confirmation-guard.test`;
  const memberId = `${MEMBER_PREFIX}-${suffix}`;
  return insertAuthUser(
    {
      email,
      password: "Password123!",
      displayName,
    },
    memberId,
  );
}

describe("HU-SEC-02A disabled account confirmation guard", {
  skip: mongoReady ? false : "owned hu_test_ MongoDB is not selected",
}, () => {
  const userIds: string[] = [];

  before(async () => {
    await connectMongoClient();
  });

  after(async () => {
    await deleteAuthUsersByEmailPrefix(`${EMAIL_PREFIX}-`);
    for (const userId of userIds) {
      await deleteMemberProfileByUserId(userId);
      await deleteAuthSessionsByUserId(userId);
      await deleteEmailConfirmationCodesByUserIds([userId]);
    }
    await deleteEmailVerificationTokensByUserIds(userIds);
    await disconnectMongoClient();
  });

  it("does not issue a session when a disabled account presents a valid confirmation code", async () => {
    const user = await insertPending("disabled-valid", "Disabled pending");
    userIds.push(user.userId);
    const code = await issuePendingCode(user.userId, user.email);
    await updateAuthUserAccountStatus(user.userId, "disabled");

    await assert.rejects(
      () => confirmRegistrationEmailCode({ userId: user.userId, code }),
      UserDisabledError,
    );

    const stored = await findAuthUserById(user.userId);
    assert.equal(stored?.status, "disabled");
    assert.equal(stored?.emailVerificationStatus, "pending");
    assert.equal(await countSessions(user.userId), 0);
    const stillActive = await findActiveEmailConfirmationCode({
      userId: user.userId,
      purpose: PURPOSE,
    });
    assert.equal(stillActive?.status, "active");
  });

  it("does not issue a session when a disabled verified account re-enters confirmation", async () => {
    const user = await insertPending("disabled-verified", "Disabled verified");
    userIds.push(user.userId);
    await markAuthUserEmailVerified(user.userId);
    await updateAuthUserAccountStatus(user.userId, "disabled");

    await assert.rejects(
      () => confirmRegistrationEmailCode({ userId: user.userId, code: "123456" }),
      UserDisabledError,
    );

    assert.equal(await countSessions(user.userId), 0);
    const stored = await findAuthUserById(user.userId);
    assert.equal(stored?.status, "disabled");
    assert.equal(stored?.emailVerificationStatus, "verified");
  });

  it("still rejects an incorrect code for an active account", async () => {
    const user = await insertPending("active-wrong", "Active wrong code");
    userIds.push(user.userId);
    const code = await issuePendingCode(user.userId, user.email);
    const wrongCode = code === "000000" ? "111111" : "000000";

    await assert.rejects(
      () => confirmRegistrationEmailCode({ userId: user.userId, code: wrongCode }),
      (error: unknown) => {
        assert.ok(error instanceof AuthValidationError);
        assert.match(error.message, /incorrect/);
        return true;
      },
    );

    const stored = await findAuthUserById(user.userId);
    assert.equal(stored?.status, "active");
    assert.equal(stored?.emailVerificationStatus, "pending");
    assert.equal(await countSessions(user.userId), 0);
    const stillActive = await findActiveEmailConfirmationCode({
      userId: user.userId,
      purpose: PURPOSE,
    });
    assert.equal(stillActive?.status, "active");
  });

  it("still rejects a missing confirmation code for an active account", async () => {
    const user = await insertPending("active-expired", "Active expired code");
    userIds.push(user.userId);

    await assert.rejects(
      () => confirmRegistrationEmailCode({ userId: user.userId, code: "123456" }),
      (error: unknown) => {
        assert.ok(error instanceof AuthValidationError);
        assert.match(error.message, /expired/);
        return true;
      },
    );

    const stored = await findAuthUserById(user.userId);
    assert.equal(stored?.emailVerificationStatus, "pending");
    assert.equal(await countSessions(user.userId), 0);
  });

  it("does not create or send a confirmation code when a disabled account requests a resend", async () => {
    const user = await insertPending("resend-disabled", "Disabled resend");
    userIds.push(user.userId);
    const originalCode = await issuePendingCode(user.userId, user.email);
    const codesBefore = await countConfirmationCodes(user.userId);
    await updateAuthUserAccountStatus(user.userId, "disabled");

    await assert.rejects(
      () => resendRegistrationConfirmationCode({ userId: user.userId, ipKey: "resend-disabled" }),
      UserDisabledError,
    );

    assert.equal(await countConfirmationCodes(user.userId), codesBefore);
    assert.equal(getLastIssuedConfirmationCodeForTests(user.userId, PURPOSE), originalCode);
    const stillActive = await findActiveEmailConfirmationCode({
      userId: user.userId,
      purpose: PURPOSE,
    });
    assert.equal(stillActive?.status, "active");
    const stored = await findAuthUserById(user.userId);
    assert.equal(stored?.status, "disabled");
    assert.equal(stored?.emailVerificationStatus, "pending");
  });

  it("still sends a confirmation code when an active account requests a resend", async () => {
    const user = await insertPending("resend-active", "Active resend");
    userIds.push(user.userId);

    const status = await resendRegistrationConfirmationCode({
      userId: user.userId,
      ipKey: "resend-active",
    });

    assert.equal(status.emailSent, true);
    assert.equal(status.status, "pending");
    const issued = getLastIssuedConfirmationCodeForTests(user.userId, PURPOSE);
    assert.ok(issued);
    const stored = await findAuthUserById(user.userId);
    assert.equal(stored?.status, "active");
    assert.equal(stored?.emailVerificationStatus, "pending");
    assert.equal(await countSessions(user.userId), 0);
    const activeCode = await findActiveEmailConfirmationCode({
      userId: user.userId,
      purpose: PURPOSE,
    });
    assert.equal(activeCode?.status, "active");
  });

  it("still tells a verified account that the email is already confirmed", async () => {
    const user = await insertPending("resend-verified", "Verified resend");
    userIds.push(user.userId);
    await markAuthUserEmailVerified(user.userId);
    const codesBefore = await countConfirmationCodes(user.userId);

    await assert.rejects(
      () => resendRegistrationConfirmationCode({ userId: user.userId }),
      (error: unknown) => {
        assert.ok(error instanceof AuthValidationError);
        assert.match(error.message, /already confirmed/);
        return true;
      },
    );

    assert.equal(await countConfirmationCodes(user.userId), codesBefore);
  });

  it("does not create or send a login code when a disabled account requests a two-step resend", async () => {
    const user = await insertPending("two-step-disabled", "Disabled two-step resend");
    userIds.push(user.userId);
    await markAuthUserEmailVerified(user.userId);
    await setAuthUserLoginEmailTwoStepEnabled(user.userId, true);
    await createEmailConfirmationCode({
      userId: user.userId,
      email: user.email,
      purpose: "login_email_two_step",
    });
    const originalCode = getLastIssuedConfirmationCodeForTests(user.userId, "login_email_two_step");
    const codesBefore = await countConfirmationCodes(user.userId);
    await updateAuthUserAccountStatus(user.userId, "disabled");

    await assert.rejects(
      () => resendLoginTwoStepCode({ userId: user.userId, ipKey: "two-step-disabled" }),
      UserDisabledError,
    );

    assert.equal(await countConfirmationCodes(user.userId), codesBefore);
    assert.equal(
      getLastIssuedConfirmationCodeForTests(user.userId, "login_email_two_step"),
      originalCode,
    );
    const stillActive = await findActiveEmailConfirmationCode({
      userId: user.userId,
      purpose: "login_email_two_step",
    });
    assert.equal(stillActive?.status, "active");
  });

  it("still sends a login code when an active two-step account requests a resend", async () => {
    const user = await insertPending("two-step-active", "Active two-step resend");
    userIds.push(user.userId);
    await markAuthUserEmailVerified(user.userId);
    await setAuthUserLoginEmailTwoStepEnabled(user.userId, true);

    const status = await resendLoginTwoStepCode({
      userId: user.userId,
      ipKey: "two-step-active",
    });

    assert.equal(status.emailSent, true);
    assert.equal(status.status, "pending");
    assert.ok(getLastIssuedConfirmationCodeForTests(user.userId, "login_email_two_step"));
    const stored = await findAuthUserById(user.userId);
    assert.equal(stored?.status, "active");
    assert.equal(stored?.emailVerificationStatus, "verified");
    assert.equal(await countSessions(user.userId), 0);
  });

  it("still rejects a two-step resend when the account is verified but two-step is off", async () => {
    const user = await insertPending("two-step-off", "Verified without two-step");
    userIds.push(user.userId);
    await markAuthUserEmailVerified(user.userId);
    const codesBefore = await countConfirmationCodes(user.userId);

    await assert.rejects(
      () => resendLoginTwoStepCode({ userId: user.userId }),
      (error: unknown) => {
        assert.ok(error instanceof AuthValidationError);
        assert.match(error.message, /Login verification session is invalid/);
        return true;
      },
    );

    assert.equal(await countConfirmationCodes(user.userId), codesBefore);
  });

  it("returns the generic reset response and sends no email for a disabled account", async () => {
    const user = await insertPending("reset-disabled", "Disabled password reset");
    userIds.push(user.userId);
    await markAuthUserEmailVerified(user.userId);
    await updateAuthUserAccountStatus(user.userId, "disabled");
    MockEmailProvider.clearForTests();

    const disabled = await requestPasswordReset(user.email);
    const unknown = await requestPasswordReset(`${EMAIL_PREFIX}-missing-reset@confirmation-guard.test`);
    const invalid = await requestPasswordReset("not-an-email");
    const operator = await requestPasswordResetForUserId(user.userId);
    await drainEmailQueueForTests();

    const generic = {
      requested: true as const,
      message: "If an account exists, a reset email has been sent.",
    };
    assert.deepEqual(disabled, generic);
    assert.deepEqual(unknown, generic);
    assert.deepEqual(invalid, generic);
    assert.deepEqual(operator, { sent: false, reason: "disabled" });
    assert.equal(await countResetTokens(user.userId), 0);
    assert.equal(await countPasswordResetAudits(user.email), 0);
    assert.equal(resetEmailsFor(user.email).length, 0);
    assert.equal(await countSessions(user.userId), 0);
  });

  it("still sends a reset email for an active account and does not issue a session", async () => {
    const user = await insertPending("reset-active", "Active password reset");
    userIds.push(user.userId);
    await markAuthUserEmailVerified(user.userId);
    const passwordHashBefore = user.passwordHash;
    MockEmailProvider.clearForTests();

    const active = await requestPasswordReset(user.email.toUpperCase());
    const unknown = await requestPasswordReset(`${EMAIL_PREFIX}-missing-active@confirmation-guard.test`);
    await drainEmailQueueForTests();

    assert.deepEqual(active, unknown);
    assert.equal(active.message, "If an account exists, a reset email has been sent.");
    assert.equal(await countResetTokens(user.userId), 1);
    assert.equal(await countPasswordResetAudits(user.email), 1);
    const resetEmail = resetEmailsFor(user.email);
    assert.equal(resetEmail.length, 1);

    const token = tokenFromResetEmail(resetEmail[0]?.text ?? "");
    assert.deepEqual(await validatePasswordResetToken(token), { valid: true });

    const reset = await resetPasswordWithToken(token, "Recovered123!");
    await drainEmailQueueForTests();
    assert.equal(reset.userId, user.userId);
    assert.equal("passwordHash" in reset, false);
    assert.equal(await countSessions(user.userId), 0);

    const stored = await findAuthUserById(user.userId);
    assert.notEqual(stored?.passwordHash, passwordHashBefore);
    assert.equal(await verifyPassword("Recovered123!", stored?.passwordHash ?? ""), true);
    assert.equal(await verifyPassword("Password123!", stored?.passwordHash ?? ""), false);
    assert.deepEqual(await validatePasswordResetToken(token), { valid: false });

    await assert.rejects(
      () => loginAuthUser({ email: user.email, password: "Password123!" }),
      (error: unknown) => error instanceof InvalidCredentialsError,
    );
    const loggedIn = await loginAuthUser({ email: user.email, password: "Recovered123!" });
    assert.equal(loggedIn.kind, "session");
    assert.equal(await countSessions(user.userId), 1);
  });

  it("does not let a previously issued reset token change a disabled account password", async () => {
    const user = await insertPending("reset-token", "Disabled existing reset token");
    userIds.push(user.userId);
    await markAuthUserEmailVerified(user.userId);
    const issued = await createEmailVerificationToken({
      userId: user.userId,
      purpose: "password_reset",
    });
    const passwordHashBefore = user.passwordHash;
    await updateAuthUserAccountStatus(user.userId, "disabled");
    MockEmailProvider.clearForTests();

    assert.deepEqual(await validatePasswordResetToken(issued.token), { valid: false });
    await assert.rejects(
      () => resetPasswordWithToken(issued.token, "Recovered123!"),
      UserDisabledError,
    );
    await drainEmailQueueForTests();

    const stored = await findAuthUserById(user.userId);
    assert.equal(stored?.status, "disabled");
    assert.equal(stored?.passwordHash, passwordHashBefore);
    assert.equal(await verifyPassword("Password123!", stored?.passwordHash ?? ""), true);
    assert.equal(await countSessions(user.userId), 0);
    assert.equal(resetEmailsFor(user.email).length, 0);
    const stillValid = await findValidEmailVerificationToken({
      token: issued.token,
      purpose: "password_reset",
    });
    assert.equal(stillValid?.userId, user.userId);
    await assert.rejects(
      () => loginAuthUser({ email: user.email, password: "Recovered123!" }),
      UserDisabledError,
    );
    await assert.rejects(
      () => loginAuthUser({ email: user.email, password: "Password123!" }),
      UserDisabledError,
    );
  });

  it("still rejects login and refresh for a disabled account and allows them while active", async () => {
    const user = await insertPending("login", "Login restriction");
    userIds.push(user.userId);

    const pendingLogin = await loginAuthUser({
      email: user.email,
      password: "Password123!",
    });
    assert.equal(pendingLogin.kind, "email_confirmation_required");

    await markAuthUserEmailVerified(user.userId);
    const activeLogin = await loginAuthUser({
      email: user.email,
      password: "Password123!",
    });
    assert.equal(activeLogin.kind, "session");
    if (activeLogin.kind !== "session") {
      return;
    }

    const refreshed = await refreshAuthSession(activeLogin.tokens.refreshToken);
    assert.equal(refreshed.kind, "session");

    await updateAuthUserAccountStatus(user.userId, "disabled");

    await assert.rejects(
      () => loginAuthUser({ email: user.email, password: "Password123!" }),
      UserDisabledError,
    );
    await assert.rejects(
      () => refreshAuthSession(activeLogin.tokens.refreshToken),
      InvalidRefreshTokenError,
    );
  });
});

describe("HU-SEC-02A active confirmation completion", {
  skip: mongoReady ? false : "owned hu_test_ MongoDB is not selected",
}, () => {
  const userIds: string[] = [];
  let replicaSet = false;
  let previousNodeTestEnv: string | undefined;

  before(async () => {
    previousNodeTestEnv = process.env.NODE_TEST_ENV;
    await connectMongoClient();
    const uri = process.env.MONGODB_URI;
    assert.ok(uri);
    const probe = new MongoClient(uri);
    await probe.connect();
    try {
      const hello = await probe.db().command({ hello: 1 });
      replicaSet = Boolean((hello as { setName?: string }).setName);
    } finally {
      await probe.close();
    }
    if (!replicaSet) {
      return;
    }
    delete process.env.NODE_TEST_ENV;
    await ensureMongoIndexes();
  });

  after(async () => {
    if (replicaSet) {
      await deleteMembersByMemberIdPrefix(MEMBER_PREFIX);
      await deleteAuthUsersByEmailPrefix(`${EMAIL_PREFIX}-`);
      for (const userId of userIds) {
        await deleteMemberProfileByUserId(userId);
        await deleteAuthSessionsByUserId(userId);
        await deleteEmailConfirmationCodesByUserIds([userId]);
      }
    }
    if (previousNodeTestEnv === undefined) {
      delete process.env.NODE_TEST_ENV;
    } else {
      process.env.NODE_TEST_ENV = previousNodeTestEnv;
    }
    await disconnectMongoClient();
  });

  it("lets an active account complete confirmation and receive a session", async (t) => {
    if (!replicaSet) {
      t.skip("Member registration confirmation requires a MongoDB replica set.");
      return;
    }

    const user = await insertPending("confirm", "Active confirmation");
    userIds.push(user.userId);
    await createMemberProfileForUser({
      userId: user.userId,
      displayName: "Active confirmation",
    });
    const code = await issuePendingCode(user.userId, user.email);

    const session = await confirmRegistrationEmailCode({
      userId: user.userId,
      code,
    });

    assert.equal(session.kind, "session");
    assert.ok(session.tokens.accessToken);
    assert.ok(session.tokens.refreshToken);

    const verified = await findAuthUserById(user.userId);
    assert.equal(verified?.emailVerificationStatus, "verified");
    assert.equal(verified?.status, "active");
    assert.ok(await findMemberByIdentityId(user.userId));
    assert.equal(await countSessions(user.userId), 1);
  });
});
