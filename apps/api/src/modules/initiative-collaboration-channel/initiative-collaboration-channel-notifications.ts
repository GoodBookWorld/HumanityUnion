import {
  createNotification,
  markNotificationsReadByRelatedEntity,
} from "../notifications/notification.service.js";
import { resolveRecipientIdentity } from "../notifications/notification.recipients.js";
import { getNotificationTemplate } from "../notifications/notification.templates.js";

/** Both Collaboration Channel notification event types — used to narrow `markNotificationsReadByRelatedEntity` so it never touches an unrelated platform Notification that happens to share `relatedEntityType: "initiative"` + the same `initiativeId`. */
const CHANNEL_NOTIFICATION_EVENT_TYPES = [
  "initiative_collaboration_channel_message_received",
  "initiative_collaboration_channel_system_event",
] as const;

/**
 * Communication UX Pack 03.5 Part 7 — Collaboration Channel notifications
 * reuse the exact same fire-and-forget notification infrastructure as
 * Direct Messaging (`direct-messaging-notifications.ts`) and Initiative
 * Ally (`initiative-discussion-collaboration-notifications.ts`): the same
 * `createNotification` + `resolveRecipientIdentity` + `getNotificationTemplate`
 * primitives, never `emitCivicNotificationEvent` (that path has no case for
 * a known peer recipient list or a Channel deep-link — see the two
 * dedicated event types added for this pack).
 *
 * Every notification routes directly to the Initiative's Collaboration
 * Channel, and never embeds the private message text in the notification
 * body.
 *
 * Communication UX Pack 03.9 Part 12 — Workspace Messages is now the single
 * communication workspace, so the deep link opens Initiative Group Chat
 * mode there (pre-selecting the Initiative and the Channel section) instead
 * of the old `/initiatives/public/{id}#collaboration-channel` anchor. The
 * public Initiative page still mounts the same Channel component
 * independently; this only changes where a notification click lands.
 */
function collaborationChannelUrl(initiativeId: string): string {
  return `/workspace/messages?mode=initiative&initiativeId=${encodeURIComponent(initiativeId)}&section=channel`;
}

export interface CollaborationChannelNotificationInput {
  recipientParticipantId: string;
  /** Omitted for a system event with no single human actor. */
  actorParticipantId?: string;
  initiativeId: string;
}

async function notify(
  eventType: "initiative_collaboration_channel_message_received" | "initiative_collaboration_channel_system_event",
  input: CollaborationChannelNotificationInput,
): Promise<void> {
  if (input.actorParticipantId && input.recipientParticipantId === input.actorParticipantId) {
    return;
  }

  const recipient = await resolveRecipientIdentity(input.recipientParticipantId);

  if (!recipient) {
    return;
  }

  const template = getNotificationTemplate(eventType);

  await createNotification({
    recipientUserId: recipient.userId,
    recipientProfileId: recipient.profileId,
    eventType,
    title: template.title,
    message: template.message,
    relatedEntityType: "initiative",
    relatedEntityId: input.initiativeId,
    relatedUrl: collaborationChannelUrl(input.initiativeId),
    priority: template.priority,
  });
}

const pendingNotificationTasks = new Set<Promise<unknown>>();

function track(task: Promise<unknown>): void {
  const tracked = task.catch(() => {
    // Swallow: notification delivery failure must never surface as a Channel send/system-event failure.
  });

  pendingNotificationTasks.add(tracked);
  void tracked.finally(() => {
    pendingNotificationTasks.delete(tracked);
  });
}

/** New participant message in the Channel — notifies every other access holder (skip-self via `actorParticipantId`). */
export function emitInitiativeCollaborationChannelMessageNotification(
  input: CollaborationChannelNotificationInput,
): void {
  track(notify("initiative_collaboration_channel_message_received", input));
}

/** Important system event posted to the Channel (Part 5/7), e.g. Ally joined. */
export function emitInitiativeCollaborationChannelSystemEventNotification(
  input: CollaborationChannelNotificationInput,
): void {
  track(notify("initiative_collaboration_channel_system_event", input));
}

/**
 * Lifecycle UX Correction Pack 01 Part 1/5 — the Channel's counterpart to
 * Direct Messaging's `markDirectMessageNotificationsRead`: opening/reading
 * the Channel (the only place this happens today) clears every
 * `initiative_collaboration_channel_*` notification for this Initiative,
 * so the Notification Center's Messages section (which now surfaces these
 * as unread-conversation cards, not platform Notifications) converges with
 * the Channel's own durable read state instead of drifting from it. Never
 * touches any other notification for this Initiative (e.g. a published
 * Collaborative Analysis).
 */
export async function markInitiativeCollaborationChannelNotificationsRead(input: {
  participantId: string;
  initiativeId: string;
}): Promise<void> {
  const recipient = await resolveRecipientIdentity(input.participantId);

  if (!recipient) {
    return;
  }

  await markNotificationsReadByRelatedEntity(
    recipient.userId,
    "initiative",
    input.initiativeId,
    CHANNEL_NOTIFICATION_EVENT_TYPES,
  );
}

/** Test-only: lets tests await fire-and-forget notification delivery before asserting/exiting. */
export async function drainInitiativeCollaborationChannelNotificationsForTests(): Promise<void> {
  if (pendingNotificationTasks.size === 0) {
    return;
  }

  await Promise.allSettled([...pendingNotificationTasks]);
}
