/**
 * EMAIL DELIVERABILITY 03A.1 — List-Unsubscribe header allowlist + scoped application.
 * Uses synthetic fixed tokens only. Never prints full unsubscribe URLs with secret tokens.
 */
import "./email-deliverability-03a1.setup.js";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  generateBlogSubscriptionRawToken,
  hashBlogSubscriptionToken,
  resolveBlogSubscriptionConfirmExpiresAt,
} from "../../../src/modules/blog/blog-subscription-tokens.js";
import { confirmBlogSubscription } from "../../../src/modules/blog/blog-subscription.service.js";
import {
  resetBlogSubscribersForTests,
  upsertBlogSubscriberRecord,
} from "../../../src/modules/blog/persistence/blog-subscriber.repository.js";
import { clearEmailAuditRecordsForTests } from "../../../src/modules/email/email.audit.js";
import {
  buildBlogListUnsubscribeHeaders,
  EMAIL_LIST_UNSUBSCRIBE_HEADER,
  EMAIL_LIST_UNSUBSCRIBE_POST_HEADER,
  EMAIL_LIST_UNSUBSCRIBE_POST_VALUE,
  EmailListHeaderValidationError,
  sanitizeEmailListUnsubscribeHeaders,
} from "../../../src/modules/email/email-list-headers.js";
import {
  sendLoginTwoStepCodeEmail,
  sendPasswordResetEmail,
  sendRegistrationVerificationEmail,
  sendTransactionalEmailAndAwait,
} from "../../../src/modules/email/email.service.js";
import { resetEmailProviderCacheForTests } from "../../../src/modules/email/email.provider.js";
import {
  disposeEmailWorkersForTests,
  drainEmailQueueForTests,
  resetMockEmailOutboxForTests,
} from "../../../src/modules/email/email-test-helpers.js";
import { MockEmailProvider } from "../../../src/modules/email/providers/mock.provider.js";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SYNTHETIC_TOKEN = "03a1-fixed-list-header-token-xyz";

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
  clearEmailAuditRecordsForTests();
}

function readApi(relativePath: string): string {
  return readFileSync(path.resolve(apiRoot, relativePath), "utf8");
}

describe("EMAIL DELIVERABILITY 03A.1 — list unsubscribe headers", () => {
  beforeEach(() => {
    restoreEnv();
    process.env.NODE_ENV = "test";
    process.env.NODE_TEST_ENV = "true";
    process.env.HU_VERIFICATION_MODE = "true";
    process.env.ALLOW_REAL_EMAIL_IN_TESTS = "false";
    process.env.EMAIL_PROVIDER = "mock";
    process.env.WEB_ORIGIN = "https://example.com";
    process.env.PUBLIC_SITE_URL = "https://example.com";
    process.env.BLOG_SUBSCRIBER_FORCE_MEMORY = "true";
    delete process.env.MONGODB_URI;
    delete process.env.MONGODB_DATABASE;
    delete process.env.MONGODB_TEST_DATABASE;
    resetBlogSubscribersForTests();
    resetMockEmailOutboxForTests();
  });

  afterEach(async () => {
    await drainEmailQueueForTests();
    disposeEmailWorkersForTests();
    restoreEnv();
  });

  it("sanitize accepts allowlisted pair and rejects CR/LF", () => {
    const ok = sanitizeEmailListUnsubscribeHeaders({
      [EMAIL_LIST_UNSUBSCRIBE_HEADER]: `<https://example.com/blog/subscribe/unsubscribe?token=${SYNTHETIC_TOKEN}>`,
      [EMAIL_LIST_UNSUBSCRIBE_POST_HEADER]: EMAIL_LIST_UNSUBSCRIBE_POST_VALUE,
    });
    assert.ok(ok);
    assert.equal(ok?.[EMAIL_LIST_UNSUBSCRIBE_POST_HEADER], EMAIL_LIST_UNSUBSCRIBE_POST_VALUE);

    assert.throws(
      () =>
        sanitizeEmailListUnsubscribeHeaders({
          [EMAIL_LIST_UNSUBSCRIBE_HEADER]: "<https://example.com/u>\r\nBcc: evil@example.com",
          [EMAIL_LIST_UNSUBSCRIBE_POST_HEADER]: EMAIL_LIST_UNSUBSCRIBE_POST_VALUE,
        }),
      EmailListHeaderValidationError,
    );
  });

  it("sanitize rejects prohibited identity/security overrides", () => {
    for (const name of ["From", "To", "Subject", "Message-ID", "Return-Path", "DKIM", "Reply-To"]) {
      assert.throws(
        () =>
          sanitizeEmailListUnsubscribeHeaders({
            [name]: "evil",
            [EMAIL_LIST_UNSUBSCRIBE_HEADER]: `<https://example.com/u?token=${SYNTHETIC_TOKEN}>`,
            [EMAIL_LIST_UNSUBSCRIBE_POST_HEADER]: EMAIL_LIST_UNSUBSCRIBE_POST_VALUE,
          } as Record<string, string>),
        EmailListHeaderValidationError,
      );
    }
  });

  it("buildBlogListUnsubscribeHeaders uses publicSiteUrl + synthetic token shape", () => {
    const headers = buildBlogListUnsubscribeHeaders(SYNTHETIC_TOKEN);
    const listUnsub = headers[EMAIL_LIST_UNSUBSCRIBE_HEADER];
    assert.equal(listUnsub.startsWith("<"), true);
    assert.equal(listUnsub.endsWith(">"), true);
    assert.equal(listUnsub.includes("/blog/subscribe/unsubscribe?token="), true);
    assert.equal(listUnsub.includes(encodeURIComponent(SYNTHETIC_TOKEN)), true);
    assert.equal(headers[EMAIL_LIST_UNSUBSCRIBE_POST_HEADER], EMAIL_LIST_UNSUBSCRIBE_POST_VALUE);
  });

  it("callers without list headers remain unchanged", async () => {
    await sendTransactionalEmailAndAwait({
      to: "plain@example.com",
      template: "security_alert",
      templateInput: {
        displayName: "A",
        alertTitle: "T",
        alertBody: "B",
      },
    });
    const sent = MockEmailProvider.sentMessages.at(-1);
    assert.equal(sent?.template, "security_alert");
    assert.equal(sent?.listHeaders, undefined);
  });

  it("Welcome receives both list headers", async () => {
    const now = new Date().toISOString();
    const confirmRaw = generateBlogSubscriptionRawToken();
    await upsertBlogSubscriberRecord({
      subscriberId: "sub-welcome-03a1",
      emailNormalized: "welcome03a1@example.com",
      emailDisplay: "welcome03a1@example.com",
      status: "not_confirmed",
      subscriptionType: "blog_publications",
      emailsSent: 0,
      confirmTokenHash: hashBlogSubscriptionToken("confirm", confirmRaw),
      confirmTokenExpiresAt: resolveBlogSubscriptionConfirmExpiresAt(),
      unsubscribeTokenHash: hashBlogSubscriptionToken(
        "unsubscribe",
        generateBlogSubscriptionRawToken(),
      ),
      createdAt: now,
      updatedAt: now,
    });

    await confirmBlogSubscription({ token: confirmRaw });
    const welcome = MockEmailProvider.sentMessages.find(
      (row) => row.template === "blog_subscription_welcome",
    );
    assert.ok(welcome);
    const listUnsub = welcome?.listHeaders?.[EMAIL_LIST_UNSUBSCRIBE_HEADER] ?? "";
    assert.equal(listUnsub.startsWith("<"), true);
    assert.equal(listUnsub.includes("/blog/subscribe/unsubscribe?token="), true);
    assert.equal(listUnsub.endsWith(">"), true);
    assert.equal(
      welcome?.listHeaders?.[EMAIL_LIST_UNSUBSCRIBE_POST_HEADER],
      EMAIL_LIST_UNSUBSCRIBE_POST_VALUE,
    );
  });

  it("confirmation / auth / password / 2FA do not receive list headers", async () => {
    await sendTransactionalEmailAndAwait({
      to: "confirm@example.com",
      template: "blog_subscription_confirm",
      templateInput: {
        confirmationUrl: "https://example.com/blog/subscribe/confirm?token=fixed-confirm",
        unsubscribeUrl: `https://example.com/blog/subscribe/unsubscribe?token=${SYNTHETIC_TOKEN}`,
      },
    });
    await sendRegistrationVerificationEmail({
      to: "verify@example.com",
      displayName: "V",
      verificationToken: "fixed-verify-token",
    });
    await drainEmailQueueForTests();
    await sendPasswordResetEmail({
      to: "reset@example.com",
      displayName: "R",
      resetToken: "fixed-reset-token",
    });
    await drainEmailQueueForTests();
    await sendLoginTwoStepCodeEmail({
      to: "otp@example.com",
      displayName: "O",
      loginCode: "123456",
      expiresMinutes: 10,
    });

    for (const template of [
      "blog_subscription_confirm",
      "registration_verification",
      "password_reset",
      "login_two_step_code",
    ] as const) {
      const row = MockEmailProvider.sentMessages.find((entry) => entry.template === template);
      assert.ok(row, `expected ${template}`);
      assert.equal(row?.listHeaders, undefined, `${template} must not have list headers`);
    }
  });

  it("digest send path includes listHeaders in default provider wiring", () => {
    const service = readApi("src/modules/blog/blog-publication-delivery.service.ts");
    assert.match(service, /buildBlogListUnsubscribeHeaders/);
    assert.match(service, /listHeaders:\s*buildBlogListUnsubscribeHeaders/);
    assert.match(service, /blog_publication_digest/);
  });

  it("SMTP and Resend providers forward approved headers field", () => {
    const smtp = readApi("src/modules/email/providers/smtp.provider.ts");
    const resend = readApi("src/modules/email/providers/resend.provider.ts");
    assert.match(smtp, /listHeaders/);
    assert.match(smtp, /headers:\s*\{\s*\.\.\.request\.listHeaders/);
    assert.match(resend, /listHeaders/);
    assert.match(resend, /headers:\s*\{\s*\.\.\.request\.listHeaders/);
  });

  it("mock provider captures listHeaders deterministically", async () => {
    const headers = buildBlogListUnsubscribeHeaders(SYNTHETIC_TOKEN);
    await sendTransactionalEmailAndAwait({
      to: "digest@example.com",
      template: "blog_publication_digest",
      templateInput: {
        title: "T",
        excerpt: "E",
        publicationUrl: "https://example.com/blog/p",
        unsubscribeUrl: `https://example.com/blog/subscribe/unsubscribe?token=${SYNTHETIC_TOKEN}`,
      },
      listHeaders: headers,
    });
    const sent = MockEmailProvider.sentMessages.at(-1);
    assert.equal(sent?.template, "blog_publication_digest");
    assert.deepEqual(sent?.listHeaders, headers);
  });

  it("tokens are not stored in email audit records", async () => {
    const headers = buildBlogListUnsubscribeHeaders(SYNTHETIC_TOKEN);
    const delivery = await sendTransactionalEmailAndAwait({
      to: "audit@example.com",
      template: "blog_publication_digest",
      templateInput: {
        title: "T",
        excerpt: "E",
        publicationUrl: "https://example.com/blog/p",
        unsubscribeUrl: `https://example.com/u?token=${SYNTHETIC_TOKEN}`,
      },
      listHeaders: headers,
    });
    assert.equal(delivery.emailSent, true);
    const { findEmailAuditRecordById } = await import(
      "../../../src/modules/email/email.audit.js"
    );
    const audit = await findEmailAuditRecordById(delivery.emailId);
    assert.ok(audit);
    const serialized = JSON.stringify(audit);
    assert.equal(serialized.includes(SYNTHETIC_TOKEN), false);
    assert.doesNotMatch(serialized, /List-Unsubscribe/);
  });

  it("sendTransactionalEmailAndAwait rejects injected prohibited headers", async () => {
    await assert.rejects(
      () =>
        sendTransactionalEmailAndAwait({
          to: "x@example.com",
          template: "security_alert",
          templateInput: {
            displayName: "A",
            alertTitle: "T",
            alertBody: "B",
          },
          listHeaders: {
            From: "attacker@evil.test",
            [EMAIL_LIST_UNSUBSCRIBE_HEADER]: `<https://example.com/u?token=${SYNTHETIC_TOKEN}>`,
            [EMAIL_LIST_UNSUBSCRIBE_POST_HEADER]: EMAIL_LIST_UNSUBSCRIBE_POST_VALUE,
          } as never,
        }),
      EmailListHeaderValidationError,
    );
  });
});
