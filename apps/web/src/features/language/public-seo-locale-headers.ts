/**
 * Pack 2.1 / 2.1A — private internal request headers for SEO locale authority.
 * Set by thin middleware; consumed by document locale resolution. Not a response contract.
 */

export const HU_URL_LOCALE_SEGMENT_HEADER = "x-hu-url-locale-segment" as const;

/** Normalized request pathname stamped for root SSR recovery (Pack 2.1A). */
export const HU_PATHNAME_HEADER = "x-hu-pathname" as const;
