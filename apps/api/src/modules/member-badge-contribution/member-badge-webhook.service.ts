import { findAuthUserById } from "../auth/auth-user.repository.js";
import { sendTransactionalEmail } from "../email/email.service.js";
import { findMembershipByUserId } from "../membership/membership.repository.js";
import {
  buildMembershipWebhookEventRecord,
  findMembershipWebhookEventByStripeEventId,
  insertMembershipWebhookEvent,
  markMembershipWebhookEventProcessed,
} from "../membership-payment/membership-webhook-event.repository.js";
import { createNotification } from "../notifications/notification.service.js";
import {
  MEMBER_BADGE_CONTRIBUTION_AMOUNT_CENTS,
  MEMBER_BADGE_CONTRIBUTION_CURRENCY,
  MEMBER_BADGE_PAYMENT_PURPOSE,
} from "./member-badge-contribution.constants.js";
import { resolveMemberBadgeContributionConfig } from "./member-badge-contribution.config.js";
import { MemberBadgeContributionValidationError } from "./member-badge-contribution.errors.js";
import {
  findMemberBadgeContributionByCheckoutSessionId,
  findMemberBadgeContributionById,
  findMemberBadgeContributionByPaymentIntentId,
  parseStripeShippingAddress,
  updateMemberBadgeContribution,
} from "./member-badge-contribution.repository.js";

function formatCad(cents: number): string {
  return `${(cents / 100).toFixed(2)} CAD`;
}

function extractMetadata(object: Record<string, unknown>): Record<string, string> {
  return (object.metadata as Record<string, string> | undefined) ?? {};
}

async function sendBadgeConfirmationEmailIfNeeded(input: {
  badgeContributionId: string;
  userId: string;
  badgeRequestNumber: string;
  amountCents: number;
  shippingAmountCents: number;
  totalProcessedAmountCents: number;
  fulfillmentStatus: string;
}): Promise<void> {
  const record = await findMemberBadgeContributionById(input.badgeContributionId);
  if (!record || record.confirmationEmailSentAt) {
    return;
  }

  const user = await findAuthUserById(input.userId);
  if (!user?.email) {
    return;
  }

  const config = resolveMemberBadgeContributionConfig();
  const requestDetailsUrl = `${config.webOrigin}/membership/member-badge/requests/${encodeURIComponent(input.badgeContributionId)}`;

  await sendTransactionalEmail({
    to: user.email,
    template: "member_badge_contribution_confirmed",
    templateInput: {
      badgeRequestNumber: input.badgeRequestNumber,
      contributionAmount: formatCad(input.amountCents),
      shippingAmount: formatCad(input.shippingAmountCents),
      totalProcessedAmount: formatCad(input.totalProcessedAmountCents),
      fulfillmentStatus: input.fulfillmentStatus,
      requestDetailsUrl,
    },
  });

  await updateMemberBadgeContribution(input.badgeContributionId, {
    confirmationEmailSentAt: new Date().toISOString(),
  });
}

async function emitBadgeConfirmedNotification(input: {
  userId: string;
  profileId: string;
  badgeContributionId: string;
  badgeRequestNumber: string;
}): Promise<void> {
  await createNotification({
    recipientUserId: input.userId,
    recipientProfileId: input.profileId,
    eventType: "member_badge_contribution_confirmed",
    title: "Official Member item request confirmed",
    message: `Your official Humanity Union Member item request ${input.badgeRequestNumber} has been confirmed.`,
    relatedEntityType: "member_badge_contribution",
    relatedEntityId: input.badgeContributionId,
    relatedUrl: `/membership/member-badge/requests/${input.badgeContributionId}`,
    priority: "important",
  });
}

async function confirmMemberBadgeContributionFromCheckout(input: {
  sessionObject: Record<string, unknown>;
  stripeEventId: string;
}): Promise<{ badgeContributionId: string; userId: string }> {
  const metadata = extractMetadata(input.sessionObject);
  const paymentPurpose = metadata.paymentPurpose;

  if (paymentPurpose !== MEMBER_BADGE_PAYMENT_PURPOSE) {
    throw new MemberBadgeContributionValidationError(
      "Invalid payment purpose for Badge contribution.",
    );
  }

  const badgeContributionId = metadata.badgeContributionId;
  const userId = metadata.internalUserId;

  if (!badgeContributionId || !userId) {
    throw new MemberBadgeContributionValidationError("Badge webhook metadata is incomplete.");
  }

  const existing = await findMemberBadgeContributionById(badgeContributionId);
  if (!existing) {
    throw new MemberBadgeContributionValidationError("Badge contribution record not found.");
  }

  if (existing.contributionStatus === "contribution_confirmed") {
    return { badgeContributionId, userId };
  }

  const config = resolveMemberBadgeContributionConfig();
  const amountTotal =
    typeof input.sessionObject.amount_total === "number" ? input.sessionObject.amount_total : null;
  const shippingCost = input.sessionObject.shipping_cost as
    { amount_total?: number; shipping_rate?: string } | null | undefined;
  const shippingAmountCents = shippingCost?.amount_total ?? 0;
  const contributionAmountCents = config.amountCents;

  if (amountTotal !== null && amountTotal < contributionAmountCents + shippingAmountCents) {
    throw new MemberBadgeContributionValidationError(
      "Processed amount is below expected contribution.",
    );
  }

  const shippingDetails = input.sessionObject.shipping_details as
    | {
        name?: string | null;
        address?: {
          line1?: string | null;
          line2?: string | null;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          country?: string | null;
        } | null;
      }
    | null
    | undefined;

  const shippingAddress = parseStripeShippingAddress({
    name: shippingDetails?.name,
    address: shippingDetails?.address,
  });

  const paymentIntentId =
    typeof input.sessionObject.payment_intent === "string"
      ? input.sessionObject.payment_intent
      : null;
  const customerId =
    typeof input.sessionObject.customer === "string" ? input.sessionObject.customer : null;

  const paidAt = new Date(
    typeof input.sessionObject.created === "number"
      ? input.sessionObject.created * 1000
      : Date.now(),
  ).toISOString();

  const totalProcessedAmountCents = amountTotal ?? contributionAmountCents + shippingAmountCents;

  const updated = await updateMemberBadgeContribution(badgeContributionId, {
    contributionStatus: "contribution_confirmed",
    paymentStatus: "paid",
    fulfillmentStatus: "pending",
    recipientName: shippingAddress?.recipientName ?? shippingDetails?.name ?? null,
    shippingAddress,
    shippingMethod: shippingCost?.shipping_rate ?? null,
    shippingAmountCents,
    totalProcessedAmountCents,
    stripePaymentIntentId: paymentIntentId,
    stripeCustomerId: customerId,
    stripeShippingRateId: shippingCost?.shipping_rate ?? null,
    paidAt,
    confirmedAt: paidAt,
    lastWebhookEventId: input.stripeEventId,
  });

  if (!updated) {
    throw new MemberBadgeContributionValidationError("Unable to update Badge contribution record.");
  }

  const membership = await findMembershipByUserId(userId);
  if (!membership || membership.status !== "active_member") {
    throw new MemberBadgeContributionValidationError(
      "Badge contribution requires an active Membership.",
    );
  }

  await sendBadgeConfirmationEmailIfNeeded({
    badgeContributionId,
    userId,
    badgeRequestNumber: updated.badgeRequestNumber,
    amountCents: updated.amountCents,
    shippingAmountCents: shippingAmountCents,
    totalProcessedAmountCents,
    fulfillmentStatus: updated.fulfillmentStatus,
  });

  await emitBadgeConfirmedNotification({
    userId,
    profileId: updated.profileId,
    badgeContributionId,
    badgeRequestNumber: updated.badgeRequestNumber,
  });

  return { badgeContributionId, userId };
}

export async function processMemberBadgeStripeEvent(event: {
  id: string;
  type: string;
  api_version: string | null;
  livemode: boolean;
  data: {
    object: Record<string, unknown>;
  };
}): Promise<{ processed: boolean; ignored: boolean }> {
  const existing = await findMembershipWebhookEventByStripeEventId(event.id);

  if (existing?.processingStatus === "processed") {
    return { processed: true, ignored: true };
  }

  if (!existing) {
    await insertMembershipWebhookEvent(
      buildMembershipWebhookEventRecord({
        stripeEventId: event.id,
        stripeEventType: event.type,
        stripeApiVersion: event.api_version,
        livemode: event.livemode,
        processingStatus: "received",
      }),
    );
  }

  const supportedEvents = new Set([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "payment_intent.succeeded",
    "payment_intent.payment_failed",
    "charge.refunded",
    "charge.dispute.created",
  ]);

  if (!supportedEvents.has(event.type)) {
    await markMembershipWebhookEventProcessed(event.id, {
      processingStatus: "ignored",
    });
    return { processed: false, ignored: true };
  }

  try {
    const object = event.data.object;

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const metadata = extractMetadata(object);
      if (metadata.paymentPurpose !== MEMBER_BADGE_PAYMENT_PURPOSE) {
        await markMembershipWebhookEventProcessed(event.id, { processingStatus: "ignored" });
        return { processed: false, ignored: true };
      }

      const result = await confirmMemberBadgeContributionFromCheckout({
        sessionObject: object,
        stripeEventId: event.id,
      });

      await markMembershipWebhookEventProcessed(event.id, {
        processingStatus: "processed",
        userId: result.userId,
        contributionId: result.badgeContributionId,
      });

      return { processed: true, ignored: false };
    }

    if (event.type === "checkout.session.async_payment_failed") {
      const sessionId = String(object.id ?? "");
      const record = await findMemberBadgeContributionByCheckoutSessionId(sessionId);

      if (record) {
        await updateMemberBadgeContribution(record.badgeContributionId, {
          contributionStatus: "payment_failed",
          paymentStatus: "failed",
          lastWebhookEventId: event.id,
        });
      }

      await markMembershipWebhookEventProcessed(event.id, {
        processingStatus: "processed",
        contributionId: record?.badgeContributionId ?? null,
        userId: record?.userId ?? null,
      });

      return { processed: true, ignored: false };
    }

    if (event.type === "payment_intent.payment_failed") {
      const paymentIntentId = String(object.id ?? "");
      const record = await findMemberBadgeContributionByPaymentIntentId(paymentIntentId);

      if (record) {
        await updateMemberBadgeContribution(record.badgeContributionId, {
          contributionStatus: "payment_failed",
          paymentStatus: "failed",
          stripePaymentIntentId: paymentIntentId,
          lastWebhookEventId: event.id,
        });
      }

      await markMembershipWebhookEventProcessed(event.id, {
        processingStatus: "processed",
        contributionId: record?.badgeContributionId ?? null,
        userId: record?.userId ?? null,
      });

      return { processed: true, ignored: false };
    }

    if (event.type === "charge.refunded") {
      const paymentIntentId =
        typeof object.payment_intent === "string" ? object.payment_intent : null;
      const record = paymentIntentId
        ? await findMemberBadgeContributionByPaymentIntentId(paymentIntentId)
        : null;

      if (record) {
        await updateMemberBadgeContribution(record.badgeContributionId, {
          contributionStatus: "refunded",
          paymentStatus: "refunded",
          refundedAt: new Date().toISOString(),
          lastWebhookEventId: event.id,
        });

        await createNotification({
          recipientUserId: record.userId,
          recipientProfileId: record.profileId,
          eventType: "member_badge_contribution_refunded",
          title: "Additional Member contribution refunded",
          message: `Your additional Member item contribution for ${record.badgeRequestNumber} was refunded.`,
          relatedEntityType: "member_badge_contribution",
          relatedEntityId: record.badgeContributionId,
          relatedUrl: `/membership/member-badge/requests/${record.badgeContributionId}`,
          priority: "important",
        });
      }

      await markMembershipWebhookEventProcessed(event.id, {
        processingStatus: "processed",
        contributionId: record?.badgeContributionId ?? null,
        userId: record?.userId ?? null,
      });

      return { processed: true, ignored: false };
    }

    if (event.type === "charge.dispute.created") {
      const paymentIntentId =
        typeof object.payment_intent === "string" ? object.payment_intent : null;
      const record = paymentIntentId
        ? await findMemberBadgeContributionByPaymentIntentId(paymentIntentId)
        : null;

      if (record) {
        await updateMemberBadgeContribution(record.badgeContributionId, {
          contributionStatus: "disputed",
          paymentStatus: "disputed",
          lastWebhookEventId: event.id,
        });
      }

      await markMembershipWebhookEventProcessed(event.id, {
        processingStatus: "processed",
        contributionId: record?.badgeContributionId ?? null,
        userId: record?.userId ?? null,
      });

      return { processed: true, ignored: false };
    }

    if (event.type === "payment_intent.succeeded") {
      const metadata = extractMetadata(object);
      if (metadata.paymentPurpose !== MEMBER_BADGE_PAYMENT_PURPOSE) {
        await markMembershipWebhookEventProcessed(event.id, { processingStatus: "ignored" });
        return { processed: false, ignored: true };
      }

      await markMembershipWebhookEventProcessed(event.id, { processingStatus: "processed" });
      return { processed: true, ignored: false };
    }

    await markMembershipWebhookEventProcessed(event.id, { processingStatus: "ignored" });
    return { processed: false, ignored: true };
  } catch (error) {
    await markMembershipWebhookEventProcessed(event.id, {
      processingStatus: "failed",
      processingError: error instanceof Error ? error.message : "webhook_processing_failed",
    });
    throw error;
  }
}

/** Test helper: simulate mock Badge checkout completion without HTTP. */
export async function simulateMockMemberBadgeCheckoutCompleted(input: {
  sessionId: string;
  userId: string;
  badgeContributionId: string;
  membershipId: string;
  shippingAmountCents?: number;
}): Promise<void> {
  const shippingAmountCents = input.shippingAmountCents ?? 500;
  const config = resolveMemberBadgeContributionConfig();

  await processMemberBadgeStripeEvent({
    id: `mock_badge_evt_${input.sessionId}`,
    type: "checkout.session.completed",
    api_version: null,
    livemode: false,
    data: {
      object: {
        id: input.sessionId,
        created: Math.floor(Date.now() / 1000),
        payment_intent: `mock_badge_pi_${input.badgeContributionId}`,
        amount_total: config.amountCents + shippingAmountCents,
        shipping_cost: {
          amount_total: shippingAmountCents,
          shipping_rate: "mock_shipping_rate_ca",
        },
        shipping_details: {
          name: "Badge Recipient",
          address: {
            line1: "123 Civic Avenue",
            city: "Toronto",
            state: "ON",
            postal_code: "M5V 2T6",
            country: "CA",
          },
        },
        metadata: {
          paymentPurpose: MEMBER_BADGE_PAYMENT_PURPOSE,
          badgeContributionId: input.badgeContributionId,
          membershipId: input.membershipId,
          internalUserId: input.userId,
          platformVersion: config.platformVersion,
        },
      },
    },
  });
}

export function validateMemberBadgeContributionAmount(amountCents: number, currency: string): void {
  if (currency.toLowerCase() !== MEMBER_BADGE_CONTRIBUTION_CURRENCY) {
    throw new MemberBadgeContributionValidationError("Unexpected Badge contribution currency.");
  }

  if (amountCents !== MEMBER_BADGE_CONTRIBUTION_AMOUNT_CENTS) {
    throw new MemberBadgeContributionValidationError("Unexpected Badge contribution amount.");
  }
}
