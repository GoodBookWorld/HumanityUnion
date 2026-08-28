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

/** Pack 25D — canonical A5 shipping-label sender (points: 1 pt = 1/72 in). */
export const MEMBER_BADGE_APPLICATION_SENDER = {
  name: "Humanity Union Society",
  addressLine1: "514 Vernon St.",
  cityProvincePostal: "Nelson, BC V1L 5R4",
  country: "Canada",
} as const;

/** Pack 25D — A5 page size in PDF points (never expand to A4 / Letter). */
export const MEMBER_BADGE_APPLICATION_LABEL_PAGE_SIZE_PT = [419.53, 595.28] as const;

/** Reuses membership webhook `paymentPurpose` value for Badge Checkout. */
export { MEMBER_BADGE_PAYMENT_PURPOSE } from "../member-badge-contribution/member-badge-contribution.constants.js";
