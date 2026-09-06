/**
 * Reset 03C.1 — structural inventory of participant /media page.
 * Used for flag OFF vs ON parity assertions.
 */

/** Major section element ids present on the real Civic Media page. */
export const MEDIA_PAGE_MAJOR_SECTION_IDS = [
  "overview",
  "initiative-flow",
  "news-widgets",
  "selection-principles",
  "trusted-media",
  "fact-checking",
  "propaganda-analysis",
  "faq",
] as const;

export type MediaPageMajorSectionId = (typeof MEDIA_PAGE_MAJOR_SECTION_IDS)[number];

/** Control / tab hooks that must remain present in both localization modes. */
export const MEDIA_PAGE_CONTROL_HOOKS = [
  "trusted-media", // TrustedMediaCategoryTabs host
] as const;
