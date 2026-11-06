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

  parsed.hash = "";
  return parsed.toString();
}
