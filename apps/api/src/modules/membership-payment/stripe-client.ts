import Stripe from "stripe";

import { resolveMembershipPaymentConfig } from "./membership-payment.config.js";

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  const config = resolveMembershipPaymentConfig();

  if (!config.secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(config.secretKey, {
      apiVersion: "2025-08-27.basil",
    });
  }

  return stripeClient;
}

export function resetStripeClientForTests(): void {
  stripeClient = null;
}
