import {
  MEMBER_BADGE_APPLICATION_AMOUNT_CENTS,
  MEMBER_BADGE_APPLICATION_CURRENCY,
} from "./member-badge-application.constants.js";

export type MemberBadgeApplicationPaymentProvider = "stripe" | "mock";

export interface MemberBadgeApplicationPaymentConfig {
  provider: MemberBadgeApplicationPaymentProvider;
  secretKey: string | null;
  webhookSecret: string | null;
  priceId: string | null;
  webOrigin: string;
  amountCents: number;
  currency: string;
  platformVersion: string;
}

/**
 * Pack 25C — Badge Application Checkout config.
 * Uses STRIPE_MEMBER_BADGE_PRICE_ID for the CA$28 application Price.
 * Does not require legacy contribution shipping rates or MEMBER_BADGE_CONTRIBUTIONS_ENABLED.
 */
export function resolveMemberBadgeApplicationPaymentConfig(): MemberBadgeApplicationPaymentConfig {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() || null;
  const explicitProvider = process.env.MEMBER_BADGE_PAYMENT_PROVIDER?.trim().toLowerCase();

  let provider: MemberBadgeApplicationPaymentProvider = "mock";

  if (explicitProvider === "stripe") {
    provider = "stripe";
  } else if (explicitProvider === "mock") {
    provider = "mock";
  } else if (secretKey) {
    provider = "stripe";
  }

  return {
    provider,
    secretKey,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim() || null,
    priceId: process.env.STRIPE_MEMBER_BADGE_PRICE_ID?.trim() || null,
    webOrigin: process.env.WEB_ORIGIN?.trim() || "http://localhost:3000",
    amountCents: MEMBER_BADGE_APPLICATION_AMOUNT_CENTS,
    currency: MEMBER_BADGE_APPLICATION_CURRENCY,
    platformVersion: process.env.PLATFORM_VERSION?.trim() || "0.1.0",
  };
}

export function isMemberBadgeApplicationStripeCheckoutConfigured(
  config = resolveMemberBadgeApplicationPaymentConfig(),
): boolean {
  return (
    config.provider === "stripe" &&
    Boolean(config.secretKey) &&
    Boolean(config.webhookSecret) &&
    Boolean(config.priceId)
  );
}

export function isMemberBadgeApplicationMockCheckoutConfigured(
  config = resolveMemberBadgeApplicationPaymentConfig(),
): boolean {
  return config.provider === "mock" && Boolean(config.webhookSecret);
}

export function isMemberBadgeApplicationPaymentConfigured(
  config = resolveMemberBadgeApplicationPaymentConfig(),
): boolean {
  if (config.provider === "mock") {
    return isMemberBadgeApplicationMockCheckoutConfigured(config);
  }

  return isMemberBadgeApplicationStripeCheckoutConfigured(config);
}
