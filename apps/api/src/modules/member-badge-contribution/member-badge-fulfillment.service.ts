import type { MemberBadgeContributionRecord } from "@hu/types";

import { createNotification } from "../notifications/notification.service.js";
import {
  findMemberBadgeContributionById,
  updateMemberBadgeContribution,
} from "./member-badge-contribution.repository.js";

/** Future authorized administration hooks (TASK-094 prep). */
export async function listConfirmedMemberBadgeContributions(): Promise<
  MemberBadgeContributionRecord[]
> {
  const { findMemberBadgeContributionsForFulfillment } =
    await import("./member-badge-contribution.repository.js");
  return findMemberBadgeContributionsForFulfillment("contribution_confirmed");
}

export async function markMemberBadgeContributionPreparing(
  badgeContributionId: string,
): Promise<MemberBadgeContributionRecord | null> {
  return updateMemberBadgeContribution(badgeContributionId, {
    fulfillmentStatus: "preparing",
  });
}

export async function markMemberBadgeContributionShipped(input: {
  badgeContributionId: string;
  trackingCarrier: string;
  trackingNumber: string;
}): Promise<MemberBadgeContributionRecord | null> {
  const now = new Date().toISOString();
  const updated = await updateMemberBadgeContribution(input.badgeContributionId, {
    fulfillmentStatus: "shipped",
    trackingCarrier: input.trackingCarrier,
    trackingNumber: input.trackingNumber,
    shippedAt: now,
  });

  if (updated) {
    await createNotification({
      recipientUserId: updated.userId,
      recipientProfileId: updated.profileId,
      eventType: "member_badge_shipped",
      title: "Official Member item shipped",
      message: `Your official Humanity Union Member item request ${updated.badgeRequestNumber} has shipped.`,
      relatedEntityType: "member_badge_contribution",
      relatedEntityId: updated.badgeContributionId,
      relatedUrl: `/membership/member-badge/requests/${updated.badgeContributionId}`,
      priority: "important",
    });
  }

  return updated;
}

export async function markMemberBadgeContributionDelivered(
  badgeContributionId: string,
): Promise<MemberBadgeContributionRecord | null> {
  const updated = await updateMemberBadgeContribution(badgeContributionId, {
    fulfillmentStatus: "delivered",
    deliveredAt: new Date().toISOString(),
  });

  if (updated) {
    await createNotification({
      recipientUserId: updated.userId,
      recipientProfileId: updated.profileId,
      eventType: "member_badge_delivered",
      title: "Official Member item delivered",
      message: `Your official Humanity Union Member item request ${updated.badgeRequestNumber} was delivered.`,
      relatedEntityType: "member_badge_contribution",
      relatedEntityId: updated.badgeContributionId,
      relatedUrl: `/membership/member-badge/requests/${updated.badgeContributionId}`,
      priority: "informational",
    });
  }

  return updated;
}

export async function getMemberBadgeContributionForAdmin(
  badgeContributionId: string,
): Promise<MemberBadgeContributionRecord | null> {
  return findMemberBadgeContributionById(badgeContributionId);
}
