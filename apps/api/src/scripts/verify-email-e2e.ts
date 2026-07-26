/**
 * TASK-062 — Email infrastructure foundation verification.
 * Run: npm run verify:email
 */

import fs from "node:fs";
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
  deleteAuthUsersByEmailPrefix,
  findRawAuthUserByEmail,
} from "../modules/auth/auth-user.repository.js";
import { deleteAuthSessionsByUserIds } from "../modules/auth/auth-session.repository.js";
import { registerAuthUser } from "../modules/auth/auth.service.js";
import {
  resetPasswordWithToken,
  validatePasswordResetToken,
  verifyRegistrationEmail,
} from "../modules/auth/auth-email.service.js";
import {
  clearEmailAuditRecordsForTests,
  findEmailAuditRecordById,
  toEmailAuditRecordPublic,
} from "../modules/email/email.audit.js";
import { resolveEmailConfig, resolveEmailProviderMode } from "../modules/email/email.config.js";
import { resolveEmailProvider } from "../modules/email/email.provider.js";
import { isVerificationMode } from "../modules/email/email-verification-guards.js";
import { clearEmailQueueForTests } from "../modules/email/email.queue.js";
import { drainEmailQueueForTests } from "../modules/email/email.service.js";
import {
  createEmailVerificationToken,
  deleteEmailVerificationTokensByUserIds,
  hashVerificationToken,
} from "../modules/email/email.tokens.js";
import { renderEmailTemplate } from "../modules/email/email.templates.js";
import { MockEmailProvider } from "../modules/email/providers/mock.provider.js";
import { SmtpEmailProvider } from "../modules/email/providers/smtp.provider.js";
import { ResendEmailProvider } from "../modules/email/providers/resend.provider.js";
import {
  getEmailProviderHealth,
  sendRegistrationVerificationEmail,
} from "../modules/email/email.service.js";
import { runVerificationScript } from "./verification-script-lifecycle.js";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../../..");
const TEST_EMAIL_PREFIX = `email-verify-${Date.now()}`;

const FORBIDDEN_AUDIT_FIELDS = [
  "password",
  "passwordHash",
  "refreshToken",
  "token",
  "html",
  "body",
  "verificationCode",
  "jwt",
] as const;

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8");
}

async function cleanupTestRecords(): Promise<void> {
  const users = await getMongoCollection<{ userId: string; email: string }>(
    MONGO_COLLECTIONS.authUsers,
  )
    .find({ email: { $regex: `^${TEST_EMAIL_PREFIX}` } })
    .toArray();

  const userIds = users.map((user) => user.userId);
  await deleteEmailVerificationTokensByUserIds(userIds);
  await deleteAuthSessionsByUserIds(userIds);
  await deleteAuthUsersByEmailPrefix(TEST_EMAIL_PREFIX);
}

function verifyModuleStructure(): void {
  const requiredFiles = [
    "apps/api/src/modules/email/email.service.ts",
    "apps/api/src/modules/email/email.provider.ts",
    "apps/api/src/modules/email/email.queue.ts",
    "apps/api/src/modules/email/email.templates.ts",
    "apps/api/src/modules/email/email.routes.ts",
    "apps/api/src/modules/email/email.types.ts",
    "apps/api/src/modules/email/email.audit.ts",
    "apps/api/src/modules/email/providers/mock.provider.ts",
    "apps/api/src/modules/email/providers/smtp.provider.ts",
    "apps/api/src/modules/email/providers/resend.provider.ts",
    "apps/api/src/modules/email/index.ts",
    "docs/EMAIL_INFRASTRUCTURE_FOUNDATION.md",
  ];

  for (const file of requiredFiles) {
    assert(fs.existsSync(path.join(REPO_ROOT, file)), `Missing required file: ${file}`);
  }

  const authService = readRepoFile("apps/api/src/modules/auth/auth.service.ts");
  assert(!authService.includes("nodemailer"), "Auth service must not import nodemailer directly.");
  assert(
    authService.includes("queueRegistrationConfirmationCode"),
    "Registration must queue confirmation code email.",
  );
}

function verifyTemplateRendering(): void {
  const rendered = renderEmailTemplate("registration_verification", {
    displayName: "Verify User",
    verificationUrl: "https://example.com/verify?token=test",
  });

  assert(rendered.subject.includes("Verify"), "Registration template must include verify subject.");
  assert(rendered.html.includes("#0174B0"), "Templates must use Humanity primary color.");
  assert(
    rendered.html.includes("Humanity Union"),
    "Templates must include Humanity Union branding.",
  );
  assert(rendered.text.includes("Verify User"), "Templates must include plain-text body.");
}

async function verifyMockProvider(): Promise<void> {
  process.env.EMAIL_PROVIDER = "mock";
  MockEmailProvider.clearForTests();
  clearEmailQueueForTests();

  const emailId = await sendRegistrationVerificationEmail({
    to: `${TEST_EMAIL_PREFIX}@example.com`,
    displayName: "Mock User",
    verificationToken: "mock-token-value",
  });

  await drainEmailQueueForTests();

  assert(MockEmailProvider.sentMessages.length === 1, "Mock provider must capture sent message.");
  assert(
    MockEmailProvider.sentMessages[0]?.template === "registration_verification",
    "Mock provider must record template id.",
  );

  const audit = await findEmailAuditRecordById(emailId);
  assert(audit !== null, "Audit record must be created for mock delivery.");
  assert(audit.status === "sent", "Mock delivery must mark audit as sent.");

  const publicAudit = toEmailAuditRecordPublic(audit);

  for (const field of FORBIDDEN_AUDIT_FIELDS) {
    assert(!(field in publicAudit), `Audit projection must not expose ${field}.`);
  }

  assert(
    !JSON.stringify(publicAudit).includes("@example.com"),
    "Audit must not store raw recipient email.",
  );
}

async function verifyTokenLifecycle(userId: string): Promise<void> {
  const issued = await createEmailVerificationToken({
    userId,
    purpose: "registration",
  });

  assert(issued.token.length >= 32, "Verification token must be cryptographically strong.");
  assert(
    hashVerificationToken(issued.token) === issued.record.tokenHash,
    "Stored token hash must match issued token.",
  );
  assert(!issued.record.tokenHash.includes(issued.token), "Raw token must not be stored.");

  const verified = await verifyRegistrationEmail(issued.token);
  assert(verified.emailVerificationStatus === "verified", "Verification must mark email verified.");

  await assertThrowsAsync(
    () => verifyRegistrationEmail(issued.token),
    "Invalid or expired verification token",
  );
}

async function verifyPasswordResetFlow(userId: string): Promise<void> {
  const issued = await createEmailVerificationToken({
    userId,
    purpose: "password_reset",
  });

  const validation = await validatePasswordResetToken(issued.token);
  assert(validation.valid, "Password reset token must validate before use.");

  await resetPasswordWithToken(issued.token, "new-password-123");
  const reused = await validatePasswordResetToken(issued.token);
  assert(!reused.valid, "Password reset token must be single-use.");
}

async function verifyProviderAbstraction(): Promise<void> {
  process.env.EMAIL_PROVIDER = "mock";
  assert(resolveEmailProviderMode() === "mock", "Default provider mode must be mock.");
  assert(resolveEmailProvider().providerId === "mock", "Mock provider must resolve by default.");

  if (isVerificationMode()) {
    process.env.EMAIL_PROVIDER = "smtp";
    await assertThrowsAsync(async () => {
      resolveEmailProvider();
    }, 'Unsafe email provider "smtp" blocked in verification mode');

    process.env.EMAIL_PROVIDER = "resend";
    await assertThrowsAsync(async () => {
      resolveEmailProvider();
    }, 'Unsafe email provider "resend" blocked in verification mode');
  } else {
    process.env.EMAIL_PROVIDER = "smtp";
    assert(
      resolveEmailProvider().providerId === "smtp",
      "SMTP provider must resolve when configured.",
    );

    process.env.EMAIL_PROVIDER = "resend";
    assert(
      resolveEmailProvider().providerId === "resend",
      "Resend provider must resolve when configured.",
    );
  }

  process.env.EMAIL_PROVIDER = "mock";
}

async function verifyProviderHealthChecks(): Promise<void> {
  process.env.EMAIL_PROVIDER = "mock";
  const mockHealth = await getEmailProviderHealth();
  assert(mockHealth.healthy, "Mock provider health must be healthy.");
  assert(mockHealth.provider === "mock", "Health must report provider id.");

  process.env.EMAIL_PROVIDER = "smtp";
  delete process.env.SMTP_HOST;
  const smtpProvider = new SmtpEmailProvider();
  const smtpHealth = await smtpProvider.verifyConfiguration();
  assert(!smtpHealth.configured, "SMTP health must fail when host is missing.");

  process.env.EMAIL_PROVIDER = "resend";
  delete process.env.RESEND_API_KEY;
  const resendProvider = new ResendEmailProvider();
  const resendHealth = await resendProvider.verifyConfiguration();
  assert(!resendHealth.configured, "Resend health must fail when API key is missing.");

  process.env.EMAIL_PROVIDER = "mock";
}

async function verifyRegistrationIntegration(): Promise<void> {
  process.env.EMAIL_PROVIDER = "mock";
  MockEmailProvider.clearForTests();
  clearEmailQueueForTests();

  const email = `${TEST_EMAIL_PREFIX}-register@example.com`;
  const beforeCount = MockEmailProvider.sentMessages.length;

  await registerAuthUser({
    email,
    displayName: "Email Verify User",
    password: "verify-password-123",
  });

  await drainEmailQueueForTests();

  assert(
    MockEmailProvider.sentMessages.length > beforeCount,
    "Registration must queue verification email.",
  );
}

async function assertThrowsAsync(
  fn: () => Promise<unknown>,
  expectedMessagePart: string,
): Promise<void> {
  try {
    await fn();
    throw new Error(`Expected throw containing: ${expectedMessagePart}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("Expected throw containing")) {
      throw error;
    }

    assert(
      message.includes(expectedMessagePart),
      `Expected "${expectedMessagePart}" but got "${message}"`,
    );
  }
}

async function main(): Promise<void> {
  assert(isMongoConfigured(), "MONGODB_URI must be configured for verify:email.");

  process.env.EMAIL_PROVIDER = "mock";
  delete process.env.AUTH_REQUIRE_EMAIL_VERIFICATION;

  await bootstrapAuthPersistence();
  clearEmailAuditRecordsForTests();

  console.log("OK: email module structure");
  verifyModuleStructure();

  console.log("OK: template rendering");
  verifyTemplateRendering();

  console.log("OK: provider abstraction");
  await verifyProviderAbstraction();

  console.log("OK: provider health checks");
  await verifyProviderHealthChecks();

  console.log("OK: mock provider delivery + audit");
  await verifyMockProvider();

  const email = `${TEST_EMAIL_PREFIX}-token@example.com`;
  await registerAuthUser({
    email,
    displayName: "Token User",
    password: "verify-password-123",
  });

  const stored = await findRawAuthUserByEmail(email);
  assert(stored !== null, "Registered user must exist.");

  console.log("OK: verification token lifecycle");
  await verifyTokenLifecycle(stored.userId);

  console.log("OK: password reset token lifecycle");
  await verifyPasswordResetFlow(stored.userId);

  console.log("OK: registration email integration");
  await verifyRegistrationIntegration();

  const config = resolveEmailConfig();
  assert(
    config.fromName === "Humanity Union" || Boolean(process.env.EMAIL_FROM_NAME),
    "Email from name must resolve.",
  );

  await cleanupTestRecords();
  console.log("\nverify:email PASSED.");
}

void runVerificationScript(main);
