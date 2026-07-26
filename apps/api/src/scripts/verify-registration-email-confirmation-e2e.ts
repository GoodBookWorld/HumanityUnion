/**
 * TASK-087 — Registration email confirmation verification.
 * Run: npm run verify:registration-email-confirmation
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(scriptDir, "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { MONGO_COLLECTIONS } from "../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../infrastructure/mongodb/mongo-config.js";
import { getMongoCollection } from "../infrastructure/mongodb/mongo-database.js";
import { bootstrapAuthPersistence } from "../infrastructure/mongodb/bootstrap-auth-persistence.js";
import {
  confirmRegistrationEmailCode,
  resendRegistrationConfirmationCode,
} from "../modules/auth/auth-email-confirmation.service.js";
import { requireVerifiedEmailForMutationsMiddleware } from "../modules/auth/auth-workspace-gate.js";
import {
  deleteAuthUsersByEmailPrefix,
  findRawAuthUserByEmail,
} from "../modules/auth/auth-user.repository.js";
import { deleteAuthSessionsByUserIds } from "../modules/auth/auth-session.repository.js";
import {
  loginAuthUser,
  refreshAuthSession,
  registerAuthUser,
  isEmailConfirmationRequiredResponse,
} from "../modules/auth/auth.service.js";
import {
  clearEmailConfirmationCodesForTests,
  deleteEmailConfirmationCodesByUserIds,
  findActiveEmailConfirmationCode,
  getLastIssuedConfirmationCodeForTests,
  hashEmailConfirmationCode,
} from "../modules/email/email-confirmation-code.repository.js";
import { resolveEmailConfirmationConfig } from "../modules/email/email-confirmation.config.js";
import { MockEmailProvider } from "../modules/email/providers/mock.provider.js";
import { clearEmailQueueForTests } from "../modules/email/email.queue.js";
import { drainEmailQueueForTests } from "../modules/email/email.service.js";
import { runVerificationScript } from "./verification-script-lifecycle.js";
import type { Request, Response } from "express";

const TEST_EMAIL_PREFIX = `reg-email-confirm-${Date.now()}`;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function cleanupTestRecords(): Promise<void> {
  const users = await getMongoCollection<{ userId: string; email: string }>(
    MONGO_COLLECTIONS.authUsers,
  )
    .find({ email: { $regex: `^${TEST_EMAIL_PREFIX}` } })
    .toArray();

  const userIds = users.map((user) => user.userId);
  await deleteEmailConfirmationCodesByUserIds(userIds);
  await deleteAuthSessionsByUserIds(userIds);
  await deleteAuthUsersByEmailPrefix(TEST_EMAIL_PREFIX);
  clearEmailConfirmationCodesForTests();
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

async function assertRejects(fn: () => Promise<unknown>, pattern: RegExp): Promise<void> {
  try {
    await fn();
    throw new Error(`Expected rejection matching ${pattern}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("Expected rejection")) {
      throw error;
    }

    assert(pattern.test(message), `Expected ${pattern}, got "${message}"`);
  }
}

async function verifyRegistrationCreatesUnconfirmedAccount(): Promise<string> {
  process.env.EMAIL_PROVIDER = "mock";
  MockEmailProvider.clearForTests();
  clearEmailQueueForTests();

  const email = `${TEST_EMAIL_PREFIX}@example.com`;
  const registered = await registerAuthUser({
    email,
    displayName: "Confirm Flow User",
    password: "verify-password-123",
  });

  assert(
    isEmailConfirmationRequiredResponse(registered),
    "Registration must require confirmation.",
  );
  assert(registered.confirmation.emailConfirmationRequired === true, "Confirmation flag required.");
  assert(registered.confirmation.maskedEmail.includes("@"), "Masked email must be returned.");

  const stored = await findRawAuthUserByEmail(email);
  assert(stored !== null, "User must be stored.");
  assert(stored.emailVerificationStatus === "pending", "New account must be unconfirmed.");
  assert(!stored.emailVerifiedAt, "emailVerifiedAt must be null for new accounts.");

  await drainEmailQueueForTests();
  assert(
    MockEmailProvider.sentMessages.some(
      (message) => message.template === "registration_confirmation_code",
    ),
    "Confirmation email must be queued.",
  );

  const code = getLastIssuedConfirmationCodeForTests(stored.userId);
  assert(code !== null && /^\d{6}$/.test(code), "Confirmation code must be six digits.");

  const activeCode = await findActiveEmailConfirmationCode({
    userId: stored.userId,
    purpose: "registration_email_confirmation",
  });
  assert(activeCode !== null, "Active confirmation code record must exist.");
  assert(
    activeCode.codeHash === hashEmailConfirmationCode(stored.userId, code),
    "Code must be hashed.",
  );
  assert(!JSON.stringify(activeCode).includes(code), "Plain code must not be stored.");

  return stored.userId;
}

async function verifyUnconfirmedWorkspaceBlocked(
  userId: string,
  memberId: string,
  email: string,
): Promise<void> {
  const req = {
    method: "POST",
    auth: { id: userId, memberId, email },
  } as Request;

  const res = createMockResponse();
  let nextCalled = false;

  await requireVerifiedEmailForMutationsMiddleware(req, res as unknown as Response, () => {
    nextCalled = true;
  });

  assert(!nextCalled, "Unconfirmed account must not pass workspace write gate.");
  assert(res.statusCode === 403, "Workspace gate must return 403.");
}

async function verifyConfirmResendAndLimits(userId: string, email: string): Promise<void> {
  process.env.EMAIL_CONFIRMATION_RESEND_COOLDOWN_SECONDS = "60";

  const validCode = getLastIssuedConfirmationCodeForTests(userId);
  assert(validCode !== null, "Valid code required.");

  const config = resolveEmailConfirmationConfig();

  for (let attempt = 1; attempt < config.maxAttempts; attempt += 1) {
    await assertRejects(
      () => confirmRegistrationEmailCode({ userId, code: "000000" }),
      /incorrect/i,
    );
  }

  await assertRejects(
    () => confirmRegistrationEmailCode({ userId, code: "000000" }),
    /Too many unsuccessful attempts/i,
  );

  await assertRejects(
    () => resendRegistrationConfirmationCode({ userId }),
    /Please wait before requesting another code/i,
  );

  process.env.EMAIL_CONFIRMATION_RESEND_COOLDOWN_SECONDS = "1";
  await new Promise((resolve) => {
    setTimeout(resolve, 1100);
  });

  const beforeResendCode = getLastIssuedConfirmationCodeForTests(userId);
  const status = await resendRegistrationConfirmationCode({ userId, ipKey: "127.0.0.1" });
  assert(status.status === "pending", "Resend must return pending status.");

  const afterResendCode = getLastIssuedConfirmationCodeForTests(userId);
  assert(afterResendCode !== beforeResendCode, "Resend must invalidate previous code.");

  await assertRejects(
    () => confirmRegistrationEmailCode({ userId, code: beforeResendCode ?? "" }),
    /incorrect|expired/i,
  );

  const confirmed = await confirmRegistrationEmailCode({
    userId,
    code: afterResendCode ?? "",
  });

  assert(confirmed.user.emailVerificationStatus === "verified", "Email must be confirmed.");
  assert(confirmed.tokens.accessToken.length > 20, "Session must be issued after confirmation.");

  await drainEmailQueueForTests();
  const welcomeCount = MockEmailProvider.sentMessages.filter(
    (message) => message.template === "registration_welcome",
  ).length;
  assert(welcomeCount === 1, "Welcome email must be sent once.");

  await confirmRegistrationEmailCode({ userId, code: afterResendCode ?? "" });
  const welcomeCountAfterReuse = MockEmailProvider.sentMessages.filter(
    (message) => message.template === "registration_welcome",
  ).length;
  assert(welcomeCountAfterReuse === 1, "Duplicate confirm must not resend welcome email.");

  await assertRejects(() => resendRegistrationConfirmationCode({ userId }), /already confirmed/i);

  const loginResult = await loginAuthUser({ email, password: "verify-password-123" });
  assert(!isEmailConfirmationRequiredResponse(loginResult), "Verified login must return session.");
  assert(loginResult.kind === "session", "Verified login must include session.");

  await refreshAuthSession(loginResult.tokens.refreshToken);
}

async function verifyRefreshBlockedBeforeConfirmation(): Promise<void> {
  const email = `${TEST_EMAIL_PREFIX}-refresh@example.com`;
  await registerAuthUser({
    email,
    displayName: "Refresh Block User",
    password: "verify-password-123",
  });

  const pendingLogin = await loginAuthUser({ email, password: "verify-password-123" });
  assert(isEmailConfirmationRequiredResponse(pendingLogin), "Unconfirmed login must stay pending.");
}

async function verifyNoUserIdSpoofing(): Promise<void> {
  const email = `${TEST_EMAIL_PREFIX}-spoof@example.com`;
  const registered = await registerAuthUser({
    email,
    displayName: "Spoof User",
    password: "verify-password-123",
  });
  assert(
    isEmailConfirmationRequiredResponse(registered),
    "Registration must require confirmation.",
  );

  const stored = await findRawAuthUserByEmail(email);
  assert(stored !== null, "Registered user must exist.");

  const code = getLastIssuedConfirmationCodeForTests(stored.userId);
  assert(code !== null, "Confirmation code must exist.");

  await assertRejects(
    () => confirmRegistrationEmailCode({ userId: "another-user-id", code }),
    /invalid|incorrect|expired/i,
  );
}

async function runPass(pass: number): Promise<void> {
  console.log(`\n=== verify:registration-email-confirmation pass ${pass} ===`);
  await cleanupTestRecords();

  const userId = await verifyRegistrationCreatesUnconfirmedAccount();
  const stored = await findRawAuthUserByEmail(`${TEST_EMAIL_PREFIX}@example.com`);
  assert(stored !== null, "Registered user must exist.");

  await verifyUnconfirmedWorkspaceBlocked(userId, stored.memberId, stored.email);
  await verifyConfirmResendAndLimits(userId, stored.email);
  await verifyRefreshBlockedBeforeConfirmation();
  await verifyNoUserIdSpoofing();

  await cleanupTestRecords();
  console.log(`Pass ${pass} complete.`);
}

async function main(): Promise<void> {
  assert(isMongoConfigured(), "MONGODB_URI must be configured.");
  process.env.EMAIL_PROVIDER = "mock";

  await bootstrapAuthPersistence();

  for (let pass = 1; pass <= 3; pass += 1) {
    await runPass(pass);
  }

  console.log("\nverify:registration-email-confirmation PASSED (3 consecutive passes).");
}

void runVerificationScript(main);
