/**
 * Pack 25B/25C — Member Badge Application aggregate.
 * Stripe Checkout attaches to this record (Pack 25C); Admin fulfillment is Pack 25D.
 */

/** Canonical badge application contribution amount (CAD cents). */
export const MEMBER_BADGE_APPLICATION_AMOUNT_CENTS = 2800 as const;

export const MEMBER_BADGE_APPLICATION_CURRENCY = "cad" as const;

/** Display label for UI — keep in sync with amount cents. */
export const MEMBER_BADGE_APPLICATION_PRICE_LABEL = "CA$28" as const;

export const MEMBER_BADGE_APPLICATION_DELIVERY_LABEL = "Delivery included" as const;

export type MemberBadgeApplicationStatus = "draft" | "submitted" | "cancelled";

export type MemberBadgeApplicationPaymentStatus = "unpaid" | "paid" | "refunded";

export type MemberBadgeApplicationFulfillmentStatus =
  | "not_ready"
  | "awaiting_fulfillment"
  | "preparing"
  | "shipped"
  | "completed";

/** Private fulfillment shipping address — never public. */
export interface MemberBadgeApplicationShippingAddress {
  recipientName: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  provinceStateRegion: string;
  postalCode: string;
  country: string;
  phone: string | null;
}

/** Private Mongo-backed Member Badge Application / Order record. */
export interface MemberBadgeApplicationRecord {
  applicationId: string;
  userId: string;
  participantId: string;
  membershipId: string;
  memberNumberSnapshot: string;
  shippingAddress: MemberBadgeApplicationShippingAddress;
  applicationStatus: MemberBadgeApplicationStatus;
  paymentStatus: MemberBadgeApplicationPaymentStatus;
  fulfillmentStatus: MemberBadgeApplicationFulfillmentStatus;
  amountCents: number;
  currency: string;
  deliveryIncluded: true;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  lastStripeEventId: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Owner-authenticated detail (includes private shipping address). */
export interface MemberBadgeApplicationDetail {
  applicationId: string;
  applicationStatus: MemberBadgeApplicationStatus;
  paymentStatus: MemberBadgeApplicationPaymentStatus;
  fulfillmentStatus: MemberBadgeApplicationFulfillmentStatus;
  amountCents: number;
  currency: string;
  priceLabel: string;
  deliveryLabel: string;
  deliveryIncluded: true;
  shippingAddress: MemberBadgeApplicationShippingAddress;
  memberNumberSnapshot: string;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  /** Present when Badge Stripe Checkout is not configured. */
  paymentSetupMessage: string | null;
}

export interface MemberBadgeApplicationAvailability {
  eligible: boolean;
  reason: string | null;
  priceLabel: string;
  deliveryLabel: string;
  amountCents: number;
  currency: string;
  /** True when Continue to Payment can create a Checkout Session. */
  paymentConfigured: boolean;
}

/**
 * Continue-to-Payment response.
 * When `checkoutReady` is true, the client must redirect to `checkoutUrl`.
 */
export interface MemberBadgeApplicationPaymentBoundary {
  application: MemberBadgeApplicationDetail;
  checkoutReady: boolean;
  checkoutUrl: string | null;
  sessionId: string | null;
  message: string;
}
