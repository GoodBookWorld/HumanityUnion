import type { MemberNotification } from "@hu/types";

import type {
  NotificationListFilter,
  NotificationPersistenceAdapter,
} from "../notification.types.js";

export class MemoryNotificationPersistenceAdapter implements NotificationPersistenceAdapter {
  readonly mode = "memory" as const;

  private notifications = new Map<string, MemberNotification>();

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

  clearForTests(): void {
    this.notifications.clear();
  }
}

export function createMemoryNotificationPersistenceAdapter(): MemoryNotificationPersistenceAdapter {
  return new MemoryNotificationPersistenceAdapter();
}
