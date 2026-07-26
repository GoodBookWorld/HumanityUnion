/**
 * TASK-095C — Auth UX, navigation, and email branding polish verification.
 * Run: npm run verify:auth-ux-polish
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadApiEnvironment } from "../config/load-api-environment.js";
import { bootstrapAuthPersistence } from "../infrastructure/mongodb/bootstrap-auth-persistence.js";
import { assertAuthCodeSendAllowed } from "../modules/auth/auth-code-rate-limit.js";
import { AuthCodeRateLimitError } from "../modules/auth/auth.errors.js";
import { registerAuthUser } from "../modules/auth/auth.service.js";
import {
  confirmLoginTwoStepCode,
  queueLoginTwoStepCode,
} from "../modules/auth/auth-login-two-step.service.js";
import {
  findRawAuthUserByEmail,
  markAuthUserEmailVerified,
  setAuthUserLoginEmailTwoStepEnabled,
} from "../modules/auth/auth-user.repository.js";
import {
  clearEmailConfirmationCodesForTests,
  countAccountAuthCodeSends,
  countIpAuthCodeSends,
  createEmailConfirmationCode,
  discardEmailConfirmationCode,
  findActiveEmailConfirmationCode,
  getLastIssuedConfirmationCodeForTests,
  markEmailConfirmationCodeDelivered,
  revokeActiveEmailConfirmationCodesExcept,
} from "../modules/email/email-confirmation-code.repository.js";
import {
  getMockEmailSendCount,
  resetMockEmailOutboxForTests,
} from "../modules/email/email-test-helpers.js";
import { renderEmailTemplate } from "../modules/email/email.templates.js";
import { MockEmailProvider } from "../modules/email/providers/mock.provider.js";
import { runVerificationScript } from "./verification-script-lifecycle.js";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");
const PASS_COUNT = Number.parseInt(process.env.VERIFY_PASS_COUNT ?? "3", 10);

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

function verifyBrandingAssets(): void {
  console.log("1. Transactional email logo and footer");

  const logoPath = path.join(
    REPO_ROOT,
    "apps/web/public/brand/humanity-union-logo-white-email.png",
  );
  const logoStats = fs.statSync(logoPath);
  assert(logoStats.size < 30_000, "Email logo PNG must not be a large placeholder asset.");
  assert(logoStats.size > 2_000, "Email logo PNG must exist and contain rendered logo data.");

  const rendered = renderEmailTemplate("registration_confirmation_code", {
    displayName: "Verify User",
    confirmationCode: "123456",
    expiresMinutes: 15,
  });
  assert(
    rendered.html.includes('alt="Humanity Union"'),
    "Email header must include logo alt text.",
  );
  assert(
    rendered.html.includes("Humanity Union</p>"),
    "Email header must include readable text fallback.",
  );
  assert(
    rendered.html.includes("© 2024 Humanity Union. All rights reserved."),
    "Email footer must use static 2024 copyright.",
  );
  assert(
    !rendered.html.includes("© 2026 Humanity Union"),
    "Email footer must not use dynamic current year.",
  );

  const constants = readRepoFile("apps/web/src/features/public-experience/constants.ts");
  assert(
    constants.includes("© 2024 Humanity Union. All rights reserved."),
    "Public footer constant must use exact 2024 copyright text.",
  );
}

function verifyNavigationAndCrossLinks(): void {
  console.log("2. Workspace navigation and profile/account cross-links");

  const workspaceNav = readRepoFile(
    "apps/web/src/features/initiatives/components/WorkspaceNavigation.tsx",
  );
  assert(workspaceNav.includes('href: "/account"'), "Workspace navigation must include Account.");
  assert(
    workspaceNav.includes('href: "/notifications"'),
    "Workspace navigation must include Notifications.",
  );

  const profile = readRepoFile(
    "apps/web/src/features/member-profile/components/MemberProfilePreview.tsx",
  );
  assert(profile.includes('href="/account"'), "Profile page must link to Account & Security.");

  const account = readRepoFile("apps/web/src/features/auth/components/AccountPanel.tsx");
  assert(account.includes('href="/profile"'), "Account page must link to Edit Profile.");
}

function verifyRedirectPolicy(): void {
  console.log("3. Canonical redirect policy");

  const safeReturnTo = readRepoFile("apps/web/src/features/auth/lib/resolve-safe-return-to.ts");
  assert(safeReturnTo.includes("resolveSafeReturnTo"), "Safe return helper must be defined.");
  assert(
    safeReturnTo.includes("/login/verify"),
    "Safe return helper must block auth verify paths.",
  );

  const loginForm = readRepoFile("apps/web/src/features/auth/components/LoginForm.tsx");
  assert(loginForm.includes("resolveSafeReturnTo"), "Login form must use safe return helper.");
  assert(loginForm.includes('"/workspace"'), "Login default redirect must be /workspace.");

  const confirmEmail = readRepoFile("apps/web/src/features/auth/components/ConfirmEmailForm.tsx");
  assert(
    confirmEmail.includes('"/account?confirmed=1"'),
    "Email confirmation success must redirect to /account.",
  );

  const loginVerify = readRepoFile("apps/web/src/features/auth/components/LoginVerifyForm.tsx");
  assert(loginVerify.includes("resolveSafeReturnTo"), "Login verify must use safe return helper.");
}

async function verifyLayeredRateLimits(userAId: string, userBId: string): Promise<void> {
  console.log("4. Layered auth-code rate limits");

  clearEmailConfirmationCodesForTests();
  const sharedIp = "127.0.0.1";

  for (let index = 0; index < 3; index += 1) {
    await queueLoginTwoStepCode(userAId, sharedIp);
  }

  const accountASends = await countAccountAuthCodeSends({
    userId: userAId,
    purpose: "login_email_two_step",
    sinceIso: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  });
  const accountBSends = await countAccountAuthCodeSends({
    userId: userBId,
    purpose: "login_email_two_step",
    sinceIso: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  });

  assert(accountASends >= 1, "Account A must have recorded sends.");
  assert(accountBSends === 0, "Account B must remain independent on the same IP.");

  const ipSends = await countIpAuthCodeSends({
    ipKey: sharedIp,
    purpose: "login_email_two_step",
    sinceIso: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  });
  assert(ipSends >= accountASends, "IP send count must track shared-network volume separately.");

  try {
    await assertAuthCodeSendAllowed({
      userId: userAId,
      purpose: "login_email_two_step",
      ipKey: sharedIp,
      lastSentAt: new Date().toISOString(),
    });
    throw new Error("Expected cooldown rate limit.");
  } catch (error) {
    assert(
      error instanceof AuthCodeRateLimitError,
      "Cooldown must throw structured rate-limit error.",
    );
    assert(error.retryAfterSeconds > 0, "Cooldown must include retryAfterSeconds.");
    assert(error.limitType === "cooldown", "Cooldown must report limitType=cooldown.");
  }
}

async function verifySafeCodeRotation(userId: string): Promise<void> {
  console.log("5. Safe resend code rotation");

  clearEmailConfirmationCodesForTests();
  MockEmailProvider.clearForTests();

  const first = await createEmailConfirmationCode({
    userId,
    email: `auth-ux-${userId}@example.com`,
    purpose: "login_email_two_step",
  });

  await markEmailConfirmationCodeDelivered({
    confirmationId: first.record.confirmationId,
    userId,
    email: `auth-ux-${userId}@example.com`,
    purpose: "login_email_two_step",
    sentAt: new Date().toISOString(),
  });

  const replacement = await createEmailConfirmationCode({
    userId,
    email: `auth-ux-${userId}@example.com`,
    purpose: "login_email_two_step",
    preserveExistingActive: true,
  });

  await discardEmailConfirmationCode(replacement.record.confirmationId);

  const stillValid = await findActiveEmailConfirmationCode({
    userId,
    purpose: "login_email_two_step",
  });
  assert(
    stillValid?.confirmationId === first.record.confirmationId,
    "Failed resend delivery must preserve the previous active code.",
  );

  const deliveredReplacement = await createEmailConfirmationCode({
    userId,
    email: `auth-ux-${userId}@example.com`,
    purpose: "login_email_two_step",
    preserveExistingActive: true,
  });

  await markEmailConfirmationCodeDelivered({
    confirmationId: deliveredReplacement.record.confirmationId,
    userId,
    email: `auth-ux-${userId}@example.com`,
    purpose: "login_email_two_step",
    sentAt: new Date().toISOString(),
  });
  await revokeActiveEmailConfirmationCodesExcept({
    userId,
    purpose: "login_email_two_step",
    confirmationId: deliveredReplacement.record.confirmationId,
  });

  const activeAfterSuccess = await findActiveEmailConfirmationCode({
    userId,
    purpose: "login_email_two_step",
  });
  assert(
    activeAfterSuccess?.confirmationId === deliveredReplacement.record.confirmationId,
    "Successful resend must invalidate the previous active code.",
  );

  const replacementCode = getLastIssuedConfirmationCodeForTests(userId, "login_email_two_step");
  assert(
    replacementCode !== null,
    "Replacement code must remain available for verification flow tests.",
  );
  await confirmLoginTwoStepCode({ userId, code: replacementCode });
}

function verifySharedAuthUxComponents(): void {
  console.log("6. Shared auth verification UX components");

  const sharedFields = readRepoFile(
    "apps/web/src/features/auth/components/AuthCodeVerificationFields.tsx",
  );
  const feedback = readRepoFile("apps/web/src/features/auth/components/AuthFeedbackMessage.tsx");
  assert(
    sharedFields.includes("AuthFeedbackMessage"),
    "Shared auth code form must use AuthFeedbackMessage.",
  );
  assert(
    feedback.includes('role = variant === "error" ? "alert" : "status"'),
    "Auth feedback must expose alert/status roles.",
  );
  assert(
    sharedFields.includes("You can request another code in"),
    "Shared auth code form must show resend countdown copy.",
  );
  assert(
    sharedFields.includes("getAuthCodeRateLimitDetails"),
    "Shared auth code form must consume server retryAfterSeconds.",
  );
}

function verifyDevelopmentResetTool(): void {
  console.log("7. Development rate-limit reset tool");

  const script = readRepoFile("apps/api/src/scripts/dev-reset-auth-rate-limits.ts");
  assert(
    script.includes('process.env.NODE_ENV === "production"'),
    "Development reset tool must refuse production execution.",
  );
  assert(
    readRepoFile("apps/api/package.json").includes("dev:reset-auth-rate-limits"),
    "API package must expose dev:reset-auth-rate-limits script.",
  );
}

async function createVerifiedTwoStepUser(input: {
  email: string;
  displayName: string;
}): Promise<string> {
  await registerAuthUser({
    email: input.email,
    displayName: input.displayName,
    password: "verify-password-123",
  });

  const stored = await findRawAuthUserByEmail(input.email);
  assert(stored !== null, "Registered user must exist.");

  await markAuthUserEmailVerified(stored.userId);
  await setAuthUserLoginEmailTwoStepEnabled(stored.userId, true);

  return stored.userId;
}

async function runPass(pass: number): Promise<void> {
  console.log(`\n=== verify:auth-ux-polish pass ${pass} ===`);

  process.env.EMAIL_PROVIDER = "mock";
  process.env.HU_VERIFICATION_MODE = "true";
  resetMockEmailOutboxForTests();
  MockEmailProvider.clearForTests();
  clearEmailConfirmationCodesForTests();

  verifyBrandingAssets();
  verifyNavigationAndCrossLinks();
  verifyRedirectPolicy();
  verifySharedAuthUxComponents();
  verifyDevelopmentResetTool();

  await bootstrapAuthPersistence();

  const suffix = `${Date.now()}-${pass}`;
  const userAId = await createVerifiedTwoStepUser({
    email: `auth-ux-a-${suffix}@example.com`,
    displayName: "Auth UX A",
  });
  const userBId = await createVerifiedTwoStepUser({
    email: `auth-ux-b-${suffix}@example.com`,
    displayName: "Auth UX B",
  });

  await verifyLayeredRateLimits(userAId, userBId);

  const mockDelta = getMockEmailSendCount();
  assert(mockDelta >= 1, "Mock verification flow must exercise email delivery.");

  await verifySafeCodeRotation(userAId);

  console.log(`Pass ${pass} complete. Mock sends this pass: ${mockDelta}`);
}

async function main(): Promise<void> {
  loadApiEnvironment();

  for (let pass = 1; pass <= PASS_COUNT; pass += 1) {
    await runPass(pass);
  }

  console.log(`\nverify:auth-ux-polish PASSED (${PASS_COUNT} consecutive passes).`);
}

void runVerificationScript(main);
