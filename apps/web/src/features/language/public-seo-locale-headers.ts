/**
 * Pack 2.1 — request header carrying the raw URL locale segment for SEO-prefixed paths.
 * Set by thin middleware; consumed by document locale resolution. Not a cookie.
 */
export const HU_URL_LOCALE_SEGMENT_HEADER = "x-hu-url-locale-segment" as const;
