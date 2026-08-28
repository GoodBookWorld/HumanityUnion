/** Public Support page — Launch-ready copy and links (no backend). */

export const SUPPORT_DONATE_URL = "https://buy.stripe.com/6oE03n4bc9Vm9A45kl";

/**
 * Temporary external Regional Program landing (WordPress).
 * Pack 26A — no equivalent new-platform route exists yet; keep until cutover mapping.
 * See docs/WORDPRESS_REDIRECT_INVENTORY.md (`/regional-program/` → NEEDS_MAPPING / KEEP_TEMPORARILY).
 */
export const SUPPORT_REGIONAL_PROGRAM_URL = "https://huws.org/regional-program/";

export const SUPPORT_ILLUSTRATIONS = {
  /** Pack 26D — Support Humanity Union hero uses the shared unity illustration. */
  hero: "/illustrations/unity.webp",
  resources: "/illustrations/support/resources.svg",
  participation: "/illustrations/support/participation.svg",
  regional: "/illustrations/support/regional.svg",
  /** Why Support Matters — fruit-tree illustration. */
  why: "/illustrations/fruit-tree.webp",
} as const;
