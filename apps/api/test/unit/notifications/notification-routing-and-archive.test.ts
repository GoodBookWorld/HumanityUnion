import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  archiveNotification,
  createNotification,
  deleteArchivedNotification,
  markNotificationsReadByRelatedEntity,
  resetNotificationsForTests,
} from "../../../src/modules/notifications/notification.service.js";

const USER_ID = "user-notification-routing-1";
const PROFILE_ID = "profile-notification-routing-1";
const INITIATIVE_ID = "initiative-routing-1";

function buildNotificationInput(
  overrides: Partial<Parameters<typeof createNotification>[0]> = {},
) {
  return {
    recipientUserId: USER_ID,
    recipientProfileId: PROFILE_ID,
    eventType: "initiative_collaboration_channel_message_received" as const,
    title: "New message",
    message: "Someone sent a message.",
    relatedEntityType: "initiative" as const,
    relatedEntityId: INITIATIVE_ID,
    relatedUrl: `/workspace/messages?mode=initiative&initiativeId=${INITIATIVE_ID}`,
    priority: "normal" as const,
    ...overrides,
  };
}

describe("Lifecycle UX Correction Pack 01 Part 1 — narrowed markNotificationsReadByRelatedEntity", () => {
  afterEach(() => {
    resetNotificationsForTests();
  });

  it("without an eventTypes filter, marks every unread notification for the related entity as read (existing Direct Messaging behavior, unchanged)", async () => {
    await createNotification(buildNotificationInput({ eventType: "initiative_collaboration_channel_message_received" }));
    await createNotification(
      buildNotificationInput({ eventType: "initiative_published" as never, relatedEntityId: INITIATIVE_ID }),
    );

    const result = await markNotificationsReadByRelatedEntity(USER_ID, "initiative", INITIATIVE_ID);

    assert.equal(result.updatedCount, 2);
  });

  it("with an eventTypes filter, marks read only the matching event types, leaving an unrelated platform Notification for the same entity untouched", async () => {
    await createNotification(
      buildNotificationInput({ eventType: "initiative_collaboration_channel_message_received" }),
    );
    await createNotification(
      buildNotificationInput({ eventType: "initiative_published" as never, relatedEntityId: INITIATIVE_ID }),
    );

    const result = await markNotificationsReadByRelatedEntity(USER_ID, "initiative", INITIATIVE_ID, [
      "initiative_collaboration_channel_message_received",
      "initiative_collaboration_channel_system_event",
    ]);

    assert.equal(result.updatedCount, 1);
  });
});

describe("Lifecycle UX Correction Pack 01 Part 4/9 — deleteArchivedNotification", () => {
  afterEach(() => {
    resetNotificationsForTests();
  });

  it("rejects deleting a still-unread/unarchived notification", async () => {
    const notification = await createNotification(buildNotificationInput());

    await assert.rejects(() => deleteArchivedNotification(notification.notificationId, USER_ID));
  });

  it("deletes only the archived notification record, leaving other notifications untouched", async () => {
    const toDelete = await createNotification(buildNotificationInput());
    const toKeep = await createNotification(buildNotificationInput({ relatedEntityId: "initiative-routing-2" }));

    await archiveNotification(toDelete.notificationId, USER_ID);
    await deleteArchivedNotification(toDelete.notificationId, USER_ID);

    await assert.rejects(() => archiveNotification(toDelete.notificationId, USER_ID));
    await archiveNotification(toKeep.notificationId, USER_ID);
  });

  it("rejects deleting a notification owned by a different recipient", async () => {
    const notification = await createNotification(buildNotificationInput());
    await archiveNotification(notification.notificationId, USER_ID);

    await assert.rejects(() => deleteArchivedNotification(notification.notificationId, "someone-else"));
  });
});
