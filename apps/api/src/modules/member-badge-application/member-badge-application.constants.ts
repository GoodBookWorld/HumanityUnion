import {
  MEMBER_BADGE_APPLICATION_AMOUNT_CENTS,
  MEMBER_BADGE_APPLICATION_CURRENCY,
  MEMBER_BADGE_APPLICATION_DELIVERY_LABEL,
  MEMBER_BADGE_APPLICATION_PRICE_LABEL,
} from "@hu/types";

export {
  MEMBER_BADGE_APPLICATION_AMOUNT_CENTS,
  MEMBER_BADGE_APPLICATION_CURRENCY,
  MEMBER_BADGE_APPLICATION_DELIVERY_LABEL,
  MEMBER_BADGE_APPLICATION_PRICE_LABEL,
};

/** Shown when Badge Stripe Checkout is not configured. */
export const MEMBER_BADGE_APPLICATION_PAYMENT_UNAVAILABLE_MESSAGE =
  "Member Badge payment is temporarily unavailable. Please try again later." as const;

/** Reuses membership webhook `paymentPurpose` value for Badge Checkout. */
export { MEMBER_BADGE_PAYMENT_PURPOSE } from "../member-badge-contribution/member-badge-contribution.constants.js";
