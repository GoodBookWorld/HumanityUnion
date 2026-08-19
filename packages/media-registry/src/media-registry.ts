import type {
  ApprovedNewsSource,
  MediaRegistryCategory,
  MediaRegistryProvider,
  MediaRegistryRegionTag,
} from "@hu/types";

export const MEDIA_REGISTRY_CATEGORIES: readonly MediaRegistryCategory[] = [
  "democracy",
  "public participation",
  "human rights",
  "public health",
  "education",
  "climate resilience",
  "community development",
  "peace and security",
  "emergency response",
  "misinformation and media literacy",
  "social justice",
  "institutional accountability",
] as const;

export const MEDIA_REGISTRY_REGION_TAGS: readonly MediaRegistryRegionTag[] = [
  "global",
  "international",
  "europe",
  "americas",
  "africa",
  "asia-pacific",
  "middle-east",
] as const;

export const TRUSTED_GLOBAL_MEDIA_REGISTRY: readonly MediaRegistryProvider[] = [
  {
    id: "bbc-world",
    name: "BBC World",
    country: "United Kingdom",
    countryCode: "GB",
    language: "en",
    rssFeeds: [
      {
        url: "http://feeds.bbci.co.uk/news/world/rss.xml",
        defaultCategory: "peace and security",
      },
    ],
    logoUrl: "/images/media/bbc.webp",
    logoLabel: "BBC",
    website: "https://www.bbc.com/news/world",
    categories: ["peace and security", "democracy", "human rights"],
    priority: 1,
    reliabilityScore: 96,
    regionTags: ["global", "europe", "international"],
    sourceDomains: ["bbc.co.uk", "bbc.com"],
    aliases: ["BBC News", "BBC"],
    rssEnabled: true,
  },
  {
    id: "reuters",
    name: "Reuters",
    country: "International",
    language: "en",
    rssFeeds: [
      {
        url: "https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best",
        defaultCategory: "institutional accountability",
      },
    ],
    logoUrl: "/images/media/reuters.webp",
    logoLabel: "R",
    website: "https://www.reuters.com/",
    categories: ["institutional accountability", "peace and security", "democracy"],
    priority: 2,
    reliabilityScore: 97,
    regionTags: ["global", "international"],
    sourceDomains: ["reuters.com", "reutersagency.com"],
    rssEnabled: false,
    rssDisabledReason: "Configured feed returns HTTP 404.",
  },
  {
    id: "associated-press",
    name: "Associated Press",
    country: "United States",
    countryCode: "US",
    language: "en",
    rssFeeds: [
      {
        url: "https://apnews.com/apf-topnews?output=rss",
        defaultCategory: "democracy",
      },
    ],
    logoUrl: "/images/media/ap.webp",
    logoLabel: "AP",
    website: "https://apnews.com/",
    categories: ["democracy", "institutional accountability", "public participation"],
    priority: 3,
    reliabilityScore: 96,
    regionTags: ["global", "americas", "international"],
    sourceDomains: ["apnews.com", "ap.org"],
    rssEnabled: false,
    rssDisabledReason: "Public RSS endpoint returns HTML instead of a parseable feed.",
  },
  {
    id: "deutsche-welle",
    name: "DW",
    country: "Germany",
    countryCode: "DE",
    language: "en",
    rssFeeds: [
      {
        url: "https://rss.dw.com/xml/rss-en-world",
        defaultCategory: "peace and security",
      },
    ],
    logoUrl: "/images/media/dw.webp",
    logoLabel: "DW",
    website: "https://www.dw.com/en/",
    categories: ["peace and security", "democracy", "human rights"],
    priority: 4,
    reliabilityScore: 94,
    regionTags: ["global", "europe", "international"],
    sourceDomains: ["dw.com"],
    aliases: ["Deutsche Welle"],
    rssEnabled: true,
  },
  {
    id: "france24",
    name: "France24",
    country: "France",
    countryCode: "FR",
    language: "en",
    rssFeeds: [
      {
        url: "https://www.france24.com/en/rss",
        defaultCategory: "peace and security",
      },
    ],
    logoUrl: "/images/media/france24.webp",
    logoLabel: "F24",
    website: "https://www.france24.com/en/",
    categories: ["peace and security", "democracy", "human rights"],
    priority: 5,
    reliabilityScore: 93,
    regionTags: ["global", "europe", "africa", "middle-east", "international"],
    sourceDomains: ["france24.com"],
    rssEnabled: true,
  },
  {
    id: "euronews",
    name: "Euronews",
    country: "International",
    language: "en",
    rssFeeds: [
      {
        url: "https://www.euronews.com/rss?format=xml",
        defaultCategory: "democracy",
      },
    ],
    logoUrl: "/images/media/euronews.webp",
    logoLabel: "EN",
    website: "https://www.euronews.com/",
    categories: ["democracy", "peace and security", "climate resilience"],
    priority: 6,
    reliabilityScore: 92,
    regionTags: ["global", "europe", "international"],
    sourceDomains: ["euronews.com"],
    rssEnabled: true,
  },
  {
    id: "al-jazeera-english",
    name: "Al Jazeera English",
    country: "International",
    language: "en",
    rssFeeds: [
      {
        url: "https://www.aljazeera.com/xml/rss/all.xml",
        defaultCategory: "human rights",
      },
    ],
    logoUrl: "/images/media/aljazeera.webp",
    logoLabel: "AJ",
    website: "https://www.aljazeera.com/",
    categories: ["human rights", "peace and security", "democracy"],
    priority: 7,
    reliabilityScore: 91,
    regionTags: ["global", "middle-east", "africa", "asia-pacific", "international"],
    sourceDomains: ["aljazeera.com", "aljazeera.net"],
    aliases: ["Al Jazeera"],
    rssEnabled: true,
  },
  {
    id: "un-news",
    name: "UN News",
    country: "International",
    language: "en",
    rssFeeds: [
      {
        url: "https://news.un.org/feed/subscribe/en/news/all/rss.xml",
        defaultCategory: "institutional accountability",
      },
    ],
    logoUrl: "/images/media/un-news.webp",
    logoLabel: "UN",
    website: "https://news.un.org/en/",
    categories: ["institutional accountability", "human rights", "peace and security"],
    priority: 8,
    reliabilityScore: 95,
    regionTags: ["global", "international"],
    sourceDomains: ["news.un.org", "un.org"],
    rssEnabled: true,
  },
  {
    id: "who-news",
    name: "WHO News",
    country: "International",
    language: "en",
    rssFeeds: [
      {
        url: "https://www.who.int/rss-feeds/news-english.xml",
        defaultCategory: "public health",
      },
    ],
    logoUrl: "/images/media/who.webp",
    logoLabel: "WHO",
    website: "https://www.who.int/news",
    categories: ["public health", "emergency response", "education"],
    priority: 9,
    reliabilityScore: 95,
    regionTags: ["global", "international"],
    sourceDomains: ["who.int"],
    rssEnabled: true,
  },
  {
    id: "nasa-news",
    name: "NASA News",
    country: "United States",
    countryCode: "US",
    language: "en",
    rssFeeds: [
      {
        url: "https://www.nasa.gov/rss/dyn/breaking_news.rss",
        defaultCategory: "education",
      },
    ],
    logoUrl: "/images/media/nasa.webp",
    logoLabel: "NASA",
    website: "https://www.nasa.gov/news/",
    categories: ["education", "climate resilience", "community development"],
    priority: 10,
    reliabilityScore: 94,
    regionTags: ["global", "americas", "international"],
    sourceDomains: ["nasa.gov"],
    rssEnabled: true,
  },
  {
    id: "nature-news",
    name: "Nature News",
    country: "International",
    language: "en",
    rssFeeds: [
      {
        url: "https://www.nature.com/nature.rss",
        defaultCategory: "education",
      },
    ],
    logoUrl: "/images/media/nature.webp",
    logoLabel: "Nat",
    website: "https://www.nature.com/news",
    categories: ["education", "public health", "climate resilience"],
    priority: 11,
    reliabilityScore: 96,
    regionTags: ["global", "international"],
    sourceDomains: ["nature.com"],
    rssEnabled: true,
  },
  {
    id: "the-conversation",
    name: "The Conversation",
    country: "International",
    language: "en",
    rssFeeds: [
      {
        url: "https://theconversation.com/us/articles.atom",
        defaultCategory: "public participation",
      },
    ],
    logoUrl: "/images/media/the-conversation.webp",
    logoLabel: "TC",
    website: "https://theconversation.com/us",
    categories: ["public participation", "education", "misinformation and media literacy"],
    priority: 12,
    reliabilityScore: 93,
    regionTags: ["global", "americas", "international"],
    sourceDomains: ["theconversation.com"],
    rssEnabled: true,
  },
  {
    id: "the-guardian",
    name: "The Guardian",
    country: "United Kingdom",
    countryCode: "GB",
    language: "en",
    rssFeeds: [
      {
        url: "https://www.theguardian.com/international/rss",
        defaultCategory: "peace and security",
      },
    ],
    logoUrl: "/images/media/guardian.webp",
    logoLabel: "G",
    website: "https://www.theguardian.com/international",
    categories: ["peace and security", "democracy", "human rights"],
    priority: 13,
    reliabilityScore: 94,
    regionTags: ["global", "europe", "international"],
    sourceDomains: ["theguardian.com", "guardian.com"],
    aliases: ["Guardian"],
    rssEnabled: true,
  },
  {
    id: "the-economist",
    name: "The Economist",
    country: "United Kingdom",
    countryCode: "GB",
    language: "en",
    rssFeeds: [
      {
        url: "https://www.economist.com/international/rss.xml",
        defaultCategory: "institutional accountability",
      },
    ],
    logoUrl: "/images/media/the-economist.webp",
    logoLabel: "TE",
    website: "https://www.economist.com/international",
    categories: ["institutional accountability", "democracy", "peace and security"],
    priority: 14,
    reliabilityScore: 93,
    regionTags: ["global", "europe", "international"],
    sourceDomains: ["economist.com"],
    aliases: ["Economist"],
    rssEnabled: true,
  },
  {
    id: "washington-post",
    name: "The Washington Post",
    country: "United States",
    countryCode: "US",
    language: "en",
    rssFeeds: [
      {
        url: "https://feeds.washingtonpost.com/rss/opinions",
        defaultCategory: "democracy",
      },
    ],
    logoUrl: "/images/media/wpost.webp",
    logoLabel: "WP",
    website: "https://www.washingtonpost.com/",
    categories: ["democracy", "institutional accountability", "public participation"],
    priority: 15,
    reliabilityScore: 93,
    regionTags: ["global", "americas", "international"],
    sourceDomains: ["washingtonpost.com", "wapo.st"],
    aliases: ["Washington Post", "WaPo"],
    rssEnabled: true,
  },
  {
    id: "cbc",
    name: "CBC",
    country: "Canada",
    countryCode: "CA",
    language: "en",
    rssFeeds: [
      {
        url: "https://www.cbc.ca/webfeed/rss/rss-world",
        defaultCategory: "peace and security",
      },
    ],
    logoUrl: "/images/media/canada/cbc.webp",
    logoLabel: "CBC",
    website: "https://www.cbc.ca/news/world",
    categories: ["peace and security", "democracy", "public participation"],
    priority: 16,
    reliabilityScore: 93,
    regionTags: ["global", "americas", "international"],
    sourceDomains: ["cbc.ca"],
    aliases: ["CBC News"],
    rssEnabled: true,
  },
  {
    id: "politico",
    name: "POLITICO",
    country: "United States",
    countryCode: "US",
    language: "en",
    rssFeeds: [
      {
        url: "https://www.politico.com/rss/politicopicks.xml",
        defaultCategory: "democracy",
      },
    ],
    // Dedicated logo asset for the Trusted Media / discovery rails.
    logoUrl: "/images/media/politico.webp",
    logoLabel: "POL",
    website: "https://www.politico.com/",
    categories: ["democracy", "institutional accountability", "public participation"],
    priority: 17,
    reliabilityScore: 91,
    regionTags: ["global", "americas", "international"],
    sourceDomains: ["politico.com", "politico.eu"],
    aliases: ["Politico"],
    rssEnabled: true,
  },
  {
    id: "new-york-times",
    name: "The New York Times",
    country: "United States",
    countryCode: "US",
    language: "en",
    rssFeeds: [
      {
        url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
        defaultCategory: "peace and security",
      },
    ],
    logoUrl: "/images/media/nytimes.webp",
    logoLabel: "NYT",
    website: "https://www.nytimes.com/section/world",
    categories: ["peace and security", "democracy", "human rights"],
    priority: 18,
    reliabilityScore: 94,
    regionTags: ["global", "americas", "international"],
    sourceDomains: ["nytimes.com", "nyti.ms"],
    aliases: ["New York Times", "NYT", "NY Times"],
    rssEnabled: true,
  },
] as const;

export const MEDIA_REGISTRY_UPDATED_AT = "2026-08-13T00:00:00.000Z";

export function deriveApprovedNewsSources(
  providers: readonly MediaRegistryProvider[] = listEnabledMediaRegistryProviders(),
): ApprovedNewsSource[] {
  return providers.flatMap((provider) =>
    provider.rssFeeds.map((feed) => ({
      providerId: provider.id,
      sourceName: provider.name,
      sourceDomain: provider.sourceDomains[0] ?? "",
      rssFeedUrl: feed.url,
      language: provider.language,
      category: feed.defaultCategory ?? provider.categories[0] ?? "democracy",
    })),
  );
}

export function getMediaRegistryProviderById(
  providerId: string,
  providers: readonly MediaRegistryProvider[] = TRUSTED_GLOBAL_MEDIA_REGISTRY,
): MediaRegistryProvider | undefined {
  return providers.find((provider) => provider.id === providerId);
}

export function getMediaRegistryProviderByName(
  sourceName: string,
  providers: readonly MediaRegistryProvider[] = TRUSTED_GLOBAL_MEDIA_REGISTRY,
): MediaRegistryProvider | undefined {
  const normalized = sourceName.trim().toLowerCase();

  return providers.find((provider) => {
    if (provider.name.toLowerCase() === normalized) {
      return true;
    }

    return provider.aliases?.some((alias) => alias.toLowerCase() === normalized) ?? false;
  });
}

export function resolveMediaRegistryProviderForArticle(
  sourceName: string,
  articleUrl: string,
  providers: readonly MediaRegistryProvider[] = TRUSTED_GLOBAL_MEDIA_REGISTRY,
): MediaRegistryProvider | undefined {
  const byName = getMediaRegistryProviderByName(sourceName, providers);

  if (byName) {
    return byName;
  }

  let hostname = "";

  try {
    hostname = new URL(articleUrl).hostname.toLowerCase();
  } catch {
    return undefined;
  }

  return providers.find((provider) =>
    provider.sourceDomains.some(
      (domain) =>
        hostname === domain || hostname.endsWith(`.${domain}`) || hostname.includes(domain),
    ),
  );
}

export function isApprovedMediaRegistryDomain(
  sourceDomain: string | undefined,
  providers: readonly MediaRegistryProvider[] = TRUSTED_GLOBAL_MEDIA_REGISTRY,
): boolean {
  if (!sourceDomain) {
    return false;
  }

  const normalized = sourceDomain.toLowerCase();

  return providers.some((provider) =>
    provider.sourceDomains.some(
      (domain) =>
        normalized === domain ||
        normalized.endsWith(`.${domain}`) ||
        normalized.includes(domain),
    ),
  );
}

function normalizeComparableUrl(value: string): string | undefined {
  try {
    const parsed = new URL(value.trim());
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return undefined;
  }
}

export function isMediaRegistryWebsiteUrl(
  articleUrl: string,
  providers: readonly MediaRegistryProvider[] = TRUSTED_GLOBAL_MEDIA_REGISTRY,
): boolean {
  const normalizedArticleUrl = normalizeComparableUrl(articleUrl);

  if (!normalizedArticleUrl) {
    return false;
  }

  return providers.some((provider) => {
    const normalizedWebsite = normalizeComparableUrl(provider.website);
    return normalizedWebsite === normalizedArticleUrl;
  });
}

const FEED_PATH_PATTERN = /\/(?:feed|rss|atom)(?:\/|$|[?#])/i;

function parseArticleUrl(value: string): URL | undefined {
  try {
    return new URL(value.trim());
  } catch {
    return undefined;
  }
}

function isSearchResultsUrl(parsed: URL): boolean {
  const path = parsed.pathname.toLowerCase();
  const search = parsed.search.toLowerCase();

  return (
    path.includes("/search") ||
    search.includes("search=") ||
    search.includes("?s=") ||
    search.includes("&s=")
  );
}

function isFeedDocumentUrl(parsed: URL): boolean {
  const path = parsed.pathname.toLowerCase();

  if (path.endsWith(".xml") || path.endsWith(".rss") || path.endsWith(".atom")) {
    return true;
  }

  return FEED_PATH_PATTERN.test(`${parsed.pathname}${parsed.search}`);
}

function isGenericPublicationIndexUrl(parsed: URL): boolean {
  const path = parsed.pathname.replace(/\/$/, "").toLowerCase();
  const segments = path.split("/").filter(Boolean);

  if (segments.length === 0) {
    return true;
  }

  if (segments.length === 1 && ["en", "english", "news"].includes(segments[0] ?? "")) {
    return true;
  }

  if (segments.length === 2 && segments[0] === "en" && segments[1] === "news") {
    return true;
  }

  if (path === "/news" || path.endsWith("/news")) {
    const lastSegment = segments.at(-1);

    if (lastSegment === "news" && !path.includes("/news/item/") && !path.includes("/news/articles/")) {
      return segments.length <= 2;
    }
  }

  return false;
}

function hasArticleSlugPath(path: string): boolean {
  const segments = path.split("/").filter(Boolean);

  if (segments.length === 0) {
    return false;
  }

  if (segments.length >= 2) {
    return true;
  }

  const slug = segments[0] ?? "";

  return /\d{3,}/.test(slug) || slug.length >= 16;
}

function isProviderSpecificArticleUrl(
  parsed: URL,
  provider: MediaRegistryProvider | undefined,
): boolean {
  const path = parsed.pathname.toLowerCase();
  const segments = path.split("/").filter(Boolean);

  if (provider?.id === "who-news") {
    return path.includes("/news/item/");
  }

  if (provider?.id === "deutsche-welle") {
    return /\/a-\d+/i.test(path) || /\/live-\d+/i.test(path);
  }

  if (provider?.id === "un-news") {
    return path.includes("/story/");
  }

  if (provider?.id === "bbc-world") {
    return path.includes("/articles/") || path.includes("/news/world-");
  }

  if (provider?.id === "nature-news") {
    return path.includes("/articles/");
  }

  if (provider?.id === "the-conversation") {
    return hasArticleSlugPath(path);
  }

  if (provider?.id === "the-guardian") {
    return segments.length >= 2;
  }

  if (provider?.id === "cbc") {
    return path.includes("/news/") || hasArticleSlugPath(path);
  }

  if (provider?.id === "washington-post") {
    return segments.length >= 2;
  }

  if (provider?.id === "new-york-times") {
    return segments.length >= 2;
  }

  if (provider?.id === "politico" || provider?.id === "the-economist") {
    return hasArticleSlugPath(path) || segments.length >= 2;
  }

  return hasArticleSlugPath(path);
}

/** Explicit allow-list of registry RSS/Atom feed URLs — never accept client-supplied feed URLs. */
export function listApprovedMediaRegistryFeedUrls(
  providers: readonly MediaRegistryProvider[] = listEnabledMediaRegistryProviders(),
): readonly string[] {
  const urls = new Set<string>();

  for (const provider of providers) {
    for (const feed of provider.rssFeeds) {
      const normalized = normalizeComparableUrl(feed.url);
      if (normalized) {
        urls.add(normalized);
      }
    }
  }

  return [...urls];
}

export function isApprovedMediaRegistryFeedUrl(
  feedUrl: string,
  providers: readonly MediaRegistryProvider[] = listEnabledMediaRegistryProviders(),
): boolean {
  const normalized = normalizeComparableUrl(feedUrl);
  if (!normalized) {
    return false;
  }

  return listApprovedMediaRegistryFeedUrls(providers).includes(normalized);
}

/** Returns false when the URL is a homepage, search page, feed, or other non-article destination. */
export function isSpecificMediaArticleUrl(
  articleUrl: string,
  provider?: MediaRegistryProvider,
): boolean {
  const parsed = parseArticleUrl(articleUrl);

  if (!parsed) {
    return false;
  }

  if (isMediaRegistryWebsiteUrl(articleUrl)) {
    return false;
  }

  if (isSearchResultsUrl(parsed) || isFeedDocumentUrl(parsed) || isGenericPublicationIndexUrl(parsed)) {
    return false;
  }

  return isProviderSpecificArticleUrl(parsed, provider);
}

export function listEnabledMediaRegistryProviders(
  providers: readonly MediaRegistryProvider[] = TRUSTED_GLOBAL_MEDIA_REGISTRY,
): MediaRegistryProvider[] {
  return providers.filter((provider) => provider.rssEnabled !== false);
}

export function getEnabledMediaRegistryProviderById(
  providerId: string,
  providers: readonly MediaRegistryProvider[] = TRUSTED_GLOBAL_MEDIA_REGISTRY,
): MediaRegistryProvider | undefined {
  const provider = getMediaRegistryProviderById(providerId, providers);

  if (!provider || provider.rssEnabled === false) {
    return undefined;
  }

  return provider;
}
