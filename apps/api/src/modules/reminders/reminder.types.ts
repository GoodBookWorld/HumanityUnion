import type { CommunicationReminder, CommunicationReminderStatus } from "@hu/types";

export type { CommunicationReminder, CommunicationReminderStatus };

export interface ReminderListFilter {
  userId: string;
  status?: CommunicationReminderStatus | "all";
  limit?: number;
  offset?: number;
}

export interface ReminderPersistenceAdapter {
  readonly mode: "memory" | "mongodb";
  insert(reminder: CommunicationReminder): Promise<void>;
  list(filter: ReminderListFilter): Promise<CommunicationReminder[]>;
  /** Lifecycle UX Correction Pack 01 Part 7 — idempotent generation: find an existing active reminder for the same recipient/category/related entity before creating a duplicate. */
  findActiveByRecipientCategoryAndEntity(
    userId: string,
    category: CommunicationReminder["category"],
    relatedEntityId: string,
  ): Promise<CommunicationReminder | null>;
  /**
   * Pack 02 — latest reminder for recipient/category/entity including archived,
   * for Community Intelligence cooldown (days, not minutes).
   */
  findLatestByRecipientCategoryAndEntity(
    userId: string,
    category: CommunicationReminder["category"],
    relatedEntityId: string,
  ): Promise<CommunicationReminder | null>;
  findById(reminderId: string): Promise<CommunicationReminder | null>;
  update(reminder: CommunicationReminder): Promise<void>;
  delete(reminderId: string): Promise<void>;
  deleteByRelatedEntity(relatedEntityType: string, relatedEntityId: string): Promise<number>;
  clearForTests?(): void;
}
