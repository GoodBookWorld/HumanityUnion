/**
 * Production Completion Pack 02C Task 03 — Web-origin `hu_lang` cookie helpers.
 *
 * Same contract as API Task 01: Path=/; SameSite=Lax; Secure in production;
 * Max-Age 365d; not HttpOnly. Validation lives in the write route — callers
 * must only write after Registry canonicalize succeeds.
 */

import {
  HU_LANG_COOKIE_MAX_AGE_SECONDS,
  HU_LANG_COOKIE_NAME,
} from "@hu/types";

export { HU_LANG_COOKIE_MAX_AGE_SECONDS, HU_LANG_COOKIE_NAME };

export function isHuLangSecureCookieEnvironment(): boolean {
  return (process.env.NODE_ENV ?? "development") === "production";
}

/** Cookie attributes for Next.js `cookies().set` / `NextResponse.cookies.set`. */
export function buildWebHuLangCookieAttributes(overrides?: {
  readonly clear?: boolean;
}): {
  readonly name: typeof HU_LANG_COOKIE_NAME;
  readonly path: "/";
  readonly sameSite: "lax";
  readonly httpOnly: false;
  readonly secure: boolean;
  readonly maxAge: number;
} {
  return {
    name: HU_LANG_COOKIE_NAME,
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    secure: isHuLangSecureCookieEnvironment(),
    maxAge: overrides?.clear ? 0 : HU_LANG_COOKIE_MAX_AGE_SECONDS,
  };
}

/** Read raw `hu_lang` from `document.cookie` (browser only). */
export function readHuLangCookieFromDocument(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${HU_LANG_COOKIE_NAME}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(prefix)) {
      continue;
    }
    const value = decodeURIComponent(trimmed.slice(prefix.length).trim());
    return value.length > 0 ? value : null;
  }
  return null;
}
