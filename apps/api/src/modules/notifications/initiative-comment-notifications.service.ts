import type { InitiativeComment } from "@hu/types";

import { findAuthUserById } from "../auth/auth-user.repository.js";
import { getInitiativeById } from "../initiatives/initiative.store.js";
import { getInitiativeCommentById } from "../initiative-comments/initiative-comment.service.js";
import { createNotification } from "./notification.service.js";
import { resolveRecipientIdentity } from "./notification.recipients.js";
import { getNotificationTemplate } from "./notification.templates.js";

function initiativeDiscussionUrl(initiativeId: string): string {
  return `/initiatives/public/${encodeURIComponent(initiativeId)}#discussion`;
}

async function resolveMemberIdForUser(userId: string): Promise<string | null> {
  const authUser = await findAuthUserById(userId);
  return authUser?.memberId ?? null;
}

async function notifyMemberIfDistinct(input: {
  recipientMemberId: string | null | undefined;
  actorMemberId: string | null | undefined;
  eventType: "initiative_comment_posted" | "initiative_comment_reply";
  initiativeId: string;
  commentId: string;
}): Promise<void> {
  if (!input.recipientMemberId || input.recipientMemberId === input.actorMemberId) {
    return;
  }

  const recipient = await resolveRecipientIdentity(input.recipientMemberId);

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
    relatedEntityId: input.commentId,
    relatedUrl: initiativeDiscussionUrl(input.initiativeId),
    priority: template.priority,
  });
}

export async function notifyInitiativeCommentParticipants(input: {
  comment: InitiativeComment;
  actorMemberId: string | null;
}): Promise<void> {
  const initiative = getInitiativeById(input.comment.initiativeId);

  if (!initiative) {
    return;
  }

  if (input.comment.parentCommentId) {
    const parentComment = await getInitiativeCommentById(input.comment.parentCommentId);
    const parentAuthorMemberId = parentComment
      ? await resolveMemberIdForUser(parentComment.authorUserId)
      : null;

    await notifyMemberIfDistinct({
      recipientMemberId: parentAuthorMemberId,
      actorMemberId: input.actorMemberId,
      eventType: "initiative_comment_reply",
      initiativeId: input.comment.initiativeId,
      commentId: input.comment.commentId,
    });

    return;
  }

  await notifyMemberIfDistinct({
    recipientMemberId: initiative.stewardId,
    actorMemberId: input.actorMemberId,
    eventType: "initiative_comment_posted",
    initiativeId: input.comment.initiativeId,
    commentId: input.comment.commentId,
  });
}

export function emitInitiativeCommentNotifications(input: {
  comment: InitiativeComment;
  actorMemberId: string | null;
}): void {
  void notifyInitiativeCommentParticipants(input).catch(() => {
    // Notification delivery must not block comment posting.
  });
}
