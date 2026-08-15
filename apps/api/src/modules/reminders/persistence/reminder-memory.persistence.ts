import type { CommunicationReminder } from "@hu/types";

import type { ReminderListFilter, ReminderPersistenceAdapter } from "../reminder.types.js";

export class MemoryReminderPersistenceAdapter implements ReminderPersistenceAdapter {
  readonly mode = "memory" as const;

  private reminders = new Map<string, CommunicationReminder>();

  async insert(reminder: CommunicationReminder): Promise<void> {
    this.reminders.set(reminder.reminderId, structuredClone(reminder));
  }

  async list(filter: ReminderListFilter): Promise<CommunicationReminder[]> {
    const items = [...this.reminders.values()].filter(
      (reminder) => reminder.recipientUserId === filter.userId,
    );

    const filtered =
      filter.status && filter.status !== "all"
        ? items.filter((reminder) => reminder.status === filter.status)
        : items;

    const sorted = filtered.sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );

    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 50;

    return sorted.slice(offset, offset + limit).map((item) => structuredClone(item));
  }

  async findActiveByRecipientCategoryAndEntity(
    userId: string,
    category: CommunicationReminder["category"],
    relatedEntityId: string,
  ): Promise<CommunicationReminder | null> {
    const match = [...this.reminders.values()].find(
      (reminder) =>
        reminder.recipientUserId === userId &&
        reminder.category === category &&
        reminder.relatedEntityId === relatedEntityId &&
        reminder.status === "active",
    );

    return match ? structuredClone(match) : null;
  }

  async findLatestByRecipientCategoryAndEntity(
    userId: string,
    category: CommunicationReminder["category"],
    relatedEntityId: string,
  ): Promise<CommunicationReminder | null> {
    const matches = [...this.reminders.values()]
      .filter(
        (reminder) =>
          reminder.recipientUserId === userId &&
          reminder.category === category &&
          reminder.relatedEntityId === relatedEntityId,
      )
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      );

    return matches[0] ? structuredClone(matches[0]) : null;
  }

  async findById(reminderId: string): Promise<CommunicationReminder | null> {
    const reminder = this.reminders.get(reminderId);
    return reminder ? structuredClone(reminder) : null;
  }

  async update(reminder: CommunicationReminder): Promise<void> {
    this.reminders.set(reminder.reminderId, structuredClone(reminder));
  }

  async delete(reminderId: string): Promise<void> {
    this.reminders.delete(reminderId);
  }

  async deleteByRelatedEntity(relatedEntityType: string, relatedEntityId: string): Promise<number> {
    let deletedCount = 0;

    for (const [reminderId, reminder] of this.reminders.entries()) {
      if (reminder.relatedEntityType === relatedEntityType && reminder.relatedEntityId === relatedEntityId) {
        this.reminders.delete(reminderId);
        deletedCount += 1;
      }
    }

    return deletedCount;
  }

  clearForTests(): void {
    this.reminders.clear();
  }
}

export function createMemoryReminderPersistenceAdapter(): MemoryReminderPersistenceAdapter {
  return new MemoryReminderPersistenceAdapter();
}
