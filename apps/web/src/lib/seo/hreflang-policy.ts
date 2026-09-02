/**
 * Pack 02I — Hreflang / alternate-language URL policy.
 *
 * Humanity Union does **not** expose locale-prefixed public routes
 * (there is no `/uk/...`, `/ar/...`, or `?lang=` addressable public URL surface).
 * Interface locale is negotiated via cookie + Accept-Language only
 * (see `resolveDocumentHtmlLocale` / Pack 02C).
 *
 * Emitting `hreflang` (or `alternates.languages`) that all point at the same
 * canonical URL would be misleading to crawlers: it claims language-specific
 * addressable alternates that do not exist.
 *
 * Decision: **HREFLANG_DEFERRED** until durable locale-addressable URLs exist.
 * `x-default` is **ABSENT** — do not invent a synthetic default alternate.
 *
 * `html[lang]` remains resolved separately in the root layout and is unrelated
 * to hreflang emission.
 */

export const HREFLANG_STATUS = "DEFERRED" as const;

export const HREFLANG_DEFERRED_REASON =
  "No locale-prefixed or otherwise durable locale-addressable public URLs exist; " +
  "locale is cookie/Accept-Language negotiation only. Emitting hreflang (or " +
  "x-default) to the same canonical URL would be misleading. Defer until " +
  "locale-addressable URLs exist.";

/** Pack 02I — never emit hreflang / alternates.languages while deferred. */
export function shouldEmitHreflangAlternates(): false {
  return false;
}

/** Pack 02I — never invent x-default while deferred. */
export function shouldEmitXDefault(): false {
  return false;
}
