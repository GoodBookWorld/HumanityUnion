import { createReminderIfNotExists } from "../reminders/reminder.service.js";
import { resolveRecipientIdentity } from "../notifications/notification.recipients.js";

/**
 * Lifecycle UX Correction Pack 01 Part 6/7 — "upcoming Collaboration
 * Session" is one of the named Reminder generation sources. Generated at
 * scheduling time (there is no scheduled-job/cron infrastructure in this
 * codebase yet to fire it closer to the Session's start), and deduplicated
 * per (recipient, session) by `createReminderIfNotExists` so rescheduling
 * or re-fetching never produces a second Reminder for the same Session.
 *
 * Deliberately a separate Reminder from `initiative_collaboration_session_created`
 * (a Notification, Part 1) — "Collaboration Session invitation ->
 * Notifications" is the immediate "you were invited" signal; this Reminder
 * is the forward-looking "you have something to prepare for" nudge.
 */
export interface InitiativeCollaborationSessionReminderInput {
  recipientParticipantId: string;
  actorParticipantId: string;
  initiativeId: string;
  sessionId: string;
  sessionTitle: string;
  scheduledAtUtc: string;
}

function collaborationSessionsUrl(initiativeId: string): string {
  return `/workspace/messages?mode=initiative&initiativeId=${encodeURIComponent(initiativeId)}&section=sessions`;
}

async function notify(input: InitiativeCollaborationSessionReminderInput): Promise<void> {
  if (input.recipientParticipantId === input.actorParticipantId) {
    return;
  }

  const recipient = await resolveRecipientIdentity(input.recipientParticipantId);

  if (!recipient) {
    return;
  }

  await createReminderIfNotExists({
    recipientUserId: recipient.userId,
    recipientProfileId: recipient.profileId,
    category: "session",
    title: "Upcoming Collaboration Session",
    message: `"${input.sessionTitle}" is scheduled — review the details and confirm your attendance.`,
    relatedEntityType: "initiative_collaboration_session",
    relatedEntityId: input.sessionId,
    relatedUrl: collaborationSessionsUrl(input.initiativeId),
    dueAt: input.scheduledAtUtc,
  });
}

const pendingReminderTasks = new Set<Promise<unknown>>();

/** A new Session was scheduled — nudges every other current Active Ally to prepare for it. */
export function emitInitiativeCollaborationSessionUpcomingReminder(
  input: InitiativeCollaborationSessionReminderInput,
): void {
  const task = notify(input).catch(() => {
    // Swallow: reminder generation failure must never surface as a Session write failure.
  });

  pendingReminderTasks.add(task);
  void task.finally(() => {
    pendingReminderTasks.delete(task);
  });
}

/** Test-only: lets tests await fire-and-forget reminder generation before asserting/exiting. */
export async function drainInitiativeCollaborationSessionRemindersForTests(): Promise<void> {
  if (pendingReminderTasks.size === 0) {
    return;
  }

  await Promise.allSettled([...pendingReminderTasks]);
}
