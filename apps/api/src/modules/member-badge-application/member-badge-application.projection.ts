import type {
  AdminMemberBadgeOrderDetail,
  MemberBadgeApplicationDetail,
  MemberBadgeApplicationRecord,
  MemberBadgeApplicationShippingAddress,
} from "@hu/types";

import {
  MEMBER_BADGE_APPLICATION_DELIVERY_LABEL,
  MEMBER_BADGE_APPLICATION_PRICE_LABEL,
} from "./member-badge-application.constants.js";

export function toMemberBadgeApplicationDetail(
  record: MemberBadgeApplicationRecord,
  options?: { paymentSetupMessage?: string | null },
): MemberBadgeApplicationDetail {
  return {
    applicationId: record.applicationId,
    applicationStatus: record.applicationStatus,
    paymentStatus: record.paymentStatus,
    fulfillmentStatus: record.fulfillmentStatus,
    shipped: record.shipped,
    delivered: record.delivered,
    amountCents: record.amountCents,
    currency: record.currency,
    priceLabel: MEMBER_BADGE_APPLICATION_PRICE_LABEL,
    deliveryLabel: MEMBER_BADGE_APPLICATION_DELIVERY_LABEL,
    deliveryIncluded: true,
    shippingAddress: record.shippingAddress,
    memberNumberSnapshot: record.memberNumberSnapshot,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    paidAt: record.paidAt,
    paymentSetupMessage: options?.paymentSetupMessage ?? null,
  };
}

export function toAdminMemberBadgeOrderDetail(input: {
  record: MemberBadgeApplicationRecord;
  displayName: string;
  email: string;
  lookupUrl: string;
}): AdminMemberBadgeOrderDetail {
  const { record } = input;
  return {
    applicationId: record.applicationId,
    userId: record.userId,
    participantId: record.participantId,
    participantDisplayName: input.displayName,
    email: input.email,
    memberNumber: record.memberNumberSnapshot || null,
    paymentStatus: record.paymentStatus,
    fulfillmentStatus: record.fulfillmentStatus,
    shipped: record.shipped,
    shippedAt: record.shippedAt,
    delivered: record.delivered,
    deliveredAt: record.deliveredAt,
    amountCents: record.amountCents,
    currency: record.currency,
    priceLabel: MEMBER_BADGE_APPLICATION_PRICE_LABEL,
    deliveryLabel: MEMBER_BADGE_APPLICATION_DELIVERY_LABEL,
    shippingAddress: record.shippingAddress,
    paidAt: record.paidAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lookupReference: `badgeApplicationId=${record.applicationId}`,
    lookupUrl: input.lookupUrl,
  };
}

/** Format a private address for the authenticated owner widget only. */
export function formatMemberBadgeApplicationAddressLines(
  address: MemberBadgeApplicationShippingAddress,
): string[] {
  const lines = [address.addressLine1];
  if (address.addressLine2?.trim()) {
    lines.push(address.addressLine2.trim());
  }
  lines.push(`${address.city}, ${address.provinceStateRegion} ${address.postalCode}`);
  lines.push(address.country);
  return lines;
}
