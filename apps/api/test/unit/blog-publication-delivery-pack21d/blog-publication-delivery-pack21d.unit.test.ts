/**
 * Pack 21D — BlogPostPublished → subscriber publication delivery + ledger.
 */
import "./blog-publication-delivery-pack21d.setup.js";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { BlogPost, BlogSubscriberRecord } from "@hu/types";

import { CATALOGUE_EVENTS } from "../../../src/infrastructure/events/catalogue-events.js";
import { createDomainEvent } from "../../../src/infrastructure/events/event-envelope.js";
import { getHandlersForEvent } from "../../../src/infrastructure/integration/event-handler-registry.js";
import {
  BLOG_PUBLICATION_DELIVERY_BATCH_SIZE,
  BLOG_PUBLICATION_DELIVERY_CONSUMER_ID,
  BLOG_PUBLICATION_DELIVERY_CONCURRENCY,
  BLOG_PUBLICATION_DELIVERY_MAX_ATTEMPTS,
  fanOutBlogPublicationDelivery,
  isBlogPostPubliclyDeliverable,
  registerBlogPublicationDeliveryHandlers,
  resetBlogPublicationDeliveryHandlersForTests,
} from "../../../src/modules/blog/blog-publication-delivery.index.js";
import { renderEmailTemplate } from "../../../src/modules/email/email.templates.js";
import {
  findBlogPublicationDelivery,
  resetBlogPublicationDeliveriesForTests,
} from "../../../src/modules/blog/persistence/blog-publication-delivery.repository.js";
import {
  resetBlogSubscribersForTests,
  upsertBlogSubscriberRecord,
} from "../../../src/modules/blog/persistence/blog-subscriber.repository.js";
import { clearDomainEventHandlers } from "../../../src/infrastructure/integration/event-handler-registry.js";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readApi(relativePath: string): string {
  return readFileSync(path.resolve(apiRoot, relativePath), "utf8");
}

function makePost(overrides: Partial<BlogPost> = {}): BlogPost {
  const now = "2026-08-01T12:00:00.000Z";
  return {
    postId: "post-1",
    authorParticipantId: "author-1",
    authorDisplayNameSnapshot: "Author",
    title: "Civic Hope",
    slug: "civic-hope",
    excerpt: "A short excerpt about civic hope.",
    content: "<p>Body</p>",
    categoryId: "our_life",
    tags: [],
    coverMedia: {
      mediaId: "m1",
      mediaUrl: "https://cdn.example.com/cover.jpg",
    },
    status: "published",
    originalLanguage: "en",
    safetyOutcome: null,
    review: { reviewStatus: "approved" },
    publishedVersion: 1,
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
    ...overrides,
  } as BlogPost;
}

function makeEnvelope(payload: Record<string, unknown> = {}) {
  return createDomainEvent({
    eventName: CATALOGUE_EVENTS.blogPostPublished,
    aggregateType: "BlogPost",
    aggregateId: "post-1",
    actorId: "publisher-1",
    payload: {
      postId: "post-1",
      authorParticipantId: "author-1",
      publishedByParticipantId: "publisher-1",
      publishedVersion: 1,
      slug: "civic-hope",
      ...payload,
    },
  });
}

async function seedSubscriber(input: {
  subscriberId: string;
  email: string;
  status: BlogSubscriberRecord["status"];
  emailsSent?: number;
}): Promise<BlogSubscriberRecord> {
  const now = new Date().toISOString();
  const record: BlogSubscriberRecord = {
    subscriberId: input.subscriberId,
    emailNormalized: input.email.toLowerCase(),
    emailDisplay: input.email,
    status: input.status,
    subscriptionType: "blog_publications",
    emailsSent: input.emailsSent ?? 0,
    ...(input.status === "subscribed"
      ? { subscribedAt: now, confirmedAt: now }
      : {}),
    createdAt: now,
    updatedAt: now,
  };
  await upsertBlogSubscriberRecord(record);
  return record;
}

describe("Pack 21D — publication subscriber delivery", () => {
  beforeEach(() => {
    resetBlogSubscribersForTests();
    resetBlogPublicationDeliveriesForTests();
    resetBlogPublicationDeliveryHandlersForTests();
    clearDomainEventHandlers();
  });

  afterEach(() => {
    resetBlogPublicationDeliveryHandlersForTests();
    clearDomainEventHandlers();
  });

  it("registers BlogPostPublished consumer", () => {
    registerBlogPublicationDeliveryHandlers();
    const handlers = getHandlersForEvent(CATALOGUE_EVENTS.blogPostPublished);
    assert.ok(handlers.some((row) => row.consumerId === BLOG_PUBLICATION_DELIVERY_CONSUMER_ID));
    assert.equal(BLOG_PUBLICATION_DELIVERY_BATCH_SIZE, 50);
    assert.equal(BLOG_PUBLICATION_DELIVERY_CONCURRENCY, 3);
    assert.equal(BLOG_PUBLICATION_DELIVERY_MAX_ATTEMPTS, 3);
  });

  it("visibility helper requires published + not blocked + publishedAt", () => {
    assert.equal(isBlogPostPubliclyDeliverable(makePost()), true);
    assert.equal(isBlogPostPubliclyDeliverable(makePost({ status: "scheduled" })), false);
    assert.equal(isBlogPostPubliclyDeliverable(makePost({ status: "archived" })), false);
    assert.equal(
      isBlogPostPubliclyDeliverable(makePost({ administrativelyBlocked: true })),
      false,
    );
    assert.equal(isBlogPostPubliclyDeliverable(makePost({ publishedAt: undefined })), false);
  });

  it("sends only to subscribed blog_publications recipients and increments emailsSent once", async () => {
    await seedSubscriber({
      subscriberId: "sub-ok",
      email: "ok@example.com",
      status: "subscribed",
      emailsSent: 1,
    });
    await seedSubscriber({
      subscriberId: "sub-pending",
      email: "pending@example.com",
      status: "not_confirmed",
    });
    await seedSubscriber({
      subscriberId: "sub-left",
      email: "left@example.com",
      status: "unsubscribed",
    });

    const sends: string[] = [];
    const post = makePost();
    const store = new Map<string, BlogSubscriberRecord>();
    for (const id of ["sub-ok", "sub-pending", "sub-left"]) {
      const { findBlogSubscriberById } = await import(
        "../../../src/modules/blog/persistence/blog-subscriber.repository.js"
      );
      store.set(id, (await findBlogSubscriberById(id))!);
    }

    const result = await fanOutBlogPublicationDelivery({
      envelope: makeEnvelope(),
      deps: {
        findPostById: async () => post,
        listEligibleBatch: async ({ afterSubscriberId, limit }) => {
          const { listEligibleBlogPublicationSubscribersBatch } = await import(
            "../../../src/modules/blog/persistence/blog-subscriber.repository.js"
          );
          return listEligibleBlogPublicationSubscribersBatch({ afterSubscriberId, limit });
        },
        findSubscriberById: async (id) => store.get(id) ?? null,
        upsertSubscriber: async (row) => {
          store.set(row.subscriberId, row);
          await upsertBlogSubscriberRecord(row);
          return row;
        },
        sendPublicationEmail: async ({ to }) => {
          sends.push(to);
          return { emailSent: true, status: "sent" };
        },
      },
    });

    assert.equal(result.sent, 1);
    assert.deepEqual(sends, ["ok@example.com"]);
    assert.equal(store.get("sub-ok")!.emailsSent, 2);

    const ledger = await findBlogPublicationDelivery("post-1", "sub-ok");
    assert.equal(ledger?.status, "sent");
    assert.equal(ledger?.emailsSentIncremented, true);
  });

  it("skips fan-out when post is no longer publicly deliverable", async () => {
    await seedSubscriber({
      subscriberId: "sub-a",
      email: "a@example.com",
      status: "subscribed",
    });
    let sendCount = 0;
    const result = await fanOutBlogPublicationDelivery({
      envelope: makeEnvelope(),
      deps: {
        findPostById: async () => makePost({ status: "archived" }),
        listEligibleBatch: async () => [],
        findSubscriberById: async () => null,
        upsertSubscriber: async (row) => row,
        sendPublicationEmail: async () => {
          sendCount += 1;
          return { emailSent: true, status: "sent" };
        },
      },
    });
    assert.equal(result.skippedReason, "post_not_deliverable");
    assert.equal(sendCount, 0);
  });

  it("already-sent ledger skips resend and does not increment again", async () => {
    await seedSubscriber({
      subscriberId: "sub-once",
      email: "once@example.com",
      status: "subscribed",
      emailsSent: 0,
    });
    const post = makePost();
    const store = new Map<string, BlogSubscriberRecord>();
    const { findBlogSubscriberById } = await import(
      "../../../src/modules/blog/persistence/blog-subscriber.repository.js"
    );
    store.set("sub-once", (await findBlogSubscriberById("sub-once"))!);

    let sendCount = 0;
    const deps = {
      findPostById: async () => post,
      listEligibleBatch: async ({ afterSubscriberId, limit }: { afterSubscriberId?: string; limit: number }) => {
        const { listEligibleBlogPublicationSubscribersBatch } = await import(
          "../../../src/modules/blog/persistence/blog-subscriber.repository.js"
        );
        return listEligibleBlogPublicationSubscribersBatch({ afterSubscriberId, limit });
      },
      findSubscriberById: async (id: string) => store.get(id) ?? null,
      upsertSubscriber: async (row: BlogSubscriberRecord) => {
        store.set(row.subscriberId, row);
        await upsertBlogSubscriberRecord(row);
        return row;
      },
      sendPublicationEmail: async () => {
        sendCount += 1;
        return { emailSent: true, status: "sent" };
      },
    };

    const first = await fanOutBlogPublicationDelivery({ envelope: makeEnvelope(), deps });
    const second = await fanOutBlogPublicationDelivery({ envelope: makeEnvelope(), deps });
    assert.equal(first.sent, 1);
    assert.equal(second.sent, 0);
    assert.equal(second.skippedAlreadySent, 1);
    assert.equal(sendCount, 1);
    assert.equal(store.get("sub-once")!.emailsSent, 1);
  });

  it("failed send does not increment emailsSent and records failed ledger", async () => {
    await seedSubscriber({
      subscriberId: "sub-fail",
      email: "fail@example.com",
      status: "subscribed",
      emailsSent: 0,
    });
    const store = new Map<string, BlogSubscriberRecord>();
    const { findBlogSubscriberById } = await import(
      "../../../src/modules/blog/persistence/blog-subscriber.repository.js"
    );
    store.set("sub-fail", (await findBlogSubscriberById("sub-fail"))!);

    const result = await fanOutBlogPublicationDelivery({
      envelope: makeEnvelope(),
      deps: {
        findPostById: async () => makePost(),
        listEligibleBatch: async ({ afterSubscriberId, limit }) => {
          const { listEligibleBlogPublicationSubscribersBatch } = await import(
            "../../../src/modules/blog/persistence/blog-subscriber.repository.js"
          );
          return listEligibleBlogPublicationSubscribersBatch({ afterSubscriberId, limit });
        },
        findSubscriberById: async (id) => store.get(id) ?? null,
        upsertSubscriber: async (row) => {
          store.set(row.subscriberId, row);
          await upsertBlogSubscriberRecord(row);
          return row;
        },
        sendPublicationEmail: async () => ({
          emailSent: false,
          status: "failed",
          emailDeliveryError: "provider_error",
        }),
      },
    });

    assert.equal(result.failed, 1);
    assert.equal(store.get("sub-fail")!.emailsSent, 0);
    const ledger = await findBlogPublicationDelivery("post-1", "sub-fail");
    assert.equal(ledger?.status, "failed");
    assert.equal(ledger?.failureCode, "provider_error");
  });

  it("rechecks eligibility before send (unsubscribe during fan-out)", async () => {
    await seedSubscriber({
      subscriberId: "sub-race",
      email: "race@example.com",
      status: "subscribed",
    });
    let sendCount = 0;
    const result = await fanOutBlogPublicationDelivery({
      envelope: makeEnvelope(),
      deps: {
        findPostById: async () => makePost(),
        listEligibleBatch: async () => [
          {
            subscriberId: "sub-race",
            emailNormalized: "race@example.com",
            emailDisplay: "race@example.com",
            status: "subscribed",
            subscriptionType: "blog_publications",
            emailsSent: 0,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        findSubscriberById: async () => ({
          subscriberId: "sub-race",
          emailNormalized: "race@example.com",
          emailDisplay: "race@example.com",
          status: "unsubscribed",
          subscriptionType: "blog_publications",
          emailsSent: 0,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }),
        upsertSubscriber: async (row) => row,
        sendPublicationEmail: async () => {
          sendCount += 1;
          return { emailSent: true, status: "sent" };
        },
      },
    });
    assert.equal(sendCount, 0);
    assert.equal(result.skippedIneligible, 1);
  });

  it("publication digest template includes title, URL, image, unsubscribe", () => {
    const rendered = renderEmailTemplate("blog_publication_digest", {
      title: "Civic Hope",
      excerpt: "A short excerpt",
      publicationUrl: "https://example.com/blog/civic-hope",
      unsubscribeUrl: "https://example.com/blog/subscribe/unsubscribe?token=xyz",
      coverImageUrl: "https://cdn.example.com/cover.jpg",
    });
    assert.match(rendered.subject, /Civic Hope/);
    assert.match(rendered.html, /Civic Hope/);
    assert.match(rendered.html, /blog\/civic-hope/);
    assert.match(rendered.html, /cdn\.example\.com\/cover\.jpg/);
    assert.match(rendered.html, /unsubscribe\?token=xyz/);
    assert.match(rendered.html, /Read publication/);
  });

  it("omits non-https cover images from template", () => {
    const rendered = renderEmailTemplate("blog_publication_digest", {
      title: "No Image",
      excerpt: "x",
      publicationUrl: "https://example.com/blog/x",
      unsubscribeUrl: "https://example.com/u",
      coverImageUrl: "http://insecure.example.com/a.jpg",
    });
    assert.doesNotMatch(rendered.html, /insecure\.example\.com/);
  });

  it("wires bootstrap registration and does not emit per-subscriber outbox events", () => {
    const bootstrap = readApi("src/infrastructure/events/bootstrap-event-infrastructure.ts");
    assert.match(bootstrap, /registerBlogPublicationDeliveryHandlers/);

    const service = readApi("src/modules/blog/blog-publication-delivery.service.ts");
    assert.match(service, /sendTransactionalEmailAndAwait|sendPublicationEmail/);
    assert.doesNotMatch(service, /emitBlogPostPublished\(/);
    assert.doesNotMatch(service, /enqueueDomainEvent/);

    const emit = readApi("src/modules/blog/blog.events.ts");
    assert.match(emit, /emitBlogPostPublished/);

    const blogService = readApi("src/modules/blog/blog.service.ts");
    assert.match(blogService, /releaseDueScheduledBlogPublications/);
    assert.match(blogService, /emitBlogPostPublished/);
  });

  it("scheduled creation path does not emit BlogPostPublished until published", () => {
    const blogService = readApi("src/modules/blog/blog.service.ts");
    // Author notify may fire for scheduled; domain BlogPostPublished only when status published.
    assert.match(
      blogService,
      /if \(updated\.status === "published"\)[\s\S]*emitBlogPostPublished/,
    );
  });

  it("Admin table still binds emailsSent from directory item", () => {
    const webRoot = path.resolve(apiRoot, "../web/src");
    const section = readFileSync(
      path.join(
        webRoot,
        "features/administration/components/AdminViewsSubscribersSection.tsx",
      ),
      "utf8",
    );
    assert.match(section, /row\.emailsSent/);
  });
});
