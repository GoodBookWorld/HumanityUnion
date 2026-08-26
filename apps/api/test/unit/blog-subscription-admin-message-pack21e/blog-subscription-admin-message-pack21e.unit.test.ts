/**
 * Pack 21E — Admin selected-subscriber message queue + durable fan-out.
 */
import "./blog-subscription-admin-message-pack21e.setup.js";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { BlogSubscriberRecord } from "@hu/types";

import {
  AdministrationForbiddenError,
  AdministrationValidationError,
} from "../../../src/modules/administration/administration.errors.js";
import { CATALOGUE_EVENTS } from "../../../src/infrastructure/events/catalogue-events.js";
import { createDomainEvent } from "../../../src/infrastructure/events/event-envelope.js";
import {
  clearDomainEventHandlers,
  getHandlersForEvent,
} from "../../../src/infrastructure/integration/event-handler-registry.js";
import { setBlogSubscriberAdminActorOverrideForTests } from "../../../src/modules/blog/blog-subscription-admin.service.js";
import {
  BLOG_ADMIN_SUBSCRIBER_MESSAGE_CONSUMER_ID,
  fanOutBlogAdminSubscriberMessage,
  registerBlogAdminSubscriberMessageHandlers,
  resetBlogAdminSubscriberMessageHandlersForTests,
} from "../../../src/modules/blog/blog-subscription-admin-message.index.js";
import { queueAdminBlogSubscriberMessage } from "../../../src/modules/blog/blog-subscription-admin-message.service.js";
import {
  BLOG_ADMIN_MESSAGE_MAX_RECIPIENTS,
  sanitizeAdminSubscriberIdList,
  sanitizeAdminSubscriberMessageBody,
  sanitizeAdminSubscriberMessageSubject,
} from "../../../src/modules/blog/blog-subscription-admin-message-validation.js";
import { renderEmailTemplate } from "../../../src/modules/email/email.templates.js";
import { findBlogAdminSubscriberMessageDelivery } from "../../../src/modules/blog/persistence/blog-admin-subscriber-message-delivery.repository.js";
import { resetBlogAdminSubscriberMessageDeliveriesForTests } from "../../../src/modules/blog/persistence/blog-admin-subscriber-message-delivery.repository.js";
import {
  findBlogAdminSubscriberMessageById,
  resetBlogAdminSubscriberMessagesForTests,
} from "../../../src/modules/blog/persistence/blog-admin-subscriber-message.repository.js";
import {
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
  status: BlogSubscriberRecord["status"];
  emailsSent?: number;
}): Promise<void> {
  const now = new Date().toISOString();
  await upsertBlogSubscriberRecord({
    subscriberId: input.subscriberId,
    emailNormalized: input.email.toLowerCase(),
    emailDisplay: input.email,
    status: input.status,
    subscriptionType: "blog_publications",
    emailsSent: input.emailsSent ?? 0,
    ...(input.status === "subscribed" ? { subscribedAt: now, confirmedAt: now } : {}),
    createdAt: now,
    updatedAt: now,
  });
}

describe("Pack 21E — Admin selected-subscriber messaging", () => {
  beforeEach(() => {
    resetBlogSubscribersForTests();
    resetBlogAdminSubscriberMessagesForTests();
    resetBlogAdminSubscriberMessageDeliveriesForTests();
    resetBlogAdminSubscriberMessageHandlersForTests();
    clearDomainEventHandlers();
    setBlogSubscriberAdminActorOverrideForTests({
      userId: "admin-1",
      participantId: "participant-admin-1",
      role: "admin",
    });
  });

  afterEach(() => {
    setBlogSubscriberAdminActorOverrideForTests(null);
    resetBlogAdminSubscriberMessageHandlersForTests();
    clearDomainEventHandlers();
  });

  it("validates subject, message, and recipient limits", () => {
    assert.equal(sanitizeAdminSubscriberMessageSubject("  Hello  "), "Hello");
    assert.throws(() => sanitizeAdminSubscriberMessageSubject("<b>x</b>"));
    assert.throws(() => sanitizeAdminSubscriberMessageBody("<script>"));
    assert.equal(sanitizeAdminSubscriberMessageBody(" Plain note. "), "Plain note.");
    assert.throws(() => sanitizeAdminSubscriberIdList([]));
    assert.throws(() =>
      sanitizeAdminSubscriberIdList(
        Array.from({ length: BLOG_ADMIN_MESSAGE_MAX_RECIPIENTS + 1 }, (_, i) => `id-${i}`),
      ),
    );
    assert.deepEqual(sanitizeAdminSubscriberIdList(["a", "a", "b"]), ["a", "b"]);
  });

  it("Admin-only queue; persists message + selected IDs; returns queued", async () => {
    setBlogSubscriberAdminActorOverrideForTests({
      userId: "member-1",
      participantId: "p-member",
      role: "member",
    });
    await assert.rejects(
      () =>
        queueAdminBlogSubscriberMessage({
          actorUserId: "member-1",
          body: {
            subject: "Hi",
            message: "Body",
            subscriberIds: ["s1"],
          },
          enqueue: async () => undefined,
        }),
      AdministrationForbiddenError,
    );

    setBlogSubscriberAdminActorOverrideForTests({
      userId: "admin-1",
      participantId: "participant-admin-1",
      role: "admin",
    });

    let enqueued = 0;
    const result = await queueAdminBlogSubscriberMessage({
      actorUserId: "admin-1",
      body: {
        subject: "Update",
        message: "Thank you for following our work.",
        subscriberIds: ["sub-a", "sub-b"],
      },
      enqueue: async () => {
        enqueued += 1;
      },
    });
    assert.equal(result.queued, true);
    assert.equal(result.status, "queued");
    assert.equal(result.selectedRecipientCount, 2);
    assert.equal(enqueued, 1);
    assert.match(result.message, /queued for 2/i);
    assert.doesNotMatch(result.message, /all emails sent/i);

    const stored = await findBlogAdminSubscriberMessageById(result.adminMessageId);
    assert.ok(stored);
    assert.deepEqual(stored!.selectedSubscriberIds, ["sub-a", "sub-b"]);
    assert.equal(stored!.subject, "Update");
    assert.equal(stored!.createdByParticipantId, "participant-admin-1");
  });

  it("rejects over-limit recipient list on queue", async () => {
    await assert.rejects(
      () =>
        queueAdminBlogSubscriberMessage({
          actorUserId: "admin-1",
          body: {
            subject: "Hi",
            message: "Body",
            subscriberIds: Array.from(
              { length: BLOG_ADMIN_MESSAGE_MAX_RECIPIENTS + 1 },
              (_, i) => `id-${i}`,
            ),
          },
          enqueue: async () => undefined,
        }),
      AdministrationValidationError,
    );
  });

  it("registers consumer and wires bootstrap / single-event architecture", () => {
    registerBlogAdminSubscriberMessageHandlers();
    const handlers = getHandlersForEvent(CATALOGUE_EVENTS.blogAdminSubscriberMessageQueued);
    assert.ok(
      handlers.some((row) => row.consumerId === BLOG_ADMIN_SUBSCRIBER_MESSAGE_CONSUMER_ID),
    );

    const bootstrap = readApi("src/infrastructure/events/bootstrap-event-infrastructure.ts");
    assert.match(bootstrap, /registerBlogAdminSubscriberMessageHandlers/);

    const routes = readApi("src/modules/blog/admin-publishing.routes.ts");
    assert.match(routes, /\/subscribers\/messages/);
    assert.match(routes, /queueAdminBlogSubscriberMessage/);

    const service = readApi("src/modules/blog/blog-subscription-admin-message.service.ts");
    assert.match(service, /blog\.subscriber_message\.queue/);
    assert.match(service, /subjectLength=/);
    assert.doesNotMatch(service, /afterSummary:.*message=/);

    const fanout = readApi("src/modules/blog/blog-subscription-admin-message-delivery.service.ts");
    assert.doesNotMatch(fanout, /enqueueDomainEvent/);
    assert.doesNotMatch(fanout, /emitBlogAdminSubscriberMessageQueued/);
  });

  it("sends only currently subscribed recipients and increments emailsSent once", async () => {
    await seedSubscriber({
      subscriberId: "sub-ok",
      email: "ok@example.com",
      status: "subscribed",
      emailsSent: 2,
    });
    await seedSubscriber({
      subscriberId: "sub-left",
      email: "left@example.com",
      status: "unsubscribed",
    });

    const queued = await queueAdminBlogSubscriberMessage({
      actorUserId: "admin-1",
      body: {
        subject: "Hello",
        message: "News for you.",
        subscriberIds: ["sub-ok", "sub-left"],
      },
      enqueue: async () => undefined,
    });

    const store = new Map<string, BlogSubscriberRecord>();
    const { findBlogSubscriberById } = await import(
      "../../../src/modules/blog/persistence/blog-subscriber.repository.js"
    );
    store.set("sub-ok", (await findBlogSubscriberById("sub-ok"))!);
    store.set("sub-left", (await findBlogSubscriberById("sub-left"))!);

    const sends: string[] = [];
    const envelope = createDomainEvent({
      eventName: CATALOGUE_EVENTS.blogAdminSubscriberMessageQueued,
      aggregateType: "BlogAdminSubscriberMessage",
      aggregateId: queued.adminMessageId,
      actorId: "participant-admin-1",
      payload: {
        adminMessageId: queued.adminMessageId,
        createdByParticipantId: "participant-admin-1",
        selectedRecipientCount: 2,
      },
    });

    const first = await fanOutBlogAdminSubscriberMessage({
      envelope,
      deps: {
        findMessageById: findBlogAdminSubscriberMessageById,
        findSubscriberById: async (id) => store.get(id) ?? null,
        upsertSubscriber: async (row) => {
          store.set(row.subscriberId, row);
          await upsertBlogSubscriberRecord(row);
          return row;
        },
        sendAdminMessageEmail: async ({ to, templateInput }) => {
          sends.push(to);
          assert.equal(templateInput.subject, "Hello");
          assert.match(String(templateInput.unsubscribeUrl), /unsubscribe\?token=/);
          return { emailSent: true, status: "sent" };
        },
      },
    });
    assert.equal(first.sent, 1);
    assert.equal(first.skippedIneligible, 1);
    assert.deepEqual(sends, ["ok@example.com"]);
    assert.equal(store.get("sub-ok")!.emailsSent, 3);

    const ledger = await findBlogAdminSubscriberMessageDelivery(
      queued.adminMessageId,
      "sub-ok",
    );
    assert.equal(ledger?.status, "sent");

    const second = await fanOutBlogAdminSubscriberMessage({
      envelope,
      deps: {
        findMessageById: findBlogAdminSubscriberMessageById,
        findSubscriberById: async (id) => store.get(id) ?? null,
        upsertSubscriber: async (row) => {
          store.set(row.subscriberId, row);
          return row;
        },
        sendAdminMessageEmail: async ({ to }) => {
          sends.push(to);
          return { emailSent: true, status: "sent" };
        },
      },
    });
    assert.equal(second.sent, 0);
    assert.equal(second.skippedAlreadySent, 1);
    assert.equal(store.get("sub-ok")!.emailsSent, 3);
    assert.equal(sends.length, 1);
  });

  it("skips subscriber who unsubscribed after selection (race)", async () => {
    const queued = await queueAdminBlogSubscriberMessage({
      actorUserId: "admin-1",
      body: {
        subject: "Race",
        message: "Body",
        subscriberIds: ["sub-race"],
      },
      enqueue: async () => undefined,
    });

    let sendCount = 0;
    const result = await fanOutBlogAdminSubscriberMessage({
      envelope: createDomainEvent({
        eventName: CATALOGUE_EVENTS.blogAdminSubscriberMessageQueued,
        aggregateType: "BlogAdminSubscriberMessage",
        aggregateId: queued.adminMessageId,
        actorId: "participant-admin-1",
        payload: { adminMessageId: queued.adminMessageId },
      }),
      deps: {
        findMessageById: findBlogAdminSubscriberMessageById,
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
        sendAdminMessageEmail: async () => {
          sendCount += 1;
          return { emailSent: true, status: "sent" };
        },
      },
    });
    assert.equal(sendCount, 0);
    assert.equal(result.skippedIneligible, 1);
  });

  it("failed send does not increment emailsSent", async () => {
    await seedSubscriber({
      subscriberId: "sub-fail",
      email: "fail@example.com",
      status: "subscribed",
      emailsSent: 0,
    });
    const queued = await queueAdminBlogSubscriberMessage({
      actorUserId: "admin-1",
      body: {
        subject: "Fail",
        message: "Body",
        subscriberIds: ["sub-fail"],
      },
      enqueue: async () => undefined,
    });
    const store = new Map<string, BlogSubscriberRecord>();
    const { findBlogSubscriberById } = await import(
      "../../../src/modules/blog/persistence/blog-subscriber.repository.js"
    );
    store.set("sub-fail", (await findBlogSubscriberById("sub-fail"))!);

    const result = await fanOutBlogAdminSubscriberMessage({
      envelope: createDomainEvent({
        eventName: CATALOGUE_EVENTS.blogAdminSubscriberMessageQueued,
        aggregateType: "BlogAdminSubscriberMessage",
        aggregateId: queued.adminMessageId,
        actorId: "participant-admin-1",
        payload: { adminMessageId: queued.adminMessageId },
      }),
      deps: {
        findMessageById: findBlogAdminSubscriberMessageById,
        findSubscriberById: async (id) => store.get(id) ?? null,
        upsertSubscriber: async (row) => {
          store.set(row.subscriberId, row);
          return row;
        },
        sendAdminMessageEmail: async () => ({
          emailSent: false,
          status: "failed",
          emailDeliveryError: "provider_error",
        }),
      },
    });
    assert.equal(result.failed, 1);
    assert.equal(store.get("sub-fail")!.emailsSent, 0);
  });

  it("admin message template uses HU branding and unsubscribe", () => {
    const rendered = renderEmailTemplate("blog_subscription_admin_message", {
      subject: "Platform note",
      message: "Thank you for staying engaged.",
      unsubscribeUrl: "https://example.com/blog/subscribe/unsubscribe?token=abc",
      ctaLabel: "Visit Blog",
      ctaUrl: "https://example.com/blog",
    });
    assert.equal(rendered.subject, "Platform note");
    assert.match(rendered.html, /Humanity Union Blog/);
    assert.match(rendered.html, /Thank you for staying engaged/);
    assert.match(rendered.html, /Visit Blog/);
    assert.match(rendered.html, /unsubscribe\?token=abc/);
    assert.doesNotMatch(rendered.html, /Admin identity|sent by admin/i);
  });
});
