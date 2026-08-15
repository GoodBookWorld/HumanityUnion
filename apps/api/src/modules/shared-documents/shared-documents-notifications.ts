import { createNotification } from "../notifications/notification.service.js";
import { resolveRecipientIdentity } from "../notifications/notification.recipients.js";
import { getNotificationTemplate } from "../notifications/notification.templates.js";

/**
 * Communication UX Pack 03.7 Part 10 — reuses the exact same fire-and-forget
 * notification primitives every other communication pack already
 * standardized on (`createNotification` + `resolveRecipientIdentity` +
 * `getNotificationTemplate`). Never notifies the uploader (Part 10:
 * "Never notify the uploader") — enforced by the caller only ever
 * iterating `otherParticipantIds` (which already excludes the actor —
 * see `shared-documents-access.ts`), and defensively re-checked here too.
 *
 * Every notification's `relatedUrl` opens the originating communication
 * context (Direct Conversation / Collaboration Channel / Collaboration
 * Session) — never the file itself, and never auto-downloads (Part 10).
 */
export type SharedDocumentNotificationEventType =
  | "shared_document_uploaded"
  | "shared_document_replaced"
  | "shared_document_removed";

export interface SharedDocumentNotificationInput {
  recipientParticipantId: string;
  uploaderParticipantId: string;
  relatedEntityType: "direct_conversation" | "initiative";
  relatedEntityId: string;
  relatedUrl: string;
}

async function notify(
  eventType: SharedDocumentNotificationEventType,
  input: SharedDocumentNotificationInput,
): Promise<void> {
  if (input.recipientParticipantId === input.uploaderParticipantId) {
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
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    relatedUrl: input.relatedUrl,
    priority: template.priority,
  });
}

const pendingNotificationTasks = new Set<Promise<unknown>>();

function track(task: Promise<unknown>): void {
  const tracked = task.catch(() => {
    // Swallow: notification delivery failure must never surface as an upload/replace/remove failure.
  });

  pendingNotificationTasks.add(tracked);
  void tracked.finally(() => {
    pendingNotificationTasks.delete(tracked);
  });
}

export function emitSharedDocumentUploadedNotification(input: SharedDocumentNotificationInput): void {
  track(notify("shared_document_uploaded", input));
}

export function emitSharedDocumentReplacedNotification(input: SharedDocumentNotificationInput): void {
  track(notify("shared_document_replaced", input));
}

export function emitSharedDocumentRemovedNotification(input: SharedDocumentNotificationInput): void {
  track(notify("shared_document_removed", input));
}

/** Test-only: lets tests await fire-and-forget notification delivery before asserting/exiting. */
export async function drainSharedDocumentNotificationsForTests(): Promise<void> {
  if (pendingNotificationTasks.size === 0) {
    return;
  }

  await Promise.allSettled([...pendingNotificationTasks]);
}
