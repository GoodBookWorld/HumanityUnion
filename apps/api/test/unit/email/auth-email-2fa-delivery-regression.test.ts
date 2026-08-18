import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { collectInvalidEmailConfig } from "../../../src/config/validate-production-environment.js";
import {
  isDeployedPlatformRequiringRealEmail,
  mustForceMockEmailProvider,
} from "../../../src/modules/email/email-safety-guards.js";
import {
  sendLoginTwoStepCodeEmail,
  sendTransactionalEmailAndAwait,
} from "../../../src/modules/email/email.service.js";
import { resetEmailProviderCacheForTests } from "../../../src/modules/email/email.provider.js";
import { MockEmailProvider } from "../../../src/modules/email/providers/mock.provider.js";

const originalEnv = { ...process.env };

function restoreEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  resetEmailProviderCacheForTests();
  MockEmailProvider.clearForTests();
}

describe("Auth email 2FA delivery regression", () => {
  beforeEach(() => {
    restoreEnv();
    process.env.NODE_ENV = "test";
    process.env.NODE_TEST_ENV = "true";
    process.env.HU_VERIFICATION_MODE = "true";
    process.env.ALLOW_REAL_EMAIL_IN_TESTS = "false";
    process.env.EMAIL_PROVIDER = "mock";
  });

  afterEach(() => {
    restoreEnv();
  });

  it("production config rejects EMAIL_PROVIDER=mock (silent non-delivery)", () => {
    process.env.EMAIL_PROVIDER = "mock";
    const problems = collectInvalidEmailConfig();
    assert.ok(problems.some((problem) => problem.includes("EMAIL_PROVIDER=mock")));
  });

  it("production config requires SMTP credentials when EMAIL_PROVIDER=smtp", () => {
    process.env.EMAIL_PROVIDER = "smtp";
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USERNAME;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    delete process.env.SMTP_FROM;
    delete process.env.SMTP_FROM_EMAIL;
    delete process.env.EMAIL_FROM;

    const problems = collectInvalidEmailConfig();
    assert.ok(problems.some((problem) => problem.includes("SMTP_HOST")));
    assert.ok(problems.some((problem) => problem.includes("SMTP_PASSWORD")));
  });

  it("staging PLATFORM_MODE requires real email and does not force mock", () => {
    process.env.NODE_ENV = "production";
    delete process.env.NODE_TEST_ENV;
    delete process.env.HU_VERIFICATION_MODE;
    process.env.PLATFORM_MODE = "staging";
    process.env.EMAIL_PROVIDER = "mock";

    assert.equal(mustForceMockEmailProvider(), false);
    assert.equal(isDeployedPlatformRequiringRealEmail(), true);
  });

  it("awaited login-code send fails closed on deployed mock provider (no false emailSent)", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.NODE_TEST_ENV;
    delete process.env.HU_VERIFICATION_MODE;
    process.env.PLATFORM_MODE = "staging";
    process.env.EMAIL_PROVIDER = "mock";
    process.env.ALLOW_REAL_EMAIL_IN_TESTS = "false";
    resetEmailProviderCacheForTests();

    const result = await sendLoginTwoStepCodeEmail({
      to: "participant@huws.org",
      displayName: "Participant",
      loginCode: "123456",
      expiresMinutes: 10,
    });

    assert.equal(result.emailSent, false);
    assert.equal(result.emailDeliveryError, "email_provider_mock");
    assert.equal(MockEmailProvider.sentMessages.length, 0);
  });

  it("login-code send is awaited through sendTransactionalEmailAndAwait (not fire-and-forget)", async () => {
    const result = await sendTransactionalEmailAndAwait({
      to: "participant@huws.org",
      template: "login_two_step_code",
      templateInput: {
        displayName: "Participant",
        loginCode: "654321",
        expiresMinutes: 10,
      },
    });

    assert.equal(result.emailSent, true);
    assert.equal(MockEmailProvider.sentMessages.length, 1);
    assert.equal(MockEmailProvider.sentMessages[0]?.template, "login_two_step_code");
    assert.equal(/654321/.test(MockEmailProvider.sentMessages[0]?.text ?? ""), true);
    assert.equal(/SMTP_PASSWORD|RESEND_API_KEY|password=/i.test(JSON.stringify(result)), false);
  });
});
