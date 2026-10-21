import { resolveIntegrityMediaAuthorParticipants } from "../integrity-media-author-messages/integrity-media-author-directory.service.js";
import {
  projectAdminNotificationForAdmins,
  type AdminNotificationProjectionDeps,
} from "./admin-notification.service.js";

const AUTHOR_REPLY_NOTIFICATION_TITLE = "Integrity Media author message";
const AUTHOR_REPLY_NOTIFICATION_HREF = "/admin/integrity-media";
const AUTHOR_REPLY_FALLBACK_LABEL = "Participant";

let announcementDepsForTests: AdminNotificationProjectionDeps | null = null;

/** Test-only. Production uses the active-admin list and the configured inbox store. */
export function setIntegrityMediaAuthorReplyAnnouncementDepsForTests(
  deps: AdminNotificationProjectionDeps | null,
): void {
  announcementDepsForTests = deps;
}

/**
 * Inbox announcement for one newly stored IM → HU author chat.
 * Runs only after the reply transaction commits. A projection or profile
 * lookup failure does not change reply acceptance.
 */
export async function announceAcceptedIntegrityMediaAuthorReply(input: {
  messageId: string;
  memberId: string;
}): Promise<void> {
  try {
    const targetLabel = await resolveAuthorReplyTargetLabel(input.memberId);
    await projectAdminNotificationForAdmins(
      {
        type: "integrity_media_author_message",
        title: AUTHOR_REPLY_NOTIFICATION_TITLE,
        targetLabel,
        targetHref: AUTHOR_REPLY_NOTIFICATION_HREF,
        sourceEventId: input.messageId,
      },
      announcementDepsForTests ?? {},
    );
  } catch {
    // The reply row is already durable.
  }
}

async function resolveAuthorReplyTargetLabel(memberId: string): Promise<string> {
  try {
    const displays = await resolveIntegrityMediaAuthorParticipants([memberId]);
    const name = displays.get(memberId)?.participantDisplayName?.trim();
    return name ? name : AUTHOR_REPLY_FALLBACK_LABEL;
  } catch {
    return AUTHOR_REPLY_FALLBACK_LABEL;
  }
}
