import type { AdminNotification } from "@hu/types";

import type {
  AdminNotificationListFilter,
  AdminNotificationPersistenceAdapter,
} from "../admin-notification.types.js";
import { ADMIN_NOTIFICATION_DEFAULT_LIST_LIMIT } from "../admin-notification.types.js";

export class MemoryAdminNotificationPersistenceAdapter
  implements AdminNotificationPersistenceAdapter
{
  readonly mode = "memory" as const;

  private notifications = new Map<string, AdminNotification>();

  async insertIfAbsent(notification: AdminNotification): Promise<boolean> {
    if (notification.sourceEventId) {
      for (const existing of this.notifications.values()) {
        if (
          existing.recipientAdminUserId === notification.recipientAdminUserId &&
          existing.sourceEventId === notification.sourceEventId
        ) {
          return false;
        }
      }
    }

    this.notifications.set(notification.adminNotificationId, structuredClone(notification));
    return true;
  }

  async list(filter: AdminNotificationListFilter): Promise<AdminNotification[]> {
    const items = [...this.notifications.values()].filter(
      (row) => row.recipientAdminUserId === filter.recipientAdminUserId,
    );
    items.sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? ADMIN_NOTIFICATION_DEFAULT_LIST_LIMIT;
    return items.slice(offset, offset + limit).map((row) => structuredClone(row));
  }

  async countByRecipient(recipientAdminUserId: string): Promise<number> {
    return [...this.notifications.values()].filter(
      (row) => row.recipientAdminUserId === recipientAdminUserId,
    ).length;
  }

  async findById(adminNotificationId: string): Promise<AdminNotification | null> {
    const row = this.notifications.get(adminNotificationId);
    return row ? structuredClone(row) : null;
  }

  async deleteOwned(input: {
    adminNotificationId: string;
    recipientAdminUserId: string;
  }): Promise<boolean> {
    const existing = this.notifications.get(input.adminNotificationId);
    if (!existing || existing.recipientAdminUserId !== input.recipientAdminUserId) {
      return false;
    }
    this.notifications.delete(input.adminNotificationId);
    return true;
  }

  async updateBySourceEventId(input: {
    sourceEventId: string;
    title?: string;
    targetLabel?: string;
    severity?: AdminNotification["severity"];
  }): Promise<number> {
    let updated = 0;
    for (const [id, row] of this.notifications.entries()) {
      if (row.sourceEventId !== input.sourceEventId) {
        continue;
      }
      this.notifications.set(id, {
        ...row,
        ...(input.title ? { title: input.title } : {}),
        ...(input.targetLabel ? { targetLabel: input.targetLabel } : {}),
        ...(input.severity ? { severity: input.severity } : {}),
      });
      updated += 1;
    }
    return updated;
  }

  clearForTests(): void {
    this.notifications.clear();
  }
}

let sharedMemoryAdapter: MemoryAdminNotificationPersistenceAdapter | null = null;

export function createMemoryAdminNotificationPersistenceAdapter(): MemoryAdminNotificationPersistenceAdapter {
  if (!sharedMemoryAdapter) {
    sharedMemoryAdapter = new MemoryAdminNotificationPersistenceAdapter();
  }
  return sharedMemoryAdapter;
}

export function resetMemoryAdminNotificationPersistenceForTests(): void {
  if (sharedMemoryAdapter) {
    sharedMemoryAdapter.clearForTests();
  }
}
