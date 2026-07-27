/** Membership Contribution payment lifecycle (TASK-092). */
export type MembershipContributionPaymentStatus =
  "pending" | "checkout_created" | "paid" | "failed" | "refunded" | "disputed" | "technical_error";

/** Stripe webhook event processing status. */
export type MembershipWebhookProcessingStatus = "received" | "processed" | "ignored" | "failed";

/** Mongo-backed Membership Contribution payment record. */
export interface MembershipContributionRecord {
  contributionId: string;
  membershipId: string;
  userId: string;
  amountCents: number;
  currency: string;
  status: MembershipContributionPaymentStatus;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  stripeCustomerId: string | null;
  paidAt: string | null;
  refundedAt: string | null;
  disputedAt: string | null;
  lastStripeEventId: string | null;
  webhookProcessedAt: string | null;
  webhookResult: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Append-only Stripe webhook audit log for Membership. */
export interface MembershipWebhookEventRecord {
  webhookEventRecordId: string;
  stripeEventId: string;
  stripeEventType: string;
  stripeApiVersion: string | null;
  livemode: boolean;
  membershipId: string | null;
  contributionId: string | null;
  userId: string | null;
  processingStatus: MembershipWebhookProcessingStatus;
  processingError: string | null;
  receivedAt: string;
  processedAt: string | null;
}

/** POST /api/v1/membership/checkout response. */
export interface MembershipCheckoutSessionPayload {
  checkoutUrl: string;
  sessionId: string;
}
