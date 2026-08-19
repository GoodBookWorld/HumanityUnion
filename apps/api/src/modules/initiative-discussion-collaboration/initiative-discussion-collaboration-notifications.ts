import { createNotification } from "../notifications/notification.service.js";
import { resolveRecipientIdentity } from "../notifications/notification.recipients.js";
import { getNotificationTemplate } from "../notifications/notification.templates.js";

/**
 * Profile UX Pack 01 Part 4 / Lifecycle Staging Fix 02 —
 * `?filter=collaboration` is read once on initial load by
 * `PublicInitiativeExperiencePage` to land the notification recipient on the
 * Collaboration working list (Discussion tab; `#discussion` activates that
 * tab via existing shell hash routing). Same canonical Initiative route —
 * never a parallel page.
 */
export function buildInitiativeCollaborationDeepLink(initiativeId: string): string {
  return `/initiatives/public/${encodeURIComponent(initiativeId)}?filter=collaboration#discussion`;
}

function initiativeCollaborationUrl(initiativeId: string): string {
  return buildInitiativeCollaborationDeepLink(initiativeId);
}

export interface CollaborationNotificationInput {
  recipientParticipantId: string;
  actorParticipantId: string;
  eventType:
    | "initiative_collaboration_interest_expressed"
    | "initiative_collaboration_interest_accepted"
    | "initiative_collaboration_interest_declined"
    | "initiative_allies_invitation_received"
    | "initiative_allies_invitation_accepted"
    | "initiative_allies_invitation_declined";
  initiativeId: string;
}

async function notify(input: CollaborationNotificationInput): Promise<void> {
  if (input.recipientParticipantId === input.actorParticipantId) {
    return;
  }

  const recipient = await resolveRecipientIdentity(input.recipientParticipantId);

  if (!recipient) {
    return;
  }

  const template = getNotificationTemplate(input.eventType);

  await createNotification({
    recipientUserId: recipient.userId,
    recipientProfileId: recipient.profileId,
    eventType: input.eventType,
    title: template.title,
    message: template.message,
    relatedEntityType: "initiative",
    relatedEntityId: input.initiativeId,
    relatedUrl: initiativeCollaborationUrl(input.initiativeId),
    priority: template.priority,
  });
}

const pendingNotificationTasks = new Set<Promise<unknown>>();

/** Notification delivery must never block the collaboration workflow itself. */
export function emitInitiativeCollaborationNotification(
  input: CollaborationNotificationInput,
): void {
  const task = notify(input).catch(() => {
    // Swallow: notification delivery failure must not surface as a workflow error.
  });

  pendingNotificationTasks.add(task);
  void task.finally(() => {
    pendingNotificationTasks.delete(task);
  });
}

/** Test-only: lets tests await fire-and-forget notification delivery before asserting/exiting. */
export async function drainInitiativeCollaborationNotificationsForTests(): Promise<void> {
  if (pendingNotificationTasks.size === 0) {
    return;
  }

  await Promise.allSettled([...pendingNotificationTasks]);
}
