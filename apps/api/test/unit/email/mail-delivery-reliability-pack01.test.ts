import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  CANONICAL_FLOCKMAIL_SMTP_HOST,
  resolveEmailConfig,
  resolveEmailLogoUrl,
  resolveEmailProviderMode,
} from "../../../src/modules/email/email.config.js";
import {
  MailDeliveryService,
  sendTransactionalEmailAndAwait,
} from "../../../src/modules/email/email.service.js";
import { resolveEmailProvider, resetEmailProviderCacheForTests } from "../../../src/modules/email/email.provider.js";
import {
  assertRecipientAllowedForExternalDelivery,
  isSafePublicHttpsLogoUrl,
  isSyntheticTestRecipient,
  mustForceMockEmailProvider,
  TestRecipientBlockedError,
} from "../../../src/modules/email/email-safety-guards.js";
import { renderEmailTemplate } from "../../../src/modules/email/email.templates.js";
import { MockEmailProvider } from "../../../src/modules/email/providers/mock.provider.js";
import { SmtpEmailProvider } from "../../../src/modules/email/providers/smtp.provider.js";
import {
  classifySmtpFailure,
  isTemporarySmtpFailure,
  smtpRetryDelayMs,
} from "../../../src/modules/email/smtp-retry.js";
import {
  createSmtpTransport,
  hasCachedSmtpTransportForTests,
  resetSmtpTransportForTests,
} from "../../../src/modules/email/smtp-transport.js";

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
  resetSmtpTransportForTests();
  MockEmailProvider.clearForTests();
}

describe("Mail Delivery Reliability Pack 01", () => {
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

  it("1 — NODE_ENV=test never uses real Flockmail SMTP", () => {
    process.env.EMAIL_PROVIDER = "smtp";
    process.env.SMTP_HOST = CANONICAL_FLOCKMAIL_SMTP_HOST;
    process.env.SMTP_USERNAME = "info@huws.org";
    process.env.SMTP_PASSWORD = "not-a-real-secret";
    process.env.SMTP_FROM = "info@huws.org";

    assert.equal(mustForceMockEmailProvider(), true);
    assert.equal(resolveEmailProviderMode(), "mock");
    assert.equal(resolveEmailProvider().providerId, "mock");
    assert.throws(() => createSmtpTransport(), /refused|mock/i);
    assert.equal(hasCachedSmtpTransportForTests(), false);
  });

  it("2 — Valid SMTP credentials in env do not override test isolation", () => {
    process.env.EMAIL_PROVIDER = "smtp";
    process.env.SMTP_HOST = "smtp-out.flockmail.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_SECURE = "true";
    process.env.SMTP_USER = "info@huws.org";
    process.env.SMTP_PASSWORD = "production-looking-password";
    process.env.SMTP_FROM_EMAIL = "info@huws.org";
    process.env.SMTP_FROM_NAME = "Humanity Union";

    const config = resolveEmailConfig();
    assert.equal(config.provider, "mock");
    assert.equal(resolveEmailProvider().providerId, "mock");
    assert.equal(hasCachedSmtpTransportForTests(), false);
  });

  it("3 — user@direct-messaging.test never reaches SMTP", async () => {
    const result = await new SmtpEmailProvider().sendEmail({
      to: "user@direct-messaging.test",
      subject: "should not send",
      html: "<p>x</p>",
      text: "x",
      template: "security_alert",
    });

    assert.equal(result.status, "blocked");
    assert.equal(result.failureCategory, "test_recipient_blocked");
    assert.equal(hasCachedSmtpTransportForTests(), false);
  });

  it("4/5/6 — .test / .invalid / .example recipients are synthetic", () => {
    assert.equal(isSyntheticTestRecipient("a@foo.test"), true);
    assert.equal(isSyntheticTestRecipient("a@bar.invalid"), true);
    assert.equal(isSyntheticTestRecipient("a@docs.example"), true);
    assert.equal(isSyntheticTestRecipient("a@example.com"), true);
    assert.equal(isSyntheticTestRecipient("a@example.org"), true);

    assert.throws(
      () => assertRecipientAllowedForExternalDelivery("bounce@mail.invalid", "smtp"),
      TestRecipientBlockedError,
    );
  });

  it("7 — Normal production recipient is not classified as synthetic", () => {
    assert.equal(isSyntheticTestRecipient("participant@huws.org"), false);
    assert.equal(isSyntheticTestRecipient("hello@gmail.com"), false);
    assert.doesNotThrow(() =>
      assertRecipientAllowedForExternalDelivery("participant@huws.org", "smtp"),
    );
  });

  it("8 — Test-blocked delivery does not create SMTP transport (no external bounce)", async () => {
    // Hard guard on real provider: blocked locally, no transporter, no Flockmail bounce.
    const smtpResult = await new SmtpEmailProvider().sendEmail({
      to: "dm-service-xyz@direct-messaging.test",
      subject: "blocked",
      html: "<p>x</p>",
      text: "x",
      template: "workspace_message_alert",
    });
    assert.equal(smtpResult.status, "blocked");
    assert.equal(smtpResult.failureCategory, "test_recipient_blocked");
    assert.equal(hasCachedSmtpTransportForTests(), false);

    // Test environment still uses mock — synthetic recipients stay local (no SMTP).
    const mockResult = await sendTransactionalEmailAndAwait({
      to: "dm-service-xyz@direct-messaging.test",
      template: "workspace_message_alert",
      templateInput: {
        displayName: "Tester",
        messagesUrl: "https://huws.org/workspace/messages",
      },
    });
    assert.equal(mockResult.status, "sent");
    assert.equal(resolveEmailProvider().providerId, "mock");
    assert.equal(hasCachedSmtpTransportForTests(), false);
  });

  it("9/10/11 — Logo uses absolute safe HTTPS URL with dimensions/alt; no localhost", () => {
    process.env.EMAIL_LOGO_URL = "https://huws.org/brand/humanity-union-logo-white-email.png";
    process.env.WEB_ORIGIN = "https://huws.org";

    assert.equal(isSafePublicHttpsLogoUrl(process.env.EMAIL_LOGO_URL), true);
    assert.equal(isSafePublicHttpsLogoUrl("http://localhost:3000/brand/logo.png"), false);
    assert.equal(isSafePublicHttpsLogoUrl("/brand/logo.png"), false);

    const logo = resolveEmailLogoUrl("https://huws.org");
    assert.equal(logo, "https://huws.org/brand/humanity-union-logo-white-email.png");

    const rendered = renderEmailTemplate("registration_welcome", {
      displayName: "Ada",
      profileUrl: "https://huws.org/profile",
      exploreUrl: "https://huws.org/initiatives",
      createInitiativeUrl: "https://huws.org/initiatives",
    });

    assert.match(rendered.html, /src="https:\/\/huws\.org\/brand\/humanity-union-logo-white-email\.png"/);
    assert.match(rendered.html, /alt="Humanity Union"/);
    assert.match(rendered.html, /width="160"/);
    assert.match(rendered.html, /height="40"/);
    assert.equal(rendered.html.includes("localhost"), false);
    assert.equal(/src="\//.test(rendered.html), false);
    assert.ok(rendered.text.length > 0);
  });

  it("12 — Sender-avatar vs embedded branding distinction is documented in ops guide", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const docs = readFileSync(
      resolve(process.cwd(), "../../docs/EMAIL_DELIVERY_OPERATIONS.md"),
      "utf8",
    );
    assert.match(docs, /avatar shown by Gmail/i);
    assert.match(docs, /Email Sender Brand Identity/i);
    assert.match(docs, /BIMI|SPF|DKIM|DMARC/);
    assert.match(docs, /not.*by the HTML email template/i);
  });

  it("canonical SMTP config aliases resolve", () => {
    process.env.NODE_ENV = "development";
    delete process.env.NODE_TEST_ENV;
    delete process.env.HU_VERIFICATION_MODE;
    process.env.ALLOW_REAL_EMAIL_IN_TESTS = "false";
    process.env.EMAIL_PROVIDER = "smtp";
    process.env.SMTP_HOST = CANONICAL_FLOCKMAIL_SMTP_HOST;
    // Prefer SMTP_USER when SMTP_USERNAME is unset (alias path).
    delete process.env.SMTP_USERNAME;
    process.env.SMTP_USER = "mailbox@huws.org";
    delete process.env.SMTP_FROM;
    delete process.env.EMAIL_FROM;
    process.env.SMTP_FROM_EMAIL = "mailbox@huws.org";
    delete process.env.EMAIL_FROM_NAME;
    process.env.SMTP_FROM_NAME = "Humanity Union";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_SECURE = "true";

    assert.equal(mustForceMockEmailProvider(), false);
    const config = resolveEmailConfig();
    assert.equal(config.provider, "smtp");
    assert.equal(config.smtpHost, CANONICAL_FLOCKMAIL_SMTP_HOST);
    assert.equal(config.smtpUsername, "mailbox@huws.org");
    assert.equal(config.fromAddress, "mailbox@huws.org");
    assert.equal(config.fromName, "Humanity Union");
    assert.equal(config.smtpSecure, true);
    assert.equal(config.smtpConnectionTimeoutMs, 15000);
  });

  it("one MailDeliveryService facade is exported and mock send succeeds", async () => {
    assert.equal(typeof MailDeliveryService.sendTransactionalEmailAndAwait, "function");
    assert.equal(resolveEmailProvider().providerId, "mock");

    const result = await MailDeliveryService.sendTransactionalEmailAndAwait({
      to: "real-looking@huws.org",
      template: "workspace_notification_summary",
      templateInput: {
        displayName: "Ada",
        unreadCount: 3,
        notificationsUrl: "https://huws.org/workspace/notifications",
      },
    });

    assert.equal(result.emailSent, true);
    assert.equal(result.status, "sent");
    assert.equal(MockEmailProvider.sentMessages.length, 1);
    const message = MockEmailProvider.sentMessages[0]!;
    assert.ok(message.html.includes("<"));
    assert.ok(message.text.length > 0);
    assert.match(message.text, /3 new notifications/i);
    assert.equal(message.text.includes("private message content"), true);
  });

  it("HTML + plain text for Author application and message alert", () => {
    const author = renderEmailTemplate("blog_author_application_status", {
      displayName: "Ada",
      statusLabel: "Blog Author application approved",
      statusMessage: "Your Blog Author application has been approved.",
      authoringUrl: "https://huws.org/workspace/authoring",
    });
    assert.match(author.subject, /approved/i);
    assert.ok(author.html.includes("Humanity Union"));
    assert.ok(author.text.includes("Open Authoring"));
    assert.equal(author.html.includes("cid:"), false);

    const dm = renderEmailTemplate("workspace_message_alert", {
      displayName: "Ada",
      messagesUrl: "https://huws.org/workspace/messages",
    });
    assert.match(dm.text, /You have a new message in Humanity Union/);
    assert.equal(/secret chat body|password|token=/i.test(dm.html + dm.text), false);
  });

  it("temporary SMTP failures are classified for retry; permanent are not", () => {
    assert.equal(isTemporarySmtpFailure({ code: "ETIMEDOUT", message: "timeout" }), true);
    assert.equal(isTemporarySmtpFailure({ code: "ECONNRESET", message: "reset" }), true);
    assert.equal(isTemporarySmtpFailure({ code: "EAUTH", message: "Invalid login" }), false);
    assert.equal(
      isTemporarySmtpFailure({ code: "EENVELOPE", message: "550 recipient address rejected" }),
      false,
    );
    assert.equal(classifySmtpFailure({ code: "ETIMEDOUT", message: "timeout" }), "timeout");
    assert.equal(classifySmtpFailure({ code: "EAUTH", message: "Invalid login" }), "auth_failure");
    assert.ok(smtpRetryDelayMs(0) < smtpRetryDelayMs(2));
    assert.ok(smtpRetryDelayMs(5) <= 1500);
  });

  it("localhost logo URL is omitted from rendered production-style email", () => {
    process.env.EMAIL_LOGO_URL = "http://localhost:3000/brand/humanity-union-logo-white-email.png";
    process.env.WEB_ORIGIN = "http://localhost:3000";
    assert.equal(resolveEmailLogoUrl("http://localhost:3000"), null);

    const rendered = renderEmailTemplate("security_alert", {
      displayName: "Ada",
      alertTitle: "Security notice",
      alertBody: "Something happened.",
    });
    assert.equal(rendered.html.includes("<img"), false);
    assert.match(rendered.html, /Humanity Union/);
    assert.ok(rendered.text.length > 0);
  });

  it("preference helper defaults to enabled when preferences missing", async () => {
    const enabled = await MailDeliveryService.isParticipantEmailNotificationsEnabled(
      "missing-participant-id-for-mail-pack",
    );
    assert.equal(enabled, true);
  });

  it("logging helpers redact full recipient while keeping domain", async () => {
    const { maskRecipientEmail, recipientDomainForLogs } = await import(
      "../../../src/modules/email/email-safety-guards.js"
    );
    assert.equal(maskRecipientEmail("vlad@huws.org"), "v***@huws.org");
    assert.equal(recipientDomainForLogs("vlad@huws.org"), "huws.org");
  });
});
