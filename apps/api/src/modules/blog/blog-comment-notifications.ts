import type { BlogComment } from "@hu/types";

import { createNotification } from "../notifications/notification.service.js";
import { resolveRecipientIdentity } from "../notifications/notification.recipients.js";
import { getNotificationTemplate } from "../notifications/notification.templates.js";
import { findBlogPostById } from "./persistence/blog.repository.js";
import { findBlogCommentById } from "./persistence/blog-comment.repository.js";

function blogCommentUrl(slug: string, commentId: string): string {
  return `/blog/${encodeURIComponent(slug)}#comment-${encodeURIComponent(commentId)}`;
}

async function notifyIfDistinct(input: {
  recipientParticipantId: string | null | undefined;
  actorParticipantId: string;
  eventType: "blog_comment_posted" | "blog_comment_reply";
  postId: string;
  commentId: string;
  slug: string;
}): Promise<void> {
  if (!input.recipientParticipantId || input.recipientParticipantId === input.actorParticipantId) {
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
    relatedEntityType: "blog_post",
    relatedEntityId: input.commentId,
    relatedUrl: blogCommentUrl(input.slug, input.commentId),
    priority: template.priority,
  });
}

export async function notifyBlogCommentParticipants(input: {
  comment: BlogComment;
  actorParticipantId: string;
}): Promise<void> {
  // Only notify for publicly visible comments.
  if (input.comment.status !== "visible") {
    return;
  }

  const post = await findBlogPostById(input.comment.postId);
  if (!post || post.status !== "published") {
    return;
  }

  if (input.comment.parentCommentId) {
    const parent = await findBlogCommentById(input.comment.parentCommentId);
    await notifyIfDistinct({
      recipientParticipantId: parent?.authorParticipantId,
      actorParticipantId: input.actorParticipantId,
      eventType: "blog_comment_reply",
      postId: post.postId,
      commentId: input.comment.commentId,
      slug: post.slug,
    });
    return;
  }

  await notifyIfDistinct({
    recipientParticipantId: post.authorParticipantId,
    actorParticipantId: input.actorParticipantId,
    eventType: "blog_comment_posted",
    postId: post.postId,
    commentId: input.comment.commentId,
    slug: post.slug,
  });
}

export async function emitBlogCommentNotifications(input: {
  comment: BlogComment;
  actorParticipantId: string;
}): Promise<void> {
  await notifyBlogCommentParticipants(input).catch(() => {
    /* never block comment workflows */
  });
}
