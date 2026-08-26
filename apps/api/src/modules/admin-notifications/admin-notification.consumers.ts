/**
 * Pack 22E.1 — Admin notification projection consumers.
 */
import { resolveInitiativeLifecycleProfile } from "@hu/types";

import type { CanonicalDomainEventEnvelope } from "../../infrastructure/events/domain-event.js";
import { findBlogPostById } from "../blog/persistence/blog.repository.js";
import { projectAdminNotificationForAdmins } from "./admin-notification.service.js";
import type { AdminNotificationProjectionDeps } from "./admin-notification.service.js";

export const ADMIN_NOTIFICATIONS_MEMBER_REGISTERED_CONSUMER_ID =
  "admin.notifications.member-registered.v1" as const;
export const ADMIN_NOTIFICATIONS_BLOG_SUBSCRIBER_CONFIRMED_CONSUMER_ID =
  "admin.notifications.blog-subscriber-confirmed.v1" as const;
export const ADMIN_NOTIFICATIONS_INITIATIVE_PUBLISHED_CONSUMER_ID =
  "admin.notifications.initiative-published.v1" as const;
export const ADMIN_NOTIFICATIONS_BLOG_POST_PUBLISHED_CONSUMER_ID =
  "admin.notifications.blog-post-published.v1" as const;

function asRecord(payload: unknown): Record<string, unknown> {
  return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function handleMemberRegisteredAdminNotification(
  envelope: CanonicalDomainEventEnvelope,
  deps: AdminNotificationProjectionDeps = {},
): Promise<void> {
  const payload = asRecord(envelope.payload);
  const displayName = asString(payload.displayName);
  const uniqueName = asString(payload.uniqueName);
  const label = displayName ?? uniqueName ?? "Participant";

  await projectAdminNotificationForAdmins(
    {
      type: "participant_registered",
      title: "New Participant",
      actorLabel: label,
      targetLabel: label,
      targetHref: "/admin/participants",
      sourceEventId: envelope.eventId,
      createdAt: envelope.metadata.occurredAt,
    },
    deps,
  );
}

export async function handleBlogSubscriptionConfirmedAdminNotification(
  envelope: CanonicalDomainEventEnvelope,
  deps: AdminNotificationProjectionDeps = {},
): Promise<void> {
  const payload = asRecord(envelope.payload);
  const displayLabel = asString(payload.displayLabel) ?? "Subscriber";

  await projectAdminNotificationForAdmins(
    {
      type: "blog_subscriber_confirmed",
      title: "New Blog subscriber",
      actorLabel: displayLabel,
      targetLabel: displayLabel,
      targetHref: "/admin/views/subscribers",
      sourceEventId: envelope.eventId,
      createdAt: envelope.metadata.occurredAt,
    },
    deps,
  );
}

export async function handleInitiativePublishedAdminNotification(
  envelope: CanonicalDomainEventEnvelope,
  deps: AdminNotificationProjectionDeps = {},
): Promise<void> {
  const payload = asRecord(envelope.payload);
  const initiativeId = asString(payload.initiativeId);
  if (!initiativeId) {
    return;
  }

  const title = asString(payload.title) ?? "Initiative";
  const electionTitle = asString(payload.electionTitle) ?? title;
  const actorLabel = asString(payload.actorLabel);
  const profile = resolveInitiativeLifecycleProfile(
    asString(payload.lifecycleProfile) as "STANDARD" | "PUBLIC_CHOICE" | undefined,
  );

  if (profile === "PUBLIC_CHOICE") {
    await projectAdminNotificationForAdmins(
      {
        type: "public_choice_published",
        title: "New Public Choice",
        ...(actorLabel ? { actorLabel } : {}),
        targetLabel: electionTitle,
        targetHref: `/admin/public-choice/${encodeURIComponent(initiativeId)}`,
        sourceEventId: envelope.eventId,
        createdAt: envelope.metadata.occurredAt,
      },
      deps,
    );
    return;
  }

  await projectAdminNotificationForAdmins(
    {
      type: "initiative_published",
      title: "New Initiative",
      ...(actorLabel ? { actorLabel } : {}),
      targetLabel: title,
      targetHref: `/admin/initiatives/${encodeURIComponent(initiativeId)}`,
      sourceEventId: envelope.eventId,
      createdAt: envelope.metadata.occurredAt,
    },
    deps,
  );
}

export async function handleBlogPostPublishedAdminNotification(
  envelope: CanonicalDomainEventEnvelope,
  deps: AdminNotificationProjectionDeps & {
    findPostById?: typeof findBlogPostById;
  } = {},
): Promise<void> {
  const payload = asRecord(envelope.payload);
  const postId = asString(payload.postId);
  const slugFromEvent = asString(payload.slug);
  if (!postId) {
    return;
  }

  const findPost = deps.findPostById ?? findBlogPostById;
  const post = await findPost(postId);
  if (!post || post.status !== "published") {
    return;
  }

  const slug = post.slug || slugFromEvent;
  if (!slug) {
    return;
  }

  const authorLabel =
    asString(post.authorDisplayNameSnapshot) ?? asString(payload.authorParticipantId) ?? "Author";
  const postTitle = asString(post.title) ?? "Publication";

  await projectAdminNotificationForAdmins(
    {
      type: "blog_post_published",
      title: "New Blog publication",
      actorLabel: authorLabel,
      targetLabel: postTitle,
      targetHref: `/blog/${encodeURIComponent(slug)}`,
      sourceEventId: envelope.eventId,
      createdAt: envelope.metadata.occurredAt,
    },
    deps,
  );
}
