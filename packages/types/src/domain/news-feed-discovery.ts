/**
 * RSS-SOURCE-02C — Admin RSS/Atom discovery for NEWS_SOURCE resources. Discovery only
 * reads the source website and the feeds it advertises; nothing is saved until an
 * Admin confirms a candidate.
 */

export type NewsFeedDiscoveryStatus =
  /** At least one advertised feed is valid. */
  | "found"
  /** The website advertises no RSS/Atom feed. */
  | "no_feed_advertised"
  /** Feeds are advertised but none passed validation. */
  | "no_valid_feed"
  /** The website itself could not be read safely. */
  | "website_unreachable";

export type NewsFeedCandidateReason =
  | "not_https"
  | "comments_feed"
  | "not_checked"
  | "http_error"
  | "timeout"
  | "network_error"
  | "response_too_large"
  | "blocked_host"
  | "too_many_redirects"
  | "unsupported_content_type"
  | "invalid_feed"
  | "no_valid_articles"
  | "unknown_error";

/**
 * RSS-SOURCE-02C.1 — how well a feed found on a news section page corresponds to that
 * section. Only `section_match` (several independent signals agree) claims coverage.
 */
export type NewsFeedSectionMatch = "section_match" | "uncertain" | "general_feed";

export interface NewsFeedDiscoveryCandidate {
  feedUrl: string;
  feedHost: string;
  /** Channel/feed title as published (publisher), or the advertised link title. */
  title: string | null;
  format: "rss" | "atom" | null;
  valid: boolean;
  reason: NewsFeedCandidateReason | null;
  /** Fixed, sanitized explanation; never raw exception text. */
  message: string | null;
  httpStatus: number | null;
  /** Parsed items whose links are articles on the source's approved domains. */
  sampleArticleCount: number;
  /** Up to three of those article URLs, as evidence for the Admin. */
  sampleArticleUrls: string[];
  latestPublishedAt: string | null;
  recommended: boolean;
  /** Section discovery only (null otherwise or for unusable feeds). */
  sectionMatch: NewsFeedSectionMatch | null;
  /** Plain-language reasons behind `sectionMatch`. */
  sectionEvidence: string[];
}

export interface NewsFeedDiscoveryResult {
  status: NewsFeedDiscoveryStatus;
  websiteUrl: string;
  /** Set when discovery read a news section page instead of the website. */
  newsSectionUrl: string | null;
  /** The page whose advertised feeds were checked. */
  discoveryPageUrl: string;
  message: string;
  candidates: NewsFeedDiscoveryCandidate[];
  recommendedFeedUrl: string | null;
  /** The resource's saved RSS URL, checked the same way (existing resources only). */
  current: NewsFeedDiscoveryCandidate | null;
  checkedAt: string;
}
