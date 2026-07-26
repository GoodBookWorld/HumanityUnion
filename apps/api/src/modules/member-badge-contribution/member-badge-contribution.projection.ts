import type {
  MemberBadgeContributionDetail,
  MemberBadgeContributionRecord,
  MemberBadgeContributionSummary,
} from "@hu/types";

function formatShippingSummary(record: MemberBadgeContributionRecord): string | null {
  const address = record.shippingAddress;
  if (!address) {
    return null;
  }

  const parts = [
    address.addressLine1,
    address.addressLine2,
    address.city,
    address.administrativeArea,
    address.postalCode,
    address.countryCode,
  ].filter(Boolean);

  return parts.join(", ");
}

export function toMemberBadgeContributionSummary(
  record: MemberBadgeContributionRecord,
): MemberBadgeContributionSummary {
  return {
    badgeContributionId: record.badgeContributionId,
    badgeRequestNumber: record.badgeRequestNumber,
    contributionStatus: record.contributionStatus,
    fulfillmentStatus: record.fulfillmentStatus,
    amountCents: record.amountCents,
    shippingAmountCents: record.shippingAmountCents,
    totalProcessedAmountCents: record.totalProcessedAmountCents,
    currency: record.currency,
    createdAt: record.createdAt,
    confirmedAt: record.confirmedAt,
  };
}

export function toMemberBadgeContributionDetail(
  record: MemberBadgeContributionRecord,
): MemberBadgeContributionDetail {
  return {
    ...toMemberBadgeContributionSummary(record),
    shippingMethod: record.shippingMethod,
    shippingAddressSummary: formatShippingSummary(record),
    trackingCarrier: record.trackingCarrier,
    trackingNumber: record.trackingNumber,
    paidAt: record.paidAt,
    shippedAt: record.shippedAt,
    deliveredAt: record.deliveredAt,
  };
}
