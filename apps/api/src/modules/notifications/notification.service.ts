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

/**
 * UX Completion Pack 04 Part 7 — closes the read-semantics gap between
 * "conversation read" and "notification read". A `direct_message_received`
 * notification is created per unread message (never per conversation), so
 * opening/reading a conversation elsewhere (the Messenger, not the
 * Notification Center) previously left those notifications — and the
 * header bell count they still fed — permanently unread. This marks every
 * unread notification for one related entity (e.g. one conversation) as
 * read in the same way `markAllNotificationsRead` marks every unread
 * notification: ownership is implicit (only this `userId`'s own
 * notifications are ever listed/updated), ordinary `markNotificationRead`
 * semantics are reused verbatim, and ineligible notifications for other
 * entities are left untouched.
 */
export async function markNotificationsReadByRelatedEntity(
  userId: string,
  relatedEntityType: MemberNotification["relatedEntityType"],
  relatedEntityId: string,
  /**
   * Lifecycle UX Correction Pack 01 Part 1/5 — Collaboration Channel
   * notifications share `relatedEntityType: "initiative"` with several
   * unrelated platform Notification event types (e.g. a published
   * Collaborative Analysis). Without this optional narrowing, clearing
   * "conversation read" for the Channel would incorrectly also mark those
   * unrelated platform Notifications as read. Omitted, this matches every
   * existing caller (Direct Messaging) exactly as before.
   */
  eventTypes?: ReadonlyArray<MemberNotification["eventType"]>,
): Promise<{ updatedCount: number }> {
  const unread = await persistence.list({ userId, status: "unread", limit: 500, offset: 0 });
  const matching = unread.filter(
    (notification) =>
      notification.relatedEntityType === relatedEntityType &&
      notification.relatedEntityId === relatedEntityId &&
      (!eventTypes || eventTypes.includes(notification.eventType)),
  );
  const timestamp = new Date().toISOString();

  for (const notification of matching) {
    await persistence.update({
      ...notification,
      status: "read",
      readAt: notification.readAt ?? timestamp,
    });
  }

  return { updatedCount: matching.length };
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

/**
 * Lifecycle UX Correction Pack 01 Part 4/9 — Delete is only ever offered in
 * the UI for an already-archived notification, and removes only that one
 * notification record. It never touches the underlying Initiative,
 * Lifecycle event, published content, Outbox event, or History that the
 * notification referenced — those are owned by their own domains and are
 * never reachable through this call.
 */
export async function deleteArchivedNotification(notificationId: string, userId: string): Promise<void> {
  const notification = await getOwnedNotification(notificationId, userId);

  if (notification.status !== "archived") {
    throw new Error("Only an archived notification can be deleted.");
  }

  await persistence.delete(notification.notificationId);
}

/**
 * Initiative UX Pack 01.1 — Draft Initiative Safe Delete.
 *
 * Draft-only collaboration (Collaboration Channel, Sessions, Ally interest)
 * is not lifecycle-gated, so notifications referencing a still-unpublished
 * Initiative can exist across many recipients. Once the Draft itself is
 * permanently deleted those notifications would otherwise dangle (their
 * `relatedUrl` would 404 forever), so every notification for this related
 * entity is purged regardless of recipient or read status. This never
 * touches notifications for published civic history, since it is scoped to
 * exactly one `relatedEntityId` that the caller has already verified is an
 * unpublished Draft.
 */
export async function deleteNotificationsByRelatedEntity(
  relatedEntityType: MemberNotification["relatedEntityType"],
  relatedEntityId: string,
): Promise<number> {
  return persistence.deleteByRelatedEntity(relatedEntityType, relatedEntityId);
}

export function resetNotificationsForTests(): void {
  if ("clearForTests" in persistence && typeof persistence.clearForTests === "function") {
    persistence.clearForTests();
  }
}

export { persistence as notificationPersistenceForTests };
