import {
  MEMBER_BADGE_CONTRIBUTION_AMOUNT_CENTS,
  MEMBER_BADGE_CONTRIBUTION_CURRENCY,
} from "./member-badge-contribution.constants.js";

export type MemberBadgePaymentProvider = "stripe" | "mock";

export interface MemberBadgeShippingRateConfig {
  countryCode: string;
  stripeShippingRateId: string;
}

export interface MemberBadgeContributionConfig {
  provider: MemberBadgePaymentProvider;
  enabled: boolean;
  secretKey: string | null;
  webhookSecret: string | null;
  priceId: string | null;
  webOrigin: string;
  amountCents: number;
  currency: string;
  platformVersion: string;
  shippingCountries: string[];
  shippingRates: MemberBadgeShippingRateConfig[];
}

function parseShippingCountries(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return ["CA"];
  }

  return raw
    .split(",")
    .map((entry) => entry.trim().toUpperCase())
    .filter(Boolean);
}

function parseShippingRates(): MemberBadgeShippingRateConfig[] {
  const rates: MemberBadgeShippingRateConfig[] = [];
  const mappings: Array<[string, string | undefined]> = [
    ["CA", process.env.STRIPE_MEMBER_BADGE_SHIPPING_RATE_CA?.trim()],
    ["US", process.env.STRIPE_MEMBER_BADGE_SHIPPING_RATE_US?.trim()],
    ["INTL", process.env.STRIPE_MEMBER_BADGE_SHIPPING_RATE_INTERNATIONAL?.trim()],
  ];

  for (const [countryCode, stripeShippingRateId] of mappings) {
    if (stripeShippingRateId) {
      rates.push({ countryCode, stripeShippingRateId });
    }
  }

  return rates;
}

export function resolveMemberBadgeContributionConfig(): MemberBadgeContributionConfig {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim() || null;
  const explicitProvider = process.env.MEMBER_BADGE_PAYMENT_PROVIDER?.trim().toLowerCase();
  const enabled = process.env.MEMBER_BADGE_CONTRIBUTIONS_ENABLED?.trim().toLowerCase() === "true";

  let provider: MemberBadgePaymentProvider = "mock";

  if (explicitProvider === "stripe") {
    provider = "stripe";
  } else if (explicitProvider === "mock") {
    provider = "mock";
  } else if (secretKey) {
    provider = "stripe";
  }

  const amountCents = Number.parseInt(
    process.env.MEMBER_BADGE_CONTRIBUTION_CAD_CENTS?.trim() ||
      String(MEMBER_BADGE_CONTRIBUTION_AMOUNT_CENTS),
    10,
  );

  return {
    provider,
    enabled,
    secretKey,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim() || null,
    priceId: process.env.STRIPE_MEMBER_BADGE_PRICE_ID?.trim() || null,
    webOrigin: process.env.WEB_ORIGIN?.trim() || "http://localhost:3000",
    amountCents: Number.isFinite(amountCents)
      ? amountCents
      : MEMBER_BADGE_CONTRIBUTION_AMOUNT_CENTS,
    currency: MEMBER_BADGE_CONTRIBUTION_CURRENCY,
    platformVersion: process.env.PLATFORM_VERSION?.trim() || "0.1.0",
    shippingCountries: parseShippingCountries(process.env.MEMBER_BADGE_SHIPPING_COUNTRIES),
    shippingRates: parseShippingRates(),
  };
}

export function isMemberBadgeStripeCheckoutConfigured(
  config = resolveMemberBadgeContributionConfig(),
): boolean {
  return (
    config.enabled &&
    config.provider === "stripe" &&
    Boolean(config.secretKey) &&
    Boolean(config.webhookSecret) &&
    Boolean(config.priceId) &&
    config.shippingRates.length > 0
  );
}

export function isMemberBadgeMockCheckoutConfigured(
  config = resolveMemberBadgeContributionConfig(),
): boolean {
  return config.enabled && config.provider === "mock" && Boolean(config.webhookSecret);
}
