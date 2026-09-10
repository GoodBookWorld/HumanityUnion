/**
 * Media browser-visible HU-owned prose groups — Localization Simplification Reset 01.
 * PLP is the sole public presentation owner for these groups, including the
 * /media news carousel (public_news title+summary).
 */

export const MEDIA_BROWSER_VISIBLE_HU_OWNED_PROSE_GROUPS = [
  "overview",
  "faq",
  "selection-principles",
  "trusted-media",
  "fact-checking",
  "propaganda-analysis",
  "news-carousel",
] as const;

export type MediaBrowserVisibleHuOwnedProseGroup =
  (typeof MEDIA_BROWSER_VISIBLE_HU_OWNED_PROSE_GROUPS)[number];

/** PLP entity types that must carry CURRENT machine prose for /media HU bodies. */
export const MEDIA_PUBLIC_PLP_ENTITY_TYPES = [
  "civic_media_editorial",
  "civic_media_principle",
  "civic_media_trusted",
  "civic_media_fact_check",
  "civic_media_propaganda",
  "public_news",
] as const;

export type MediaPublicPlpEntityType = (typeof MEDIA_PUBLIC_PLP_ENTITY_TYPES)[number];
