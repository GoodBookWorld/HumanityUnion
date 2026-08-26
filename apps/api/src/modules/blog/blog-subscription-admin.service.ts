/**
 * Pack 21C — Admin Blog subscriber directory + remove.
 */
import type {
  AdminBlogSubscriberDirectoryItem,
  AdminBlogSubscriberDirectoryResponse,
  AdminBlogSubscriberRemoveResponse,
  AdminBlogSubscriberStatusFilter,
  BlogSubscriberRecord,
  BlogSubscriptionType,
} from "@hu/types";

import {
  AdministrationForbiddenError,
  AdministrationUnauthorizedError,
} from "../administration/administration.errors.js";
import { record as recordAdministrationAudit } from "../administration/audit.service.js";
import { findAuthUserById, findAuthUserByMemberId } from "../auth/auth-user.repository.js";
import { findMemberProfileByUserId } from "../member-profile/member-profile.repository.js";
import { BlogNotFoundError } from "./blog.errors.js";
import { isBlogSubscriberEligibleForPublicationDelivery } from "./blog-subscription-labels.js";
import {
  countBlogSubscribersByStatus,
  findBlogSubscriberById,
  listBlogSubscribersForAdmin,
  upsertBlogSubscriberRecord,
} from "./persistence/blog-subscriber.repository.js";

/** Pack 21C — memory-store unit tests without Auth Mongo. */
let adminActorOverrideForTests: {
  userId: string;
  participantId: string;
  role: "admin" | "member";
} | null = null;

let displayNameResolverForTests:
  | ((participantId: string) => string | undefined)
  | null = null;

export function setBlogSubscriberAdminActorOverrideForTests(
  actor: { userId: string; participantId: string; role: "admin" | "member" } | null,
): void {
  adminActorOverrideForTests = actor;
}

export function setBlogSubscriberDisplayNameResolverForTests(
  resolver: ((participantId: string) => string | undefined) | null,
): void {
  displayNameResolverForTests = resolver;
}

async function assertAdminActor(userId: string): Promise<{
  userId: string;
  participantId: string;
}> {
  if (!userId.trim()) {
    throw new AdministrationUnauthorizedError("Authentication is required.");
  }
  if (adminActorOverrideForTests) {
    if (adminActorOverrideForTests.userId !== userId) {
      throw new AdministrationUnauthorizedError();
    }
    if (adminActorOverrideForTests.role !== "admin") {
      throw new AdministrationForbiddenError("Administrator access is required.");
    }
    return {
      userId: adminActorOverrideForTests.userId,
      participantId: adminActorOverrideForTests.participantId,
    };
  }
  const user = await findAuthUserById(userId);
  if (!user) {
    throw new AdministrationUnauthorizedError();
  }
  if (user.role !== "admin") {
    throw new AdministrationForbiddenError("Administrator access is required.");
  }
  return { userId: user.userId, participantId: user.memberId };
}

/** Pack 21E — shared Admin gate for selected-subscriber messaging. */
export async function assertBlogSubscriberAdminActor(userId: string): Promise<{
  userId: string;
  participantId: string;
}> {
  return assertAdminActor(userId);
}

async function resolveLinkedDisplayName(participantId: string): Promise<string | undefined> {
  if (displayNameResolverForTests) {
    return displayNameResolverForTests(participantId)?.trim() || undefined;
  }
  try {
    const authUser = await findAuthUserByMemberId(participantId);
    if (!authUser) {
      return undefined;
    }
    const profile = await findMemberProfileByUserId(authUser.userId);
    const name =
      profile?.displayName?.trim() || authUser.displayName?.trim() || undefined;
    return name || undefined;
  } catch {
    return undefined;
  }
}

async function toDirectoryItem(
  record: BlogSubscriberRecord,
): Promise<AdminBlogSubscriberDirectoryItem> {
  const displayName = record.participantId
    ? await resolveLinkedDisplayName(record.participantId)
    : undefined;
  return {
    subscriberId: record.subscriberId,
    ...(displayName ? { displayName } : {}),
    email: record.emailDisplay || record.emailNormalized,
    subscriptionType: record.subscriptionType,
    status: record.status,
    ...(record.subscribedAt ? { subscribedAt: record.subscribedAt } : {}),
    ...(record.confirmedAt ? { confirmedAt: record.confirmedAt } : {}),
    ...(record.countryCode ? { countryCode: record.countryCode } : {}),
    emailsSent: record.emailsSent,
    hasLinkedParticipant: Boolean(record.participantId),
    createdAt: record.createdAt,
  };
}

function recordMatchesSearch(
  record: BlogSubscriberRecord,
  displayName: string | undefined,
  qNormalized: string,
): boolean {
  if (!qNormalized) {
    return true;
  }
  if (record.emailNormalized.includes(qNormalized)) {
    return true;
  }
  if (record.emailDisplay.toLowerCase().includes(qNormalized)) {
    return true;
  }
  if (displayName?.toLowerCase().includes(qNormalized)) {
    return true;
  }
  return false;
}

export async function listAdminBlogSubscribers(input: {
  actorUserId: string;
  q?: string;
  status?: AdminBlogSubscriberStatusFilter;
  subscriptionType?: BlogSubscriptionType;
  limit?: number;
  offset?: number;
}): Promise<AdminBlogSubscriberDirectoryResponse> {
  await assertAdminActor(input.actorUserId);

  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);
  const status = input.status ?? "all";
  const subscriptionType = input.subscriptionType ?? "blog_publications";
  const qNormalized = input.q?.trim().toLowerCase() ?? "";

  const counts = await countBlogSubscribersByStatus({ subscriptionType });

  if (!qNormalized) {
    const listed = await listBlogSubscribersForAdmin({
      subscriptionType,
      status,
      limit,
      offset,
    });
    const subscribers: AdminBlogSubscriberDirectoryItem[] = [];
    for (const record of listed.items) {
      subscribers.push(await toDirectoryItem(record));
    }
    return {
      subscribers,
      total: listed.total,
      subscribedCount: counts.subscribed,
      notConfirmedCount: counts.not_confirmed,
      unsubscribedCount: counts.unsubscribed,
      limit,
      offset,
    };
  }

  // Search: bounded scan so email + linked display name can both match without
  // loading the entire collection into the browser.
  const scanned = await listBlogSubscribersForAdmin({
    subscriptionType,
    status,
    limit: 500,
    offset: 0,
  });
  const matched: AdminBlogSubscriberDirectoryItem[] = [];
  for (const record of scanned.items) {
    const item = await toDirectoryItem(record);
    if (!recordMatchesSearch(record, item.displayName, qNormalized)) {
      continue;
    }
    matched.push(item);
  }
  matched.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    subscribers: matched.slice(offset, offset + limit),
    total: matched.length,
    subscribedCount: counts.subscribed,
    notConfirmedCount: counts.not_confirmed,
    unsubscribedCount: counts.unsubscribed,
    limit,
    offset,
  };
}

export async function removeAdminBlogSubscriber(input: {
  actorUserId: string;
  subscriberId: string;
}): Promise<AdminBlogSubscriberRemoveResponse> {
  const admin = await assertAdminActor(input.actorUserId);
  const subscriberId = input.subscriberId.trim();
  if (!subscriberId) {
    throw new BlogNotFoundError("Subscriber not found.");
  }

  const existing = await findBlogSubscriberById(subscriberId);
  if (!existing) {
    throw new BlogNotFoundError("Subscriber not found.");
  }

  if (existing.status === "unsubscribed") {
    return {
      removed: true,
      subscriberId: existing.subscriberId,
      status: "unsubscribed",
      alreadyUnsubscribed: true,
    };
  }

  const now = new Date().toISOString();
  const updated: BlogSubscriberRecord = {
    subscriberId: existing.subscriberId,
    emailNormalized: existing.emailNormalized,
    emailDisplay: existing.emailDisplay,
    status: "unsubscribed",
    subscriptionType: existing.subscriptionType,
    ...(existing.participantId ? { participantId: existing.participantId } : {}),
    ...(existing.countryCode ? { countryCode: existing.countryCode } : {}),
    ...(existing.subscribedAt ? { subscribedAt: existing.subscribedAt } : {}),
    ...(existing.confirmedAt ? { confirmedAt: existing.confirmedAt } : {}),
    ...(existing.welcomeSentAt ? { welcomeSentAt: existing.welcomeSentAt } : {}),
    unsubscribedAt: now,
    emailsSent: existing.emailsSent,
    unsubscribeTokenHash: existing.unsubscribeTokenHash,
    createdAt: existing.createdAt,
    updatedAt: now,
  };
  await upsertBlogSubscriberRecord(updated);

  await recordAdministrationAudit({
    actorParticipantId: admin.participantId,
    action: "blog.subscriber.remove",
    targetType: "blog_subscriber",
    targetId: existing.subscriberId,
    scope: { scopeType: "blog", scopeId: "subscribers" },
    afterSummary: `subscriptionType=${existing.subscriptionType};status=unsubscribed`,
  });

  return {
    removed: true,
    subscriberId: existing.subscriberId,
    status: "unsubscribed",
    alreadyUnsubscribed: false,
  };
}

export { isBlogSubscriberEligibleForPublicationDelivery };
