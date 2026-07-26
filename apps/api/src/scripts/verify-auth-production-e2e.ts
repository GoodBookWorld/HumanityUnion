/**
 * TASK-063 — Authentication production hardening verification.
 * Run: npm run verify:auth-production
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import type { Request, Response } from "express";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDir, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { MONGO_COLLECTIONS } from "../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../infrastructure/mongodb/mongo-config.js";
import { getMongoCollection } from "../infrastructure/mongodb/mongo-database.js";
import { bootstrapAuthPersistence } from "../infrastructure/mongodb/bootstrap-auth-persistence.js";
import {
  changePasswordForUser,
  confirmEmailChangeWithToken,
  requestEmailChange,
  requestPasswordReset,
  resetPasswordWithToken,
  verifyRegistrationEmail,
  resendRegistrationVerification,
} from "../modules/auth/auth-email.service.js";
import { verifyPassword } from "../modules/auth/auth-password.js";
import {
  clearAuthRateLimitBucketsForTests,
  createAuthRateLimiter,
} from "../modules/auth/auth-rate-limit.js";
import { toAuthUserPublic } from "../modules/auth/auth-user.projection.js";
import {
  deleteAuthUsersByEmailPrefix,
  findRawAuthUserByEmail,
} from "../modules/auth/auth-user.repository.js";
import {
  deleteAuthSessionsByUserIds,
  findAuthSessionById,
  refreshTokenMatchesSession,
} from "../modules/auth/auth-session.repository.js";
import { requireVerifiedEmailForMutationsMiddleware } from "../modules/auth/auth-workspace-gate.js";
import {
  loginAuthUser,
  refreshAuthSession,
  registerAuthUser,
  isEmailConfirmationRequiredResponse,
} from "../modules/auth/auth.service.js";
import type { AuthLoginResult } from "../modules/auth/auth-session.issue.js";
import { confirmRegistrationEmailCode } from "../modules/auth/auth-email-confirmation.service.js";
import { getLastIssuedConfirmationCodeForTests } from "../modules/email/email-confirmation-code.repository.js";
import { verifyRefreshToken } from "../modules/auth/auth-tokens.js";
import {
  createEmailVerificationToken,
  deleteEmailVerificationTokensByUserIds,
} from "../modules/email/email.tokens.js";
import { MockEmailProvider } from "../modules/email/providers/mock.provider.js";
import { drainEmailQueueForTests } from "../modules/email/email.service.js";
import { clearEmailQueueForTests } from "../modules/email/email.queue.js";
import { runVerificationScript } from "./verification-script-lifecycle.js";

const TEST_EMAIL_PREFIX = `auth-prod-${Date.now()}`;

const FORBIDDEN_PUBLIC_FIELDS = [
  "passwordHash",
  "refreshTokenHash",
  "sessionId",
  "refreshToken",
  "token",
  "tokenHash",
] as const;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function cleanupTestRecords(): Promise<void> {
  const users = await getMongoCollection<{ userId: string }>(MONGO_COLLECTIONS.authUsers)
    .find({ email: { $regex: `^${TEST_EMAIL_PREFIX}` } })
    .toArray();

  const userIds = users.map((user) => user.userId);
  await deleteEmailVerificationTokensByUserIds(userIds);
  await deleteAuthSessionsByUserIds(userIds);
  await deleteAuthUsersByEmailPrefix(TEST_EMAIL_PREFIX);
}

function createMockResponse() {
  return {
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
}

async function registerAndConfirmUser(input: {
  email: string;
  displayName: string;
  password: string;
}): Promise<AuthLoginResult> {
  const registered = await registerAuthUser(input);
  assert(
    isEmailConfirmationRequiredResponse(registered),
    "Registration must require confirmation.",
  );

  const stored = await findRawAuthUserByEmail(input.email);
  assert(stored !== null, "Registered user must exist.");

  const code = getLastIssuedConfirmationCodeForTests(stored.userId);
  assert(code !== null, "Confirmation code must be issued.");

  return confirmRegistrationEmailCode({
    userId: stored.userId,
    code,
  });
}

async function verifyEmailVerificationFlow(): Promise<void> {
  process.env.EMAIL_PROVIDER = "mock";
  MockEmailProvider.clearForTests();
  clearEmailQueueForTests();

  const email = `${TEST_EMAIL_PREFIX}-verify@example.com`;
  const registered = await registerAuthUser({
    email,
    displayName: "Verify Flow User",
    password: "verify-password-123",
  });

  assert(
    isEmailConfirmationRequiredResponse(registered),
    "Registration must require confirmation.",
  );

  const stored = await findRawAuthUserByEmail(email);
  assert(stored !== null, "Registered user must exist.");
  assert(
    stored.emailVerificationStatus === "pending",
    "Registration must start pending confirmation.",
  );

  await drainEmailQueueForTests();
  assert(
    MockEmailProvider.sentMessages.some(
      (message) => message.template === "registration_confirmation_code",
    ),
    "Registration must send confirmation code email.",
  );

  const code = getLastIssuedConfirmationCodeForTests(stored.userId);
  assert(code !== null, "Confirmation code must be issued.");
  const verified = await confirmRegistrationEmailCode({ userId: stored.userId, code });
  assert(
    verified.user.emailVerificationStatus === "verified",
    "Confirmation code must verify email.",
  );

  await resendRegistrationVerification(stored.userId).catch((error) => {
    assert(
      error instanceof Error && error.message.includes("already verified"),
      "Resend must reject already verified accounts.",
    );
  });

  const issued = await createEmailVerificationToken({
    userId: stored.userId,
    purpose: "registration",
  });
  await verifyRegistrationEmail(issued.token);
  await verifyRegistrationEmail(issued.token).catch((error) => {
    assert(
      error instanceof Error && error.message.includes("Invalid or expired"),
      "Used verification token must be rejected.",
    );
  });
}

async function verifyWorkspaceWriteGate(): Promise<void> {
  process.env.AUTH_REQUIRE_EMAIL_VERIFICATION = "true";

  const email = `${TEST_EMAIL_PREFIX}-gate@example.com`;
  const registered = await registerAuthUser({
    email,
    displayName: "Gate User",
    password: "verify-password-123",
  });

  assert(
    isEmailConfirmationRequiredResponse(registered),
    "Registration must require confirmation.",
  );

  const stored = await findRawAuthUserByEmail(email);
  assert(stored !== null, "Registered user must exist.");

  const req = {
    method: "POST",
    auth: {
      id: stored.userId,
      memberId: stored.memberId,
      email: stored.email,
    },
  } as Request;

  const res = createMockResponse();
  let nextCalled = false;

  await requireVerifiedEmailForMutationsMiddleware(req, res as unknown as Response, () => {
    nextCalled = true;
  });

  assert(!nextCalled, "Unverified user must be blocked from workspace writes.");
  assert(res.statusCode === 403, "Workspace gate must return 403.");
  assert(
    JSON.stringify(res.body).includes("confirm your email"),
    "Workspace gate must include confirmation message.",
  );

  const code = getLastIssuedConfirmationCodeForTests(stored.userId);
  assert(code !== null, "Confirmation code must be issued.");
  await confirmRegistrationEmailCode({ userId: stored.userId, code });

  nextCalled = false;
  await requireVerifiedEmailForMutationsMiddleware(req, res as unknown as Response, () => {
    nextCalled = true;
  });

  assert(nextCalled, "Verified user must pass workspace write gate.");
}

async function verifyPasswordResetFlow(): Promise<void> {
  const email = `${TEST_EMAIL_PREFIX}-reset@example.com`;
  const registered = await registerAndConfirmUser({
    email,
    displayName: "Reset User",
    password: "verify-password-123",
  });

  const missing = await requestPasswordReset("not-an-email");
  assert(
    missing.message.includes("If an account exists"),
    "Password reset must return generic success for malformed email.",
  );

  const unknown = await requestPasswordReset(`${TEST_EMAIL_PREFIX}-missing@example.com`);
  assert(
    unknown.message.includes("If an account exists"),
    "Password reset must not enumerate missing accounts.",
  );

  const requested = await requestPasswordReset(email);
  assert(
    requested.message.includes("If an account exists"),
    "Password reset must return generic success.",
  );

  const issued = await createEmailVerificationToken({
    userId: registered.user.userId,
    purpose: "password_reset",
  });

  const oldRefresh = registered.tokens.refreshToken;
  const oldPayload = verifyRefreshToken(oldRefresh);
  const oldSession = await findAuthSessionById(oldPayload.sessionId);
  assert(oldSession !== null, "Session must exist before password reset.");

  await resetPasswordWithToken(issued.token, "new-password-456");
  const stored = await findRawAuthUserByEmail(email);
  assert(stored !== null, "User must remain after password reset.");
  assert(
    await verifyPassword("new-password-456", stored.passwordHash),
    "Password hash must update.",
  );

  const sessionAfterReset = await findAuthSessionById(oldPayload.sessionId);
  assert(
    Boolean(sessionAfterReset?.revokedAt),
    "Password reset must revoke existing refresh sessions.",
  );

  await refreshAuthSession(oldRefresh).catch((error) => {
    assert(
      error instanceof Error && error.message.includes("Invalid or expired refresh token"),
      "Revoked session must not refresh.",
    );
  });

  const loggedIn = await loginAuthUser({ email, password: "new-password-456" });
  assert(!isEmailConfirmationRequiredResponse(loggedIn), "Verified login must return session.");
  assert(
    "tokens" in loggedIn && loggedIn.tokens.accessToken.length > 20,
    "User must login with new password.",
  );
}

async function verifyPasswordChangeFlow(): Promise<void> {
  const email = `${TEST_EMAIL_PREFIX}-change@example.com`;
  const registered = await registerAndConfirmUser({
    email,
    displayName: "Change Password User",
    password: "verify-password-123",
  });

  const refreshPayload = verifyRefreshToken(registered.tokens.refreshToken);

  await changePasswordForUser({
    userId: registered.user.userId,
    currentPassword: "wrong-password",
    newPassword: "another-password-123",
  }).catch((error) => {
    assert(
      error instanceof Error && error.message.includes("Invalid email or password"),
      "Bad current password must be rejected generically.",
    );
  });

  await changePasswordForUser({
    userId: registered.user.userId,
    currentPassword: "verify-password-123",
    newPassword: "changed-password-123",
    currentSessionId: refreshPayload.sessionId,
  });

  const stored = await findRawAuthUserByEmail(email);
  assert(stored !== null, "User must remain after password change.");
  assert(
    await verifyPassword("changed-password-123", stored.passwordHash),
    "Password must change.",
  );

  const currentSession = await findAuthSessionById(refreshPayload.sessionId);
  assert(!currentSession?.revokedAt, "Current session should remain active after password change.");
}

async function verifyEmailChangeFlow(): Promise<void> {
  const email = `${TEST_EMAIL_PREFIX}-email-change@example.com`;
  const registered = await registerAndConfirmUser({
    email,
    displayName: "Email Change User",
    password: "verify-password-123",
  });

  const newEmail = `${TEST_EMAIL_PREFIX}-changed@example.com`;
  await requestEmailChange(registered.user.userId, newEmail);

  await requestEmailChange(registered.user.userId, email).catch((error) => {
    assert(
      error instanceof Error && error.message.includes("already associated"),
      "Duplicate current email must be rejected.",
    );
  });

  const duplicateUser = await registerAuthUser({
    email: `${TEST_EMAIL_PREFIX}-duplicate@example.com`,
    displayName: "Duplicate Target",
    password: "verify-password-123",
  });
  assert(
    isEmailConfirmationRequiredResponse(duplicateUser),
    "Duplicate registration must require confirmation.",
  );
  const duplicateStored = await findRawAuthUserByEmail(
    `${TEST_EMAIL_PREFIX}-duplicate@example.com`,
  );
  assert(duplicateStored !== null, "Duplicate user must exist.");

  await requestEmailChange(registered.user.userId, duplicateStored.email).catch((error) => {
    assert(
      error instanceof Error && error.message.includes("already in use"),
      "Duplicate target email must be rejected.",
    );
  });

  const issued = await createEmailVerificationToken({
    userId: registered.user.userId,
    purpose: "email_change",
    metadata: { pendingEmail: newEmail },
  });

  const updated = await confirmEmailChangeWithToken(issued.token);
  assert(updated.email === newEmail, "Email change confirm must update email.");
  assert(updated.emailVerificationStatus === "verified", "Confirmed email must be verified.");
}

async function verifySessionRotationAndPublicSafety(): Promise<void> {
  const email = `${TEST_EMAIL_PREFIX}-session@example.com`;
  const registered = await registerAndConfirmUser({
    email,
    displayName: "Session User",
    password: "verify-password-123",
  });

  const payload = verifyRefreshToken(registered.tokens.refreshToken);
  const before = await findAuthSessionById(payload.sessionId);
  assert(before !== null, "Session must exist.");

  const refreshed = await refreshAuthSession(registered.tokens.refreshToken);
  assert(
    refreshed.tokens.refreshToken !== registered.tokens.refreshToken,
    "Refresh must rotate token.",
  );

  const after = await findAuthSessionById(payload.sessionId);
  assert(Boolean(after?.lastUsedAt), "Refresh must update lastUsedAt.");
  assert(
    refreshTokenMatchesSession(refreshed.tokens.refreshToken, after!),
    "Rotated refresh token hash must be stored.",
  );

  const publicUser = toAuthUserPublic((await findRawAuthUserByEmail(email))!);
  for (const field of FORBIDDEN_PUBLIC_FIELDS) {
    assert(!(field in publicUser), `Public projection must not expose ${field}.`);
  }
}

function verifyRateLimitFoundation(): void {
  clearAuthRateLimitBucketsForTests();
  process.env.AUTH_RATE_LIMIT_WINDOW_MS = "60000";
  process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS = "2";

  const limiter = createAuthRateLimiter("verify-auth-production");
  const req = {
    method: "POST",
    headers: {},
    socket: { remoteAddress: "127.0.0.1" },
  } as Request;

  let blocked = false;

  limiter(req, createMockResponse() as unknown as Response, () => undefined);
  limiter(req, createMockResponse() as unknown as Response, () => undefined);
  limiter(req, createMockResponse() as unknown as Response, () => {
    blocked = true;
  });

  assert(!blocked, "Third attempt within window must be blocked by rate limiter.");

  const res = createMockResponse();
  limiter(req, res as unknown as Response, () => undefined);
  assert(res.statusCode === 429, "Rate limit must return 429.");
  assert(
    JSON.stringify(res.body).includes("Too many attempts"),
    "Rate limit must return calm error message.",
  );
}

async function runPass(pass: number): Promise<void> {
  console.log(`\n=== verify:auth-production pass ${pass} ===`);
  clearAuthRateLimitBucketsForTests();
  process.env.EMAIL_PROVIDER = "mock";
  process.env.AUTH_REQUIRE_EMAIL_VERIFICATION = "true";

  await verifyEmailVerificationFlow();
  console.log("OK: email verification flow");

  await verifyWorkspaceWriteGate();
  console.log("OK: workspace write gate");

  await verifyPasswordResetFlow();
  console.log("OK: password reset flow");

  await verifyPasswordChangeFlow();
  console.log("OK: password change flow");

  await verifyEmailChangeFlow();
  console.log("OK: email change flow");

  await verifySessionRotationAndPublicSafety();
  console.log("OK: session rotation + public safety");

  verifyRateLimitFoundation();
  console.log("OK: rate limiting foundation");

  await cleanupTestRecords();
  console.log(`Pass ${pass} complete.`);
}

async function main(): Promise<void> {
  assert(isMongoConfigured(), "MONGODB_URI must be configured for verify:auth-production.");
  await bootstrapAuthPersistence();

  for (let pass = 1; pass <= 3; pass += 1) {
    await runPass(pass);
  }

  console.log("\nverify:auth-production PASSED (3 consecutive passes).");
}

void runVerificationScript(main);
