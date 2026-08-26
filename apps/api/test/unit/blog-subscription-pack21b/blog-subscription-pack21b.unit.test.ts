/**
 * Pack 21B — Welcome Message settings + Welcome email after confirmation.
 *
 * Product rules documented here:
 * - Welcome sends only on not_confirmed → subscribed.
 * - Send-once via welcomeSentAt for the current confirmed lifecycle.
 * - Re-subscribe (unsubscribed → not_confirmed → confirm) starts a new lifecycle
 *   and may receive a new Welcome (welcomeSentAt cleared when re-entering pending).
 * - Confirmation email does not increment emailsSent.
 * - Welcome increments emailsSent only after successful send.
 * - Welcome failure does not roll back subscribed status.
 */
import "./blog-subscription-pack21b.setup.js";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { AdministrationForbiddenError } from "../../../src/modules/administration/administration.errors.js";
import {
  getAdminBlogSubscriptionSettings,
  resolveEffectiveBlogSubscriptionWelcomeMessage,
  setBlogSubscriptionSettingsAdminActorOverrideForTests,
  updateAdminBlogSubscriptionSettings,
} from "../../../src/modules/blog/blog-subscription-settings.admin.service.js";
import {
  DEFAULT_BLOG_SUBSCRIPTION_WELCOME_MESSAGE,
  sanitizeBlogSubscriptionWelcomeMessage,
} from "../../../src/modules/blog/blog-subscription-welcome.js";
import {
  generateBlogSubscriptionRawToken,
  hashBlogSubscriptionToken,
  resolveBlogSubscriptionConfirmExpiresAt,
} from "../../../src/modules/blog/blog-subscription-tokens.js";
import {
  confirmBlogSubscription,
  requestBlogSubscription,
  unsubscribeBlogSubscription,
} from "../../../src/modules/blog/blog-subscription.service.js";
import { resetBlogSubscriptionRateLimitsForTests } from "../../../src/modules/blog/blog-subscription-rate-limit.js";
import {
  findBlogSubscriberByNormalizedEmail,
  resetBlogSubscribersForTests,
  upsertBlogSubscriberRecord,
} from "../../../src/modules/blog/persistence/blog-subscriber.repository.js";
import { resetBlogSubscriptionSettingsForTests } from "../../../src/modules/blog/persistence/blog-subscription-settings.repository.js";
import { renderEmailTemplate } from "../../../src/modules/email/email.templates.js";
import {
  disposeEmailWorkersForTests,
  drainEmailQueueForTests,
  resetMockEmailOutboxForTests,
} from "../../../src/modules/email/email-test-helpers.js";
import { MockEmailProvider } from "../../../src/modules/email/providers/mock.provider.js";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readApi(relativePath: string): string {
  return readFileSync(path.resolve(apiRoot, relativePath), "utf8");
}

describe("Pack 21B — Welcome settings & Welcome email", () => {
  beforeEach(() => {
    resetBlogSubscribersForTests();
    resetBlogSubscriptionSettingsForTests();
    resetBlogSubscriptionRateLimitsForTests();
    resetMockEmailOutboxForTests();
    setBlogSubscriptionSettingsAdminActorOverrideForTests(null);
    process.env.EMAIL_PROVIDER = "mock";
  });

  afterEach(async () => {
    setBlogSubscriptionSettingsAdminActorOverrideForTests(null);
    await drainEmailQueueForTests();
    disposeEmailWorkersForTests();
  });

  it("uses default Welcome Message when no settings record exists", async () => {
    const message = await resolveEffectiveBlogSubscriptionWelcomeMessage();
    assert.equal(message, DEFAULT_BLOG_SUBSCRIPTION_WELCOME_MESSAGE);
    assert.match(message, /Humanity Union Blog/i);
  });

  it("Admin can read settings (default when unset)", async () => {
    setBlogSubscriptionSettingsAdminActorOverrideForTests({
      userId: "admin-1",
      participantId: "participant-admin-1",
      role: "admin",
    });
    const settings = await getAdminBlogSubscriptionSettings({ actorUserId: "admin-1" });
    assert.equal(settings.isDefault, true);
    assert.equal(settings.welcomeMessage, DEFAULT_BLOG_SUBSCRIPTION_WELCOME_MESSAGE);
  });

  it("non-Admin cannot update settings", async () => {
    setBlogSubscriptionSettingsAdminActorOverrideForTests({
      userId: "member-1",
      participantId: "participant-member-1",
      role: "member",
    });
    await assert.rejects(
      () =>
        updateAdminBlogSubscriptionSettings({
          actorUserId: "member-1",
          body: { welcomeMessage: "Hello subscribers." },
        }),
      AdministrationForbiddenError,
    );
  });

  it("Admin can save Welcome Message", async () => {
    setBlogSubscriptionSettingsAdminActorOverrideForTests({
      userId: "admin-1",
      participantId: "participant-admin-1",
      role: "admin",
    });
    const saved = await updateAdminBlogSubscriptionSettings({
      actorUserId: "admin-1",
      body: { welcomeMessage: "  Thanks for following Humanity Union Blog.  " },
    });
    assert.equal(saved.isDefault, false);
    assert.equal(saved.welcomeMessage, "Thanks for following Humanity Union Blog.");
    assert.equal(await resolveEffectiveBlogSubscriptionWelcomeMessage(), saved.welcomeMessage);

    const readBack = await getAdminBlogSubscriptionSettings({ actorUserId: "admin-1" });
    assert.equal(readBack.welcomeMessage, saved.welcomeMessage);
    assert.equal(readBack.isDefault, false);
  });

  it("rejects HTML/script Welcome Message content", () => {
    assert.throws(() => sanitizeBlogSubscriptionWelcomeMessage("<script>alert(1)</script>"));
    assert.throws(() => sanitizeBlogSubscriptionWelcomeMessage("Hello <b>there</b>"));
    assert.throws(() => sanitizeBlogSubscriptionWelcomeMessage(""));
    assert.equal(sanitizeBlogSubscriptionWelcomeMessage("  Plain text ok.  "), "Plain text ok.");
  });

  it("successful confirmation sends Welcome via MailDeliveryService", async () => {
    const confirmRaw = generateBlogSubscriptionRawToken();
    const unsubRaw = generateBlogSubscriptionRawToken();
    const now = new Date().toISOString();
    await upsertBlogSubscriberRecord({
      subscriberId: "sub-welcome-1",
      emailNormalized: "welcome@example.com",
      emailDisplay: "welcome@example.com",
      status: "not_confirmed",
      subscriptionType: "blog_publications",
      emailsSent: 0,
      confirmTokenHash: hashBlogSubscriptionToken("confirm", confirmRaw),
      confirmTokenExpiresAt: resolveBlogSubscriptionConfirmExpiresAt(),
      unsubscribeTokenHash: hashBlogSubscriptionToken("unsubscribe", unsubRaw),
      createdAt: now,
      updatedAt: now,
    });

    const result = await confirmBlogSubscription({ token: confirmRaw });
    assert.equal(result.confirmed, true);

    const welcomeMails = MockEmailProvider.sentMessages.filter(
      (row) => row.template === "blog_subscription_welcome",
    );
    assert.equal(welcomeMails.length, 1);
    assert.match(welcomeMails[0]!.html, /Humanity Union/i);
    assert.match(welcomeMails[0]!.html, /subscription is now active/i);
    assert.match(welcomeMails[0]!.html, /Unsubscribe/i);
    assert.match(welcomeMails[0]!.text, /Unsubscribe:/i);

    const row = await findBlogSubscriberByNormalizedEmail("welcome@example.com");
    assert.equal(row!.status, "subscribed");
    assert.ok(row!.welcomeSentAt);
    assert.equal(row!.emailsSent, 1);
  });

  it("confirmation email request does not send Welcome prematurely", async () => {
    await requestBlogSubscription({ email: "pending@example.com", ipKey: "21b-1" });
    await drainEmailQueueForTests();

    const welcomeMails = MockEmailProvider.sentMessages.filter(
      (row) => row.template === "blog_subscription_welcome",
    );
    assert.equal(welcomeMails.length, 0);

    const confirmMails = MockEmailProvider.sentMessages.filter(
      (row) => row.template === "blog_subscription_confirm",
    );
    assert.ok(confirmMails.length >= 1);

    const row = await findBlogSubscriberByNormalizedEmail("pending@example.com");
    assert.equal(row!.status, "not_confirmed");
    assert.equal(row!.emailsSent, 0);
    assert.equal(row!.welcomeSentAt, undefined);
  });

  it("repeated confirmation does not resend Welcome or double-increment emailsSent", async () => {
    const confirmRaw = generateBlogSubscriptionRawToken();
    const unsubRaw = generateBlogSubscriptionRawToken();
    const now = new Date().toISOString();
    await upsertBlogSubscriberRecord({
      subscriberId: "sub-welcome-once",
      emailNormalized: "once@example.com",
      emailDisplay: "once@example.com",
      status: "not_confirmed",
      subscriptionType: "blog_publications",
      emailsSent: 0,
      confirmTokenHash: hashBlogSubscriptionToken("confirm", confirmRaw),
      confirmTokenExpiresAt: resolveBlogSubscriptionConfirmExpiresAt(),
      unsubscribeTokenHash: hashBlogSubscriptionToken("unsubscribe", unsubRaw),
      createdAt: now,
      updatedAt: now,
    });

    await confirmBlogSubscription({ token: confirmRaw });
    const afterFirst = await findBlogSubscriberByNormalizedEmail("once@example.com");
    assert.equal(afterFirst!.emailsSent, 1);
    assert.ok(afterFirst!.welcomeSentAt);

    // Replay path: subscribed + leftover confirm token must not resend Welcome.
    const replayToken = generateBlogSubscriptionRawToken();
    await upsertBlogSubscriberRecord({
      ...afterFirst!,
      confirmTokenHash: hashBlogSubscriptionToken("confirm", replayToken),
      confirmTokenExpiresAt: resolveBlogSubscriptionConfirmExpiresAt(),
      updatedAt: new Date().toISOString(),
    });
    await confirmBlogSubscription({ token: replayToken });

    const welcomeMails = MockEmailProvider.sentMessages.filter(
      (row) => row.template === "blog_subscription_welcome",
    );
    assert.equal(welcomeMails.length, 1);

    const afterReplay = await findBlogSubscriberByNormalizedEmail("once@example.com");
    assert.equal(afterReplay!.emailsSent, 1);
    assert.equal(afterReplay!.welcomeSentAt, afterFirst!.welcomeSentAt);
  });

  it("Welcome failure does not roll back subscribed; welcomeSentAt only on success", async () => {
    MockEmailProvider.failNextSendsForTests(1);
    const confirmRaw = generateBlogSubscriptionRawToken();
    const unsubRaw = generateBlogSubscriptionRawToken();
    const now = new Date().toISOString();
    await upsertBlogSubscriberRecord({
      subscriberId: "sub-welcome-fail",
      emailNormalized: "fail@example.com",
      emailDisplay: "fail@example.com",
      status: "not_confirmed",
      subscriptionType: "blog_publications",
      emailsSent: 0,
      confirmTokenHash: hashBlogSubscriptionToken("confirm", confirmRaw),
      confirmTokenExpiresAt: resolveBlogSubscriptionConfirmExpiresAt(),
      unsubscribeTokenHash: hashBlogSubscriptionToken("unsubscribe", unsubRaw),
      createdAt: now,
      updatedAt: now,
    });

    const result = await confirmBlogSubscription({ token: confirmRaw });
    assert.equal(result.confirmed, true);

    const row = await findBlogSubscriberByNormalizedEmail("fail@example.com");
    assert.equal(row!.status, "subscribed");
    assert.equal(row!.welcomeSentAt, undefined);
    assert.equal(row!.emailsSent, 0);
  });

  it("Pack 21F — concurrent confirmation claims Welcome once", async () => {
    const confirmRaw = generateBlogSubscriptionRawToken();
    const unsubRaw = generateBlogSubscriptionRawToken();
    const now = new Date().toISOString();
    await upsertBlogSubscriberRecord({
      subscriberId: "sub-welcome-race",
      emailNormalized: "race-welcome@example.com",
      emailDisplay: "race-welcome@example.com",
      status: "not_confirmed",
      subscriptionType: "blog_publications",
      emailsSent: 0,
      confirmTokenHash: hashBlogSubscriptionToken("confirm", confirmRaw),
      confirmTokenExpiresAt: resolveBlogSubscriptionConfirmExpiresAt(),
      unsubscribeTokenHash: hashBlogSubscriptionToken("unsubscribe", unsubRaw),
      createdAt: now,
      updatedAt: now,
    });

    const results = await Promise.allSettled([
      confirmBlogSubscription({ token: confirmRaw }),
      confirmBlogSubscription({ token: confirmRaw }),
    ]);
    const fulfilled = results.filter((row) => row.status === "fulfilled");
    assert.ok(fulfilled.length >= 1);

    const welcomeMails = MockEmailProvider.sentMessages.filter(
      (row) => row.template === "blog_subscription_welcome",
    );
    assert.equal(welcomeMails.length, 1);

    const row = await findBlogSubscriberByNormalizedEmail("race-welcome@example.com");
    assert.equal(row!.status, "subscribed");
    assert.equal(row!.emailsSent, 1);
    assert.ok(row!.welcomeSentAt);
  });

  it("re-subscribe + new confirmation may send a new Welcome", async () => {
    const confirmRaw1 = generateBlogSubscriptionRawToken();
    const unsubRaw = generateBlogSubscriptionRawToken();
    const now = new Date().toISOString();
    await upsertBlogSubscriberRecord({
      subscriberId: "sub-resub",
      emailNormalized: "resub@example.com",
      emailDisplay: "resub@example.com",
      status: "not_confirmed",
      subscriptionType: "blog_publications",
      emailsSent: 0,
      confirmTokenHash: hashBlogSubscriptionToken("confirm", confirmRaw1),
      confirmTokenExpiresAt: resolveBlogSubscriptionConfirmExpiresAt(),
      unsubscribeTokenHash: hashBlogSubscriptionToken("unsubscribe", unsubRaw),
      createdAt: now,
      updatedAt: now,
    });

    await confirmBlogSubscription({ token: confirmRaw1 });
    const subscribed = await findBlogSubscriberByNormalizedEmail("resub@example.com");
    assert.ok(subscribed!.welcomeSentAt);
    assert.equal(subscribed!.emailsSent, 1);

    // Capture rotated unsubscribe token from welcome send by using known token after reset.
    const unsubKnown = generateBlogSubscriptionRawToken();
    await upsertBlogSubscriberRecord({
      ...subscribed!,
      unsubscribeTokenHash: hashBlogSubscriptionToken("unsubscribe", unsubKnown),
      updatedAt: new Date().toISOString(),
    });
    await unsubscribeBlogSubscription({ token: unsubKnown });
    const unsubscribed = await findBlogSubscriberByNormalizedEmail("resub@example.com");
    assert.equal(unsubscribed!.status, "unsubscribed");
    assert.ok(unsubscribed!.welcomeSentAt);

    await requestBlogSubscription({ email: "resub@example.com", ipKey: "21b-resub" });
    const pending = await findBlogSubscriberByNormalizedEmail("resub@example.com");
    assert.equal(pending!.status, "not_confirmed");
    assert.equal(pending!.welcomeSentAt, undefined);

    const confirmRaw2 = generateBlogSubscriptionRawToken();
    await upsertBlogSubscriberRecord({
      ...pending!,
      confirmTokenHash: hashBlogSubscriptionToken("confirm", confirmRaw2),
      confirmTokenExpiresAt: resolveBlogSubscriptionConfirmExpiresAt(),
      updatedAt: new Date().toISOString(),
    });
    await confirmBlogSubscription({ token: confirmRaw2 });

    const welcomeMails = MockEmailProvider.sentMessages.filter(
      (row) => row.template === "blog_subscription_welcome",
    );
    assert.equal(welcomeMails.length, 2);

    const again = await findBlogSubscriberByNormalizedEmail("resub@example.com");
    assert.equal(again!.status, "subscribed");
    assert.ok(again!.welcomeSentAt);
    assert.equal(again!.emailsSent, 2);
  });

  it("Welcome template includes unsubscribe link and Blog link", () => {
    const rendered = renderEmailTemplate("blog_subscription_welcome", {
      welcomeMessage: "Thanks for joining.",
      blogUrl: "https://example.com/blog",
      unsubscribeUrl: "https://example.com/blog/subscribe/unsubscribe?token=xyz",
    });
    assert.match(rendered.subject, /Welcome/i);
    assert.match(rendered.html, /Thanks for joining/);
    assert.match(rendered.html, /Visit the Blog/);
    assert.match(rendered.html, /unsubscribe\?token=xyz/);
    assert.doesNotMatch(rendered.html, /publication card|fake publication/i);
  });

  it("wires Admin subscription-settings routes with auth gate", () => {
    const routes = readApi("src/modules/blog/admin-publishing.routes.ts");
    assert.match(routes, /\/subscription-settings/);
    assert.match(routes, /getAdminBlogSubscriptionSettings/);
    assert.match(routes, /updateAdminBlogSubscriptionSettings/);
    assert.match(routes, /authenticationMiddleware/);
    assert.match(routes, /requireAuthenticationMiddleware/);

    const service = readApi("src/modules/blog/blog-subscription-settings.admin.service.ts");
    assert.match(service, /assertAdminActor/);
    assert.match(service, /blog\.subscription_settings\.update/);
    assert.match(service, /welcomeMessageLength=/);
  });
});
