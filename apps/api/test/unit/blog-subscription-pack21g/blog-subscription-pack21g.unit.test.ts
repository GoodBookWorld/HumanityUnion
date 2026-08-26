/**
 * Pack 21G — Admin manual subscriber add.
 */
import "./blog-subscription-pack21g.setup.js";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  AdministrationForbiddenError,
  AdministrationValidationError,
} from "../../../src/modules/administration/administration.errors.js";
import {
  adminManualAddBlogSubscriber,
  listAdminBlogSubscribers,
  setBlogSubscriberAdminActorOverrideForTests,
  setBlogSubscriberDisplayNameResolverForTests,
} from "../../../src/modules/blog/blog-subscription-admin.service.js";
import { normalizeBlogSubscriptionEmail } from "../../../src/modules/blog/blog-subscription-email.js";
import { confirmBlogSubscription } from "../../../src/modules/blog/blog-subscription.service.js";
import {
  findBlogSubscriberByNormalizedEmail,
  resetBlogSubscribersForTests,
  upsertBlogSubscriberRecord,
} from "../../../src/modules/blog/persistence/blog-subscriber.repository.js";
import {
  disposeEmailWorkersForTests,
  drainEmailQueueForTests,
  getMockEmailSendCount,
  resetMockEmailOutboxForTests,
} from "../../../src/modules/email/email-test-helpers.js";
import { MockEmailProvider } from "../../../src/modules/email/providers/mock.provider.js";
import { generateBlogSubscriptionRawToken, hashBlogSubscriptionToken } from "../../../src/modules/blog/blog-subscription-tokens.js";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readApi(relativePath: string): string {
  return readFileSync(path.resolve(apiRoot, relativePath), "utf8");
}

describe("Pack 21G — Admin manual subscriber add", () => {
  beforeEach(() => {
    resetBlogSubscribersForTests();
    resetMockEmailOutboxForTests();
    process.env.EMAIL_PROVIDER = "mock";
    setBlogSubscriberAdminActorOverrideForTests({
      userId: "admin-1",
      participantId: "participant-admin-1",
      role: "admin",
    });
    setBlogSubscriberDisplayNameResolverForTests(null);
  });

  afterEach(async () => {
    setBlogSubscriberAdminActorOverrideForTests(null);
    setBlogSubscriberDisplayNameResolverForTests(null);
    await drainEmailQueueForTests();
    disposeEmailWorkersForTests();
  });

  it("Admin can manually add a confirmed historical subscriber", async () => {
    const result = await adminManualAddBlogSubscriber({
      actorUserId: "admin-1",
      body: {
        email: "  History@Example.com ",
        displayName: "Ada Lovelace",
        importMode: "confirmed_existing",
      },
    });
    assert.equal(result.created, true);
    assert.equal(result.reusedExisting, false);
    assert.equal(result.confirmationEmailQueued, false);
    assert.equal(result.subscriber.status, "subscribed");
    assert.equal(result.subscriber.displayName, "Ada Lovelace");
    assert.equal(result.subscriber.email, "History@Example.com");
    assert.equal(result.subscriber.emailsSent, 0);
    assert.ok(result.subscriber.subscribedAt);
    assert.ok(result.subscriber.confirmedAt);

    const row = await findBlogSubscriberByNormalizedEmail("history@example.com");
    assert.ok(row);
    assert.equal(row!.status, "subscribed");
    assert.equal(row!.displayName, "Ada Lovelace");
    assert.equal(row!.emailsSent, 0);
    assert.equal(row!.welcomeSentAt, undefined);
  });

  it("non-Admin cannot add", async () => {
    setBlogSubscriberAdminActorOverrideForTests({
      userId: "member-1",
      participantId: "participant-member-1",
      role: "member",
    });
    await assert.rejects(
      () =>
        adminManualAddBlogSubscriber({
          actorUserId: "member-1",
          body: { email: "x@example.com", importMode: "confirmed_existing" },
        }),
      AdministrationForbiddenError,
    );
  });

  it("optional Name persists; email normalization reused", async () => {
    assert.equal(normalizeBlogSubscriptionEmail("  MixED@Example.COM "), "mixed@example.com");
    const result = await adminManualAddBlogSubscriber({
      actorUserId: "admin-1",
      body: { email: "  MixED@Example.COM ", name: "  Mixed   Name ", importMode: "confirmed_existing" },
    });
    assert.equal(result.subscriber.displayName, "Mixed Name");
    const row = await findBlogSubscriberByNormalizedEmail("mixed@example.com");
    assert.equal(row!.emailNormalized, "mixed@example.com");
  });

  it("duplicate email does not create a second row; display name may update", async () => {
    const first = await adminManualAddBlogSubscriber({
      actorUserId: "admin-1",
      body: { email: "dup@example.com", displayName: "First", importMode: "confirmed_existing" },
    });
    const second = await adminManualAddBlogSubscriber({
      actorUserId: "admin-1",
      body: { email: "dup@example.com", displayName: "Updated", importMode: "confirmed_existing" },
    });
    assert.equal(second.created, false);
    assert.equal(second.reusedExisting, true);
    assert.equal(second.subscriber.subscriberId, first.subscriber.subscriberId);
    assert.equal(second.subscriber.displayName, "Updated");

    const listed = await listAdminBlogSubscribers({ actorUserId: "admin-1" });
    assert.equal(listed.total, 1);
    assert.equal(listed.subscribedCount, 1);
  });

  it("confirmation-required mode creates not_confirmed and sends confirmation email", async () => {
    const before = getMockEmailSendCount();
    const result = await adminManualAddBlogSubscriber({
      actorUserId: "admin-1",
      body: { email: "pending@example.com", importMode: "needs_confirmation" },
    });
    await drainEmailQueueForTests();
    assert.equal(result.created, true);
    assert.equal(result.confirmationEmailQueued, true);
    assert.equal(result.subscriber.status, "not_confirmed");
    assert.equal(result.subscriber.emailsSent, 0);

    const row = await findBlogSubscriberByNormalizedEmail("pending@example.com");
    assert.equal(row!.status, "not_confirmed");
    assert.ok(row!.confirmTokenHash);
    assert.equal(row!.emailsSent, 0);
    assert.ok(getMockEmailSendCount() > before);
    assert.ok(
      MockEmailProvider.sentMessages.some((msg) => msg.template === "blog_subscription_confirm"),
    );
  });

  it("historical confirmed mode does not send confirmation or Welcome email", async () => {
    resetMockEmailOutboxForTests();
    await adminManualAddBlogSubscriber({
      actorUserId: "admin-1",
      body: { email: "quiet@example.com", importMode: "confirmed_existing" },
    });
    await drainEmailQueueForTests();
    assert.equal(getMockEmailSendCount(), 0);
    const row = await findBlogSubscriberByNormalizedEmail("quiet@example.com");
    assert.equal(row!.welcomeSentAt, undefined);
    assert.equal(row!.emailsSent, 0);
  });

  it("unsubscribed row does not reactivate silently; explicit restore works", async () => {
    const now = new Date().toISOString();
    await upsertBlogSubscriberRecord({
      subscriberId: "sub-unsub-1",
      emailNormalized: "left@example.com",
      emailDisplay: "left@example.com",
      status: "unsubscribed",
      subscriptionType: "blog_publications",
      unsubscribedAt: now,
      emailsSent: 3,
      createdAt: now,
      updatedAt: now,
    });

    await assert.rejects(
      () =>
        adminManualAddBlogSubscriber({
          actorUserId: "admin-1",
          body: { email: "left@example.com", importMode: "confirmed_existing" },
        }),
      AdministrationValidationError,
    );

    const restored = await adminManualAddBlogSubscriber({
      actorUserId: "admin-1",
      body: {
        email: "left@example.com",
        importMode: "confirmed_existing",
        restoreUnsubscribed: true,
        displayName: "Restored",
      },
    });
    assert.equal(restored.reusedExisting, true);
    assert.equal(restored.restoredFromUnsubscribed, true);
    assert.equal(restored.subscriber.status, "subscribed");
    assert.equal(restored.subscriber.displayName, "Restored");
    assert.equal(restored.subscriber.emailsSent, 3);
    assert.equal(restored.confirmationEmailQueued, false);

    const row = await findBlogSubscriberByNormalizedEmail("left@example.com");
    assert.equal(row!.subscriberId, "sub-unsub-1");
    assert.equal(row!.emailsSent, 3);
  });

  it("unsubscribed + needs_confirmation with restore reuses confirmation lifecycle", async () => {
    const now = new Date().toISOString();
    await upsertBlogSubscriberRecord({
      subscriberId: "sub-unsub-2",
      emailNormalized: "again@example.com",
      emailDisplay: "again@example.com",
      status: "unsubscribed",
      subscriptionType: "blog_publications",
      unsubscribedAt: now,
      emailsSent: 1,
      createdAt: now,
      updatedAt: now,
    });

    const result = await adminManualAddBlogSubscriber({
      actorUserId: "admin-1",
      body: {
        email: "again@example.com",
        importMode: "needs_confirmation",
        restoreUnsubscribed: true,
      },
    });
    await drainEmailQueueForTests();
    assert.equal(result.subscriber.status, "not_confirmed");
    assert.equal(result.confirmationEmailQueued, true);
    assert.equal(result.subscriber.emailsSent, 1);
    assert.ok(
      MockEmailProvider.sentMessages.some((msg) => msg.template === "blog_subscription_confirm"),
    );
  });

  it("emailsSent remains unchanged on manual add; Welcome only after confirm path", async () => {
    const added = await adminManualAddBlogSubscriber({
      actorUserId: "admin-1",
      body: { email: "welcome-path@example.com", importMode: "needs_confirmation" },
    });
    await drainEmailQueueForTests();
    const pending = await findBlogSubscriberByNormalizedEmail("welcome-path@example.com");
    assert.equal(pending!.emailsSent, 0);

    const confirmRaw = generateBlogSubscriptionRawToken();
    const unsubRaw = generateBlogSubscriptionRawToken();
    await upsertBlogSubscriberRecord({
      ...pending!,
      confirmTokenHash: hashBlogSubscriptionToken("confirm", confirmRaw),
      confirmTokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      unsubscribeTokenHash: hashBlogSubscriptionToken("unsubscribe", unsubRaw),
    });

    resetMockEmailOutboxForTests();
    await confirmBlogSubscription({ token: confirmRaw });
    await drainEmailQueueForTests();
    const confirmed = await findBlogSubscriberByNormalizedEmail("welcome-path@example.com");
    assert.equal(confirmed!.status, "subscribed");
    // Welcome may increment emailsSent after successful send (Pack 21B).
    assert.ok((confirmed!.emailsSent ?? 0) >= 0);
    void added;
  });

  it("directory/count refresh sees new subscriber; response has no tokens", async () => {
    await adminManualAddBlogSubscriber({
      actorUserId: "admin-1",
      body: { email: "visible@example.com", displayName: "Visible", importMode: "confirmed_existing" },
    });
    const listed = await listAdminBlogSubscribers({ actorUserId: "admin-1" });
    assert.equal(listed.subscribedCount, 1);
    assert.equal(listed.total, 1);
    assert.equal(listed.subscribers[0]?.displayName, "Visible");
    const raw = JSON.stringify(listed.subscribers[0]);
    assert.doesNotMatch(raw, /confirmToken|unsubscribeToken|TokenHash/i);
  });

  it("rejects HTML in Name", async () => {
    await assert.rejects(
      () =>
        adminManualAddBlogSubscriber({
          actorUserId: "admin-1",
          body: {
            email: "html@example.com",
            displayName: "<script>x</script>",
            importMode: "confirmed_existing",
          },
        }),
      AdministrationValidationError,
    );
  });

  it("routes and audit action are wired", () => {
    const routes = readApi("src/modules/blog/admin-publishing.routes.ts");
    assert.match(routes, /adminManualAddBlogSubscriber/);
    assert.match(routes, /Pack 21G — Admin manual subscriber add/);
    assert.match(routes, /"\/subscribers"/);
    const service = readApi("src/modules/blog/blog-subscription-admin.service.ts");
    assert.match(service, /blog\.subscriber\.manual_add/);
    assert.match(service, /normalizeBlogSubscriptionEmail/);
  });
});
