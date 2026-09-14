/**
 * Production Completion Pack 02C Task 01 — guest `hu_lang` cookie contract.
 *
 * Stores canonical Registry locale only. Not HttpOnly so a future language
 * selector can read/write via document.cookie when needed; invalid values
 * never become the active locale (resolver validates against enabled Registry).
 */

import type { CookieOptions, Request, Response } from "express";

import {
  HU_LANG_COOKIE_MAX_AGE_SECONDS,
  HU_LANG_COOKIE_NAME,
} from "@hu/types";

export { HU_LANG_COOKIE_MAX_AGE_SECONDS, HU_LANG_COOKIE_NAME };

function isSecureCookieEnvironment(): boolean {
  return (process.env.NODE_ENV ?? "development") === "production";
}

/**
 * Canonical cookie options for `hu_lang`.
 * - Path=/
 * - SameSite=Lax
 * - Secure in production
 * - Not HttpOnly (client language selector may need access later)
 * - Max-Age: 365 days
 */
export function buildHuLangCookieOptions(overrides?: {
  readonly clear?: boolean;
}): CookieOptions {
  const options: CookieOptions = {
    httpOnly: false,
    sameSite: "lax",
    secure: isSecureCookieEnvironment(),
    path: "/",
  };

  if (overrides?.clear) {
    options.maxAge = 0;
  } else {
    options.maxAge = HU_LANG_COOKIE_MAX_AGE_SECONDS * 1000;
  }

  return options;
}

/** Security / serialization snapshot for tests and docs. */
export function getHuLangCookieSecuritySnapshot(): {
  readonly name: typeof HU_LANG_COOKIE_NAME;
  readonly path: string;
  readonly sameSite: "lax";
  readonly httpOnly: false;
  readonly secure: boolean;
  readonly maxAgeSeconds: number;
} {
  const options = buildHuLangCookieOptions();
  return {
    name: HU_LANG_COOKIE_NAME,
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    secure: Boolean(options.secure),
    maxAgeSeconds: HU_LANG_COOKIE_MAX_AGE_SECONDS,
  };
}

/**
 * Serialize a Set-Cookie header value for inspection (tests / debugging).
 * Does not write to a response.
 */
export function serializeHuLangSetCookieHeader(canonicalLocale: string): string {
  const options = buildHuLangCookieOptions();
  const parts = [
    `${HU_LANG_COOKIE_NAME}=${encodeURIComponent(canonicalLocale.trim())}`,
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${HU_LANG_COOKIE_MAX_AGE_SECONDS}`,
  ];
  if (options.secure) {
    parts.push("Secure");
  }
  // Explicitly omit HttpOnly — guest selector may need client access.
  return parts.join("; ");
}

/** Read raw `hu_lang` cookie value (may be invalid/disabled). */
export function readHuLangCookie(req: Request): string | null {
  const value = req.cookies?.[HU_LANG_COOKIE_NAME];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Write canonical locale to `hu_lang`.
 * Callers should pass an enabled Registry locale; the resolver still ignores
 * disabled/unknown values if a stale cookie is present.
 */
export function writeHuLangCookie(res: Response, canonicalLocale: string): void {
  const trimmed = canonicalLocale.trim();
  if (!trimmed) {
    return;
  }
  res.cookie(HU_LANG_COOKIE_NAME, trimmed, buildHuLangCookieOptions());
}

/** Clear the guest preference cookie. */
export function clearHuLangCookie(res: Response): void {
  res.clearCookie(HU_LANG_COOKIE_NAME, buildHuLangCookieOptions({ clear: true }));
}
