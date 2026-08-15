import { createNotification } from "../notifications/notification.service.js";
import { resolveRecipientIdentity } from "../notifications/notification.recipients.js";
import { getNotificationTemplate } from "../notifications/notification.templates.js";

/**
 * Communication UX Pack 03.6 Part 7 — Collaboration Session notifications
 * reuse the exact same fire-and-forget primitives as the Collaboration
 * Channel (`initiative-collaboration-channel-notifications.ts`): the same
 * `createNotification` + `resolveRecipientIdentity` + `getNotificationTemplate`
 * building blocks, never `emitCivicNotificationEvent` (that path has no
 * case for a known peer-recipient list or a Sessions-specific deep link).
 *
 * Every notification routes directly to the Initiative's Collaboration
 * Sessions, and never through the Collaboration Channel.
 *
 * Communication UX Pack 03.9 Part 12 — Workspace Messages is now the single
 * communication workspace, so the deep link opens Initiative Group Chat
 * mode there (pre-selecting the Initiative and the Sessions section)
 * instead of the old `/initiatives/public/{id}#collaboration-sessions`
 * anchor. The public Initiative page still mounts the same Sessions
 * component independently; this only changes where a notification click
 * lands.
 */
function collaborationSessionsUrl(initiativeId: string): string {
  return `/workspace/messages?mode=initiative&initiativeId=${encodeURIComponent(initiativeId)}&section=sessions`;
}

export interface CollaborationSessionNotificationInput {
  recipientParticipantId: string;
  /** Omitted for a notification with no single human actor (none currently apply, kept for symmetry with the Channel's helper). */
  actorParticipantId?: string;
  initiativeId: string;
}

type CollaborationSessionNotificationEventType =
  | "initiative_collaboration_session_created"
  | "initiative_collaboration_session_updated"
  | "initiative_collaboration_session_cancelled"
  | "initiative_collaboration_session_attendance_changed"
  | "initiative_collaboration_session_upcoming_reminder";

async function notify(
  eventType: CollaborationSessionNotificationEventType,
  input: CollaborationSessionNotificationInput,
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
    relatedUrl: collaborationSessionsUrl(input.initiativeId),
    priority: template.priority,
  });
}

const pendingNotificationTasks = new Set<Promise<unknown>>();

function track(task: Promise<unknown>): void {
  const tracked = task.catch(() => {
    // Swallow: notification delivery failure must never surface as a Session write failure.
  });

  pendingNotificationTasks.add(tracked);
  void tracked.finally(() => {
    pendingNotificationTasks.delete(tracked);
  });
}

/** Part 7 — a new Session was scheduled; notifies every current Active Ally (the Author is always the actor, so self-exclusion is automatic). */
export function emitInitiativeCollaborationSessionCreatedNotification(
  input: CollaborationSessionNotificationInput,
): void {
  track(notify("initiative_collaboration_session_created", input));
}

/** Part 5/7 — an existing Session was edited or rescheduled. */
export function emitInitiativeCollaborationSessionUpdatedNotification(
  input: CollaborationSessionNotificationInput,
): void {
  track(notify("initiative_collaboration_session_updated", input));
}

/** Part 5/7 — a Session was cancelled. */
export function emitInitiativeCollaborationSessionCancelledNotification(
  input: CollaborationSessionNotificationInput,
): void {
  track(notify("initiative_collaboration_session_cancelled", input));
}

/** Part 6/7 — an Active Ally changed their attendance response; notifies the Author only. */
export function emitInitiativeCollaborationSessionAttendanceChangedNotification(
  input: CollaborationSessionNotificationInput,
): void {
  track(notify("initiative_collaboration_session_attendance_changed", input));
}

/**
 * Part 7/8 — a Session is about to begin. Exposed as a ready-to-call
 * extension point only: nothing in this pack invokes it anywhere. A future
 * scheduled-job/automation pack (Part 8: "reminder generation belongs to
 * future automation packs") calls this once it exists, for every current
 * access holder of the Session's Initiative.
 */
export function emitInitiativeCollaborationSessionUpcomingReminderNotification(
  input: CollaborationSessionNotificationInput,
): void {
  track(notify("initiative_collaboration_session_upcoming_reminder", input));
}

/** Test-only: lets tests await fire-and-forget notification delivery before asserting/exiting. */
export async function drainInitiativeCollaborationSessionNotificationsForTests(): Promise<void> {
  if (pendingNotificationTasks.size === 0) {
    return;
  }

  await Promise.allSettled([...pendingNotificationTasks]);
}
