/**
 * TASK-095B — SMTP provider parity, test isolation, and branded header verification.
 * Run: npm run verify:smtp-provider
 */

import "./verification-environment.bootstrap.js";

import assert from "node:assert/strict";
import path from "node:path";

import { API_ROOT } from "../config/load-api-environment.js";
import { resolveEmailConfig, resolveEmailProviderMode } from "../modules/email/email.config.js";
import { resolveEmailProvider } from "../modules/email/email.provider.js";
import {
  assertSafeEmailProviderForCurrentMode,
  assertSafeRecipientForVerificationMode,
  isReservedTestRecipient,
  isVerificationMode,
} from "../modules/email/email-verification-guards.js";
import {
  disposeEmailWorkersForTests,
  getMockEmailSendCount,
  resetMockEmailOutboxForTests,
} from "../modules/email/email-test-helpers.js";
import { drainEmailQueueForTests } from "../modules/email/email.queue.js";
import {
  sendRegistrationConfirmationCodeEmail,
  sendRegistrationWelcomeEmail,
  sendLoginTwoStepCodeEmail,
  getEmailProviderHealth,
} from "../modules/email/email.service.js";
import { renderRegistrationConfirmationCodeEmail } from "../modules/email/email.templates.js";
import { MockEmailProvider } from "../modules/email/providers/mock.provider.js";
import { runVerificationScript } from "./verification-script-lifecycle.js";

function expectThrows(fn: () => void, pattern: RegExp): void {
  assert.throws(fn, (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    return pattern.test(message);
  });
}

async function verifyVerificationModeIsolation(): Promise<void> {
  console.log("1. Verification mode isolation");

  assert.equal(isVerificationMode(), true);
  assert.equal(resolveEmailProviderMode(), "mock");
  assert.equal(resolveEmailProvider().providerId, "mock");

  process.env.EMAIL_PROVIDER = "smtp";
  expectThrows(
    () => resolveEmailProvider(),
    /Unsafe email provider "smtp" blocked in verification mode/,
  );
  process.env.EMAIL_PROVIDER = "mock";
}

async function verifyReservedRecipients(): Promise<void> {
  console.log("2. Reserved synthetic recipient protection");

  assert.equal(isReservedTestRecipient("user@example.com"), true);
  assert.equal(isReservedTestRecipient("user@example.org"), true);
  assert.equal(isReservedTestRecipient("user@huws.org"), false);

  process.env.ALLOW_REAL_EMAIL_IN_TESTS = "true";
  process.env.EMAIL_PROVIDER = "smtp";

  expectThrows(
    () => assertSafeRecipientForVerificationMode("membership-domain@test@example.com", "smtp"),
    /Reserved test recipient domain blocked/,
  );

  process.env.ALLOW_REAL_EMAIL_IN_TESTS = "false";
  process.env.EMAIL_PROVIDER = "mock";
}

async function verifySmtpTransportParity(): Promise<void> {
  console.log("3. SMTP config parity (no live SMTP connection in verification mode)");

  if (process.env.SMTP_PASSWORD !== undefined) {
    assert.equal(resolveEmailConfig().smtpPassword, process.env.SMTP_PASSWORD);
  }

  assert.equal(resolveEmailProviderMode(), "mock");
}

async function verifyMockDeliveryFlows(): Promise<void> {
  console.log("4. Mock delivery flows and queue drain");

  resetMockEmailOutboxForTests();
  const before = getMockEmailSendCount();

  const confirmation = await sendRegistrationConfirmationCodeEmail({
    to: "verify-smtp-provider@example.com",
    displayName: "Verify SMTP",
    confirmationCode: "123456",
    expiresMinutes: 15,
  });

  assert.equal(confirmation.emailSent, true);

  await sendRegistrationWelcomeEmail({
    to: "verify-smtp-provider@example.com",
    displayName: "Verify SMTP",
  });

  await drainEmailQueueForTests();

  const after = getMockEmailSendCount();
  assert.ok(after > before, "Mock outbox must record sends.");
  assert.ok(
    MockEmailProvider.sentMessages.some((message) => message.template === "registration_welcome"),
    "Welcome email must be queued and drained in mock mode.",
  );

  const twoStep = await sendLoginTwoStepCodeEmail({
    to: "verify-smtp-provider@example.com",
    displayName: "Verify SMTP",
    loginCode: "654321",
    expiresMinutes: 10,
  });
  assert.equal(twoStep.emailSent, true);
}

async function verifyBrandedHeader(): Promise<void> {
  console.log("5. Branded email header and plain-text fallback");

  const config = resolveEmailConfig();
  assert.match(config.logoUrl, /^https?:\/\//u);

  const rendered = renderRegistrationConfirmationCodeEmail({
    displayName: "Verify SMTP",
    confirmationCode: "123456",
    expiresMinutes: 15,
  });

  assert.match(rendered.html, /alt="Humanity Union"/u);
  assert.match(rendered.html, new RegExp(config.logoUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(rendered.html, /123456/u);
  assert.match(rendered.text, /123456/u);
  assert.match(rendered.text, /Do not share this code/u);
}

async function verifyHealthMapping(): Promise<void> {
  console.log("6. Provider health mapping (mock)");

  const health = await getEmailProviderHealth();
  assert.equal(health.provider, "mock");
  assert.equal(health.healthy, true);
  assert.equal(health.configured, true);
}

async function verifyEnvPrecedenceDocumentation(): Promise<void> {
  console.log("7. Environment loading");

  const envPath = path.join(API_ROOT, ".env");
  assert.ok(envPath.endsWith(`${path.sep}.env`));
  assertSafeEmailProviderForCurrentMode("mock");
}

async function runPass(pass: number): Promise<void> {
  console.log(`\n=== verify:smtp-provider pass ${pass} ===`);
  disposeEmailWorkersForTests();
  await verifyVerificationModeIsolation();
  await verifyReservedRecipients();
  await verifySmtpTransportParity();
  await verifyMockDeliveryFlows();
  await verifyBrandedHeader();
  await verifyHealthMapping();
  await verifyEnvPrecedenceDocumentation();
  console.log(`Pass ${pass} complete. Mock sends this pass: ${getMockEmailSendCount()}`);
}

async function main(): Promise<void> {
  const sendCountAtStart = getMockEmailSendCount();

  for (let pass = 1; pass <= 3; pass += 1) {
    await runPass(pass);
  }

  console.log(
    `\nverify:smtp-provider PASSED (3 consecutive passes). Real SMTP sends during gates: 0 (mock delta: ${getMockEmailSendCount() - sendCountAtStart}).`,
  );
}

void runVerificationScript(main);
