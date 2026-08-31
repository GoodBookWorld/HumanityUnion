/**
 * Production Completion Pack 02D Task 03 / Pack 02E Task 02 — footer chrome labels.
 *
 * Stable English footer `label` values remain list/route identity.
 * Destinations with `navigation.*` keys are translated at presentation only.
 */

export const FOOTER_FOUNDATION_MESSAGE_KEYS = {
  Institutions: "institutions",
  Initiatives: "initiatives",
  Blog: "blog",
  Membership: "membership",
  "Civic Media": "civicMedia",
  "Civic Archive": "civicArchive",
  Support: "support",
  Search: "search",
  Privacy: "privacy",
  Terms: "terms",
  Contact: "contact",
} as const;

export type FooterFoundationStableLabel = keyof typeof FOOTER_FOUNDATION_MESSAGE_KEYS;

export type FooterFoundationMessageKey =
  (typeof FOOTER_FOUNDATION_MESSAGE_KEYS)[FooterFoundationStableLabel];

export function footerFoundationMessageKey(
  stableLabel: string,
): FooterFoundationMessageKey | null {
  if (stableLabel in FOOTER_FOUNDATION_MESSAGE_KEYS) {
    return FOOTER_FOUNDATION_MESSAGE_KEYS[stableLabel as FooterFoundationStableLabel];
  }
  return null;
}

export function resolveFooterNavDisplayLabel(
  stableLabel: string,
  translateNavigation: (key: FooterFoundationMessageKey) => string,
): string {
  const key = footerFoundationMessageKey(stableLabel);
  return key ? translateNavigation(key) : stableLabel;
}
