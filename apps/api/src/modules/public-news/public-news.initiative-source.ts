import {
  getMediaRegistryProviderByName,
  isApprovedMediaRegistryDomain,
  isMediaRegistryWebsiteUrl,
  isSpecificMediaArticleUrl,
} from "@hu/media-registry";

import type { NewsArticleRecord } from "@hu/types";

import { isPlaceholderArticleUrl } from "./public-news.fetch.js";

const BLOCKED_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".").map((part) => Number.parseInt(part, 10));

  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  const a = parts[0] ?? -1;
  const b = parts[1] ?? -1;

  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31)
  );
}

function isBlockedArticleHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(normalized)) {
    return true;
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(normalized)) {
    return isPrivateIpv4(normalized);
  }

  return normalized.endsWith(".local") || normalized.endsWith(".internal");
}

export function validateNewsArticleRecordForInitiativeSource(
  record: NewsArticleRecord,
): string | null {
  let parsed: URL;

  try {
    parsed = new URL(record.articleUrl.trim());
  } catch {
    return "News article URL must be a valid http or https URL.";
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "News article URL must use http or https.";
  }

  if (isBlockedArticleHostname(parsed.hostname)) {
    return "News article URL uses a blocked hostname.";
  }

  if (!isApprovedMediaRegistryDomain(parsed.hostname.toLowerCase())) {
    return "News article URL is not from an approved media provider.";
  }

  if (
    isPlaceholderArticleUrl(record.articleUrl) ||
    isMediaRegistryWebsiteUrl(record.articleUrl)
  ) {
    return "News article URL must point to a specific publisher article.";
  }

  const provider = getMediaRegistryProviderByName(record.sourceName);

  if (!isSpecificMediaArticleUrl(record.articleUrl, provider)) {
    return "News article URL must point to a specific publisher article.";
  }

  return null;
}

export function resolveNewsProviderId(record: NewsArticleRecord): string | undefined {
  return getMediaRegistryProviderByName(record.sourceName)?.id;
}
