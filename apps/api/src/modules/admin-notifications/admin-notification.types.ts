/**
 * Pack 22E.1 — Admin notification persistence adapter contract.
 */
import type { AdminNotification } from "@hu/types";

export interface AdminNotificationListFilter {
  recipientAdminUserId: string;
  limit?: number;
  offset?: number;
}

export interface AdminNotificationPersistenceAdapter {
  readonly mode: "memory" | "mongodb";
  /**
   * Insert one row. Returns true when inserted, false when skipped as duplicate
   * (recipientAdminUserId + sourceEventId already exists).
   */
  insertIfAbsent(notification: AdminNotification): Promise<boolean>;
  list(filter: AdminNotificationListFilter): Promise<AdminNotification[]>;
  countByRecipient(recipientAdminUserId: string): Promise<number>;
  findById(adminNotificationId: string): Promise<AdminNotification | null>;
  deleteOwned(input: {
    adminNotificationId: string;
    recipientAdminUserId: string;
  }): Promise<boolean>;
  /** Pack 22E.3 — escalate active ops rows without creating duplicates. */
  updateBySourceEventId?(input: {
    sourceEventId: string;
    title?: string;
    targetLabel?: string;
    severity?: AdminNotification["severity"];
  }): Promise<number>;
}

export const ADMIN_NOTIFICATION_DEFAULT_LIST_LIMIT = 50;
export const ADMIN_NOTIFICATION_MAX_LIST_LIMIT = 100;
