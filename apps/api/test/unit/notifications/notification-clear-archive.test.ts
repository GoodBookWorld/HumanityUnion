import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  archiveNotification,
  clearArchivedNotificationsForUser,
  createNotification,
  listMyNotifications,
  resetNotificationsForTests,
} from "../../../src/modules/notifications/notification.service.js";

const USER_A = "user-clear-archive-a";
const USER_B = "user-clear-archive-b";
const PROFILE_A = "profile-clear-archive-a";
const PROFILE_B = "profile-clear-archive-b";

function buildInput(
  userId: string,
  profileId: string,
  overrides: Partial<Parameters<typeof createNotification>[0]> = {},
) {
  return {
    recipientUserId: userId,
    recipientProfileId: profileId,
    eventType: "initiative_published" as never,
    title: "Published",
    message: "An initiative was published.",
    relatedEntityType: "initiative" as const,
    relatedEntityId: "initiative-clear-archive-1",
    relatedUrl: "/initiatives/public/initiative-clear-archive-1",
    priority: "normal" as const,
    ...overrides,
  };
}

describe("Participant UX Pack 01 — clearArchivedNotificationsForUser", () => {
  afterEach(() => {
    resetNotificationsForTests();
  });

  it("deletes archived notifications for the authenticated user only", async () => {
    const activeA = await createNotification(buildInput(USER_A, PROFILE_A));
    const archivedA = await createNotification(
      buildInput(USER_A, PROFILE_A, { relatedEntityId: "initiative-clear-archive-2" }),
    );
    const archivedB = await createNotification(buildInput(USER_B, PROFILE_B));

    await archiveNotification(archivedA.notificationId, USER_A);
    await archiveNotification(archivedB.notificationId, USER_B);

    const result = await clearArchivedNotificationsForUser(USER_A);

    assert.equal(result.deletedCount, 1);

    const remainingA = await listMyNotifications({ userId: USER_A });
    assert.equal(remainingA.notifications.length, 1);
    assert.equal(remainingA.notifications[0]?.notificationId, activeA.notificationId);
    assert.notEqual(remainingA.notifications[0]?.status, "archived");

    const remainingB = await listMyNotifications({ userId: USER_B, status: "archived" });
    assert.equal(remainingB.notifications.length, 1);
    assert.equal(remainingB.notifications[0]?.notificationId, archivedB.notificationId);
  });

  it("does not remove active/unarchived notifications", async () => {
    const unread = await createNotification(buildInput(USER_A, PROFILE_A));
    const archived = await createNotification(
      buildInput(USER_A, PROFILE_A, { relatedEntityId: "initiative-clear-archive-3" }),
    );
    await archiveNotification(archived.notificationId, USER_A);

    await clearArchivedNotificationsForUser(USER_A);

    const remaining = await listMyNotifications({ userId: USER_A });
    assert.equal(remaining.notifications.length, 1);
    assert.equal(remaining.notifications[0]?.notificationId, unread.notificationId);
  });
});
