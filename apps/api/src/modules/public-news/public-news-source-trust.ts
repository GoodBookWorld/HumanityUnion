import net from "node:net";

import type { MediaResource } from "@hu/types";
import { getMediaRegistryProviderById } from "@hu/media-registry";

/**
 * RSS-SOURCE-02B — article-domain trust for Admin NEWS_SOURCE resources.
 *
 * An article from an Admin source is trusted only when its host equals, or is a
 * subdomain of, one of the source's approved domains: the website host, the
 * domains of a linked registry provider, or the explicit `articleDomains`.
 */

export const MAX_ARTICLE_DOMAINS = 10;

const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;

/** Second-level labels that form public suffixes such as co.uk or com.ua. */
const PUBLIC_SECOND_LEVEL_LABELS = new Set(["co", "com", "org", "net", "gov", "edu", "ac"]);

/**
 * Normalizes one approved domain: lowercase ASCII (punycode) hostname, no scheme,
 * port, path, leading `www.` or trailing dot. Returns null when the value is not a
 * registrable public hostname (IP literals, single labels and bare public suffixes
 * are refused because they would trust unrelated sites).
 */
export function normalizeApprovedDomain(value: string): string | null {
  const trimmed = value.trim().toLowerCase().replace(/\.$/, "");
  if (!trimmed || /[/:?#@\s\\]/.test(trimmed)) {
    return null;
  }

  let host: string;
  try {
    host = new URL(`https://${trimmed}`).hostname;
  } catch {
    return null;
  }

  host = host.replace(/^www\./, "");
  if (net.isIP(host) || !HOSTNAME_PATTERN.test(host)) {
    return null;
  }

  const labels = host.split(".");
  if (labels.length === 2 && PUBLIC_SECOND_LEVEL_LABELS.has(labels[0]!)) {
    return null;
  }

  return host;
}

function hostnameOf(url: string): string | null {
  try {
    return new URL(url.trim()).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
}

/** Exact host or a subdomain of `domain`; never a substring match. */
export function hostMatchesApprovedDomain(host: string, domain: string): boolean {
  const normalizedHost = host.toLowerCase().replace(/\.$/, "");
  const normalizedDomain = domain.toLowerCase();
  return normalizedHost === normalizedDomain || normalizedHost.endsWith(`.${normalizedDomain}`);
}

export function isUrlOnApprovedDomains(url: string, domains: readonly string[]): boolean {
  const host = hostnameOf(url);
  if (!host) {
    return false;
  }
  return domains.some((domain) => hostMatchesApprovedDomain(host, domain));
}

/**
 * Approved article domains of an Admin NEWS_SOURCE: its website host, the domains
 * of the registry provider it is linked to (backward compatibility for seeded
 * registry sources whose articles live on sister domains) and `articleDomains`.
 */
export function resolveSourceArticleDomains(
  resource: Pick<MediaResource, "websiteUrl" | "providerId" | "articleDomains">,
): string[] {
  const domains = new Set<string>();
  const websiteHost = hostnameOf(resource.websiteUrl);
  const normalizedWebsite = websiteHost ? normalizeApprovedDomain(websiteHost) : null;
  if (normalizedWebsite) {
    domains.add(normalizedWebsite);
  }

  const providerId = resource.providerId?.trim();
  const registryProvider = providerId ? getMediaRegistryProviderById(providerId) : undefined;
  for (const domain of registryProvider?.sourceDomains ?? []) {
    const normalized = normalizeApprovedDomain(domain);
    if (normalized) {
      domains.add(normalized);
    }
  }

  for (const domain of resource.articleDomains ?? []) {
    const normalized = normalizeApprovedDomain(domain);
    if (normalized) {
      domains.add(normalized);
    }
  }

  return [...domains];
}
