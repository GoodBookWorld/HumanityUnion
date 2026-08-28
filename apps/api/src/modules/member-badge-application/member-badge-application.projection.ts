import type {
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
