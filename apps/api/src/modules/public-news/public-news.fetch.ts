import dns from "node:dns/promises";
import net from "node:net";

import {
  isApprovedMediaRegistryDomain,
  isApprovedMediaRegistryFeedUrl,
} from "@hu/media-registry";

const BLOCKED_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);
const FEED_URL_PATTERN = /\/(?:feed|rss|atom)(?:\/|$|[?#])/i;
const MOCK_ARTICLE_PATH_PATTERN = /\/mock[-_/]|mock-/i;

export function isPlaceholderArticleUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return MOCK_ARTICLE_PATH_PATTERN.test(`${parsed.pathname}${parsed.search}`);
  } catch {
    return true;
  }
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map((part) => Number.parseInt(part, 10));

  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  const a = parts[0] ?? -1;
  const b = parts[1] ?? -1;

  if (a === 10) {
    return true;
  }

  if (a === 127) {
    return true;
  }

  if (a === 0) {
    return true;
  }

  if (a === 169 && b === 254) {
    return true;
  }

  if (a === 192 && b === 168) {
    return true;
  }

  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }

  return false;
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();

  if (normalized === "::1") {
    return true;
  }

  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }

  if (normalized.startsWith("fe80")) {
    return true;
  }

  return false;
}

async function assertSafeHostname(hostname: string): Promise<void> {
  const normalized = hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(normalized)) {
    throw new Error("Blocked hostname.");
  }

  if (net.isIP(normalized)) {
    if (
      (net.isIPv4(normalized) && isPrivateIpv4(normalized)) ||
      (net.isIPv6(normalized) && isPrivateIpv6(normalized))
    ) {
      throw new Error("Blocked IP address.");
    }

    return;
  }

  const resolved = await dns.lookup(normalized, { all: true, verbatim: true });

  for (const entry of resolved) {
    if (
      (entry.family === 4 && isPrivateIpv4(entry.address)) ||
      (entry.family === 6 && isPrivateIpv6(entry.address))
    ) {
      throw new Error("Blocked resolved IP address.");
    }
  }
}

export async function fetchExternalDocument(
  url: string,
  options: { timeoutMs: number; maxBytes: number; requireApprovedRssFeed?: boolean },
): Promise<string> {
  const parsed = new URL(url);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed.");
  }

  if (options.requireApprovedRssFeed && !isApprovedMediaRegistryFeedUrl(url)) {
    throw new Error("RSS feed URL is not in the approved media registry.");
  }

  await assertSafeHostname(parsed.hostname);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(parsed.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        // Some publishers (e.g. Politico) reject bare bot UAs with HTTP 403.
        "User-Agent":
          "Mozilla/5.0 (compatible; HumanityUnionPublicNewsBot/1.0; +https://huws.org)",
        ...(parsed.hostname.toLowerCase().includes("politico.com")
          ? { Referer: "https://www.politico.com/" }
          : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`External request failed with status ${response.status}.`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    if (buffer.byteLength > options.maxBytes) {
      throw new Error("External response exceeded size limit.");
    }

    return buffer.toString("utf8");
  } finally {
    clearTimeout(timeout);
  }
}

function isFeedLikeArticleUrl(url: URL): boolean {
  const path = url.pathname.toLowerCase();

  if (path.endsWith(".xml") || path.endsWith(".rss") || path.endsWith(".atom")) {
    return true;
  }

  if (MOCK_ARTICLE_PATH_PATTERN.test(`${url.pathname}${url.search}`)) {
    return true;
  }

  return FEED_URL_PATTERN.test(`${url.pathname}${url.search}`);
}

function isApprovedPublisherArticleUrl(url: URL): boolean {
  return isApprovedMediaRegistryDomain(url.hostname.toLowerCase());
}

export async function validatePublicArticleUrl(
  url: string,
  options: { timeoutMs: number },
): Promise<boolean> {
  let parsed: URL;

  try {
    parsed = new URL(url.trim());
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  if (isFeedLikeArticleUrl(parsed)) {
    return false;
  }

  if (!isApprovedPublisherArticleUrl(parsed)) {
    return false;
  }

  try {
    await assertSafeHostname(parsed.hostname);
  } catch {
    return false;
  }

  // Approved-registry article URLs are trusted after SSRF hostname checks.
  // Do not require a live HTML GET: publishers often paywall, bot-gate (403),
  // or reset HTTP/2 streams, and Humanity Union only links out — it never
  // ingests full article bodies.
  void options.timeoutMs;
  return true;
}
