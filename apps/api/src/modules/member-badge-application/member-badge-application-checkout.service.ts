import type { MemberBadgeApplicationPaymentBoundary } from "@hu/types";

import { getStripeClient } from "../membership-payment/stripe-client.js";
import {
  MEMBER_BADGE_APPLICATION_PAYMENT_UNAVAILABLE_MESSAGE,
  MEMBER_BADGE_PAYMENT_PURPOSE,
} from "./member-badge-application.constants.js";
import {
  isMemberBadgeApplicationMockCheckoutConfigured,
  isMemberBadgeApplicationPaymentConfigured,
  isMemberBadgeApplicationStripeCheckoutConfigured,
  resolveMemberBadgeApplicationPaymentConfig,
} from "./member-badge-application-payment.config.js";
import { MemberBadgeApplicationUnavailableError } from "./member-badge-application.errors.js";
import { toMemberBadgeApplicationDetail } from "./member-badge-application.projection.js";
import {
  findMemberBadgeApplicationById,
  updateMemberBadgeApplicationCheckoutSession,
} from "./member-badge-application.repository.js";

export async function createMemberBadgeApplicationCheckoutSession(input: {
  userId: string;
  applicationId: string;
}): Promise<MemberBadgeApplicationPaymentBoundary> {
  const config = resolveMemberBadgeApplicationPaymentConfig();

  if (!isMemberBadgeApplicationPaymentConfigured(config)) {
    throw new MemberBadgeApplicationUnavailableError(
      MEMBER_BADGE_APPLICATION_PAYMENT_UNAVAILABLE_MESSAGE,
    );
  }

  const application = await findMemberBadgeApplicationById(input.applicationId);

  if (!application || application.userId !== input.userId) {
    throw new MemberBadgeApplicationUnavailableError("Member Badge Application not found.");
  }

  if (application.paymentStatus !== "unpaid") {
    throw new MemberBadgeApplicationUnavailableError(
      "This Member Badge Application is no longer payable.",
    );
  }

  if (application.applicationStatus === "cancelled") {
    throw new MemberBadgeApplicationUnavailableError(
      "This Member Badge Application was cancelled.",
    );
  }

  if (config.provider === "mock") {
    if (!isMemberBadgeApplicationMockCheckoutConfigured(config)) {
      throw new MemberBadgeApplicationUnavailableError(
        MEMBER_BADGE_APPLICATION_PAYMENT_UNAVAILABLE_MESSAGE,
      );
    }

    const sessionId = `mock_badge_app_cs_${application.applicationId}`;
    const checkoutUrl = `${config.webOrigin}/membership?badgePayment=success&session_id=${encodeURIComponent(sessionId)}`;

    const updated = await updateMemberBadgeApplicationCheckoutSession({
      applicationId: application.applicationId,
      userId: input.userId,
      stripeCheckoutSessionId: sessionId,
    });

    const detail = toMemberBadgeApplicationDetail(updated ?? application);

    return {
      application: detail,
      checkoutReady: true,
      checkoutUrl,
      sessionId,
      message: "Redirecting to payment.",
    };
  }

  if (!isMemberBadgeApplicationStripeCheckoutConfigured(config)) {
    throw new MemberBadgeApplicationUnavailableError(
      MEMBER_BADGE_APPLICATION_PAYMENT_UNAVAILABLE_MESSAGE,
    );
  }

  const stripe = getStripeClient();
  const successUrl = `${config.webOrigin}/membership?badgePayment=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${config.webOrigin}/membership?badgePayment=cancelled`;

  const checkoutMetadata = {
    paymentPurpose: MEMBER_BADGE_PAYMENT_PURPOSE,
    applicationId: application.applicationId,
    internalUserId: input.userId,
    platformVersion: config.platformVersion,
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
    throw new MemberBadgeApplicationUnavailableError(
      "Unable to create Member Badge Checkout Session.",
    );
  }

  const updated = await updateMemberBadgeApplicationCheckoutSession({
    applicationId: application.applicationId,
    userId: input.userId,
    stripeCheckoutSessionId: session.id,
  });

  return {
    application: toMemberBadgeApplicationDetail(updated ?? application),
    checkoutReady: true,
    checkoutUrl: session.url,
    sessionId: session.id,
    message: "Redirecting to Stripe Checkout.",
  };
}
