/**
 * Production Completion Pack 02D Task 03 — footer foundation chrome labels.
 *
 * Stable English footer `label` values remain list/route identity.
 * Only destinations with Pack 02D foundation keys are translated at presentation.
 */

export const FOOTER_FOUNDATION_MESSAGE_KEYS = {
  Support: "support",
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
