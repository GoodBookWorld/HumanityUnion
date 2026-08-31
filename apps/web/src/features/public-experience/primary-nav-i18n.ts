/**
 * Production Completion Pack 02D Task 02 — primary nav display labels.
 *
 * Stable English `PRIMARY_NAVIGATION` / `DESKTOP_CAPSULE_NAVIGATION` labels remain
 * the identity for href matching, active-route resolution, and list keys.
 * Translated strings are presentation-only via Pack 02D `navigation.*` keys.
 */

import type { AbstractIntlMessages } from "next-intl";

/** Foundation keys that map onto existing primary-nav destinations. */
export const PRIMARY_NAV_FOUNDATION_MESSAGE_KEYS = {
  Home: "home",
  Institutions: "institutions",
  Initiatives: "initiatives",
} as const;

export type PrimaryNavFoundationStableLabel =
  keyof typeof PRIMARY_NAV_FOUNDATION_MESSAGE_KEYS;

export type PrimaryNavFoundationMessageKey =
  (typeof PRIMARY_NAV_FOUNDATION_MESSAGE_KEYS)[PrimaryNavFoundationStableLabel];

export function primaryNavFoundationMessageKey(
  stableLabel: string,
): PrimaryNavFoundationMessageKey | null {
  if (stableLabel in PRIMARY_NAV_FOUNDATION_MESSAGE_KEYS) {
    return PRIMARY_NAV_FOUNDATION_MESSAGE_KEYS[
      stableLabel as PrimaryNavFoundationStableLabel
    ];
  }
  return null;
}

/**
 * Resolve display text for a stable primary-nav label.
 * Unmapped destinations (Civic Media, Knowledge, …) keep their English label.
 */
export function resolvePrimaryNavDisplayLabel(
  stableLabel: string,
  translateNavigation: (key: PrimaryNavFoundationMessageKey) => string,
): string {
  const key = primaryNavFoundationMessageKey(stableLabel);
  return key ? translateNavigation(key) : stableLabel;
}

/** Test/helper path: resolve from a loaded messages object (no React). */
export function resolvePrimaryNavDisplayLabelFromMessages(
  stableLabel: string,
  messages: AbstractIntlMessages,
): string {
  const key = primaryNavFoundationMessageKey(stableLabel);
  if (!key) {
    return stableLabel;
  }
  const navigation = (messages as Record<string, unknown>).navigation;
  if (navigation == null || typeof navigation !== "object" || Array.isArray(navigation)) {
    return stableLabel;
  }
  const value = (navigation as Record<string, unknown>)[key];
  return typeof value === "string" ? value : stableLabel;
}
