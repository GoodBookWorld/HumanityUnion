/** Member Badge additional Membership Contribution lifecycle (TASK-094). */
export type MemberBadgeContributionStatus =
  | "not_started"
  | "checkout_created"
  | "payment_pending"
  | "contribution_confirmed"
  | "payment_failed"
  | "cancelled"
  | "refunded"
  | "disputed"
  | "technical_error";

export type MemberBadgeFulfillmentStatus =
  "not_ready" | "pending" | "preparing" | "shipped" | "delivered" | "cancelled";

export interface MemberBadgeShippingAddress {
  recipientName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  administrativeArea: string | null;
  postalCode: string;
  countryCode: string;
}

/** Private Mongo-backed Member Badge Contribution record. */
export interface MemberBadgeContributionRecord {
  badgeContributionId: string;
  badgeRequestNumber: string;
  userId: string;
  profileId: string;
  membershipId: string;
  memberNumberSnapshot: string | null;
  contributionPurpose: "member_badge";
  amountCents: number;
  currency: string;
  contributionStatus: MemberBadgeContributionStatus;
  paymentStatus: string;
  fulfillmentStatus: MemberBadgeFulfillmentStatus;
  recipientName: string | null;
  shippingAddress: MemberBadgeShippingAddress | null;
  shippingMethod: string | null;
  shippingAmountCents: number | null;
  totalProcessedAmountCents: number | null;
  trackingCarrier: string | null;
  trackingNumber: string | null;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeCustomerId: string | null;
  stripeShippingRateId: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  confirmedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  refundedAt: string | null;
  lastWebhookEventId: string | null;
  confirmationEmailSentAt: string | null;
  version: number;
}

/** Owner-only Badge Request summary. */
export interface MemberBadgeContributionSummary {
  badgeContributionId: string;
  badgeRequestNumber: string;
  contributionStatus: MemberBadgeContributionStatus;
  fulfillmentStatus: MemberBadgeFulfillmentStatus;
  amountCents: number;
  shippingAmountCents: number | null;
  totalProcessedAmountCents: number | null;
  currency: string;
  createdAt: string;
  confirmedAt: string | null;
}

/** Owner-only Badge Request detail projection. */
export interface MemberBadgeContributionDetail extends MemberBadgeContributionSummary {
  shippingMethod: string | null;
  shippingAddressSummary: string | null;
  trackingCarrier: string | null;
  trackingNumber: string | null;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
}

/** POST checkout response. */
export interface MemberBadgeCheckoutSessionPayload {
  checkoutUrl: string;
  sessionId: string;
}

/** Feature availability for UI. */
export interface MemberBadgeContributionAvailability {
  enabled: boolean;
  eligible: boolean;
  reason: string | null;
  contributionAmountCad: string;
  shippingCountries: string[];
}
