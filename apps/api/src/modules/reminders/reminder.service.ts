import { randomUUID } from "node:crypto";

import type { CommunicationReminder, CommunicationReminderListResponse, CommunicationReminderView } from "@hu/types";

import { resolveReminderPersistenceAdapter } from "./persistence/resolve-reminder-persistence.js";
import type { ReminderListFilter } from "./reminder.types.js";

const persistence = resolveReminderPersistenceAdapter();

function toReminderView(reminder: CommunicationReminder): CommunicationReminderView {
  return {
    reminderId: reminder.reminderId,
    category: reminder.category,
    title: reminder.title,
    message: reminder.message,
    relatedEntityType: reminder.relatedEntityType,
    relatedEntityId: reminder.relatedEntityId,
    relatedUrl: reminder.relatedUrl,
    status: reminder.status,
    createdAt: reminder.createdAt,
    dueAt: reminder.dueAt,
    completedAt: reminder.completedAt,
    archivedAt: reminder.archivedAt,
  };
}

/**
 * Lifecycle UX Correction Pack 01 Part 7 — the one reusable entry point
 * every Reminder generation source (next Lifecycle step, upcoming
 * Collaboration Session, accepted commitments, initiative deadlines,
 * priority-topic matches, AI recommendations, ...) is meant to call.
 *
 * Idempotent by design: a Participant who already has an *active* Reminder
 * for the same (recipient, category, related entity) never receives a
 * second one — "never intrusive / never spam" (Part 7) — so callers can
 * invoke this unconditionally on every relevant domain event without
 * tracking their own dedup state.
 */
export async function createReminderIfNotExists(input: {
  recipientUserId: string;
  recipientProfileId: string;
  category: CommunicationReminder["category"];
  title: string;
  message: string;
  relatedEntityType: string;
  relatedEntityId: string;
  relatedUrl: string;
  dueAt?: string;
  generationKey?: string;
}): Promise<CommunicationReminder> {
  const existing = await persistence.findActiveByRecipientCategoryAndEntity(
    input.recipientUserId,
    input.category,
    input.relatedEntityId,
  );

  if (existing) {
    return existing;
  }

  const reminder: CommunicationReminder = {
    reminderId: randomUUID(),
    recipientUserId: input.recipientUserId,
    recipientProfileId: input.recipientProfileId,
    category: input.category,
    title: input.title,
    message: input.message,
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    relatedUrl: input.relatedUrl,
    status: "active",
    createdAt: new Date().toISOString(),
    dueAt: input.dueAt,
    generationKey: input.generationKey,
  };

  await persistence.insert(reminder);
  return reminder;
}

/**
 * Community Intelligence Pack 02 — active idempotency plus day-scale cooldown
 * against archived/recent reminders. Materially new `generationKey` may bypass
 * cooldown; identical rediscovery within `cooldownDays` is suppressed.
 */
export async function createReminderIfEligibleWithCooldown(input: {
  recipientUserId: string;
  recipientProfileId: string;
  category: CommunicationReminder["category"];
  title: string;
  message: string;
  relatedEntityType: string;
  relatedEntityId: string;
  relatedUrl: string;
  dueAt?: string;
  generationKey: string;
  cooldownDays: number;
  now?: Date;
}): Promise<{
  reminder: CommunicationReminder | null;
  skippedReason: "active_exists" | "cooldown" | null;
}> {
  const existingActive = await persistence.findActiveByRecipientCategoryAndEntity(
    input.recipientUserId,
    input.category,
    input.relatedEntityId,
  );

  if (existingActive) {
    return { reminder: existingActive, skippedReason: "active_exists" };
  }

  const latest = await persistence.findLatestByRecipientCategoryAndEntity(
    input.recipientUserId,
    input.category,
    input.relatedEntityId,
  );

  if (latest) {
    const anchor = latest.archivedAt ?? latest.completedAt ?? latest.createdAt;
    const ageMs = (input.now ?? new Date()).getTime() - new Date(anchor).getTime();
    const cooldownMs = input.cooldownDays * 24 * 60 * 60 * 1000;
    const sameGeneration = latest.generationKey === input.generationKey;

    if (ageMs < cooldownMs && sameGeneration) {
      return { reminder: null, skippedReason: "cooldown" };
    }

    if (ageMs < cooldownMs && !latest.generationKey) {
      return { reminder: null, skippedReason: "cooldown" };
    }
  }

  const reminder = await createReminderIfNotExists(input);
  return { reminder, skippedReason: null };
}

export async function listMyReminders(
  filter: ReminderListFilter,
): Promise<CommunicationReminderListResponse> {
  const reminders = await persistence.list(filter);

  return {
    reminders: reminders.map(toReminderView),
  };
}

async function getOwnedReminder(reminderId: string, userId: string): Promise<CommunicationReminder> {
  const reminder = await persistence.findById(reminderId);

  if (!reminder) {
    throw new Error("Reminder not found.");
  }

  if (reminder.recipientUserId !== userId) {
    throw new Error("You do not have access to this reminder.");
  }

  return reminder;
}

/**
 * Part 6 — "Clicking a reminder marks it completed and moves it into
 * Archive" in one step: there is no intermediate "completed but active"
 * state (see `CommunicationReminderStatus`).
 */
export async function completeReminder(
  reminderId: string,
  userId: string,
): Promise<CommunicationReminderView> {
  const reminder = await getOwnedReminder(reminderId, userId);
  const timestamp = new Date().toISOString();
  const updated: CommunicationReminder = {
    ...reminder,
    status: "archived",
    completedAt: reminder.completedAt ?? timestamp,
    archivedAt: reminder.archivedAt ?? timestamp,
  };

  await persistence.update(updated);
  return toReminderView(updated);
}

/**
 * Part 9 — Delete is only ever offered in the UI for an already-archived
 * item, and removes only that one Reminder record — never the underlying
 * Initiative, Lifecycle event, or Session it referenced.
 */
export async function deleteArchivedReminder(reminderId: string, userId: string): Promise<void> {
  const reminder = await getOwnedReminder(reminderId, userId);

  if (reminder.status !== "archived") {
    throw new Error("Only an archived reminder can be deleted.");
  }

  await persistence.delete(reminderId);
}

/** Mirrors `deleteNotificationsByRelatedEntity` — used when the referenced entity itself is permanently deleted (e.g. a Draft Initiative). */
export async function deleteRemindersByRelatedEntity(
  relatedEntityType: string,
  relatedEntityId: string,
): Promise<number> {
  return persistence.deleteByRelatedEntity(relatedEntityType, relatedEntityId);
}

export function resetRemindersForTests(): void {
  if ("clearForTests" in persistence && typeof persistence.clearForTests === "function") {
    persistence.clearForTests();
  }
}

export { persistence as reminderPersistenceForTests };
