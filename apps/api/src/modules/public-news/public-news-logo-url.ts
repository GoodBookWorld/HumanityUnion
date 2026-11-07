/**
 * MEDIA-NEWS-01B — publisher logo URLs the public news API may return. Logos come
 * from Admin media uploads (the public media host) or bundled site assets
 * (/images/...). Anything else is dropped so clients fall back to the next level.
 * Deliberately separate from RSS article-image validation.
 */

const MAX_LOGO_URL_LENGTH = 1024;
const DEFAULT_LOGO_HOSTS = ["media.huws.org"];
const SITE_LOGO_PATH = /^\/images\/[A-Za-z0-9/_.-]+\.(?:webp|png|jpe?g|svg|gif|avif)$/i;

function trustedLogoHosts(): Set<string> {
  const hosts = new Set(DEFAULT_LOGO_HOSTS);
  const configured = process.env.R2_PUBLIC_BASE_URL?.trim();
  if (configured) {
    try {
      const parsed = new URL(configured);
      if (parsed.protocol === "https:") {
        hosts.add(parsed.hostname.toLowerCase());
      }
    } catch {
      // An invalid configuration adds no host.
    }
  }
  return hosts;
}

export function sanitizePublicLogoUrl(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_LOGO_URL_LENGTH) {
    return undefined;
  }

  if (trimmed.startsWith("/")) {
    const segments = trimmed.split("/");
    if (
      trimmed.startsWith("//") ||
      segments.includes("..") ||
      segments.includes(".") ||
      !SITE_LOGO_PATH.test(trimmed)
    ) {
      return undefined;
    }
    return trimmed;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return undefined;
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    (parsed.port && parsed.port !== "443") ||
    !trustedLogoHosts().has(parsed.hostname.toLowerCase())
  ) {
    return undefined;
  }
  parsed.hash = "";
  return parsed.toString();
}
