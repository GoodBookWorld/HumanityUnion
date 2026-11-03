/** Public Support page — Launch-ready copy and links (no backend). */

export const SUPPORT_DONATE_URL = "https://buy.stripe.com/6oE03n4bc9Vm9A45kl";

/**
 * Regional Program has no current destination; same-page placeholder until Admin
 * configures one. The retired WordPress `/regional-program/` page must not be linked.
 */
export const SUPPORT_REGIONAL_PROGRAM_URL = "#";

export const SUPPORT_ILLUSTRATIONS = {
  /** Production Completion Pack 01 — Support hero uses globe-hand illustration. */
  hero: "/illustrations/support/globe-hand.webp",
  resources: "/illustrations/support/resources.svg",
  participation: "/illustrations/support/participation.svg",
  regional: "/illustrations/support/regional.svg",
  /** Why Support Matters — fruit-tree illustration. */
  why: "/illustrations/fruit-tree.webp",
} as const;

/** Fallback defaults when Admin-configured Support links are empty / unavailable. */
export const SUPPORT_LINK_FALLBACKS = {
  donation: SUPPORT_DONATE_URL,
  /** HU-owned Volunteer page when Admin has not configured an override URL. */
  volunteer: "/volunteer",
  regional_program: SUPPORT_REGIONAL_PROGRAM_URL,
} as const;
