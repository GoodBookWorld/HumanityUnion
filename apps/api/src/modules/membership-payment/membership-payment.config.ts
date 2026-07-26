import {
  MEMBERSHIP_CONTRIBUTION_AMOUNT_CENTS,
  MEMBERSHIP_CONTRIBUTION_CURRENCY,
} from "./membership-payment.constants.js";

export type MembershipPaymentProvider = "stripe" | "mock";

export interface MembershipPaymentConfig {
  provider: MembershipPaymentProvider;
  secretKey: string | null;
  publishableKey: string | null;
  webhookSecret: string | null;
  priceId: string | null;
  webOrigin: string;
  amountCents: number;
  currency: string;
  platformVersion: string;
}

export function resolveMembershipPaymentConfig(): MembershipPaymentConfig {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() || null;
  const explicitProvider = process.env.MEMBERSHIP_PAYMENT_PROVIDER?.trim().toLowerCase();

  let provider: MembershipPaymentProvider = "mock";

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
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY?.trim() || null,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim() || null,
    priceId: process.env.STRIPE_MEMBERSHIP_PRICE_ID?.trim() || null,
    webOrigin: process.env.WEB_ORIGIN?.trim() || "http://localhost:3000",
    amountCents: MEMBERSHIP_CONTRIBUTION_AMOUNT_CENTS,
    currency: MEMBERSHIP_CONTRIBUTION_CURRENCY,
    platformVersion: process.env.PLATFORM_VERSION?.trim() || "0.1.0",
  };
}

export function isStripeMembershipPaymentConfigured(
  config = resolveMembershipPaymentConfig(),
): boolean {
  return (
    config.provider === "stripe" &&
    Boolean(config.secretKey) &&
    Boolean(config.webhookSecret) &&
    Boolean(config.priceId)
  );
}
