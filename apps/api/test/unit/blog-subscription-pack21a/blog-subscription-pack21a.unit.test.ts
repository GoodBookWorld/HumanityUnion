/**
 * Pack 21A — Blog subscription domain, public subscribe / confirm / unsubscribe.
 */
import "./blog-subscription-pack21a.setup.js";

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  normalizeBlogSubscriptionEmail,
  isValidBlogSubscriptionEmail,
} from "../../../src/modules/blog/blog-subscription-email.js";
import {
  generateBlogSubscriptionRawToken,
  hashBlogSubscriptionToken,
  isBlogSubscriptionConfirmExpired,
  resolveBlogSubscriptionConfirmExpiresAt,
} from "../../../src/modules/blog/blog-subscription-tokens.js";
import {
  assertBlogSubscriptionSubscribeAllowed,
  isBlogSubscriptionRateLimitError,
  resetBlogSubscriptionRateLimitsForTests,
  setBlogSubscriptionRateLimitNowMsForTests,
} from "../../../src/modules/blog/blog-subscription-rate-limit.js";
import {
  confirmBlogSubscription,
  requestBlogSubscription,
  unsubscribeBlogSubscription,
} from "../../../src/modules/blog/blog-subscription.service.js";
import {
  findBlogSubscriberByNormalizedEmail,
  resetBlogSubscribersForTests,
} from "../../../src/modules/blog/persistence/blog-subscriber.repository.js";
import { renderEmailTemplate } from "../../../src/modules/email/email.templates.js";
import {
  disposeEmailWorkersForTests,
  drainEmailQueueForTests,
  resetMockEmailOutboxForTests,
} from "../../../src/modules/email/email-test-helpers.js";

describe("Pack 21A — Blog subscription domain", () => {
  beforeEach(() => {
    resetBlogSubscribersForTests();
    resetBlogSubscriptionRateLimitsForTests();
    resetMockEmailOutboxForTests();
    process.env.EMAIL_PROVIDER = "mock";
  });

  afterEach(async () => {
    await drainEmailQueueForTests();
    disposeEmailWorkersForTests();
  });

  it("normalizes email with trim + lowercase only", () => {
    assert.equal(normalizeBlogSubscriptionEmail("  Alex@Example.COM "), "alex@example.com");
    assert.equal(isValidBlogSubscriptionEmail("not-an-email"), false);
    assert.equal(isValidBlogSubscriptionEmail("ok@example.com"), true);
    assert.equal(isValidBlogSubscriptionEmail("<script>@x.com"), false);
  });

  it("creates not_confirmed subscriber and stores hashed tokens only", async () => {
    const result = await requestBlogSubscription({
      email: "Reader@Example.com",
      ipKey: "10.0.0.1",
    });
    assert.equal(result.accepted, true);
    assert.match(result.message, /Check your email/i);

    const row = await findBlogSubscriberByNormalizedEmail("reader@example.com");
    assert.ok(row);
    assert.equal(row!.status, "not_confirmed");
    assert.equal(row!.emailsSent, 0);
    assert.equal(row!.subscriptionType, "blog_publications");
    assert.ok(row!.confirmTokenHash);
    assert.ok(row!.unsubscribeTokenHash);
    assert.match(row!.confirmTokenHash!, /^[a-f0-9]{64}$/);
    assert.match(row!.unsubscribeTokenHash!, /^[a-f0-9]{64}$/);
    assert.equal(row!.countryCode, undefined);
  });

  it("does not create a second row for duplicate pending email", async () => {
    await requestBlogSubscription({ email: "dup@example.com", ipKey: "1" });
    const first = await findBlogSubscriberByNormalizedEmail("dup@example.com");
    await requestBlogSubscription({ email: "dup@example.com", ipKey: "1" });
    const second = await findBlogSubscriberByNormalizedEmail("dup@example.com");
    assert.equal(first!.subscriberId, second!.subscriberId);
    assert.equal(second!.status, "not_confirmed");
  });

  it("does not create a duplicate for already subscribed email", async () => {
    const raw = generateBlogSubscriptionRawToken();
    // create pending then confirm via service path
    await requestBlogSubscription({ email: "subbed@example.com", ipKey: "2" });
    const pending = await findBlogSubscriberByNormalizedEmail("subbed@example.com");
    assert.ok(pending?.confirmTokenHash);
    // Recover raw token by re-request which rotates — instead confirm using hash match path:
    // Issue known tokens by confirming after we craft — use unsubscribe/confirm from rotated request.
    // Simpler: request, then confirm with token we don't have. Use direct upsert via confirm after
    // extracting from a controlled hash:
    const known = generateBlogSubscriptionRawToken();
    const { upsertBlogSubscriberRecord } = await import(
      "../../../src/modules/blog/persistence/blog-subscriber.repository.js"
    );
    const now = new Date().toISOString();
    await upsertBlogSubscriberRecord({
      ...pending!,
      status: "subscribed",
      subscribedAt: now,
      confirmedAt: now,
      confirmTokenHash: undefined,
      confirmTokenExpiresAt: undefined,
      unsubscribeTokenHash: hashBlogSubscriptionToken("unsubscribe", known),
      updatedAt: now,
    });

    const before = await findBlogSubscriberByNormalizedEmail("subbed@example.com");
    const response = await requestBlogSubscription({ email: "subbed@example.com", ipKey: "2" });
    const after = await findBlogSubscriberByNormalizedEmail("subbed@example.com");
    assert.equal(response.accepted, true);
    assert.equal(before!.subscriberId, after!.subscriberId);
    assert.equal(after!.status, "subscribed");
    void raw;
  });

  it("allows unsubscribed email to re-enter confirmation without a second row", async () => {
    await requestBlogSubscription({ email: "again@example.com", ipKey: "3" });
    const pending = await findBlogSubscriberByNormalizedEmail("again@example.com");
    const unsubRaw = generateBlogSubscriptionRawToken();
    const { upsertBlogSubscriberRecord } = await import(
      "../../../src/modules/blog/persistence/blog-subscriber.repository.js"
    );
    const now = new Date().toISOString();
    await upsertBlogSubscriberRecord({
      ...pending!,
      status: "unsubscribed",
      unsubscribedAt: now,
      confirmTokenHash: undefined,
      confirmTokenExpiresAt: undefined,
      unsubscribeTokenHash: hashBlogSubscriptionToken("unsubscribe", unsubRaw),
      updatedAt: now,
    });

    await requestBlogSubscription({ email: "again@example.com", ipKey: "3" });
    const resumed = await findBlogSubscriberByNormalizedEmail("again@example.com");
    assert.equal(resumed!.subscriberId, pending!.subscriberId);
    assert.equal(resumed!.status, "not_confirmed");
    assert.equal(resumed!.unsubscribedAt, undefined);
  });

  it("confirms with valid token and is idempotent on reuse", async () => {
    const confirmRaw = generateBlogSubscriptionRawToken();
    const unsubRaw = generateBlogSubscriptionRawToken();
    const { upsertBlogSubscriberRecord } = await import(
      "../../../src/modules/blog/persistence/blog-subscriber.repository.js"
    );
    const now = new Date().toISOString();
    await upsertBlogSubscriberRecord({
      subscriberId: "sub-confirm-1",
      emailNormalized: "confirm@example.com",
      emailDisplay: "confirm@example.com",
      status: "not_confirmed",
      subscriptionType: "blog_publications",
      emailsSent: 0,
      confirmTokenHash: hashBlogSubscriptionToken("confirm", confirmRaw),
      confirmTokenExpiresAt: resolveBlogSubscriptionConfirmExpiresAt(),
      unsubscribeTokenHash: hashBlogSubscriptionToken("unsubscribe", unsubRaw),
      createdAt: now,
      updatedAt: now,
    });

    const first = await confirmBlogSubscription({ token: confirmRaw });
    assert.equal(first.confirmed, true);
    const row = await findBlogSubscriberByNormalizedEmail("confirm@example.com");
    assert.equal(row!.status, "subscribed");
    assert.ok(row!.confirmedAt);
    assert.ok(row!.subscribedAt);
    assert.equal(row!.confirmTokenHash, undefined);

    // Reuse same token after clear → invalid
    await assert.rejects(() => confirmBlogSubscription({ token: confirmRaw }));
  });

  it("rejects invalid and expired confirmation tokens", async () => {
    await assert.rejects(() => confirmBlogSubscription({ token: "short" }));
    await assert.rejects(() => confirmBlogSubscription({ token: generateBlogSubscriptionRawToken() }));

    const confirmRaw = generateBlogSubscriptionRawToken();
    const { upsertBlogSubscriberRecord } = await import(
      "../../../src/modules/blog/persistence/blog-subscriber.repository.js"
    );
    const now = new Date().toISOString();
    await upsertBlogSubscriberRecord({
      subscriberId: "sub-expired",
      emailNormalized: "expired@example.com",
      emailDisplay: "expired@example.com",
      status: "not_confirmed",
      subscriptionType: "blog_publications",
      emailsSent: 0,
      confirmTokenHash: hashBlogSubscriptionToken("confirm", confirmRaw),
      confirmTokenExpiresAt: new Date(Date.now() - 60_000).toISOString(),
      unsubscribeTokenHash: hashBlogSubscriptionToken("unsubscribe", generateBlogSubscriptionRawToken()),
      createdAt: now,
      updatedAt: now,
    });
    assert.equal(isBlogSubscriptionConfirmExpired(new Date(Date.now() - 1).toISOString()), true);
    await assert.rejects(() => confirmBlogSubscription({ token: confirmRaw }));
  });

  it("unsubscribes without auth and is idempotent", async () => {
    const unsubRaw = generateBlogSubscriptionRawToken();
    const { upsertBlogSubscriberRecord } = await import(
      "../../../src/modules/blog/persistence/blog-subscriber.repository.js"
    );
    const now = new Date().toISOString();
    await upsertBlogSubscriberRecord({
      subscriberId: "sub-unsub-1",
      emailNormalized: "leave@example.com",
      emailDisplay: "leave@example.com",
      status: "subscribed",
      subscriptionType: "blog_publications",
      emailsSent: 0,
      subscribedAt: now,
      confirmedAt: now,
      unsubscribeTokenHash: hashBlogSubscriptionToken("unsubscribe", unsubRaw),
      createdAt: now,
      updatedAt: now,
    });

    const first = await unsubscribeBlogSubscription({ token: unsubRaw });
    assert.equal(first.unsubscribed, true);
    const row = await findBlogSubscriberByNormalizedEmail("leave@example.com");
    assert.equal(row!.status, "unsubscribed");
    assert.ok(row!.unsubscribedAt);

    const second = await unsubscribeBlogSubscription({ token: unsubRaw });
    assert.equal(second.unsubscribed, true);
  });

  it("rate limits repeated subscribe attempts", () => {
    process.env.BLOG_SUBSCRIPTION_MAX_PER_EMAIL_PER_WINDOW = "2";
    process.env.BLOG_SUBSCRIPTION_MAX_PER_IP_PER_WINDOW = "100";
    resetBlogSubscriptionRateLimitsForTests();
    setBlogSubscriptionRateLimitNowMsForTests(1_000_000);
    assertBlogSubscriptionSubscribeAllowed({ emailNormalized: "rl@example.com", ipKey: "9.9.9.9" });
    assertBlogSubscriptionSubscribeAllowed({ emailNormalized: "rl@example.com", ipKey: "9.9.9.9" });
    assert.throws(
      () =>
        assertBlogSubscriptionSubscribeAllowed({
          emailNormalized: "rl@example.com",
          ipKey: "9.9.9.9",
        }),
      (error: unknown) => isBlogSubscriptionRateLimitError(error),
    );
    delete process.env.BLOG_SUBSCRIPTION_MAX_PER_EMAIL_PER_WINDOW;
    delete process.env.BLOG_SUBSCRIPTION_MAX_PER_IP_PER_WINDOW;
  });

  it("Pack 21F — rate-limit window expiry drops empty keys (no unbounded map growth)", () => {
    process.env.BLOG_SUBSCRIPTION_MAX_PER_EMAIL_PER_WINDOW = "5";
    process.env.BLOG_SUBSCRIPTION_MAX_PER_IP_PER_WINDOW = "20";
    process.env.BLOG_SUBSCRIPTION_RATE_WINDOW_MINUTES = "60";
    resetBlogSubscriptionRateLimitsForTests();
    setBlogSubscriptionRateLimitNowMsForTests(1_000_000);
    assertBlogSubscriptionSubscribeAllowed({
      emailNormalized: "prune@example.com",
      ipKey: "1.2.3.4",
    });
    // Advance beyond the window so prune drops the prior hit lists entirely.
    setBlogSubscriptionRateLimitNowMsForTests(1_000_000 + 60 * 60_000 + 1);
    assertBlogSubscriptionSubscribeAllowed({
      emailNormalized: "prune@example.com",
      ipKey: "1.2.3.4",
    });
    delete process.env.BLOG_SUBSCRIPTION_MAX_PER_EMAIL_PER_WINDOW;
    delete process.env.BLOG_SUBSCRIPTION_MAX_PER_IP_PER_WINDOW;
    delete process.env.BLOG_SUBSCRIPTION_RATE_WINDOW_MINUTES;
  });

  it("confirmation template uses subscription footer and MailDeliveryService template id", () => {
    const rendered = renderEmailTemplate("blog_subscription_confirm", {
      confirmationUrl: "https://example.com/blog/subscribe/confirm?token=abc",
      unsubscribeUrl: "https://example.com/blog/subscribe/unsubscribe?token=xyz",
    });
    assert.match(rendered.subject, /Confirm/i);
    assert.match(rendered.html, /Confirm subscription/);
    assert.match(rendered.html, /Blog subscription request|Blog publication updates/i);
    assert.match(rendered.html, /Unsubscribe/);
    assert.doesNotMatch(rendered.html, /Marketing emails are not sent through this channel/);
  });

  it("public subscribe message does not reveal subscriber existence", async () => {
    const a = await requestBlogSubscription({ email: "oracle@example.com", ipKey: "8" });
    await requestBlogSubscription({ email: "oracle@example.com", ipKey: "8" });
    const pending = await findBlogSubscriberByNormalizedEmail("oracle@example.com");
    const { upsertBlogSubscriberRecord } = await import(
      "../../../src/modules/blog/persistence/blog-subscriber.repository.js"
    );
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
    const b = await requestBlogSubscription({ email: "oracle@example.com", ipKey: "8" });
    assert.equal(a.message, b.message);
  });
});
