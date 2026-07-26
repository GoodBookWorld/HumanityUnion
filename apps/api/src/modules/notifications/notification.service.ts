import { randomUUID } from "node:crypto";

import type {
  MemberNotification,
  MemberNotificationListResponse,
  MemberNotificationView,
} from "@hu/types";

import { resolveNotificationPersistenceAdapter } from "./persistence/resolve-notification-persistence.js";
import {
  type CivicNotificationEventInput,
  resolveNotificationRecipientMemberIds,
  resolveNotificationRelatedUrl,
  resolveRecipientIdentity,
} from "./notification.recipients.js";
import { getNotificationTemplate } from "./notification.templates.js";
import {
  FORBIDDEN_NOTIFICATION_UX_TERMS,
  PRIVATE_NOTIFICATION_RESPONSE_KEYS,
  type NotificationListFilter,
} from "./notification.types.js";

const persistence = resolveNotificationPersistenceAdapter();

function toNotificationView(notification: MemberNotification): MemberNotificationView {
  return {
    notificationId: notification.notificationId,
    eventType: notification.eventType,
    title: notification.title,
    message: notification.message,
    relatedEntityType: notification.relatedEntityType,
    relatedEntityId: notification.relatedEntityId,
    relatedUrl: notification.relatedUrl,
    priority: notification.priority,
    status: notification.status,
    createdAt: notification.createdAt,
    readAt: notification.readAt,
    archivedAt: notification.archivedAt,
  };
}

export function sanitizeNotificationResponse<T>(response: T): T {
  const serialized = JSON.stringify(response).toLowerCase();

  for (const key of PRIVATE_NOTIFICATION_RESPONSE_KEYS) {
    if (serialized.includes(`"${key.toLowerCase()}"`)) {
      throw new Error(`Notification response must not expose ${key}.`);
    }
  }

  for (const term of FORBIDDEN_NOTIFICATION_UX_TERMS) {
    if (serialized.includes(term)) {
      throw new Error(`Notification response must not include gamification term: ${term}.`);
    }
  }

  return response;
}

export async function createNotification(input: {
  recipientUserId: string;
  recipientProfileId: string;
  eventType: MemberNotification["eventType"];
  title: string;
  message: string;
  relatedEntityType: MemberNotification["relatedEntityType"];
  relatedEntityId: string;
  relatedUrl: string;
  priority: MemberNotification["priority"];
}): Promise<MemberNotification> {
  const notification: MemberNotification = {
    notificationId: randomUUID(),
    recipientUserId: input.recipientUserId,
    recipientProfileId: input.recipientProfileId,
    eventType: input.eventType,
    title: input.title,
    message: input.message,
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    relatedUrl: input.relatedUrl,
    priority: input.priority,
    status: "unread",
    createdAt: new Date().toISOString(),
  };

  await persistence.insert(notification);
  return notification;
}

const NOTIFY_ACTOR_EVENT_TYPES = new Set<MemberNotification["eventType"]>([
  "initiative_published",
  "proposal_decided",
  "impact_verified",
  "civic_nomination_submitted",
  "civic_nomination_published",
  "civic_nomination_withdrawn",
  "civic_nomination_voting_opened",
  "civic_nomination_vote_cast",
  "civic_nomination_voting_closed",
]);

export async function createNotificationsForEvent(
  input: CivicNotificationEventInput,
): Promise<MemberNotification[]> {
  const template = getNotificationTemplate(input.eventType);
  const relatedUrl = resolveNotificationRelatedUrl(input.entityType, input.entityId);
  const recipientMemberIds = resolveNotificationRecipientMemberIds(input);
  const created: MemberNotification[] = [];

  for (const memberId of recipientMemberIds) {
    if (
      input.actorMemberId &&
      memberId === input.actorMemberId &&
      !NOTIFY_ACTOR_EVENT_TYPES.has(input.eventType)
    ) {
      continue;
    }

    const recipient = await resolveRecipientIdentity(memberId);

    if (!recipient) {
      continue;
    }

    const notification = await createNotification({
      recipientUserId: recipient.userId,
      recipientProfileId: recipient.profileId,
      eventType: input.eventType,
      title: template.title,
      message: template.message,
      relatedEntityType: input.entityType,
      relatedEntityId: input.entityId,
      relatedUrl,
      priority: template.priority,
    });

    created.push(notification);
  }

  return created;
}

export function emitCivicNotificationEvent(input: CivicNotificationEventInput): void {
  const task = createNotificationsForEvent(input).catch(() => {
    // Notification delivery must not block civic workflows.
  });

  pendingNotificationTasks.add(task);
  void task.finally(() => {
    pendingNotificationTasks.delete(task);
  });
}

const pendingNotificationTasks = new Set<Promise<unknown>>();

export async function drainCivicNotificationEventsForTests(): Promise<void> {
  if (pendingNotificationTasks.size === 0) {
    return;
  }

  await Promise.allSettled([...pendingNotificationTasks]);
}

export async function listMyNotifications(
  filter: NotificationListFilter,
): Promise<MemberNotificationListResponse> {
  const notifications = await persistence.list(filter);
  const unreadCount = await persistence.countByUserId(filter.userId, "unread");

  const response: MemberNotificationListResponse = {
    notifications: notifications.map(toNotificationView),
    total: notifications.length,
    unreadCount,
  };

  return sanitizeNotificationResponse(response);
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  return persistence.countByUserId(userId, "unread");
}

async function getOwnedNotification(
  notificationId: string,
  userId: string,
): Promise<MemberNotification> {
  const notification = await persistence.findById(notificationId);

  if (!notification) {
    throw new Error("Notification not found.");
  }

  if (notification.recipientUserId !== userId) {
    throw new Error("You do not have access to this notification.");
  }

  return notification;
}

export async function markNotificationRead(
  notificationId: string,
  userId: string,
): Promise<MemberNotificationView> {
  const notification = await getOwnedNotification(notificationId, userId);
  const updated: MemberNotification = {
    ...notification,
    status: "read",
    readAt: notification.readAt ?? new Date().toISOString(),
  };

  await persistence.update(updated);
  return sanitizeNotificationResponse(toNotificationView(updated));
}

export async function markAllNotificationsRead(userId: string): Promise<{ updatedCount: number }> {
  const unread = await persistence.list({ userId, status: "unread", limit: 500, offset: 0 });
  const timestamp = new Date().toISOString();

  for (const notification of unread) {
    await persistence.update({
      ...notification,
      status: "read",
      readAt: notification.readAt ?? timestamp,
    });
  }

  return { updatedCount: unread.length };
}

export async function archiveNotification(
  notificationId: string,
  userId: string,
): Promise<MemberNotificationView> {
  const notification = await getOwnedNotification(notificationId, userId);
  const updated: MemberNotification = {
    ...notification,
    status: "archived",
    archivedAt: notification.archivedAt ?? new Date().toISOString(),
  };

  await persistence.update(updated);
  return sanitizeNotificationResponse(toNotificationView(updated));
}

export function resetNotificationsForTests(): void {
  if ("clearForTests" in persistence && typeof persistence.clearForTests === "function") {
    persistence.clearForTests();
  }
}

export { persistence as notificationPersistenceForTests };
