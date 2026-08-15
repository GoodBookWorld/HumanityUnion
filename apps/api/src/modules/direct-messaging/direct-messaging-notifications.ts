import {
  createNotification,
  markNotificationsReadByRelatedEntity,
} from "../notifications/notification.service.js";
import { resolveRecipientIdentity } from "../notifications/notification.recipients.js";
import { getNotificationTemplate } from "../notifications/notification.templates.js";

/**
 * Part 13 — reuses the existing notification pipeline exactly like
 * `initiative-discussion-collaboration-notifications.ts`: fire-and-forget,
 * never blocking the send path, and never embedding the private message
 * text in the notification body (`relatedUrl` only points at the
 * conversation; the recipient must open it to read the message).
 *
 * This is deliberately NOT part of the message-send Mongo transaction —
 * unread state (the durable, authoritative signal) is updated inside that
 * transaction; this best-effort notification is a secondary convenience
 * surface, matching the same non-atomic guarantee every other collaboration
 * notification in this codebase already has.
 */
export interface DirectMessageNotificationInput {
  recipientParticipantId: string;
  senderParticipantId: string;
  conversationId: string;
}

function directConversationUrl(conversationId: string): string {
  return `/workspace/messages/${encodeURIComponent(conversationId)}`;
}

async function notify(input: DirectMessageNotificationInput): Promise<void> {
  if (input.recipientParticipantId === input.senderParticipantId) {
    return;
  }

  const recipient = await resolveRecipientIdentity(input.recipientParticipantId);

  if (!recipient) {
    return;
  }

  const template = getNotificationTemplate("direct_message_received");

  await createNotification({
    recipientUserId: recipient.userId,
    recipientProfileId: recipient.profileId,
    eventType: "direct_message_received",
    title: template.title,
    message: template.message,
    relatedEntityType: "direct_conversation",
    relatedEntityId: input.conversationId,
    relatedUrl: directConversationUrl(input.conversationId),
    priority: template.priority,
  });
}

/**
 * UX Completion Pack 04 Part 7 — the counterpart to `notify` above: called
 * when a Participant marks a conversation read (from the Messenger, the
 * only place this happens today), this clears every `direct_message_received`
 * notification tied to that same conversation so the Notification Center
 * and header bell unread counts converge with the conversation's own
 * durable unread marker instead of drifting from it. Never touches
 * notifications for any other conversation or event type.
 */
export async function markDirectMessageNotificationsRead(input: {
  participantId: string;
  conversationId: string;
}): Promise<void> {
  const recipient = await resolveRecipientIdentity(input.participantId);

  if (!recipient) {
    return;
  }

  await markNotificationsReadByRelatedEntity(
    recipient.userId,
    "direct_conversation",
    input.conversationId,
  );
}

const pendingNotificationTasks = new Set<Promise<unknown>>();

export function emitDirectMessageNotification(input: DirectMessageNotificationInput): void {
  const task = notify(input).catch(() => {
    // Swallow: notification delivery failure must not surface as a send failure.
  });

  pendingNotificationTasks.add(task);
  void task.finally(() => {
    pendingNotificationTasks.delete(task);
  });
}

/** Test-only: lets tests await fire-and-forget notification delivery before asserting. */
export async function drainDirectMessageNotificationsForTests(): Promise<void> {
  if (pendingNotificationTasks.size === 0) {
    return;
  }

  await Promise.allSettled([...pendingNotificationTasks]);
}
