import type { CivicEntityType, CivicNotificationEventType } from "./capability02-integration.js";

/** Notification-only identity. Not a civic pipeline entity. */
export const LEGAL_POLICY_NOTIFICATION_ENTITY = "legal_policy" as const;

export type MemberNotificationRelatedEntityType =
  | CivicEntityType
  | typeof LEGAL_POLICY_NOTIFICATION_ENTITY;

export type MemberNotificationPriority = "critical" | "important" | "normal" | "informational";

export type MemberNotificationStatus = "unread" | "read" | "archived";

export interface MemberNotification {
  notificationId: string;
  recipientProfileId: string;
  recipientUserId: string;
  eventType: CivicNotificationEventType;
  title: string;
  message: string;
  relatedEntityType: MemberNotificationRelatedEntityType;
  relatedEntityId: string;
  relatedUrl: string;
  priority: MemberNotificationPriority;
  status: MemberNotificationStatus;
  createdAt: string;
  readAt?: string;
  archivedAt?: string;
}

export interface MemberNotificationView {
  notificationId: string;
  eventType: CivicNotificationEventType;
  title: string;
  message: string;
  relatedEntityType: MemberNotificationRelatedEntityType;
  relatedEntityId: string;
  relatedUrl: string;
  priority: MemberNotificationPriority;
  status: MemberNotificationStatus;
  createdAt: string;
  readAt?: string;
  archivedAt?: string;
}

export interface MemberNotificationListResponse {
  notifications: MemberNotificationView[];
  total: number;
  unreadCount: number;
}
