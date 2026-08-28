import type { MembershipCheckoutSessionPayload } from "@hu/types";
import type Stripe from "stripe";

import { findAuthUserById } from "../auth/auth-user.repository.js";
import { activateMembershipMemberNumber } from "../membership/membership.service.js";
import {
  findMembershipByUserId,
  updateMembershipRecord,
} from "../membership/membership.repository.js";
import {
  buildDefaultMembershipContribution,
  findLatestMembershipContributionByMembershipId,
  findMembershipContributionByCheckoutSessionId,
  findMembershipContributionByPaymentIntentId,
  insertMembershipContribution,
  updateMembershipContribution,
} from "./membership-contribution.repository.js";
import {
  buildMembershipWebhookEventRecord,
  findMembershipWebhookEventByStripeEventId,
  insertMembershipWebhookEvent,
  markMembershipWebhookEventProcessed,
} from "./membership-webhook-event.repository.js";
import {
  MembershipPaymentAccessDeniedError,
  MembershipPaymentConflictError,
  MembershipPaymentNotFoundError,
  MembershipPaymentUnavailableError,
  MembershipPaymentValidationError,
  MembershipWebhookSignatureError,
} from "./membership-payment.errors.js";
import {
  isStripeMembershipPaymentConfigured,
  resolveMembershipPaymentConfig,
} from "./membership-payment.config.js";
import { getStripeClient } from "./stripe-client.js";
import { MEMBERSHIP_CHECKOUT_METADATA_PLATFORM } from "./membership-payment.constants.js";
import { MEMBERSHIP_PAYMENT_PURPOSE } from "../member-badge-contribution/member-badge-contribution.constants.js";
import { assertMembershipCheckoutAmountAndCurrency } from "./membership-payment.verification.js";
import { dispatchStripeMembershipWebhookEvent } from "./stripe-webhook-dispatcher.js";

function assertCheckoutEligible(
  membership: NonNullable<Awaited<ReturnType<typeof findMembershipByUserId>>>,
): void {
  if (membership.status === "active_member") {
    throw new MembershipPaymentConflictError("Membership already active.");
  }

  if (membership.applicationStatus !== "submitted" && membership.applicationStatus !== "approved") {
    throw new MembershipPaymentValidationError(
      "Membership application must be submitted before contribution.",
    );
  }
}

export async function createMembershipCheckoutSession(input: {
  userId: string;
}): Promise<MembershipCheckoutSessionPayload> {
  const user = await findAuthUserById(input.userId);

  if (!user) {
    throw new MembershipPaymentAccessDeniedError("Authentication session is invalid.");
  }

  if (user.emailVerificationStatus !== "verified") {
    throw new MembershipPaymentAccessDeniedError("Email must be confirmed before contribution.");
  }

  const membership = await findMembershipByUserId(input.userId);

  if (!membership) {
    throw new MembershipPaymentNotFoundError("Membership record not found.");
  }

  assertCheckoutEligible(membership);

  const config = resolveMembershipPaymentConfig();
  const contribution =
    (await findLatestMembershipContributionByMembershipId(membership.membershipId)) ??
    (await insertMembershipContribution(
      buildDefaultMembershipContribution({
        membershipId: membership.membershipId,
        userId: input.userId,
      }),
    ));

  if (config.provider === "mock") {
    const sessionId = `mock_cs_${contribution.contributionId}`;
    const checkoutUrl = `${config.webOrigin}/membership?checkout=mock&session_id=${encodeURIComponent(sessionId)}`;

    await updateMembershipContribution(contribution.contributionId, {
      status: "checkout_created",
      stripeCheckoutSessionId: sessionId,
    });
    await updateMembershipRecord(membership.membershipId, {
      status: "pending_payment",
    });

    return { checkoutUrl, sessionId };
  }

  if (!isStripeMembershipPaymentConfigured(config)) {
    throw new MembershipPaymentUnavailableError("Membership payment is not configured.");
  }

  const stripe = getStripeClient();
  const successUrl = `${config.webOrigin}/membership/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${config.webOrigin}/membership?contribution=cancelled`;

  const checkoutMetadata = {
    paymentPurpose: MEMBERSHIP_PAYMENT_PURPOSE,
    membershipId: membership.membershipId,
    internalUserId: input.userId,
    applicationId: membership.membershipId,
    platformVersion: config.platformVersion,
    purpose: MEMBERSHIP_CHECKOUT_METADATA_PLATFORM,
  };

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: [{ price: config.priceId!, quantity: 1 }],
    metadata: checkoutMetadata,
    payment_intent_data: {
      metadata: checkoutMetadata,
    },
  });

  if (!session.url || !session.id) {
    throw new MembershipPaymentUnavailableError("Unable to create Membership Checkout Session.");
  }

  await updateMembershipContribution(contribution.contributionId, {
    status: "checkout_created",
    stripeCheckoutSessionId: session.id,
  });
  await updateMembershipRecord(membership.membershipId, {
    status: "pending_payment",
  });

  return {
    checkoutUrl: session.url,
    sessionId: session.id,
  };
}

async function activateMembershipFromContribution(input: {
  userId: string;
  contributionId: string;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  paidAt: string;
  stripeEventId: string;
}): Promise<void> {
  const membership = await findMembershipByUserId(input.userId);

  if (!membership) {
    throw new MembershipPaymentNotFoundError("Membership record not found.");
  }

  if (membership.status === "active_member" && membership.memberNumber) {
    await updateMembershipContribution(input.contributionId, {
      status: "paid",
      stripePaymentIntentId: input.stripePaymentIntentId,
      stripeChargeId: input.stripeChargeId,
      paidAt: input.paidAt,
      lastStripeEventId: input.stripeEventId,
      webhookProcessedAt: new Date().toISOString(),
      webhookResult: "already_active",
    });
    return;
  }

  try {
    await activateMembershipMemberNumber({ userId: input.userId });

    await updateMembershipContribution(input.contributionId, {
      status: "paid",
      stripePaymentIntentId: input.stripePaymentIntentId,
      stripeChargeId: input.stripeChargeId,
      paidAt: input.paidAt,
      lastStripeEventId: input.stripeEventId,
      webhookProcessedAt: new Date().toISOString(),
      webhookResult: "activated",
    });
  } catch (error) {
    await updateMembershipRecord(membership.membershipId, {
      status: "technical_error",
    });
    await updateMembershipContribution(input.contributionId, {
      status: "technical_error",
      lastStripeEventId: input.stripeEventId,
      webhookProcessedAt: new Date().toISOString(),
      webhookResult: error instanceof Error ? error.message : "activation_failed",
    });
    throw error;
  }
}

export async function processMembershipStripeEvent(event: {
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
    if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
      const object = event.data.object;
      const metadata = (object.metadata as Record<string, string> | undefined) ?? {};

      if (metadata.paymentPurpose === "member_badge_contribution") {
        await markMembershipWebhookEventProcessed(event.id, { processingStatus: "ignored" });
        return { processed: false, ignored: true };
      }

      if (
        metadata.paymentPurpose !== undefined &&
        metadata.paymentPurpose !== MEMBERSHIP_PAYMENT_PURPOSE
      ) {
        throw new MembershipPaymentValidationError(
          "Membership webhook received unexpected paymentPurpose.",
        );
      }

      // Pack 26A — amount/currency integrity (do not trust Price ID alone).
      assertMembershipCheckoutAmountAndCurrency(object);

      const paymentStatus = object.payment_status;
      if (paymentStatus !== undefined && paymentStatus !== "paid") {
        throw new MembershipPaymentValidationError("Checkout Session is not paid.");
      }

      const userId = metadata.internalUserId;
      const membershipId = metadata.membershipId;

      let contribution =
        event.type === "checkout.session.completed"
          ? await findMembershipContributionByCheckoutSessionId(String(object.id ?? ""))
          : await findMembershipContributionByPaymentIntentId(String(object.id ?? ""));

      if (!contribution && membershipId) {
        contribution = await findLatestMembershipContributionByMembershipId(membershipId);
      }

      if (!contribution || !userId) {
        throw new MembershipPaymentValidationError("Webhook metadata is incomplete.");
      }

      const paidAt = new Date(
        typeof object.created === "number" ? object.created * 1000 : Date.now(),
      ).toISOString();

      await activateMembershipFromContribution({
        userId,
        contributionId: contribution.contributionId,
        stripePaymentIntentId:
          typeof object.payment_intent === "string"
            ? object.payment_intent
            : typeof object.id === "string" && event.type === "payment_intent.succeeded"
              ? object.id
              : null,
        stripeChargeId: typeof object.latest_charge === "string" ? object.latest_charge : null,
        paidAt,
        stripeEventId: event.id,
      });

      await markMembershipWebhookEventProcessed(event.id, {
        processingStatus: "processed",
        membershipId: contribution.membershipId,
        contributionId: contribution.contributionId,
        userId,
      });

      return { processed: true, ignored: false };
    }

    if (event.type === "payment_intent.payment_failed") {
      const object = event.data.object;
      const paymentIntentId = String(object.id ?? "");
      const metadata = (object.metadata as Record<string, string> | undefined) ?? {};
      const membershipId = metadata.membershipId;
      const contribution = membershipId
        ? await findLatestMembershipContributionByMembershipId(membershipId)
        : null;

      if (contribution) {
        await updateMembershipContribution(contribution.contributionId, {
          status: "failed",
          stripePaymentIntentId: paymentIntentId,
          lastStripeEventId: event.id,
          webhookProcessedAt: new Date().toISOString(),
          webhookResult: "payment_failed",
        });
      }

      await markMembershipWebhookEventProcessed(event.id, {
        processingStatus: "processed",
        membershipId: contribution?.membershipId ?? null,
        contributionId: contribution?.contributionId ?? null,
        userId: contribution?.userId ?? null,
      });

      return { processed: true, ignored: false };
    }

    if (event.type === "charge.refunded") {
      const object = event.data.object;
      const paymentIntentId =
        typeof object.payment_intent === "string" ? object.payment_intent : null;
      const membershipId = String(
        (object.metadata as Record<string, string> | undefined)?.membershipId ?? "",
      );

      let contribution = paymentIntentId
        ? await findMembershipContributionByPaymentIntentId(paymentIntentId)
        : null;

      if (!contribution && membershipId) {
        contribution = await findLatestMembershipContributionByMembershipId(membershipId);
      }

      if (contribution) {
        await updateMembershipContribution(contribution.contributionId, {
          status: "refunded",
          refundedAt: new Date().toISOString(),
          lastStripeEventId: event.id,
          webhookProcessedAt: new Date().toISOString(),
          webhookResult: "refunded",
        });
      }

      await markMembershipWebhookEventProcessed(event.id, {
        processingStatus: "processed",
        contributionId: contribution?.contributionId ?? null,
        membershipId: contribution?.membershipId ?? null,
        userId: contribution?.userId ?? null,
      });

      return { processed: true, ignored: false };
    }

    if (event.type === "charge.dispute.created") {
      const object = event.data.object;
      const paymentIntentId =
        typeof object.payment_intent === "string" ? object.payment_intent : null;
      const membershipId = String(
        (object.metadata as Record<string, string> | undefined)?.membershipId ?? "",
      );

      let contribution = paymentIntentId
        ? await findMembershipContributionByPaymentIntentId(paymentIntentId)
        : null;

      if (!contribution && membershipId) {
        contribution = await findLatestMembershipContributionByMembershipId(membershipId);
      }

      if (contribution) {
        await updateMembershipContribution(contribution.contributionId, {
          status: "disputed",
          disputedAt: new Date().toISOString(),
          stripePaymentIntentId: paymentIntentId,
          lastStripeEventId: event.id,
          webhookProcessedAt: new Date().toISOString(),
          webhookResult: "disputed",
        });
      }

      await markMembershipWebhookEventProcessed(event.id, {
        processingStatus: "processed",
        contributionId: contribution?.contributionId ?? null,
        membershipId: contribution?.membershipId ?? null,
        userId: contribution?.userId ?? null,
      });

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

export async function verifyAndProcessMembershipStripeWebhook(input: {
  rawBody: Buffer;
  signatureHeader: string | undefined;
}): Promise<{ processed: boolean; ignored: boolean }> {
  const config = resolveMembershipPaymentConfig();

  if (config.provider === "mock") {
    if (!config.webhookSecret) {
      throw new MembershipWebhookSignatureError("Webhook secret is not configured.");
    }

    if (input.signatureHeader !== config.webhookSecret) {
      throw new MembershipWebhookSignatureError("Invalid webhook signature.");
    }

    const event = JSON.parse(input.rawBody.toString("utf8")) as {
      id: string;
      type: string;
      api_version: string | null;
      livemode: boolean;
      data: { object: Record<string, unknown> };
    };

    return dispatchStripeMembershipWebhookEvent(event);
  }

  if (!config.webhookSecret) {
    throw new MembershipWebhookSignatureError("Webhook secret is not configured.");
  }

  if (!input.signatureHeader) {
    throw new MembershipWebhookSignatureError("Missing Stripe signature header.");
  }

  const stripe = getStripeClient();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      input.rawBody,
      input.signatureHeader,
      config.webhookSecret,
    );
  } catch {
    throw new MembershipWebhookSignatureError("Invalid webhook signature.");
  }

  return dispatchStripeMembershipWebhookEvent({
    id: event.id,
    type: event.type,
    api_version: event.api_version,
    livemode: event.livemode,
    data: { object: event.data.object as unknown as Record<string, unknown> },
  });
}

/** Test helper: simulate mock checkout completion without HTTP. */
export async function simulateMockMembershipCheckoutCompleted(input: {
  sessionId: string;
  userId: string;
  membershipId: string;
  contributionId: string;
}): Promise<void> {
  const eventId = `mock_evt_${input.sessionId}`;

  const config = resolveMembershipPaymentConfig();

  await processMembershipStripeEvent({
    id: eventId,
    type: "checkout.session.completed",
    api_version: null,
    livemode: false,
    data: {
      object: {
        id: input.sessionId,
        created: Math.floor(Date.now() / 1000),
        payment_status: "paid",
        amount_total: config.amountCents,
        currency: config.currency,
        payment_intent: `mock_pi_${input.contributionId}`,
        latest_charge: `mock_ch_${input.contributionId}`,
        metadata: {
          paymentPurpose: MEMBERSHIP_PAYMENT_PURPOSE,
          membershipId: input.membershipId,
          internalUserId: input.userId,
          applicationId: input.membershipId,
          platformVersion: config.platformVersion,
        },
      },
    },
  });
}
