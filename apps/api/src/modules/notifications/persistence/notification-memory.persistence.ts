import type { MemberNotification } from "@hu/types";

import { isPrivacyPolicyNoticeRow } from "../privacy-policy-notice.constants.js";
import type {
  NotificationListFilter,
  NotificationPersistenceAdapter,
} from "../notification.types.js";

export class MemoryNotificationPersistenceAdapter implements NotificationPersistenceAdapter {
  readonly mode = "memory" as const;

  private notifications = new Map<string, MemberNotification>();
  /** Synchronous claim so overlapping activations cannot both insert. */
  private privacyNoticeClaims = new Set<string>();

  async insert(notification: MemberNotification): Promise<void> {
    this.notifications.set(notification.notificationId, structuredClone(notification));
  }

  async list(filter: NotificationListFilter): Promise<MemberNotification[]> {
    const items = [...this.notifications.values()].filter(
      (notification) => notification.recipientUserId === filter.userId,
    );

    const filtered =
      filter.status && filter.status !== "all"
        ? items.filter((notification) => notification.status === filter.status)
        : items;

    const sorted = filtered.sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );

    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 50;

    return sorted.slice(offset, offset + limit).map((item) => structuredClone(item));
  }

  async countByUserId(userId: string, status?: MemberNotification["status"]): Promise<number> {
    return [...this.notifications.values()].filter((notification) => {
      if (notification.recipientUserId !== userId) {
        return false;
      }

      if (status) {
        return notification.status === status;
      }

      return true;
    }).length;
  }

  async findById(notificationId: string): Promise<MemberNotification | null> {
    const notification = this.notifications.get(notificationId);
    return notification ? structuredClone(notification) : null;
  }

  async update(notification: MemberNotification): Promise<void> {
    this.notifications.set(notification.notificationId, structuredClone(notification));
  }

  async delete(notificationId: string): Promise<void> {
    this.notifications.delete(notificationId);
  }

  async deleteArchivedByUserId(userId: string): Promise<number> {
    let deletedCount = 0;

    for (const [notificationId, notification] of this.notifications.entries()) {
      if (notification.recipientUserId === userId && notification.status === "archived") {
        this.notifications.delete(notificationId);
        deletedCount += 1;
      }
    }

    return deletedCount;
  }

  async deleteByRelatedEntity(
    relatedEntityType: MemberNotification["relatedEntityType"],
    relatedEntityId: string,
  ): Promise<number> {
    let deletedCount = 0;

    for (const [notificationId, notification] of this.notifications.entries()) {
      if (
        notification.relatedEntityType === relatedEntityType &&
        notification.relatedEntityId === relatedEntityId
      ) {
        this.notifications.delete(notificationId);
        deletedCount += 1;
      }
    }

    return deletedCount;
  }

  async existsForRecipientEventAndRelatedEntity(input: {
    recipientUserId: string;
    eventType: MemberNotification["eventType"];
    relatedEntityType: MemberNotification["relatedEntityType"];
    relatedEntityId: string;
  }): Promise<boolean> {
    for (const notification of this.notifications.values()) {
      if (
        notification.recipientUserId === input.recipientUserId &&
        notification.eventType === input.eventType &&
        notification.relatedEntityType === input.relatedEntityType &&
        notification.relatedEntityId === input.relatedEntityId
      ) {
        return true;
      }
    }
    return false;
  }

  async insertPrivacyPolicyNoticeIfAbsent(
    notification: MemberNotification,
  ): Promise<"inserted" | "exists"> {
    if (!isPrivacyPolicyNoticeRow(notification)) {
      throw new Error("This insert is only for the Privacy Policy v2 notice.");
    }

    const key = `${notification.recipientUserId}\0${notification.relatedEntityId}`;
    if (this.privacyNoticeClaims.has(key)) {
      return "exists";
    }

    for (const existing of this.notifications.values()) {
      if (
        existing.recipientUserId === notification.recipientUserId &&
        existing.eventType === notification.eventType &&
        existing.relatedEntityId === notification.relatedEntityId
      ) {
        this.privacyNoticeClaims.add(key);
        return "exists";
      }
    }

    this.privacyNoticeClaims.add(key);
    this.notifications.set(notification.notificationId, structuredClone(notification));
    return "inserted";
  }

  clearForTests(): void {
    this.notifications.clear();
    this.privacyNoticeClaims.clear();
  }
}

export function createMemoryNotificationPersistenceAdapter(): MemoryNotificationPersistenceAdapter {
  return new MemoryNotificationPersistenceAdapter();
}
