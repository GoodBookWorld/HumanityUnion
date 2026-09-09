/**
 * Pack 2.1 / 2.1A / 2.1B — private internal request / diagnostic headers.
 * Request headers are stamped by proxy for SSR; diagnostic is response-only.
 */

export const HU_URL_LOCALE_SEGMENT_HEADER = "x-hu-url-locale-segment" as const;

/** Normalized request pathname stamped for root SSR recovery (Pack 2.1A). */
export const HU_PATHNAME_HEADER = "x-hu-pathname" as const;

/**
 * Temporary Pack 2.1B staging diagnostic (response header).
 * Easy to remove after acceptance — not a public API contract.
 */
export const HU_SEO_LOCALE_DIAGNOSTIC_HEADER = "x-hu-seo-locale" as const;
