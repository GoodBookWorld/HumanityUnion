import type { MemberBadgeContributionStatus, MemberBadgeFulfillmentStatus } from "@hu/types";

export function formatMemberBadgeAmount(cents: number, currency: string): string {
  const normalized = currency.toUpperCase();
  return `${(cents / 100).toFixed(normalized === "CAD" ? 0 : 2)} ${normalized}`;
}

export function formatMemberBadgeContributionStatus(status: MemberBadgeContributionStatus): string {
  switch (status) {
    case "not_started":
      return "Not started";
    case "checkout_created":
      return "Checkout created";
    case "payment_pending":
      return "Payment pending";
    case "contribution_confirmed":
      return "Contribution confirmed";
    case "payment_failed":
      return "Payment failed";
    case "cancelled":
      return "Cancelled";
    case "refunded":
      return "Refunded";
    case "disputed":
      return "Disputed";
    case "technical_error":
      return "Technical error";
    default:
      return status;
  }
}

export function formatMemberBadgeFulfillmentStatus(status: MemberBadgeFulfillmentStatus): string {
  switch (status) {
    case "not_ready":
      return "Not ready";
    case "pending":
      return "Pending";
    case "preparing":
      return "Preparing";
    case "shipped":
      return "Shipped";
    case "delivered":
      return "Delivered";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function isMemberBadgeContributionConfirmed(status: MemberBadgeContributionStatus): boolean {
  return status === "contribution_confirmed";
}

export function isMemberBadgeContributionProcessing(
  status: MemberBadgeContributionStatus,
): boolean {
  return status === "checkout_created" || status === "payment_pending" || status === "not_started";
}
