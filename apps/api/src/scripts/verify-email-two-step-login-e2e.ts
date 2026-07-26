/**
 * TASK-088 — Optional email two-step login verification.
 * Run: npm run verify:email-two-step-login
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
  confirmDisableLoginTwoStep,
  confirmEnableLoginTwoStep,
  resendLoginTwoStepSettingCode,
  startDisableLoginTwoStep,
  startEnableLoginTwoStep,
} from "../modules/auth/auth-login-two-step-setting.service.js";
import {
  confirmLoginTwoStepCode,
  resendLoginTwoStepCode,
} from "../modules/auth/auth-login-two-step.service.js";
import {
  deleteAuthUsersByEmailPrefix,
  findRawAuthUserByEmail,
} from "../modules/auth/auth-user.repository.js";
import { deleteAuthSessionsByUserIds } from "../modules/auth/auth-session.repository.js";
import {
  isLoginTwoStepRequiredResponse,
  loginAuthUser,
  logoutAuthSession,
  refreshAuthSession,
  registerAndConfirmAuthUser,
  registerAuthUser,
} from "../modules/auth/auth.service.js";
import {
  clearEmailConfirmationCodesForTests,
  clearAllAuthCodeSendLogsForTests,
  deleteEmailConfirmationCodesByUserIds,
  findActiveEmailConfirmationCode,
  getLastIssuedConfirmationCodeForTests,
  hashEmailConfirmationCode,
} from "../modules/email/email-confirmation-code.repository.js";
import { resolveLoginEmailTwoStepConfig } from "../modules/email/login-email-two-step.config.js";
import { MockEmailProvider } from "../modules/email/providers/mock.provider.js";
import { clearEmailQueueForTests } from "../modules/email/email.queue.js";
import { drainEmailQueueForTests } from "../modules/email/email.service.js";
import { runVerificationScript } from "./verification-script-lifecycle.js";

const TEST_EMAIL_PREFIX = `email-two-step-${Date.now()}`;
const PASSWORD = "verify-password-123";

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
  MockEmailProvider.clearForTests();
  clearEmailQueueForTests();
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

async function createConfirmedUser(suffix: string): Promise<{
  userId: string;
  email: string;
  memberId: string;
}> {
  const email = `${TEST_EMAIL_PREFIX}-${suffix}@example.com`;
  const session = await registerAndConfirmAuthUser({
    email,
    displayName: `Two Step ${suffix}`,
    password: PASSWORD,
  });

  assert(session.kind === "session", "Confirmed registration must return session.");

  const stored = await findRawAuthUserByEmail(email);
  assert(stored !== null, "Confirmed user must exist.");
  assert(stored.emailVerificationStatus === "verified", "User must be email confirmed.");

  return {
    userId: stored.userId,
    email,
    memberId: stored.memberId,
  };
}

async function enableTwoStepForUser(userId: string, password: string): Promise<void> {
  await startEnableLoginTwoStep({ userId, currentPassword: password });
  const code = getLastIssuedConfirmationCodeForTests(userId, "login_two_step_enable");
  assert(code !== null && /^\d{6}$/.test(code), "Enable code must be six digits.");
  const updated = await confirmEnableLoginTwoStep({ userId, code });
  assert(updated.loginEmailTwoStepEnabled === true, "Two-Step Login must be enabled.");
}

async function expireActiveLoginCode(userId: string): Promise<void> {
  await getMongoCollection(MONGO_COLLECTIONS.emailConfirmationCodes).updateOne(
    {
      userId,
      purpose: "login_email_two_step",
      status: "active",
    },
    {
      $set: {
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      },
    },
  );
}

async function verifyUnconfirmedCannotEnable(): Promise<void> {
  const email = `${TEST_EMAIL_PREFIX}-unconfirmed@example.com`;
  const registered = await registerAuthUser({
    email,
    displayName: "Unconfirmed User",
    password: PASSWORD,
  });
  assert(
    registered.kind === "email_confirmation_required",
    "Registration must require confirmation.",
  );

  const stored = await findRawAuthUserByEmail(email);
  assert(stored !== null, "Unconfirmed user must exist.");

  await assertRejects(
    () => startEnableLoginTwoStep({ userId: stored.userId, currentPassword: PASSWORD }),
    /Email must be confirmed/i,
  );
}

async function verifyEnableRequiresPasswordAndCode(userId: string): Promise<void> {
  await assertRejects(
    () => startEnableLoginTwoStep({ userId, currentPassword: "wrong-password-123" }),
    /password is incorrect/i,
  );

  await startEnableLoginTwoStep({ userId, currentPassword: PASSWORD });

  await assertRejects(() => confirmEnableLoginTwoStep({ userId, code: "000000" }), /incorrect/i);

  const enableCode = getLastIssuedConfirmationCodeForTests(userId, "login_two_step_enable");
  assert(enableCode !== null, "Enable code must exist.");

  const updated = await confirmEnableLoginTwoStep({ userId, code: enableCode });
  assert(updated.loginEmailTwoStepEnabled === true, "Two-Step Login must be enabled after code.");
}

async function verifyLoginChallengeFlow(userId: string, email: string): Promise<void> {
  MockEmailProvider.clearForTests();
  clearEmailQueueForTests();

  const loginResult = await loginAuthUser({ email, password: PASSWORD });
  assert(isLoginTwoStepRequiredResponse(loginResult), "Enabled login must require two-step.");
  assert(
    loginResult.challenge.authenticationComplete === false,
    "authenticationComplete must be false.",
  );
  assert(loginResult.challenge.twoStepRequired === true, "twoStepRequired must be true.");
  assert(loginResult.challenge.challengeToken.length > 20, "Challenge token must be returned.");
  assert(!("tokens" in loginResult), "Login must not issue tokens before code confirmation.");

  await drainEmailQueueForTests();
  assert(
    MockEmailProvider.sentMessages.some((message) => message.template === "login_two_step_code"),
    "Login code email must be queued.",
  );

  const activeCode = await findActiveEmailConfirmationCode({
    userId,
    purpose: "login_email_two_step",
  });
  assert(activeCode !== null, "Active login challenge must exist.");
  const loginCode = getLastIssuedConfirmationCodeForTests(userId, "login_email_two_step");
  assert(loginCode !== null && /^\d{6}$/.test(loginCode), "Login code must be six digits.");
  assert(
    activeCode.codeHash === hashEmailConfirmationCode(userId, loginCode),
    "Login code must be hashed.",
  );
  assert(!JSON.stringify(activeCode).includes(loginCode), "Plain login code must not be stored.");

  const config = resolveLoginEmailTwoStepConfig();
  for (let attempt = 1; attempt < config.maxAttempts; attempt += 1) {
    await assertRejects(() => confirmLoginTwoStepCode({ userId, code: "000000" }), /incorrect/i);
  }

  await assertRejects(
    () => confirmLoginTwoStepCode({ userId, code: "000000" }),
    /Too many unsuccessful attempts/i,
  );

  await loginAuthUser({ email, password: PASSWORD });
  const freshCode = getLastIssuedConfirmationCodeForTests(userId, "login_email_two_step");
  assert(freshCode !== null, "Fresh login code required after attempt limit.");

  await expireActiveLoginCode(userId);
  await assertRejects(() => confirmLoginTwoStepCode({ userId, code: freshCode }), /expired/i);

  await loginAuthUser({ email, password: PASSWORD });
  const validCode = getLastIssuedConfirmationCodeForTests(userId, "login_email_two_step");
  assert(validCode !== null, "Valid login code required.");

  const session = await confirmLoginTwoStepCode({ userId, code: validCode });
  assert(session.kind === "session", "Correct code must complete login.");
  assert(session.tokens.accessToken.length > 20, "Access token must be issued.");
  assert(session.tokens.refreshToken.length > 20, "Refresh token must be issued.");

  await assertRejects(
    () => confirmLoginTwoStepCode({ userId, code: validCode }),
    /expired|incorrect|invalid/i,
  );
}

async function verifyResendCooldown(userId: string, email: string): Promise<void> {
  process.env.LOGIN_EMAIL_CODE_RESEND_COOLDOWN_SECONDS = "60";
  await clearAllAuthCodeSendLogsForTests();
  await loginAuthUser({ email, password: PASSWORD });

  await assertRejects(
    () => resendLoginTwoStepCode({ userId }),
    /Please wait before requesting another code/i,
  );

  process.env.LOGIN_EMAIL_CODE_RESEND_COOLDOWN_SECONDS = "1";
  await new Promise((resolve) => {
    setTimeout(resolve, 1100);
  });

  const beforeResend = getLastIssuedConfirmationCodeForTests(userId, "login_email_two_step");
  const status = await resendLoginTwoStepCode({ userId });
  assert(status.status === "pending", "Resend must return pending status.");

  const afterResend = getLastIssuedConfirmationCodeForTests(userId, "login_email_two_step");
  assert(afterResend !== beforeResend, "Resend must invalidate previous login code.");
}

async function verifyDisableFlowAndNormalLogin(userId: string, email: string): Promise<void> {
  await assertRejects(
    () => startDisableLoginTwoStep({ userId, currentPassword: "wrong-password-123" }),
    /password is incorrect/i,
  );

  await assertRejects(
    () => confirmDisableLoginTwoStep({ userId, code: "123456" }),
    /incorrect|expired/i,
  );

  await startDisableLoginTwoStep({ userId, currentPassword: PASSWORD });
  const disableCode = getLastIssuedConfirmationCodeForTests(userId, "login_two_step_disable");
  assert(disableCode !== null, "Disable code must exist.");

  const disabled = await confirmDisableLoginTwoStep({ userId, code: disableCode });
  assert(disabled.loginEmailTwoStepEnabled !== true, "Two-Step Login must be disabled.");

  const loginResult = await loginAuthUser({ email, password: PASSWORD });
  assert(!isLoginTwoStepRequiredResponse(loginResult), "Disabled user must login normally.");
  assert(loginResult.kind === "session", "Disabled login must return session.");
}

async function verifyRefreshDoesNotChallenge(userId: string, email: string): Promise<void> {
  await enableTwoStepForUser(userId, PASSWORD);
  MockEmailProvider.clearForTests();
  clearEmailQueueForTests();

  const pending = await loginAuthUser({ email, password: PASSWORD });
  assert(isLoginTwoStepRequiredResponse(pending), "Login must require two-step.");

  const code = getLastIssuedConfirmationCodeForTests(userId, "login_email_two_step");
  assert(code !== null, "Login code required.");

  const session = await confirmLoginTwoStepCode({ userId, code });
  const beforeRefreshCount = MockEmailProvider.sentMessages.filter(
    (message) => message.template === "login_two_step_code",
  ).length;

  await refreshAuthSession(session.tokens.refreshToken);
  await drainEmailQueueForTests();

  const afterRefreshCount = MockEmailProvider.sentMessages.filter(
    (message) => message.template === "login_two_step_code",
  ).length;
  assert(
    afterRefreshCount === beforeRefreshCount,
    "Refresh must not send another login code email.",
  );
}

async function verifyLogoutRequiresTwoStepAgain(userId: string, email: string): Promise<void> {
  const pending = await loginAuthUser({ email, password: PASSWORD });
  assert(isLoginTwoStepRequiredResponse(pending), "Login must require two-step.");

  const code = getLastIssuedConfirmationCodeForTests(userId, "login_email_two_step");
  assert(code !== null, "Login code required.");

  const session = await confirmLoginTwoStepCode({ userId, code });
  await logoutAuthSession(session.tokens.refreshToken);

  const loginAgain = await loginAuthUser({ email, password: PASSWORD });
  assert(
    isLoginTwoStepRequiredResponse(loginAgain),
    "New login after logout must require two-step.",
  );
}

async function verifyNoAccountEnumeration(): Promise<void> {
  await assertRejects(
    () => loginAuthUser({ email: `${TEST_EMAIL_PREFIX}-missing@example.com`, password: PASSWORD }),
    /Invalid email or password/i,
  );

  const { email } = await createConfirmedUser("enum");
  await assertRejects(
    () => loginAuthUser({ email, password: "wrong-password-123" }),
    /Invalid email or password/i,
  );
}

async function verifyNoMemberOrPaymentFields(userId: string): Promise<void> {
  const stored = await getMongoCollection(MONGO_COLLECTIONS.authUsers).findOne({ userId });
  assert(stored !== null, "User record must exist.");

  const serialized = JSON.stringify(stored);
  assert(!serialized.includes("stripe"), "Stripe fields must not be added.");
  assert(!serialized.includes("memberStatus"), "Member status fields must not be added.");
  assert(
    !serialized.includes("identityVerification"),
    "Identity verification fields must not be added.",
  );
  assert(
    Object.prototype.hasOwnProperty.call(stored, "loginEmailTwoStepEnabled"),
    "loginEmailTwoStepEnabled must exist on auth user.",
  );
}

async function verifySettingResendCooldown(userId: string): Promise<void> {
  await startDisableLoginTwoStep({ userId, currentPassword: PASSWORD });

  process.env.LOGIN_EMAIL_CODE_RESEND_COOLDOWN_SECONDS = "60";
  await assertRejects(
    () => resendLoginTwoStepSettingCode({ userId, action: "disable" }),
    /Please wait before requesting another code/i,
  );
}

async function runPass(pass: number): Promise<void> {
  console.log(`\n=== verify:email-two-step-login pass ${pass} ===`);
  await cleanupTestRecords();

  process.env.EMAIL_PROVIDER = "mock";
  process.env.LOGIN_EMAIL_CODE_RESEND_COOLDOWN_SECONDS = "1";

  await verifyUnconfirmedCannotEnable();

  const confirmed = await createConfirmedUser("confirmed");
  await verifyEnableRequiresPasswordAndCode(confirmed.userId);
  await verifyLoginChallengeFlow(confirmed.userId, confirmed.email);

  const resendUser = await createConfirmedUser("resend");
  await enableTwoStepForUser(resendUser.userId, PASSWORD);
  await verifyResendCooldown(resendUser.userId, resendUser.email);

  const disableUser = await createConfirmedUser("disable");
  await enableTwoStepForUser(disableUser.userId, PASSWORD);
  await verifyDisableFlowAndNormalLogin(disableUser.userId, disableUser.email);

  const refreshUser = await createConfirmedUser("refresh");
  await verifyRefreshDoesNotChallenge(refreshUser.userId, refreshUser.email);

  const reloginUser = await createConfirmedUser("relogin");
  await enableTwoStepForUser(reloginUser.userId, PASSWORD);
  await verifyLogoutRequiresTwoStepAgain(reloginUser.userId, reloginUser.email);

  const resendSettingUser = await createConfirmedUser("setting-resend");
  await enableTwoStepForUser(resendSettingUser.userId, PASSWORD);
  await verifySettingResendCooldown(resendSettingUser.userId);

  await verifyNoAccountEnumeration();
  await verifyNoMemberOrPaymentFields(confirmed.userId);

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

  console.log("\nverify:email-two-step-login PASSED (3 consecutive passes).");
}

void runVerificationScript(main);
