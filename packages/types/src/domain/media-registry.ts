/** Curated civic news category labels shared by registry providers and public news. */
export type MediaRegistryCategory =
  | "democracy"
  | "public participation"
  | "human rights"
  | "public health"
  | "education"
  | "climate resilience"
  | "community development"
  | "peace and security"
  | "emergency response"
  | "misinformation and media literacy"
  | "social justice"
  | "institutional accountability";

export type MediaRegistryRegionTag =
  | "global"
  | "europe"
  | "americas"
  | "africa"
  | "asia-pacific"
  | "middle-east"
  | "international";

export interface MediaRegistryRssFeed {
  url: string;
  /** Default category when the feed item does not specify one. */
  defaultCategory?: MediaRegistryCategory;
}

/** Trusted global media provider entry — canonical registry record. */
export interface MediaRegistryProvider {
  id: string;
  name: string;
  country: string;
  /** ISO 3166-1 alpha-2 code when the provider is country-scoped. */
  countryCode?: string;
  language: string;
  rssFeeds: MediaRegistryRssFeed[];
  /**
   * Local public asset path, e.g. /images/media/bbc.webp — never hotlink external logos.
   * Omit when no appropriate asset exists; UI uses logoLabel text fallback.
   */
  logoUrl?: string;
  logoLabel: string;
  website: string;
  categories: MediaRegistryCategory[];
  priority: number;
  /** Editorial reliability score on a 0–100 scale. */
  reliabilityScore: number;
  regionTags: MediaRegistryRegionTag[];
  /** Approved article hostname suffixes used for URL validation. */
  sourceDomains: string[];
  /** Legacy or alternate source labels that may appear on ingested articles. */
  aliases?: string[];
  /** When false, RSS ingestion skips this provider until the feed is verified again. */
  rssEnabled?: boolean;
  /** Human-readable reason when rssEnabled is false. */
  rssDisabledReason?: string;
}

export interface MediaRegistryFilter {
  provider?: string;
  country?: string;
  language?: string;
  category?: string;
  region?: string;
}

export interface MediaRegistryListing {
  providers: MediaRegistryProvider[];
  categories: MediaRegistryCategory[];
  regionTags: MediaRegistryRegionTag[];
  updatedAt: string;
}

/** RSS ingestion source derived from the registry — not authored separately. */
export interface ApprovedNewsSource {
  providerId: string;
  sourceName: string;
  sourceDomain: string;
  rssFeedUrl: string;
  language: string;
  category: MediaRegistryCategory;
}
