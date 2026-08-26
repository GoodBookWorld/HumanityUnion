/**
 * Pack 21C — Admin subscribers directory, search, selection contracts, remove.
 */
import "./blog-subscription-pack21c.setup.js";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { AdministrationForbiddenError } from "../../../src/modules/administration/administration.errors.js";
import {
  listAdminBlogSubscribers,
  removeAdminBlogSubscriber,
  setBlogSubscriberAdminActorOverrideForTests,
  setBlogSubscriberDisplayNameResolverForTests,
} from "../../../src/modules/blog/blog-subscription-admin.service.js";
import {
  formatBlogSubscriptionStatusLabel,
  formatBlogSubscriptionTypeLabel,
  isBlogSubscriberEligibleForPublicationDelivery,
} from "../../../src/modules/blog/blog-subscription-labels.js";
import { requestBlogSubscription } from "../../../src/modules/blog/blog-subscription.service.js";
import { BlogNotFoundError } from "../../../src/modules/blog/blog.errors.js";
import { resetBlogSubscriptionRateLimitsForTests } from "../../../src/modules/blog/blog-subscription-rate-limit.js";
import {
  findBlogSubscriberByNormalizedEmail,
  resetBlogSubscribersForTests,
  upsertBlogSubscriberRecord,
} from "../../../src/modules/blog/persistence/blog-subscriber.repository.js";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readApi(relativePath: string): string {
  return readFileSync(path.resolve(apiRoot, relativePath), "utf8");
}

async function seedSubscriber(input: {
  subscriberId: string;
  email: string;
  status: "not_confirmed" | "subscribed" | "unsubscribed";
  createdAt: string;
  subscribedAt?: string;
  countryCode?: string;
  emailsSent?: number;
  participantId?: string;
}): Promise<void> {
  await upsertBlogSubscriberRecord({
    subscriberId: input.subscriberId,
    emailNormalized: input.email.toLowerCase(),
    emailDisplay: input.email,
    status: input.status,
    subscriptionType: "blog_publications",
    ...(input.participantId ? { participantId: input.participantId } : {}),
    ...(input.countryCode ? { countryCode: input.countryCode } : {}),
    ...(input.subscribedAt ? { subscribedAt: input.subscribedAt } : {}),
    emailsSent: input.emailsSent ?? 0,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });
}

describe("Pack 21C — Admin subscribers directory", () => {
  beforeEach(() => {
    resetBlogSubscribersForTests();
    resetBlogSubscriptionRateLimitsForTests();
    setBlogSubscriberAdminActorOverrideForTests({
      userId: "admin-1",
      participantId: "participant-admin-1",
      role: "admin",
    });
    setBlogSubscriberDisplayNameResolverForTests(null);
  });

  afterEach(() => {
    setBlogSubscriberAdminActorOverrideForTests(null);
    setBlogSubscriberDisplayNameResolverForTests(null);
  });

  it("Admin-only list; non-Admin cannot enumerate", async () => {
    setBlogSubscriberAdminActorOverrideForTests({
      userId: "member-1",
      participantId: "participant-member-1",
      role: "member",
    });
    await assert.rejects(
      () => listAdminBlogSubscribers({ actorUserId: "member-1" }),
      AdministrationForbiddenError,
    );
  });

  it("searches by email and linked display name", async () => {
    await seedSubscriber({
      subscriberId: "s1",
      email: "alpha@example.com",
      status: "subscribed",
      createdAt: "2026-01-02T00:00:00.000Z",
      subscribedAt: "2026-01-02T00:00:00.000Z",
    });
    await seedSubscriber({
      subscriberId: "s2",
      email: "beta@example.com",
      status: "subscribed",
      createdAt: "2026-01-03T00:00:00.000Z",
      subscribedAt: "2026-01-03T00:00:00.000Z",
      participantId: "p-named",
    });
    setBlogSubscriberDisplayNameResolverForTests((id) =>
      id === "p-named" ? "Jordan Rivers" : undefined,
    );

    const byEmail = await listAdminBlogSubscribers({
      actorUserId: "admin-1",
      q: "alpha@",
    });
    assert.equal(byEmail.total, 1);
    assert.equal(byEmail.subscribers[0]?.subscriberId, "s1");

    const byName = await listAdminBlogSubscribers({
      actorUserId: "admin-1",
      q: "jordan",
    });
    assert.equal(byName.total, 1);
    assert.equal(byName.subscribers[0]?.subscriberId, "s2");
    assert.equal(byName.subscribers[0]?.displayName, "Jordan Rivers");
  });

  it("bounds/paginates and sorts newest created first", async () => {
    for (let i = 0; i < 5; i += 1) {
      await seedSubscriber({
        subscriberId: `page-${i}`,
        email: `page${i}@example.com`,
        status: "subscribed",
        createdAt: `2026-02-0${i + 1}T00:00:00.000Z`,
        subscribedAt: `2026-02-0${i + 1}T00:00:00.000Z`,
      });
    }
    const page = await listAdminBlogSubscribers({
      actorUserId: "admin-1",
      limit: 2,
      offset: 0,
    });
    assert.equal(page.limit, 2);
    assert.equal(page.subscribers.length, 2);
    assert.equal(page.total, 5);
    assert.equal(page.subscribers[0]?.subscriberId, "page-4");
    assert.equal(page.subscribers[1]?.subscriberId, "page-3");

    const next = await listAdminBlogSubscribers({
      actorUserId: "admin-1",
      limit: 2,
      offset: 2,
    });
    assert.equal(next.subscribers[0]?.subscriberId, "page-2");
  });

  it("exposes labels and status presentation helpers", () => {
    assert.equal(formatBlogSubscriptionTypeLabel("blog_publications"), "Blog publications");
    assert.equal(formatBlogSubscriptionStatusLabel("not_confirmed"), "Not confirmed");
    assert.equal(formatBlogSubscriptionStatusLabel("subscribed"), "Subscribed");
    assert.equal(formatBlogSubscriptionStatusLabel("unsubscribed"), "Unsubscribed");
  });

  it("directory rows omit token fields and include emailsSent / country placeholder semantics", async () => {
    await seedSubscriber({
      subscriberId: "s-fields",
      email: "fields@example.com",
      status: "subscribed",
      createdAt: "2026-03-01T00:00:00.000Z",
      subscribedAt: "2026-03-01T00:00:00.000Z",
      emailsSent: 3,
    });
    const listed = await listAdminBlogSubscribers({ actorUserId: "admin-1" });
    const row = listed.subscribers[0]!;
    assert.equal(row.emailsSent, 3);
    assert.equal(row.countryCode, undefined);
    assert.equal("confirmTokenHash" in row, false);
    assert.equal("unsubscribeTokenHash" in row, false);
    const raw = JSON.stringify(row);
    assert.doesNotMatch(raw, /TokenHash|password|smtp/i);
  });

  it("Admin remove transitions to unsubscribed, is idempotent, and excludes from eligible delivery", async () => {
    await seedSubscriber({
      subscriberId: "s-remove",
      email: "remove@example.com",
      status: "subscribed",
      createdAt: "2026-04-01T00:00:00.000Z",
      subscribedAt: "2026-04-01T00:00:00.000Z",
    });
    assert.equal(isBlogSubscriberEligibleForPublicationDelivery("subscribed"), true);

    const first = await removeAdminBlogSubscriber({
      actorUserId: "admin-1",
      subscriberId: "s-remove",
    });
    assert.equal(first.removed, true);
    assert.equal(first.alreadyUnsubscribed, false);

    const row = await findBlogSubscriberByNormalizedEmail("remove@example.com");
    assert.equal(row!.status, "unsubscribed");
    assert.ok(row!.unsubscribedAt);
    assert.equal(isBlogSubscriberEligibleForPublicationDelivery(row!.status), false);

    const second = await removeAdminBlogSubscriber({
      actorUserId: "admin-1",
      subscriberId: "s-remove",
    });
    assert.equal(second.alreadyUnsubscribed, true);

    await assert.rejects(
      () =>
        removeAdminBlogSubscriber({
          actorUserId: "admin-1",
          subscriberId: "missing-id",
        }),
      BlogNotFoundError,
    );
  });

  it("public re-subscribe remains possible after Admin remove", async () => {
    await seedSubscriber({
      subscriberId: "s-resub",
      email: "resub21c@example.com",
      status: "subscribed",
      createdAt: "2026-05-01T00:00:00.000Z",
      subscribedAt: "2026-05-01T00:00:00.000Z",
    });
    await removeAdminBlogSubscriber({
      actorUserId: "admin-1",
      subscriberId: "s-resub",
    });
    const accepted = await requestBlogSubscription({
      email: "resub21c@example.com",
      ipKey: "21c-resub",
    });
    assert.equal(accepted.accepted, true);
    const pending = await findBlogSubscriberByNormalizedEmail("resub21c@example.com");
    assert.equal(pending!.status, "not_confirmed");
    assert.equal(pending!.subscriberId, "s-resub");
  });

  it("wires Admin subscriber routes with auth and no public directory", () => {
    const routes = readApi("src/modules/blog/admin-publishing.routes.ts");
    assert.match(routes, /\/subscribers/);
    assert.match(routes, /listAdminBlogSubscribers/);
    assert.match(routes, /removeAdminBlogSubscriber/);
    assert.match(routes, /authenticationMiddleware/);
    assert.match(routes, /requireAuthenticationMiddleware/);

    const publicRoutes = readApi("src/modules/blog/blog.routes.ts");
    assert.doesNotMatch(publicRoutes, /listAdminBlogSubscribers|admin\/publishing\/subscribers/);

    const service = readApi("src/modules/blog/blog-subscription-admin.service.ts");
    assert.match(service, /assertAdminActor/);
    assert.match(service, /blog\.subscriber\.remove/);
    const directoryProjectionStart = service.indexOf("async function toDirectoryItem");
    const directoryProjectionEnd = service.indexOf("function recordMatchesSearch");
    assert.ok(directoryProjectionStart >= 0 && directoryProjectionEnd > directoryProjectionStart);
    const directoryProjection = service.slice(directoryProjectionStart, directoryProjectionEnd);
    assert.doesNotMatch(directoryProjection, /confirmTokenHash|unsubscribeTokenHash/);
  });

  it("subscriber counts reflect status totals", async () => {
    await seedSubscriber({
      subscriberId: "c1",
      email: "c1@example.com",
      status: "subscribed",
      createdAt: "2026-06-01T00:00:00.000Z",
      subscribedAt: "2026-06-01T00:00:00.000Z",
    });
    await seedSubscriber({
      subscriberId: "c2",
      email: "c2@example.com",
      status: "not_confirmed",
      createdAt: "2026-06-02T00:00:00.000Z",
    });
    await seedSubscriber({
      subscriberId: "c3",
      email: "c3@example.com",
      status: "unsubscribed",
      createdAt: "2026-06-03T00:00:00.000Z",
    });
    const listed = await listAdminBlogSubscribers({ actorUserId: "admin-1" });
    assert.equal(listed.subscribedCount, 1);
    assert.equal(listed.notConfirmedCount, 1);
    assert.equal(listed.unsubscribedCount, 1);
  });
});
