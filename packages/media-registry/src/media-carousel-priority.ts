/**
 * MEDIA-NEWS-01B — ordered priority publishers for the public /media news carousel.
 * A NEWS_SOURCE counts as one of these only when its verified website host equals,
 * or is a subdomain of, one of the publisher domains below; display names are never
 * used. List order breaks ties between equally recent articles.
 */
export interface MediaCarouselPrioritySource {
  key: string;
  /** Label for diagnostics only; never used for matching. */
  label: string;
  domains: readonly string[];
}

export const MEDIA_CAROUSEL_PRIORITY_SOURCES: readonly MediaCarouselPrioritySource[] = [
  { key: "reuters", label: "Reuters", domains: ["reuters.com"] },
  { key: "associated-press", label: "Associated Press", domains: ["apnews.com"] },
  { key: "euronews", label: "Euronews", domains: ["euronews.com"] },
  { key: "al-jazeera-english", label: "Al Jazeera English", domains: ["aljazeera.com"] },
  { key: "the-atlantic", label: "The Atlantic", domains: ["theatlantic.com"] },
  { key: "the-guardian", label: "The Guardian", domains: ["theguardian.com"] },
  { key: "new-york-times", label: "The New York Times", domains: ["nytimes.com"] },
  { key: "the-economist", label: "The Economist", domains: ["economist.com"] },
  { key: "washington-post", label: "The Washington Post", domains: ["washingtonpost.com"] },
  { key: "politico", label: "POLITICO", domains: ["politico.com", "politico.eu"] },
  { key: "cbc", label: "CBC", domains: ["cbc.ca"] },
  { key: "global-news", label: "Global News", domains: ["globalnews.ca"] },
];

function hostOf(url: string): string | null {
  try {
    return new URL(url.trim()).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
}

/**
 * The priority entry and its list position for a publisher website URL, or null.
 * Matching is exact host or subdomain (never a substring).
 */
export function resolveMediaCarouselPrioritySource(
  websiteUrl: string,
): { source: MediaCarouselPrioritySource; rank: number } | null {
  const host = hostOf(websiteUrl);
  if (!host) {
    return null;
  }
  for (const [rank, source] of MEDIA_CAROUSEL_PRIORITY_SOURCES.entries()) {
    if (source.domains.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
      return { source, rank };
    }
  }
  return null;
}
