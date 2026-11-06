import net from "node:net";

/**
 * RSS-SOURCE-02B.2 — the only image URLs public news may store or serve: absolute
 * HTTPS on the default port, a public-looking DNS hostname, no credentials. Images
 * are never fetched server-side; this keeps browsers from being pointed at
 * insecure, internal or non-web resources.
 */

const MAX_IMAGE_URL_LENGTH = 2048;
const INTERNAL_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".lan",
  ".home.arpa",
  ".intranet",
];
const PUBLIC_TLD_PATTERN = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

/** Hosts that only serve analytics beacons (first label), e.g. counter.theconversation.com. */
const TRACKING_HOST_LABELS = new Set([
  "counter",
  "pixel",
  "pixels",
  "tracking",
  "tracker",
  "beacon",
]);
/** Whole file names of beacons and spacers; real photos never use these names. */
const TRACKING_FILE_PATTERN =
  /^(?:count|counter|hit|pixel|spacer|blank|clear|transparent|tracking|tracker|beacon|1x1|[a-z])\.(?:gif|png)$/i;

/**
 * Obvious tracking images: beacon hosts, beacon file names (`count.gif`, `pixel.png`,
 * `1x1.gif`, single-letter GIFs such as WordPress `g.gif`), `/1x1/` paths, the
 * legacy `rss-pixel` marker and FeedBurner `~r`/`~ff` beacons. Matching is on host
 * labels and whole path segments, so photos like `counter-terrorism.jpg` or
 * `google-pixel-review.jpg` are kept.
 */
export function isTrackingImageUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  if (TRACKING_HOST_LABELS.has(host.split(".")[0] ?? "")) {
    return true;
  }
  const segments = parsed.pathname.toLowerCase().split("/").filter(Boolean);
  const file = segments.at(-1) ?? "";
  if (TRACKING_FILE_PATTERN.test(file) || segments.includes("1x1") || file.includes("rss-pixel")) {
    return true;
  }
  return host.endsWith("feedburner.com") && (segments[0] === "~r" || segments[0] === "~ff");
}

export function sanitizePublicNewsImageUrl(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_IMAGE_URL_LENGTH) {
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return undefined;
  }

  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    return undefined;
  }
  if (parsed.port && parsed.port !== "443") {
    return undefined;
  }

  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (net.isIP(host.replace(/^\[|\]$/g, "")) || !host.includes(".") || host === "localhost") {
    return undefined;
  }
  if (INTERNAL_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return undefined;
  }
  if (!PUBLIC_TLD_PATTERN.test(host.split(".").at(-1) ?? "")) {
    return undefined;
  }
  if (isTrackingImageUrl(parsed.toString())) {
    return undefined;
  }

  parsed.hash = "";
  return parsed.toString();
}
