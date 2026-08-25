/**
 * SEO Pack 01 — canonical public site origin for metadata and future sitemap.
 *
 * Uses `NEXT_PUBLIC_SITE_URL` only. Never derives production canonicals from
 * the request Host header. Empty when unset (local/tooling) so callers can
 * fall back to path-only URLs until the working domain is configured.
 */

type SiteUrlEnv = {
  NEXT_PUBLIC_SITE_URL?: string;
  [key: string]: string | undefined;
};

export function resolvePublicSiteOrigin(env: SiteUrlEnv = process.env): string {
  const raw = (env.NEXT_PUBLIC_SITE_URL ?? "").trim();
  if (!raw) {
    return "";
  }

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "";
  }
}

/**
 * Join a public path (or absolute URL) with the configured site origin.
 * Absolute http(s) inputs are returned unchanged.
 */
export function toAbsolutePublicUrl(
  pathOrUrl: string,
  origin: string = resolvePublicSiteOrigin(),
): string {
  const value = pathOrUrl.trim();
  if (!value) {
    return origin || "/";
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const path = value.startsWith("/") ? value : `/${value}`;
  if (!origin) {
    return path;
  }

  return `${origin.replace(/\/$/, "")}${path}`;
}

export function normalizeCanonicalPath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return "/";
  }
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).pathname || "/";
    } catch {
      return "/";
    }
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}
