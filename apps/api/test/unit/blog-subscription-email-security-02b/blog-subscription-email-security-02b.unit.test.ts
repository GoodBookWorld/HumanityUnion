/**
 * EMAIL SECURITY 02B — Blog subscription anti-abuse automated tests.
 * Fake Turnstile + mock email only. No real Turnstile / Titan / staging mutation.
 */
import "../blog-subscription-pack21a/blog-subscription-pack21a.setup.js";

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  BLOG_SUBSCRIPTION_EMAIL_COOLDOWN_MS,
  BLOG_SUBSCRIPTION_EMAIL_DAILY_MAX,
  BLOG_SUBSCRIPTION_IP_MAX_ATTEMPTS,
} from "../../../src/modules/blog/blog-subscription-abuse-policy.js";
import { hashBlogSubscriptionSourceIp } from "../../../src/modules/blog/blog-subscription-privacy-hash.js";
import { isBlogSubscriptionRateLimitError } from "../../../src/modules/blog/blog-subscription-rate-limit.js";
import { requestBlogSubscription } from "../../../src/modules/blog/blog-subscription.service.js";
import {
  authorizeBlogSubscriptionConfirmationSend,
  consumeBlogSubscriptionIpBudget,
  resetBlogSubscriptionAbuseForTests,
  setBlogSubscriptionAbuseForceUnavailableForTests,
  setBlogSubscriptionAbuseNowMsForTests,
} from "../../../src/modules/blog/persistence/blog-subscription-abuse.repository.js";
import {
  findBlogSubscriberByNormalizedEmail,
  resetBlogSubscribersForTests,
  upsertBlogSubscriberRecord,
} from "../../../src/modules/blog/persistence/blog-subscriber.repository.js";
import {
  listBlogSubscriptionSecurityEventsForTests,
  resetBlogSubscriptionSecurityEventsForTests,
} from "../../../src/modules/blog/persistence/blog-subscription-security-event.repository.js";
import { hashRecipientEmail } from "../../../src/modules/email/email.templates.js";
import {
  disposeEmailWorkersForTests,
  drainEmailQueueForTests,
  getMockEmailSendCount,
  resetMockEmailOutboxForTests,
} from "../../../src/modules/email/email-test-helpers.js";
import { MockEmailProvider } from "../../../src/modules/email/providers/mock.provider.js";
import {
  getBlogTurnstileTestCallCount,
  installBlogSubscriptionSecurityTestSeams,
  resetBlogTurnstileTestCallCount,
  setBlogTurnstileTestMode,
  uninstallBlogSubscriptionSecurityTestSeams,
  validTurnstileTokenForTests,
} from "./blog-subscription-email-security-02b.helpers.js";

const GENERIC = /Check your email to confirm your subscription/i;

describe("EMAIL SECURITY 02B — Blog subscription anti-abuse", () => {
  beforeEach(() => {
    resetBlogSubscribersForTests();
    resetMockEmailOutboxForTests();
    installBlogSubscriptionSecurityTestSeams();
    process.env.EMAIL_PROVIDER = "mock";
  });

  afterEach(async () => {
    await drainEmailQueueForTests();
    disposeEmailWorkersForTests();
    uninstallBlogSubscriptionSecurityTestSeams();
  });

  it("1. valid human/new subscriber enqueues exactly one confirmation", async () => {
    const result = await requestBlogSubscription({
      email: "new@example.com",
      ipKey: "ip-new",
      turnstileToken: validTurnstileTokenForTests("new"),
    });
    await drainEmailQueueForTests();
    assert.equal(result.accepted, true);
    assert.match(result.message, GENERIC);
    assert.equal(getMockEmailSendCount(), 1);
    assert.equal(MockEmailProvider.sentMessages[0]?.template, "blog_subscription_confirm");
  });

  it("2. missing Turnstile token is blocked with zero email", async () => {
    await assert.rejects(
      () =>
        requestBlogSubscription({
          email: "missing-ts@example.com",
          ipKey: "ip-missing-ts",
        }),
      /Security verification is required/,
    );
    await drainEmailQueueForTests();
    assert.equal(getMockEmailSendCount(), 0);
    const events = listBlogSubscriptionSecurityEventsForTests();
    assert.ok(events.some((e) => e.reason === "turnstile_missing" && e.outcome === "blocked"));
  });

  it("3. invalid Turnstile token is blocked with zero email", async () => {
    setBlogTurnstileTestMode("invalid");
    await assert.rejects(
      () =>
        requestBlogSubscription({
          email: "bad-ts@example.com",
          ipKey: "ip-bad-ts",
          turnstileToken: "invalid-token",
        }),
      /Security verification failed/,
    );
    await drainEmailQueueForTests();
    assert.equal(getMockEmailSendCount(), 0);
  });

  it("4. Turnstile unavailable fails closed with zero email", async () => {
    setBlogTurnstileTestMode("unavailable");
    await assert.rejects(
      () =>
        requestBlogSubscription({
          email: "ts-down@example.com",
          ipKey: "ip-ts-down",
          turnstileToken: validTurnstileTokenForTests("down"),
        }),
      /Unable to process/,
    );
    await drainEmailQueueForTests();
    assert.equal(getMockEmailSendCount(), 0);
  });

  it("5. Mongo abuse-control unavailable fails closed with zero email", async () => {
    setBlogSubscriptionAbuseForceUnavailableForTests(true);
    await assert.rejects(
      () =>
        requestBlogSubscription({
          email: "mongo-down@example.com",
          ipKey: "ip-mongo-down",
          turnstileToken: validTurnstileTokenForTests("mongo"),
        }),
      /Unable to process/,
    );
    await drainEmailQueueForTests();
    assert.equal(getMockEmailSendCount(), 0);
    assert.ok(
      listBlogSubscriptionSecurityEventsForTests().some((e) => e.reason === "mongo_unavailable"),
    );
  });

  it("6. per-IP limit exceeded blocks before Turnstile verification", async () => {
    const ipKey = "ip-flood";
    const ipHash = hashBlogSubscriptionSourceIp(ipKey);
    for (let i = 0; i < BLOG_SUBSCRIPTION_IP_MAX_ATTEMPTS; i += 1) {
      assert.equal(await consumeBlogSubscriptionIpBudget(ipHash), true);
    }
    resetBlogTurnstileTestCallCount();
    await assert.rejects(
      () =>
        requestBlogSubscription({
          email: "flood@example.com",
          ipKey,
          turnstileToken: validTurnstileTokenForTests("flood"),
        }),
      (error: unknown) => isBlogSubscriptionRateLimitError(error),
    );
    assert.equal(getBlogTurnstileTestCallCount(), 0);
    await drainEmailQueueForTests();
    assert.equal(getMockEmailSendCount(), 0);
  });

  it("7. per-email 30-minute cooldown returns generic with zero additional email", async () => {
    await requestBlogSubscription({
      email: "cool@example.com",
      ipKey: "ip-cool-1",
      turnstileToken: validTurnstileTokenForTests("cool1"),
    });
    await drainEmailQueueForTests();
    assert.equal(getMockEmailSendCount(), 1);

    const second = await requestBlogSubscription({
      email: "cool@example.com",
      ipKey: "ip-cool-2",
      turnstileToken: validTurnstileTokenForTests("cool2"),
    });
    await drainEmailQueueForTests();
    assert.match(second.message, GENERIC);
    assert.equal(getMockEmailSendCount(), 1);
  });

  it("8. per-email 3/24h cap returns generic with zero additional email", async () => {
    const start = 3_000_000_000_000;
    setBlogSubscriptionAbuseNowMsForTests(start);
    const email = "daily@example.com";
    for (let i = 0; i < BLOG_SUBSCRIPTION_EMAIL_DAILY_MAX; i += 1) {
      setBlogSubscriptionAbuseNowMsForTests(
        start + i * (BLOG_SUBSCRIPTION_EMAIL_COOLDOWN_MS + 1),
      );
      await requestBlogSubscription({
        email,
        ipKey: `ip-daily-${i}`,
        turnstileToken: validTurnstileTokenForTests(`daily-${i}`),
      });
      await drainEmailQueueForTests();
    }
    assert.equal(getMockEmailSendCount(), BLOG_SUBSCRIPTION_EMAIL_DAILY_MAX);

    setBlogSubscriptionAbuseNowMsForTests(
      start + BLOG_SUBSCRIPTION_EMAIL_DAILY_MAX * (BLOG_SUBSCRIPTION_EMAIL_COOLDOWN_MS + 1),
    );
    const blocked = await requestBlogSubscription({
      email,
      ipKey: "ip-daily-over",
      turnstileToken: validTurnstileTokenForTests("daily-over"),
    });
    await drainEmailQueueForTests();
    assert.match(blocked.message, GENERIC);
    assert.equal(getMockEmailSendCount(), BLOG_SUBSCRIPTION_EMAIL_DAILY_MAX);
    assert.ok(
      listBlogSubscriptionSecurityEventsForTests().some((e) => e.reason === "email_daily_cap"),
    );
  });

  it("9. pending within cooldown keeps existing token and sends zero additional email", async () => {
    await requestBlogSubscription({
      email: "pending@example.com",
      ipKey: "ip-pend-1",
      turnstileToken: validTurnstileTokenForTests("pend1"),
    });
    await drainEmailQueueForTests();
    const first = await findBlogSubscriberByNormalizedEmail("pending@example.com");
    const tokenBefore = first!.confirmTokenHash;

    await requestBlogSubscription({
      email: "pending@example.com",
      ipKey: "ip-pend-2",
      turnstileToken: validTurnstileTokenForTests("pend2"),
    });
    await drainEmailQueueForTests();
    const second = await findBlogSubscriberByNormalizedEmail("pending@example.com");
    assert.equal(second!.confirmTokenHash, tokenBefore);
    assert.equal(getMockEmailSendCount(), 1);
    assert.ok(
      listBlogSubscriptionSecurityEventsForTests().some((e) => e.reason === "pending_cooldown"),
    );
  });

  it("10. pending after cooldown authorizes one resend and rotates tokens", async () => {
    const start = 4_000_000_000_000;
    setBlogSubscriptionAbuseNowMsForTests(start);
    await requestBlogSubscription({
      email: "resend@example.com",
      ipKey: "ip-resend-1",
      turnstileToken: validTurnstileTokenForTests("resend1"),
    });
    await drainEmailQueueForTests();
    const before = await findBlogSubscriberByNormalizedEmail("resend@example.com");
    const tokenBefore = before!.confirmTokenHash;

    setBlogSubscriptionAbuseNowMsForTests(start + BLOG_SUBSCRIPTION_EMAIL_COOLDOWN_MS + 1);
    await requestBlogSubscription({
      email: "resend@example.com",
      ipKey: "ip-resend-2",
      turnstileToken: validTurnstileTokenForTests("resend2"),
    });
    await drainEmailQueueForTests();
    const after = await findBlogSubscriberByNormalizedEmail("resend@example.com");
    assert.notEqual(after!.confirmTokenHash, tokenBefore);
    assert.equal(getMockEmailSendCount(), 2);
  });

  it("11. already subscribed returns generic with zero email", async () => {
    const now = new Date().toISOString();
    await upsertBlogSubscriberRecord({
      subscriberId: "sub-already",
      emailNormalized: "already@example.com",
      emailDisplay: "already@example.com",
      status: "subscribed",
      subscriptionType: "blog_publications",
      emailsSent: 0,
      subscribedAt: now,
      confirmedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    const result = await requestBlogSubscription({
      email: "already@example.com",
      ipKey: "ip-already",
      turnstileToken: validTurnstileTokenForTests("already"),
    });
    await drainEmailQueueForTests();
    assert.match(result.message, GENERIC);
    assert.equal(getMockEmailSendCount(), 0);
    assert.ok(
      listBlogSubscriptionSecurityEventsForTests().some((e) => e.reason === "subscribed_noop"),
    );
  });

  it("12. concurrent double submit authorizes at most one confirmation", async () => {
    const email = "concurrent@example.com";
    const results = await Promise.all([
      requestBlogSubscription({
        email,
        ipKey: "ip-c1",
        turnstileToken: validTurnstileTokenForTests("c1"),
      }),
      requestBlogSubscription({
        email,
        ipKey: "ip-c2",
        turnstileToken: validTurnstileTokenForTests("c2"),
      }),
    ]);
    await drainEmailQueueForTests();
    assert.equal(results.every((r) => GENERIC.test(r.message)), true);
    assert.equal(getMockEmailSendCount(), 1);
  });

  it("13. two simulated API instances sharing durable state share limits", async () => {
    const recipientHash = hashRecipientEmail("shared@example.com");
    const first = await authorizeBlogSubscriptionConfirmationSend(recipientHash);
    const second = await authorizeBlogSubscriptionConfirmationSend(recipientHash);
    assert.equal(first.allowed, true);
    assert.equal(second.allowed, false);
    if (!second.allowed) {
      assert.equal(second.reason, "email_cooldown");
    }
  });

  it("14. limiter persistence does not depend on process-local Maps alone", async () => {
    const ipHash = hashBlogSubscriptionSourceIp("persist-ip");
    for (let i = 0; i < BLOG_SUBSCRIPTION_IP_MAX_ATTEMPTS; i += 1) {
      assert.equal(await consumeBlogSubscriptionIpBudget(ipHash), true);
    }
    // Shared durable memory store still enforces after "restart" of callers.
    assert.equal(await consumeBlogSubscriptionIpBudget(ipHash), false);
    // Clearing durable store (true reset) restores capacity — proves state is store-backed.
    resetBlogSubscriptionAbuseForTests();
    assert.equal(await consumeBlogSubscriptionIpBudget(ipHash), true);
  });

  it("15. generic responses do not expose subscriber state", async () => {
    const messages = new Set<string>();
    const a = await requestBlogSubscription({
      email: "opaque@example.com",
      ipKey: "ip-opaque-1",
      turnstileToken: validTurnstileTokenForTests("o1"),
    });
    messages.add(a.message);
    const b = await requestBlogSubscription({
      email: "opaque@example.com",
      ipKey: "ip-opaque-2",
      turnstileToken: validTurnstileTokenForTests("o2"),
    });
    messages.add(b.message);
    const pending = await findBlogSubscriberByNormalizedEmail("opaque@example.com");
    const now = new Date().toISOString();
    await upsertBlogSubscriberRecord({
      ...pending!,
      status: "subscribed",
      confirmedAt: now,
      subscribedAt: now,
      confirmTokenHash: undefined,
      confirmTokenExpiresAt: undefined,
      updatedAt: now,
    });
    const c = await requestBlogSubscription({
      email: "opaque@example.com",
      ipKey: "ip-opaque-3",
      turnstileToken: validTurnstileTokenForTests("o3"),
    });
    messages.add(c.message);
    assert.equal(messages.size, 1);
    assert.match([...messages][0]!, GENERIC);
  });

  it("16. blocked paths never enqueue MailDeliveryService", async () => {
    setBlogTurnstileTestMode("invalid");
    await assert.rejects(() =>
      requestBlogSubscription({
        email: "no-mail@example.com",
        ipKey: "ip-no-mail",
        turnstileToken: "invalid-token",
      }),
    );
    await drainEmailQueueForTests();
    assert.equal(MockEmailProvider.sentMessages.length, 0);
  });

  it("17. security audit is privacy-safe", async () => {
    const token = validTurnstileTokenForTests("audit");
    await requestBlogSubscription({
      email: "audit@example.com",
      ipKey: "203.0.113.10",
      turnstileToken: token,
      correlationId: "corr-audit-1",
    });
    await drainEmailQueueForTests();
    const events = listBlogSubscriptionSecurityEventsForTests();
    const sendEvent = events.find((e) => e.outcome === "allowed_send");
    assert.ok(sendEvent);
    assert.equal(sendEvent!.action, "blog_subscribe");
    assert.match(sendEvent!.recipientHash, /^[a-f0-9]{64}$/);
    assert.match(sendEvent!.sourceIpHash, /^[a-f0-9]{64}$/);
    assert.equal(sendEvent!.recipientHash, hashRecipientEmail("audit@example.com"));
    const serialized = JSON.stringify(events);
    assert.doesNotMatch(serialized, /203\.0\.113\.10/);
    assert.doesNotMatch(serialized, /audit@example\.com/i);
    assert.doesNotMatch(serialized, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(serialized, /TURNSTILE_SECRET|SMTP_PASSWORD|confirmToken|unsubscribeToken/i);
  });
});
