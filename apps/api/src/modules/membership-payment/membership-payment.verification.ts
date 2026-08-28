/**
 * Pack 26A — Membership Checkout amount / currency verification helpers.
 */
import {
  MEMBERSHIP_CONTRIBUTION_AMOUNT_CENTS,
  MEMBERSHIP_CONTRIBUTION_CURRENCY,
} from "./membership-payment.constants.js";
import { MembershipPaymentValidationError } from "./membership-payment.errors.js";

export function resolveStripeAmountTotalCents(object: Record<string, unknown>): number | null {
  if (typeof object.amount_total === "number") {
    return object.amount_total;
  }
  if (typeof object.amount_received === "number") {
    return object.amount_received;
  }
  if (typeof object.amount === "number") {
    return object.amount;
  }
  return null;
}

export function resolveStripeCurrency(object: Record<string, unknown>): string | null {
  if (typeof object.currency === "string" && object.currency.trim()) {
    return object.currency.trim().toLowerCase();
  }
  return null;
}

/**
 * Fail closed when Stripe reports a total/currency that does not match CA$1 CAD.
 * Missing amount/currency fields are rejected (do not trust Price ID alone).
 */
export function assertMembershipCheckoutAmountAndCurrency(object: Record<string, unknown>): void {
  const amountTotal = resolveStripeAmountTotalCents(object);
  const currency = resolveStripeCurrency(object);

  if (amountTotal === null) {
    throw new MembershipPaymentValidationError(
      "Membership payment amount is missing from the Stripe object.",
    );
  }

  if (amountTotal !== MEMBERSHIP_CONTRIBUTION_AMOUNT_CENTS) {
    throw new MembershipPaymentValidationError(
      "Membership payment amount does not match CA$1.",
    );
  }

  if (currency === null) {
    throw new MembershipPaymentValidationError(
      "Membership payment currency is missing from the Stripe object.",
    );
  }

  if (currency !== MEMBERSHIP_CONTRIBUTION_CURRENCY) {
    throw new MembershipPaymentValidationError(
      "Membership payment currency must be CAD.",
    );
  }
}
