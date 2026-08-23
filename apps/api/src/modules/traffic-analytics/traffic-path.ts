/**
 * Pack 11C — normalize human-facing paths for traffic reporting.
 * Rejects API/static/system routes. Does not persist query strings.
 */

const EXCLUDED_PREFIXES = [
  "/api/",
  "/_next/",
  "/favicon",
  "/robots.txt",
  "/sitemap",
  "/sw.js",
  "/manifest",
  "/icons/",
  "/images/",
  "/fonts/",
  "/media/uploads/",
] as const;

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;
const OBJECT_ID_RE = /\b[a-f0-9]{24}\b/gi;

export function isExcludedTrafficPath(pathname: string): boolean {
  const path = pathname.trim().toLowerCase();

  if (!path.startsWith("/")) {
    return true;
  }

  if (path === "/api" || path.startsWith("/api/")) {
    return true;
  }

  if (path.includes(".")) {
    const last = path.split("/").pop() ?? "";
    if (/\.(js|css|map|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|json|txt|xml)$/i.test(last)) {
      return true;
    }
  }

  return EXCLUDED_PREFIXES.some(
    (prefix) => path === prefix.replace(/\/$/, "") || path.startsWith(prefix),
  );
}

/**
 * Returns normalized pathname for analytics, or null if the path must not count.
 */
export function normalizeTrafficPathname(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }

  let path = raw.trim();

  if (!path) {
    return null;
  }

  try {
    if (path.includes("://")) {
      path = new URL(path).pathname;
    }
  } catch {
    return null;
  }

  const q = path.indexOf("?");
  if (q >= 0) {
    path = path.slice(0, q);
  }

  const h = path.indexOf("#");
  if (h >= 0) {
    path = path.slice(0, h);
  }

  if (!path.startsWith("/")) {
    path = `/${path}`;
  }

  path = path.replace(/\/{2,}/g, "/");

  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }

  if (path.length > 200) {
    return null;
  }

  if (isExcludedTrafficPath(path)) {
    return null;
  }

  // Tokenized private/opaque ids → route family for aggregation.
  path = path.replace(/\/initiatives\/public\/[^/]+/i, "/initiatives/public/:initiativeId");
  path = path.replace(/\/initiatives\/[^/]+\/experience/i, "/initiatives/:initiativeId/experience");
  path = path.replace(UUID_RE, ":id");
  path = path.replace(OBJECT_ID_RE, ":id");

  // Collapse /admin/* to section root for privacy (no deep admin URLs).
  const lower = path.toLowerCase();
  if (lower === "/admin" || lower.startsWith("/admin/")) {
    const section = lower.slice("/admin/".length).split("/")[0] ?? "";
    return section ? `/admin/${section}` : "/admin";
  }

  return path;
}

export function isObviousBotUserAgent(userAgent: string | undefined): boolean {
  if (!userAgent || !userAgent.trim()) {
    return false;
  }

  return /(bot|crawler|spider|slurp|bingpreview|facebookexternalhit|wget|curl|python-requests|httpclient|uptime|healthcheck|headlesschrome|phantomjs)/i.test(
    userAgent,
  );
}
