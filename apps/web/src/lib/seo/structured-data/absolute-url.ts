import { resolvePublicSiteOrigin, toAbsolutePublicUrl } from "../public-site-url";

/**
 * Absolute public URL for structured data, or null when origin is unset.
 * Never invents a host from the request.
 */
export function absoluteStructuredDataUrl(
  pathOrUrl: string,
  origin: string = resolvePublicSiteOrigin(),
): string | null {
  if (!origin) {
    return null;
  }
  const absolute = toAbsolutePublicUrl(pathOrUrl, origin);
  return /^https?:\/\//i.test(absolute) ? absolute : null;
}

export function resolveStructuredDataOrigin(
  env: { NEXT_PUBLIC_SITE_URL?: string; [key: string]: string | undefined } = process.env,
): string {
  return resolvePublicSiteOrigin(env);
}
