import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  completeReminder,
  createReminderIfNotExists,
  deleteArchivedReminder,
  listMyReminders,
  resetRemindersForTests,
} from "../../../src/modules/reminders/reminder.service.js";

const USER_ID = "user-reminder-1";
const PROFILE_ID = "profile-reminder-1";

function buildReminderInput(overrides: Partial<Parameters<typeof createReminderIfNotExists>[0]> = {}) {
  return {
    recipientUserId: USER_ID,
    recipientProfileId: PROFILE_ID,
    category: "proposal" as const,
    title: "Review Improvement Proposals",
    message: "Ready for your input.",
    relatedEntityType: "initiative",
    relatedEntityId: "initiative-1",
    relatedUrl: "/initiatives/public/initiative-1#improvement-proposals",
    ...overrides,
  };
}

describe("Lifecycle UX Correction Pack 01 Part 6/7 — Reminder service", () => {
  afterEach(() => {
    resetRemindersForTests();
  });

  it("creates a new active Reminder", async () => {
    const reminder = await createReminderIfNotExists(buildReminderInput());

    assert.equal(reminder.status, "active");
    assert.equal(reminder.recipientUserId, USER_ID);
    assert.equal(reminder.category, "proposal");
  });

  it("is idempotent: a second call for the same recipient/category/related entity never creates a duplicate", async () => {
    const first = await createReminderIfNotExists(buildReminderInput());
    const second = await createReminderIfNotExists(buildReminderInput({ title: "A different title" }));

    assert.equal(first.reminderId, second.reminderId);
    assert.equal(second.title, "Review Improvement Proposals");

    const { reminders } = await listMyReminders({ userId: USER_ID, status: "all" });
    assert.equal(reminders.length, 1);
  });

  it("allows a new active Reminder after the previous one for the same category/entity was archived", async () => {
    const first = await createReminderIfNotExists(buildReminderInput());
    await completeReminder(first.reminderId, USER_ID);

    const second = await createReminderIfNotExists(buildReminderInput());

    assert.notEqual(second.reminderId, first.reminderId);
    assert.equal(second.status, "active");
  });

  it("never exposes recipient identity fields in the public view", async () => {
    await createReminderIfNotExists(buildReminderInput());
    const { reminders } = await listMyReminders({ userId: USER_ID, status: "all" });

    assert.equal(reminders.length, 1);
    assert.ok(!("recipientUserId" in reminders[0]!));
    assert.ok(!("recipientProfileId" in reminders[0]!));
  });

  it("lists only active reminders by default filter, and only archived ones under 'archived'", async () => {
    const reminder = await createReminderIfNotExists(buildReminderInput());
    await completeReminder(reminder.reminderId, USER_ID);

    const active = await listMyReminders({ userId: USER_ID, status: "active" });
    const archived = await listMyReminders({ userId: USER_ID, status: "archived" });

    assert.equal(active.reminders.length, 0);
    assert.equal(archived.reminders.length, 1);
    assert.equal(archived.reminders[0]?.status, "archived");
  });

  describe("completeReminder (Part 6 — completing and archiving in one step)", () => {
    it("marks the reminder archived and records completedAt/archivedAt", async () => {
      const reminder = await createReminderIfNotExists(buildReminderInput());
      const completed = await completeReminder(reminder.reminderId, USER_ID);

      assert.equal(completed.status, "archived");
      assert.ok(completed.completedAt);
      assert.ok(completed.archivedAt);
    });

    it("rejects completing a reminder that belongs to a different recipient", async () => {
      const reminder = await createReminderIfNotExists(buildReminderInput());

      await assert.rejects(() => completeReminder(reminder.reminderId, "someone-else"));
    });
  });

  describe("deleteArchivedReminder (Part 4/9 — Delete only ever removes an archived record)", () => {
    it("rejects deleting a still-active reminder", async () => {
      const reminder = await createReminderIfNotExists(buildReminderInput());

      await assert.rejects(() => deleteArchivedReminder(reminder.reminderId, USER_ID));
    });

    it("deletes an archived reminder, removing only that one record", async () => {
      const first = await createReminderIfNotExists(buildReminderInput());
      const second = await createReminderIfNotExists(
        buildReminderInput({ relatedEntityId: "initiative-2" }),
      );

      await completeReminder(first.reminderId, USER_ID);
      await completeReminder(second.reminderId, USER_ID);
      await deleteArchivedReminder(first.reminderId, USER_ID);

      const { reminders } = await listMyReminders({ userId: USER_ID, status: "all" });
      assert.equal(reminders.length, 1);
      assert.equal(reminders[0]?.reminderId, second.reminderId);
    });
  });
});
