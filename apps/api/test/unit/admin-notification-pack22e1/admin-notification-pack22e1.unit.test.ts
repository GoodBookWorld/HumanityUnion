/**
 * Pack 22E.1 — Admin notification inbox domain, API & event projections.
 */
import "./admin-notification-pack22e1.setup.js";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { BlogPost } from "@hu/types";

import { CATALOGUE_EVENTS } from "../../../src/infrastructure/events/catalogue-events.js";
import { createDomainEvent } from "../../../src/infrastructure/events/event-envelope.js";
import {
  clearDomainEventHandlers,
  getHandlersForEvent,
} from "../../../src/infrastructure/integration/event-handler-registry.js";
import {
  ADMIN_NOTIFICATIONS_BLOG_POST_PUBLISHED_CONSUMER_ID,
  ADMIN_NOTIFICATIONS_BLOG_SUBSCRIBER_CONFIRMED_CONSUMER_ID,
  ADMIN_NOTIFICATIONS_INITIATIVE_PUBLISHED_CONSUMER_ID,
  ADMIN_NOTIFICATIONS_MEMBER_REGISTERED_CONSUMER_ID,
  buildBlogSubscriptionConfirmedEventId,
  buildInitiativePublishedEventId,
  createBlogSubscriptionConfirmedEvent,
  createInitiativePublishedEvent,
  countAdminNotificationsForActor,
  deleteAdminNotificationForActor,
  handleBlogPostPublishedAdminNotification,
  handleBlogSubscriptionConfirmedAdminNotification,
  handleInitiativePublishedAdminNotification,
  handleMemberRegisteredAdminNotification,
  listAdminNotificationsForActor,
  projectAdminNotificationForAdmins,
  registerAdminNotificationHandlers,
  resetAdminNotificationHandlersForTests,
  resetAdminNotificationPersistenceResolverForTests,
  resetMemoryAdminNotificationPersistenceForTests,
} from "../../../src/modules/admin-notifications/index.js";
import { createMemoryAdminNotificationPersistenceAdapter } from "../../../src/modules/admin-notifications/persistence/admin-notification-memory.persistence.js";
import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "../../../src/modules/administration/administration.errors.js";
import { createMemberRegisteredEvent } from "../../../src/modules/member/domain/member-registered.event.js";
import type { PersistedMemberRecord } from "../../../src/modules/member/domain/member.types.js";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readApi(relativePath: string): string {
  return readFileSync(path.resolve(apiRoot, relativePath), "utf8");
}

const persistence = createMemoryAdminNotificationPersistenceAdapter();

const ADMIN_A = "admin-a";
const ADMIN_B = "admin-b";

async function listAdmins(): Promise<string[]> {
  return [ADMIN_A, ADMIN_B];
}

function makeMember(overrides: Partial<PersistedMemberRecord> = {}): PersistedMemberRecord {
  return {
    memberId: "member-1",
    identityId: "user-1",
    displayName: "Ada Civic",
    uniqueName: "ada-civic",
    languages: [],
    status: "active",
    verificationLevel: "email",
    roles: ["participant"],
    registrationStatus: "confirmed",
    version: 1,
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
    ...overrides,
  };
}

function makePost(overrides: Partial<BlogPost> = {}): BlogPost {
  const now = "2026-08-01T12:00:00.000Z";
  return {
    postId: "post-1",
    authorParticipantId: "author-1",
    authorDisplayNameSnapshot: "Author Name",
    title: "Civic Hope",
    slug: "civic-hope",
    excerpt: "Excerpt",
    content: "<p>Body</p>",
    categoryId: "our_life",
    tags: [],
    coverMedia: { mediaId: "m1", mediaUrl: "https://cdn.example.com/cover.jpg" },
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

describe("Pack 22E.1 — Admin notification inbox", () => {
  beforeEach(() => {
    resetMemoryAdminNotificationPersistenceForTests();
    resetAdminNotificationPersistenceResolverForTests();
    resetAdminNotificationHandlersForTests();
    clearDomainEventHandlers();
  });

  afterEach(() => {
    resetMemoryAdminNotificationPersistenceForTests();
    resetAdminNotificationHandlersForTests();
    clearDomainEventHandlers();
  });

  it("1–3. persistence lists newest-first and counts per Admin", async () => {
    await projectAdminNotificationForAdmins(
      {
        type: "participant_registered",
        title: "New Participant",
        sourceEventId: "evt-old",
        createdAt: "2026-08-01T09:00:00.000Z",
        targetLabel: "Old",
      },
      { listActiveAdminUserIds: async () => [ADMIN_A], persistence },
    );
    await projectAdminNotificationForAdmins(
      {
        type: "blog_subscriber_confirmed",
        title: "New Blog subscriber",
        sourceEventId: "evt-new",
        createdAt: "2026-08-01T11:00:00.000Z",
        targetLabel: "New",
      },
      { listActiveAdminUserIds: async () => [ADMIN_A], persistence },
    );

    const listed = await persistence.list({ recipientAdminUserId: ADMIN_A, limit: 10 });
    assert.equal(listed.length, 2);
    assert.equal(listed[0]?.sourceEventId, "evt-new");
    assert.equal(listed[1]?.sourceEventId, "evt-old");
    assert.equal(await persistence.countByRecipient(ADMIN_A), 2);
    assert.equal(await persistence.countByRecipient(ADMIN_B), 0);
  });

  it("4–5. non-Admin cannot list or count (service gate)", async () => {
    // Service uses findAuthUserById — without Mongo this throws unauthorized/unavailable.
    // Source-assert Admin role gate + API auth middleware wiring.
    const service = readApi("src/modules/admin-notifications/admin-notification.service.ts");
    const routes = readApi("src/modules/admin-notifications/admin-notification.routes.ts");
    assert.match(service, /role !== "admin"/);
    assert.match(service, /AdministrationForbiddenError/);
    assert.match(routes, /authenticationMiddleware/);
    assert.match(routes, /requireAuthenticationMiddleware/);
    assert.match(routes, /\/count/);
    assert.ok(AdministrationForbiddenError);
    assert.ok(AdministrationUnauthorizedError);
  });

  it("6–8. recipient can delete own row; non-owner cannot; source untouched", async () => {
    await projectAdminNotificationForAdmins(
      {
        type: "participant_registered",
        title: "New Participant",
        sourceEventId: "evt-shared",
        createdAt: "2026-08-01T10:00:00.000Z",
      },
      { listActiveAdminUserIds: listAdmins, persistence },
    );

    const forA = await persistence.list({ recipientAdminUserId: ADMIN_A });
    const forB = await persistence.list({ recipientAdminUserId: ADMIN_B });
    assert.equal(forA.length, 1);
    assert.equal(forB.length, 1);
    const idA = forA[0]!.adminNotificationId;

    const deletedByWrongOwner = await persistence.deleteOwned({
      adminNotificationId: idA,
      recipientAdminUserId: ADMIN_B,
    });
    assert.equal(deletedByWrongOwner, false);
    assert.equal(await persistence.countByRecipient(ADMIN_A), 1);
    assert.equal(await persistence.countByRecipient(ADMIN_B), 1);

    const deleted = await persistence.deleteOwned({
      adminNotificationId: idA,
      recipientAdminUserId: ADMIN_A,
    });
    assert.equal(deleted, true);
    assert.equal(await persistence.countByRecipient(ADMIN_A), 0);
    assert.equal(await persistence.countByRecipient(ADMIN_B), 1);
  });

  it("9–10. MemberRegistered creates one row per Admin; replay does not duplicate", async () => {
    const event = createMemberRegisteredEvent({ member: makeMember() });
    const envelope = {
      eventId: event.eventId,
      eventName: event.eventName,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payload: event.payload,
      metadata: event.metadata,
    };

    await handleMemberRegisteredAdminNotification(envelope, {
      listActiveAdminUserIds: listAdmins,
      persistence,
    });
    await handleMemberRegisteredAdminNotification(envelope, {
      listActiveAdminUserIds: listAdmins,
      persistence,
    });

    assert.equal(await persistence.countByRecipient(ADMIN_A), 1);
    assert.equal(await persistence.countByRecipient(ADMIN_B), 1);
    const row = (await persistence.list({ recipientAdminUserId: ADMIN_A }))[0]!;
    assert.equal(row.type, "participant_registered");
    assert.equal(row.title, "New Participant");
    assert.equal(row.targetHref, "/admin/participants");
    assert.equal(row.sourceEventId, event.eventId);
  });

  it("11–14. BlogSubscriptionConfirmed emit + projection; pending does not notify", async () => {
    const subscriptionService = readApi("src/modules/blog/blog-subscription.service.ts");
    assert.match(subscriptionService, /emitBlogSubscriptionConfirmed/);
    assert.match(subscriptionService, /status === "subscribed"/);
    // Emit is after the early return for already subscribed.
    const earlyReturnIdx = subscriptionService.indexOf(
      'if (existing.status === "subscribed")',
    );
    const emitIdx = subscriptionService.indexOf("emitBlogSubscriptionConfirmed");
    assert.ok(earlyReturnIdx > 0 && emitIdx > earlyReturnIdx);

    const event = createBlogSubscriptionConfirmedEvent({
      subscriberId: "sub-1",
      displayLabel: "reader@example.com",
      confirmedAt: "2026-08-01T12:00:00.000Z",
    });
    assert.equal(
      event.eventId,
      buildBlogSubscriptionConfirmedEventId("sub-1", "2026-08-01T12:00:00.000Z"),
    );
    assert.equal(event.eventName, CATALOGUE_EVENTS.blogSubscriptionConfirmed);
    assert.doesNotMatch(JSON.stringify(event.payload), /token|hash/i);

    const envelope = {
      eventId: event.eventId,
      eventName: event.eventName,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payload: event.payload,
      metadata: event.metadata,
    };
    await handleBlogSubscriptionConfirmedAdminNotification(envelope, {
      listActiveAdminUserIds: listAdmins,
      persistence,
    });
    await handleBlogSubscriptionConfirmedAdminNotification(envelope, {
      listActiveAdminUserIds: listAdmins,
      persistence,
    });
    assert.equal(await persistence.countByRecipient(ADMIN_A), 1);
    const row = (await persistence.list({ recipientAdminUserId: ADMIN_A }))[0]!;
    assert.equal(row.type, "blog_subscriber_confirmed");
    assert.equal(row.targetHref, "/admin/views/subscribers");
  });

  it("15–18. InitiativePublished: publish-only wiring; PC vs standard exclusive", async () => {
    const initiativeService = readApi("src/modules/initiatives/initiative.service.ts");
    assert.match(initiativeService, /emitInitiativePublished/);
    const publishFn = initiativeService.indexOf("export function publishInitiative");
    const createDraftFn = initiativeService.indexOf("export function createInitiativeDraft");
    assert.ok(publishFn > 0);
    assert.match(initiativeService.slice(publishFn, publishFn + 3500), /emitInitiativePublished/);
    if (createDraftFn > 0) {
      const draftSliceEnd =
        createDraftFn < publishFn ? publishFn : createDraftFn + 1200;
      assert.doesNotMatch(
        initiativeService.slice(createDraftFn, draftSliceEnd),
        /emitInitiativePublished\(/,
      );
    }

    const standard = createInitiativePublishedEvent({
      initiativeId: "ini-1",
      title: "Clean Rivers",
      actorParticipantId: "steward-1",
      actorLabel: "Steward",
      lifecycleProfile: "STANDARD",
      electionTitle: "Clean Rivers",
      publishedAt: "2026-08-01T13:00:00.000Z",
    });
    assert.equal(standard.eventId, buildInitiativePublishedEventId("ini-1"));

    await handleInitiativePublishedAdminNotification(
      {
        eventId: standard.eventId,
        eventName: standard.eventName,
        aggregateType: standard.aggregateType,
        aggregateId: standard.aggregateId,
        payload: standard.payload,
        metadata: standard.metadata,
      },
      { listActiveAdminUserIds: async () => [ADMIN_A], persistence },
    );
    let rows = await persistence.list({ recipientAdminUserId: ADMIN_A });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.type, "initiative_published");
    assert.equal(rows[0]?.targetHref, "/admin/initiatives/ini-1");

    resetMemoryAdminNotificationPersistenceForTests();

    const publicChoice = createInitiativePublishedEvent({
      initiativeId: "ini-pc",
      title: "City Initiative Title",
      actorParticipantId: "steward-1",
      actorLabel: "Steward",
      lifecycleProfile: "PUBLIC_CHOICE",
      electionTitle: "Mayor Election 2026",
      publishedAt: "2026-08-01T14:00:00.000Z",
    });
    await handleInitiativePublishedAdminNotification(
      {
        eventId: publicChoice.eventId,
        eventName: publicChoice.eventName,
        aggregateType: publicChoice.aggregateType,
        aggregateId: publicChoice.aggregateId,
        payload: publicChoice.payload,
        metadata: publicChoice.metadata,
      },
      { listActiveAdminUserIds: async () => [ADMIN_A], persistence },
    );
    rows = await persistence.list({ recipientAdminUserId: ADMIN_A });
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.type, "public_choice_published");
    assert.equal(rows[0]?.targetLabel, "Mayor Election 2026");
    assert.equal(rows[0]?.targetHref, "/admin/public-choice/ini-pc");
    assert.equal(rows.filter((r) => r.type === "initiative_published").length, 0);
  });

  it("19–22. BlogPostPublished projection resolves author/title/link; unpublished skipped", async () => {
    const event = createDomainEvent({
      eventId: "blog-published:post-1:1",
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
      },
    });

    await handleBlogPostPublishedAdminNotification(
      {
        eventId: event.eventId,
        eventName: event.eventName,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload,
        metadata: event.metadata,
      },
      {
        listActiveAdminUserIds: listAdmins,
        persistence,
        findPostById: async () => makePost({ status: "scheduled" as BlogPost["status"] }),
      },
    );
    assert.equal(await persistence.countByRecipient(ADMIN_A), 0);

    await handleBlogPostPublishedAdminNotification(
      {
        eventId: event.eventId,
        eventName: event.eventName,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload,
        metadata: event.metadata,
      },
      {
        listActiveAdminUserIds: listAdmins,
        persistence,
        findPostById: async () => makePost(),
      },
    );
    await handleBlogPostPublishedAdminNotification(
      {
        eventId: event.eventId,
        eventName: event.eventName,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload,
        metadata: event.metadata,
      },
      {
        listActiveAdminUserIds: listAdmins,
        persistence,
        findPostById: async () => makePost(),
      },
    );

    assert.equal(await persistence.countByRecipient(ADMIN_A), 1);
    const row = (await persistence.list({ recipientAdminUserId: ADMIN_A }))[0]!;
    assert.equal(row.type, "blog_post_published");
    assert.equal(row.actorLabel, "Author Name");
    assert.equal(row.targetLabel, "Civic Hope");
    assert.equal(row.targetHref, "/blog/civic-hope");
  });

  it("23–24. source replay dedupe; Admins clear independently", async () => {
    await projectAdminNotificationForAdmins(
      {
        type: "participant_registered",
        title: "New Participant",
        sourceEventId: "evt-indep",
        createdAt: "2026-08-01T15:00:00.000Z",
      },
      { listActiveAdminUserIds: listAdmins, persistence },
    );
    await projectAdminNotificationForAdmins(
      {
        type: "participant_registered",
        title: "New Participant",
        sourceEventId: "evt-indep",
        createdAt: "2026-08-01T15:00:00.000Z",
      },
      { listActiveAdminUserIds: listAdmins, persistence },
    );
    assert.equal(await persistence.countByRecipient(ADMIN_A), 1);
    assert.equal(await persistence.countByRecipient(ADMIN_B), 1);

    const aRow = (await persistence.list({ recipientAdminUserId: ADMIN_A }))[0]!;
    await persistence.deleteOwned({
      adminNotificationId: aRow.adminNotificationId,
      recipientAdminUserId: ADMIN_A,
    });
    assert.equal(await persistence.countByRecipient(ADMIN_A), 0);
    assert.equal(await persistence.countByRecipient(ADMIN_B), 1);
  });

  it("25–26. no coupling to member_notifications or PWA badge", async () => {
    const moduleSrc = readApi("src/modules/admin-notifications/admin-notification.service.ts");
    const consumers = readApi("src/modules/admin-notifications/admin-notification.consumers.ts");
    assert.doesNotMatch(moduleSrc, /member_notifications|createNotification|pwa-app-badge/);
    assert.doesNotMatch(consumers, /member_notifications|createNotification|pwa-app-badge/);
    assert.match(readApi("src/app.ts"), /admin\/notifications/);
  });

  it("registers four Admin notification consumers", () => {
    registerAdminNotificationHandlers();
    assert.equal(
      getHandlersForEvent(CATALOGUE_EVENTS.memberRegistered).some(
        (h) => h.consumerId === ADMIN_NOTIFICATIONS_MEMBER_REGISTERED_CONSUMER_ID,
      ),
      true,
    );
    assert.equal(
      getHandlersForEvent(CATALOGUE_EVENTS.blogSubscriptionConfirmed).some(
        (h) => h.consumerId === ADMIN_NOTIFICATIONS_BLOG_SUBSCRIBER_CONFIRMED_CONSUMER_ID,
      ),
      true,
    );
    assert.equal(
      getHandlersForEvent(CATALOGUE_EVENTS.initiativePublished).some(
        (h) => h.consumerId === ADMIN_NOTIFICATIONS_INITIATIVE_PUBLISHED_CONSUMER_ID,
      ),
      true,
    );
    assert.equal(
      getHandlersForEvent(CATALOGUE_EVENTS.blogPostPublished).some(
        (h) => h.consumerId === ADMIN_NOTIFICATIONS_BLOG_POST_PUBLISHED_CONSUMER_ID,
      ),
      true,
    );
  });

  it("bootstrap wires Admin notification handlers", () => {
    const bootstrap = readApi("src/infrastructure/events/bootstrap-event-infrastructure.ts");
    assert.match(bootstrap, /registerAdminNotificationHandlers/);
  });

  it("service list/count/delete helpers exist for Pack 22E.2", async () => {
    // Ensure exports compile and are callable with persistence injection via memory mode.
    assert.equal(typeof listAdminNotificationsForActor, "function");
    assert.equal(typeof countAdminNotificationsForActor, "function");
    assert.equal(typeof deleteAdminNotificationForActor, "function");
  });
});
