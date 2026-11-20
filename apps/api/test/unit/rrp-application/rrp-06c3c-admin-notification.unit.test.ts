/**
 * HU-RRP-06C.3C — RrpApplicationSubmitted → Pack 22E Admin Notification consumer.
 */
process.env.NODE_TEST_ENV = "true";

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { ADMIN_NOTIFICATION_TYPES } from "@hu/types";

import { CATALOGUE_EVENTS } from "../../../src/infrastructure/events/catalogue-events.js";
import {
  clearDomainEventHandlers,
  getHandlersForEvent,
} from "../../../src/infrastructure/integration/event-handler-registry.js";
import { AdministrationValidationError } from "../../../src/modules/administration/administration.errors.js";
import {
  ADMIN_NOTIFICATIONS_BLOG_POST_PUBLISHED_CONSUMER_ID,
  ADMIN_NOTIFICATIONS_BLOG_SUBSCRIBER_CONFIRMED_CONSUMER_ID,
  ADMIN_NOTIFICATIONS_INITIATIVE_PUBLISHED_CONSUMER_ID,
  ADMIN_NOTIFICATIONS_MEMBER_REGISTERED_CONSUMER_ID,
  ADMIN_NOTIFICATIONS_RRP_APPLICATION_SUBMITTED_CONSUMER_ID,
  handleRrpApplicationSubmittedAdminNotification,
  registerAdminNotificationHandlers,
  resetAdminNotificationHandlersForTests,
  resetAdminNotificationPersistenceResolverForTests,
  resetMemoryAdminNotificationPersistenceForTests,
} from "../../../src/modules/admin-notifications/index.js";
import { createMemoryAdminNotificationPersistenceAdapter } from "../../../src/modules/admin-notifications/persistence/admin-notification-memory.persistence.js";
import { createRrpApplicationSubmittedEvent } from "../../../src/modules/rrp-application/rrp-application-submitted.event.js";
import { deriveRrpApplicationNeedsAdminAttention } from "../../../src/modules/administration/admin-rrp-directory-summary.js";

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

describe("HU-RRP-06C.3C RRP Admin Notification consumer", () => {
  beforeEach(() => {
    resetMemoryAdminNotificationPersistenceForTests();
    resetAdminNotificationPersistenceResolverForTests();
    resetAdminNotificationHandlersForTests();
    clearDomainEventHandlers();
  });

  afterEach(() => {
    resetMemoryAdminNotificationPersistenceForTests();
    resetAdminNotificationPersistenceResolverForTests();
    resetAdminNotificationHandlersForTests();
    clearDomainEventHandlers();
  });

  it("includes rrp_application_submitted in the admin notification type catalogue", () => {
    assert.ok(ADMIN_NOTIFICATION_TYPES.includes("rrp_application_submitted"));
  });

  it("projects submit events to active admins with deep link and sourceEventId", async () => {
    const event = createRrpApplicationSubmittedEvent({
      applicationId: "app-rrp-1",
      participantId: "participant-rrp-1",
      submittedAt: "2026-11-20T16:00:00.000Z",
      actorId: "user-rrp-1",
    });
    const envelope = {
      eventId: event.eventId,
      eventName: event.eventName,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payload: event.payload,
      metadata: event.metadata,
    };

    await handleRrpApplicationSubmittedAdminNotification(envelope, {
      listActiveAdminUserIds: listAdmins,
      persistence,
    });

    assert.equal(await persistence.countByRecipient(ADMIN_A), 1);
    assert.equal(await persistence.countByRecipient(ADMIN_B), 1);

    const row = (await persistence.list({ recipientAdminUserId: ADMIN_A }))[0]!;
    assert.equal(row.type, "rrp_application_submitted");
    assert.equal(row.sourceEventId, event.eventId);
    assert.equal(
      row.targetHref,
      "/admin/participants?participantId=participant-rrp-1&rrpApplicationId=app-rrp-1",
    );
    assert.doesNotMatch(row.targetHref ?? "", /dateOfBirth|motivation|funding|annualRequested/i);
    assert.doesNotMatch(JSON.stringify(row), /dateOfBirth|motivation|Lovelace/i);
  });

  it("does not duplicate inbox rows when the same event is processed twice", async () => {
    const event = createRrpApplicationSubmittedEvent({
      applicationId: "app-rrp-2",
      participantId: "participant-rrp-2",
      submittedAt: "2026-11-20T16:05:00.000Z",
    });
    const envelope = {
      eventId: event.eventId,
      eventName: event.eventName,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payload: event.payload,
      metadata: event.metadata,
    };

    await handleRrpApplicationSubmittedAdminNotification(envelope, {
      listActiveAdminUserIds: listAdmins,
      persistence,
    });
    await handleRrpApplicationSubmittedAdminNotification(envelope, {
      listActiveAdminUserIds: listAdmins,
      persistence,
    });

    assert.equal(await persistence.countByRecipient(ADMIN_A), 1);
    assert.equal(await persistence.countByRecipient(ADMIN_B), 1);
  });

  it("propagates projection failures for Outbox retry", async () => {
    const event = createRrpApplicationSubmittedEvent({
      applicationId: "app-rrp-3",
      participantId: "participant-rrp-3",
      submittedAt: "2026-11-20T16:10:00.000Z",
    });
    await assert.rejects(
      () =>
        handleRrpApplicationSubmittedAdminNotification(
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
            persistence: {
              ...persistence,
              async insertIfAbsent() {
                throw new Error("forced projection failure");
              },
            },
          },
        ),
      /forced projection failure/,
    );
  });

  it("registers the RRP consumer alongside existing Pack 22E handlers", () => {
    registerAdminNotificationHandlers();
    assert.equal(
      getHandlersForEvent(CATALOGUE_EVENTS.rrpApplicationSubmitted).some(
        (h) => h.consumerId === ADMIN_NOTIFICATIONS_RRP_APPLICATION_SUBMITTED_CONSUMER_ID,
      ),
      true,
    );
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

    const bootstrap = readApi("src/infrastructure/events/bootstrap-event-infrastructure.ts");
    assert.match(bootstrap, /registerAdminNotificationHandlers/);
    const index = readApi("src/modules/admin-notifications/index.ts");
    assert.match(index, /rrpApplicationSubmitted/);
    assert.match(index, /handleRrpApplicationSubmittedAdminNotification/);
  });

  it("Clear notification does not alter durable 06B attention derivation", () => {
    const attentionBefore = deriveRrpApplicationNeedsAdminAttention({
      status: "submitted",
      submittedAt: "2026-11-20T16:00:00.000Z",
      reviewedAt: null,
    });
    assert.equal(attentionBefore, true);

    const deleteService = readApi("src/modules/admin-notifications/admin-notification.service.ts");
    assert.match(deleteService, /deleteAdminNotificationForActor/);
    assert.doesNotMatch(deleteService, /reviewedAt|rrp_applications|replaceRrpApplication/);

    const attentionAfter = deriveRrpApplicationNeedsAdminAttention({
      status: "submitted",
      submittedAt: "2026-11-20T16:00:00.000Z",
      reviewedAt: null,
    });
    assert.equal(attentionAfter, true);
  });

  function malformedEnvelope(payload: Record<string, unknown>) {
    return {
      eventId: "evt-malformed",
      eventName: CATALOGUE_EVENTS.rrpApplicationSubmitted,
      aggregateType: "RrpApplication",
      aggregateId: "unknown",
      payload,
      metadata: {
        occurredAt: "2026-11-20T16:00:00.000Z",
        correlationId: null,
        causationId: null,
        actorId: null,
      },
    };
  }

  it("fails explicitly when applicationId is missing", async () => {
    await assert.rejects(
      () =>
        handleRrpApplicationSubmittedAdminNotification(
          malformedEnvelope({
            participantId: "participant-1",
            submittedAt: "2026-11-20T16:00:00.000Z",
          }),
          { listActiveAdminUserIds: listAdmins, persistence },
        ),
      AdministrationValidationError,
    );
    assert.equal(await persistence.countByRecipient(ADMIN_A), 0);
  });

  it("fails explicitly when participantId is missing", async () => {
    await assert.rejects(
      () =>
        handleRrpApplicationSubmittedAdminNotification(
          malformedEnvelope({
            applicationId: "app-1",
            submittedAt: "2026-11-20T16:00:00.000Z",
          }),
          { listActiveAdminUserIds: listAdmins, persistence },
        ),
      AdministrationValidationError,
    );
    assert.equal(await persistence.countByRecipient(ADMIN_A), 0);
  });

  it("fails explicitly when submittedAt is missing or blank", async () => {
    await assert.rejects(
      () =>
        handleRrpApplicationSubmittedAdminNotification(
          malformedEnvelope({
            applicationId: "app-1",
            participantId: "participant-1",
          }),
          { listActiveAdminUserIds: listAdmins, persistence },
        ),
      AdministrationValidationError,
    );
    await assert.rejects(
      () =>
        handleRrpApplicationSubmittedAdminNotification(
          malformedEnvelope({
            applicationId: "app-1",
            participantId: "participant-1",
            submittedAt: "   ",
          }),
          { listActiveAdminUserIds: listAdmins, persistence },
        ),
      AdministrationValidationError,
    );
    assert.equal(await persistence.countByRecipient(ADMIN_A), 0);
  });

  it("does not project on validation failure so Outbox cannot mark success", async () => {
    const consumers = readApi("src/modules/admin-notifications/admin-notification.consumers.ts");
    assert.match(
      consumers,
      /throw new AdministrationValidationError\(\s*"RrpApplicationSubmitted requires applicationId/,
    );
    assert.match(
      consumers,
      /throw new AdministrationValidationError\(\s*"RrpApplicationSubmitted requires participantId/,
    );
    assert.match(
      consumers,
      /throw new AdministrationValidationError\(\s*"RrpApplicationSubmitted requires submittedAt/,
    );
    assert.doesNotMatch(
      consumers.slice(consumers.indexOf("handleRrpApplicationSubmittedAdminNotification")),
      /if \(!applicationId \|\| !participantId\) \{\s*return;/,
    );
  });
});
