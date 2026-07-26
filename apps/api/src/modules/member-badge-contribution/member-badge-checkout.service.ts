import type { MemberBadgeCheckoutSessionPayload } from "@hu/types";

import { getStripeClient } from "../membership-payment/stripe-client.js";
import { MEMBER_BADGE_PAYMENT_PURPOSE } from "./member-badge-contribution.constants.js";
import {
  isMemberBadgeStripeCheckoutConfigured,
  resolveMemberBadgeContributionConfig,
} from "./member-badge-contribution.config.js";
import { MemberBadgeContributionUnavailableError } from "./member-badge-contribution.errors.js";
import { assertMemberBadgeCheckoutEligible } from "./member-badge-contribution.service.js";
import {
  buildDefaultMemberBadgeContribution,
  insertMemberBadgeContribution,
  updateMemberBadgeContribution,
} from "./member-badge-contribution.repository.js";

export async function createMemberBadgeCheckoutSession(input: {
  userId: string;
}): Promise<MemberBadgeCheckoutSessionPayload> {
  const eligibility = await assertMemberBadgeCheckoutEligible(input.userId);
  const config = resolveMemberBadgeContributionConfig();

  const record = await insertMemberBadgeContribution(
    buildDefaultMemberBadgeContribution({
      userId: eligibility.userId,
      profileId: eligibility.profileId,
      membershipId: eligibility.membershipId,
      memberNumberSnapshot: eligibility.memberNumberSnapshot,
      amountCents: config.amountCents,
    }),
  );

  if (config.provider === "mock") {
    const sessionId = `mock_badge_cs_${record.badgeContributionId}`;
    const checkoutUrl = `${config.webOrigin}/membership/member-badge/success?session_id=${encodeURIComponent(sessionId)}`;

    await updateMemberBadgeContribution(record.badgeContributionId, {
      contributionStatus: "checkout_created",
      stripeCheckoutSessionId: sessionId,
    });

    return { checkoutUrl, sessionId };
  }

  if (!isMemberBadgeStripeCheckoutConfigured(config)) {
    throw new MemberBadgeContributionUnavailableError(
      "Member Badge Contribution checkout is not configured.",
    );
  }

  const stripe = getStripeClient();
  const successUrl = `${config.webOrigin}/membership/member-badge/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${config.webOrigin}/membership/member-badge?contribution=cancelled`;

  const checkoutMetadata = {
    paymentPurpose: MEMBER_BADGE_PAYMENT_PURPOSE,
    badgeContributionId: record.badgeContributionId,
    membershipId: eligibility.membershipId,
    internalUserId: eligibility.userId,
    platformVersion: config.platformVersion,
  };

  const allowedCountries = config.shippingCountries.filter((code) => code.length === 2) as Array<
    "CA" | "US"
  >;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: [{ price: config.priceId!, quantity: 1 }],
    shipping_address_collection: {
      allowed_countries: allowedCountries.length > 0 ? allowedCountries : ["CA"],
    },
    shipping_options: config.shippingRates.map((rate) => ({
      shipping_rate: rate.stripeShippingRateId,
    })),
    metadata: checkoutMetadata,
    payment_intent_data: {
      metadata: checkoutMetadata,
    },
  });

  if (!session.url || !session.id) {
    throw new MemberBadgeContributionUnavailableError(
      "Unable to create Member Badge Checkout Session.",
    );
  }

  await updateMemberBadgeContribution(record.badgeContributionId, {
    contributionStatus: "checkout_created",
    stripeCheckoutSessionId: session.id,
  });

  return {
    checkoutUrl: session.url,
    sessionId: session.id,
  };
}
