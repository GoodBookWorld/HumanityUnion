/**
 * HU-NOTIF-02C.3 — authenticated deep-link resolver for notification emails.
 * Uses configured WEB origin only — never request Host headers.
 */

import { resolveEmailConfig } from "../../email/email.config.js";

const FALLBACK_PATH = "/notifications";
const PREFERENCES_PATH = "/preferences";

const ALLOWED_PATH_PREFIXES = [
  "/notifications",
  "/initiatives",
  "/workspace",
  "/blog",
  "/preferences",
  "/members",
  "/civic",
  "/petitions",
  "/decisions",
  "/nominations",
  "/archive",
  "/impact",
  "/commitments",
  "/authoring",
  "/publishing",
] as const;

const UNSAFE_QUERY_KEYS = [
  "token",
  "access_token",
  "refresh_token",
  "code",
  "password",
  "secret",
  "redirect",
  "returnurl",
  "return_url",
  "next",
  "url",
  "continue",
  "callback",
  "goto",
  "dest",
  "destination",
] as const;

export type MemberNotificationDeepLinkResolution =
  | {
      ok: true;
      absoluteUrl: string;
      path: string;
      usedFallback: boolean;
    }
  | {
      ok: false;
      reason: "external_url" | "unsafe_path" | "unsafe_query" | "invalid";
    };

function resolveCanonicalOrigin(): string {
  return resolveEmailConfig().publicSiteUrl.replace(/\/$/u, "");
}

/** Bounded decode to block single- and double-encoded bypass attempts. */
function decodeUriComponentBounded(value: string): string | null {
  let current = value;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const next = decodeURIComponent(current.replace(/\+/g, "%20"));
      if (next === current) {
        return current;
      }
      current = next;
    } catch {
      return null;
    }
  }
  return current;
}

function containsUnsafeDecodedMarkers(value: string): boolean {
  const lower = value.toLowerCase();
  if (
    lower.includes("javascript:") ||
    lower.includes("data:") ||
    lower.includes("vbscript:") ||
    lower.includes("mailto:")
  ) {
    return true;
  }
  if (value.includes("\\") || value.includes("\0")) {
    return true;
  }
  // Double-slash is unsafe in paths; ignore the scheme separator in absolute URLs.
  const withoutScheme = value.replace(/^[a-z][a-z0-9+.-]*:\/\//iu, "");
  if (withoutScheme.startsWith("//") || withoutScheme.includes("//")) {
    return true;
  }
  return false;
}

function isAllowedPath(pathname: string): boolean {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) {
    return false;
  }
  if (containsUnsafeDecodedMarkers(pathname)) {
    return false;
  }
  return ALLOWED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function hasUnsafeQuery(search: string): boolean {
  if (!search || search === "?") {
    return false;
  }
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const decodedSearch = decodeUriComponentBounded(raw);
  if (decodedSearch === null || containsUnsafeDecodedMarkers(decodedSearch)) {
    return true;
  }

  const params = new URLSearchParams(raw);
  for (const [key, value] of params.entries()) {
    const decodedKey = decodeUriComponentBounded(key);
    const decodedValue = decodeUriComponentBounded(value);
    if (decodedKey === null || decodedValue === null) {
      return true;
    }
    const lowerKey = decodedKey.toLowerCase();
    if (UNSAFE_QUERY_KEYS.some((unsafe) => lowerKey === unsafe || lowerKey.includes(unsafe))) {
      return true;
    }
    const lowerValue = decodedValue.toLowerCase();
    if (
      lowerValue.startsWith("http:") ||
      lowerValue.startsWith("https:") ||
      lowerValue.startsWith("//") ||
      lowerValue.includes("javascript:") ||
      lowerValue.includes("data:")
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Normalize an internal path with the URL parser, then re-validate.
 */
function normalizeAndValidateInternalPath(
  pathname: string,
  search: string,
): { pathname: string; search: string } | null {
  const decodedPath = decodeUriComponentBounded(pathname);
  if (decodedPath === null || !decodedPath.startsWith("/") || decodedPath.startsWith("//")) {
    return null;
  }
  if (containsUnsafeDecodedMarkers(decodedPath)) {
    return null;
  }

  try {
    const normalized = new URL(`https://hu.invalid${decodedPath}${search}`);
    if (normalized.username || normalized.password) {
      return null;
    }
    const safePath = normalized.pathname;
    const safeSearch = normalized.search;
    if (!isAllowedPath(safePath) || hasUnsafeQuery(safeSearch)) {
      return null;
    }
    // Reject if normalization escaped allowlisted tree via leftover ".."
    if (safePath.includes("..")) {
      return null;
    }
    return { pathname: safePath, search: safeSearch };
  } catch {
    return null;
  }
}

/**
 * Resolve relatedUrl to a safe absolute HU URL, or reject.
 * Callers should fall back to /notifications when ok is false.
 */
export function resolveMemberNotificationDeepLink(
  relatedUrl: string | null | undefined,
): MemberNotificationDeepLinkResolution {
  const origin = resolveCanonicalOrigin();
  const raw = typeof relatedUrl === "string" ? relatedUrl.trim() : "";

  if (!raw) {
    return {
      ok: true,
      absoluteUrl: `${origin}${FALLBACK_PATH}`,
      path: FALLBACK_PATH,
      usedFallback: true,
    };
  }

  const decodedRaw = decodeUriComponentBounded(raw);
  if (decodedRaw === null || containsUnsafeDecodedMarkers(decodedRaw)) {
    return { ok: false, reason: "unsafe_path" };
  }

  const lower = decodedRaw.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("mailto:")
  ) {
    return { ok: false, reason: "unsafe_path" };
  }

  // Absolute / protocol-relative — only configured origin is acceptable.
  if (/^[a-z][a-z0-9+.-]*:/i.test(decodedRaw) || decodedRaw.startsWith("//") || raw.startsWith("//")) {
    try {
      const absolute = decodedRaw.startsWith("//")
        ? `https:${decodedRaw}`
        : /^[a-z][a-z0-9+.-]*:/i.test(decodedRaw)
          ? decodedRaw
          : raw.startsWith("//")
            ? `https:${raw}`
            : raw;
      const parsed = new URL(absolute);
      const originUrl = new URL(origin);
      if (parsed.username || parsed.password) {
        return { ok: false, reason: "unsafe_path" };
      }
      if (parsed.origin !== originUrl.origin) {
        return { ok: false, reason: "external_url" };
      }
      const normalized = normalizeAndValidateInternalPath(parsed.pathname, parsed.search);
      if (!normalized) {
        return {
          ok: false,
          reason: hasUnsafeQuery(parsed.search) ? "unsafe_query" : "unsafe_path",
        };
      }
      return {
        ok: true,
        absoluteUrl: `${originUrl.origin}${normalized.pathname}${normalized.search}`,
        path: `${normalized.pathname}${normalized.search}`,
        usedFallback: false,
      };
    } catch {
      return { ok: false, reason: "invalid" };
    }
  }

  const pathOnly = decodedRaw.startsWith("/") ? decodedRaw : `/${decodedRaw}`;
  let pathname = pathOnly;
  let search = "";
  const queryIndex = pathOnly.indexOf("?");
  if (queryIndex >= 0) {
    pathname = pathOnly.slice(0, queryIndex);
    search = pathOnly.slice(queryIndex);
  }

  const normalized = normalizeAndValidateInternalPath(pathname, search);
  if (!normalized) {
    return {
      ok: false,
      reason: hasUnsafeQuery(search) ? "unsafe_query" : "unsafe_path",
    };
  }

  return {
    ok: true,
    absoluteUrl: `${origin}${normalized.pathname}${normalized.search}`,
    path: `${normalized.pathname}${normalized.search}`,
    usedFallback: false,
  };
}

export function resolveMemberNotificationFallbackDeepLink(): {
  absoluteUrl: string;
  path: string;
} {
  const origin = resolveCanonicalOrigin();
  return { absoluteUrl: `${origin}${FALLBACK_PATH}`, path: FALLBACK_PATH };
}

export function resolveMemberNotificationPreferencesDeepLink(): {
  absoluteUrl: string;
  path: string;
} {
  const origin = resolveCanonicalOrigin();
  return { absoluteUrl: `${origin}${PREFERENCES_PATH}`, path: PREFERENCES_PATH };
}
