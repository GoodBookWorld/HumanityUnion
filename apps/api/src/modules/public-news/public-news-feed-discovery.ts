import type {
  NewsFeedCandidateReason,
  NewsFeedDiscoveryCandidate,
  NewsFeedDiscoveryResult,
  NewsFeedSectionMatch,
} from "@hu/types";
import { getMediaRegistryProviderById, isSpecificMediaArticleUrl } from "@hu/media-registry";

import { mapWithConcurrency } from "./providers/rss-news.provider.js";
import { classifySourceFetchError } from "./public-news-source-health.js";
import { isUrlOnApprovedDomains, resolveSourceArticleDomains } from "./public-news-source-trust.js";
import { resolvePublicNewsConfig } from "./public-news.config.js";
import { fetchExternalDocument } from "./public-news.fetch.js";
import { parseRssOrAtomFeed } from "./public-news.rss-parser.js";

/**
 * RSS-SOURCE-02C — discovers the RSS/Atom feeds a news website officially advertises
 * (`<link rel="alternate" type="application/rss+xml|atom+xml">`) and verifies each
 * one. Only the Admin-entered website and the feeds it advertises are fetched, through
 * the hardened fetcher; feed URLs are never guessed and nothing is persisted here.
 */

const FEED_LINK_TYPES = new Set([
  "application/rss+xml",
  "application/atom+xml",
  "application/rdf+xml",
]);
const DEFAULT_TIMEOUTS = { websiteMs: 8_000, feedMs: 8_000 };
let timeouts = { ...DEFAULT_TIMEOUTS };
const WEBSITE_MAX_BYTES = 1024 * 1024;

/** Tests only: shorter per-request deadlines. */
export function setNewsFeedDiscoveryTimeoutsForTests(
  override: { websiteMs: number; feedMs: number } | null,
): void {
  timeouts = override ? { ...override } : { ...DEFAULT_TIMEOUTS };
}
/** Advertised feeds checked per discovery. */
export const MAX_DISCOVERY_CANDIDATES = 5;
const CANDIDATE_CONCURRENCY = 2;
/** Total wall-clock budget; remaining candidates are reported as not checked. */
const DISCOVERY_BUDGET_MS = 30_000;
const FRESH_FEED_MS = 7 * 86_400_000;

/** Per-Admin limit and global concurrency for discovery and confirmation checks. */
export const NEWS_FEED_DISCOVERY_RATE_LIMIT = { maxRequests: 10, windowMs: 10 * 60_000 };
export const NEWS_FEED_DISCOVERY_MAX_CONCURRENT = 2;

export class NewsFeedDiscoveryRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NewsFeedDiscoveryRateLimitError";
  }
}

const requestsByActor = new Map<string, number[]>();
let activeDiscoveries = 0;

export function resetNewsFeedDiscoveryLimitsForTests(): void {
  requestsByActor.clear();
  activeDiscoveries = 0;
}

/**
 * Counts one discovery operation for `actorId` and reserves a concurrency slot.
 * Returns the release function; throws when either limit is reached.
 */
export function acquireNewsFeedDiscoverySlot(actorId: string, now = Date.now()): () => void {
  const recent = (requestsByActor.get(actorId) ?? []).filter(
    (at) => now - at < NEWS_FEED_DISCOVERY_RATE_LIMIT.windowMs,
  );
  if (recent.length >= NEWS_FEED_DISCOVERY_RATE_LIMIT.maxRequests) {
    requestsByActor.set(actorId, recent);
    throw new NewsFeedDiscoveryRateLimitError(
      "RSS discovery limit reached. Please wait a few minutes before trying again.",
    );
  }
  if (activeDiscoveries >= NEWS_FEED_DISCOVERY_MAX_CONCURRENT) {
    throw new NewsFeedDiscoveryRateLimitError(
      "RSS discovery is busy. Please try again in a moment.",
    );
  }
  recent.push(now);
  requestsByActor.set(actorId, recent);
  activeDiscoveries += 1;
  let released = false;
  return () => {
    if (!released) {
      released = true;
      activeDiscoveries -= 1;
    }
  };
}

/** HTTPS, no credentials; the hardened fetcher enforces public addresses. */
export function parseHttpsDiscoveryUrl(value: string): URL | null {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      return null;
    }
    parsed.hash = "";
    return parsed;
  } catch {
    return null;
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function readHtmlAttribute(tag: string, name: string): string | undefined {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i").exec(
    tag,
  );
  const raw = match?.[1] ?? match?.[2] ?? match?.[3];
  return raw === undefined ? undefined : decodeHtmlEntities(raw).trim();
}

export interface AdvertisedFeedLink {
  url: string;
  title: string | null;
}

/** Feed links advertised via `<link rel="alternate">`, resolved against the page URL. */
export function extractAdvertisedFeedLinks(html: string, pageUrl: string): AdvertisedFeedLink[] {
  const links: AdvertisedFeedLink[] = [];
  const seen = new Set<string>();
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = (readHtmlAttribute(tag, "rel") ?? "").toLowerCase().split(/\s+/);
    const type = (readHtmlAttribute(tag, "type") ?? "").toLowerCase().split(";")[0]!.trim();
    const href = readHtmlAttribute(tag, "href");
    if (!rel.includes("alternate") || !FEED_LINK_TYPES.has(type) || !href) {
      continue;
    }
    let resolved: URL;
    try {
      resolved = new URL(href, pageUrl);
    } catch {
      continue;
    }
    resolved.hash = "";
    const url = resolved.toString();
    if (seen.has(url)) {
      continue;
    }
    seen.add(url);
    links.push({ url, title: readHtmlAttribute(tag, "title") || null });
  }
  return links;
}

function isCommentsFeed(link: AdvertisedFeedLink): boolean {
  return /comments?\b/i.test(link.title ?? "") || /\/comments?\/(?:feed|rss)/i.test(link.url);
}

function readFeedTitle(xml: string): string | null {
  const head = xml.split(/<(?:item|entry)\b/i)[0] ?? "";
  const raw = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1];
  if (!raw) {
    return null;
  }
  const text = decodeHtmlEntities(raw.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1"))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, 160) : null;
}

function detectFeedFormat(xml: string): "rss" | "atom" | null {
  if (/<rss\b|<rdf:RDF\b/i.test(xml)) {
    return "rss";
  }
  return /<feed\b/i.test(xml) ? "atom" : null;
}

export interface FeedValidationContext {
  websiteUrl: string;
  providerId?: string | null;
  articleDomains?: readonly string[] | null;
}

function emptyCandidate(feedUrl: string, title: string | null): NewsFeedDiscoveryCandidate {
  let feedHost = "";
  try {
    feedHost = new URL(feedUrl).hostname;
  } catch {
    // Kept empty for unparsable URLs.
  }
  return {
    feedUrl,
    feedHost,
    title,
    format: null,
    valid: false,
    reason: null,
    message: null,
    httpStatus: null,
    sampleArticleCount: 0,
    sampleArticleUrls: [],
    latestPublishedAt: null,
    recommended: false,
    sectionMatch: null,
    sectionEvidence: [],
  };
}

const REASON_MESSAGES: Partial<Record<NewsFeedCandidateReason, string>> = {
  not_https: "Only HTTPS feeds can be used.",
  comments_feed: "This is a comments feed, not a news feed.",
  not_checked: "Not checked: the discovery time limit was reached.",
  invalid_feed: "The address did not return a readable RSS or Atom feed.",
  no_valid_articles: "The feed has no entries linking to articles on this source's website.",
};

/**
 * Fetches and parses one feed and counts entries that are articles on the source's
 * approved domains (same domain trust as ingestion).
 */
export async function checkNewsFeedCandidate(
  feedUrl: string,
  context: FeedValidationContext,
  advertisedTitle: string | null = null,
): Promise<NewsFeedDiscoveryCandidate> {
  return (await inspectNewsFeedCandidate(feedUrl, context, advertisedTitle)).candidate;
}

interface InspectedFeed {
  candidate: NewsFeedDiscoveryCandidate;
  /** Every entry URL that counted as an article (section matching evidence). */
  articleUrls: string[];
}

async function inspectNewsFeedCandidate(
  feedUrl: string,
  context: FeedValidationContext,
  advertisedTitle: string | null,
): Promise<InspectedFeed> {
  const inspected = await inspectFeedDocument(feedUrl, context, advertisedTitle);
  return {
    candidate: { ...inspected.candidate, sampleArticleUrls: inspected.articleUrls.slice(0, 3) },
    articleUrls: inspected.articleUrls,
  };
}

async function inspectFeedDocument(
  feedUrl: string,
  context: FeedValidationContext,
  advertisedTitle: string | null,
): Promise<InspectedFeed> {
  const candidate = emptyCandidate(feedUrl, advertisedTitle);
  const none = (result: NewsFeedDiscoveryCandidate): InspectedFeed => ({
    candidate: result,
    articleUrls: [],
  });
  if (!parseHttpsDiscoveryUrl(feedUrl)) {
    return none({ ...candidate, reason: "not_https", message: REASON_MESSAGES.not_https! });
  }

  let xml: string;
  try {
    xml = await fetchExternalDocument(feedUrl, {
      timeoutMs: timeouts.feedMs,
      maxBytes: resolvePublicNewsConfig().maxResponseBytes,
      onStatus: (status) => {
        candidate.httpStatus = status;
      },
    });
  } catch (error) {
    const summary = classifySourceFetchError(error);
    const reason = (
      summary.code === "unapproved_feed" ? "unknown_error" : summary.code
    ) as NewsFeedCandidateReason;
    return none({
      ...candidate,
      reason,
      message: summary.message,
      httpStatus: summary.httpStatus ?? candidate.httpStatus,
    });
  }

  const format = detectFeedFormat(xml);
  const items = format ? parseRssOrAtomFeed(xml, feedUrl) : [];
  const title = readFeedTitle(xml) ?? advertisedTitle;
  if (!format || items.length === 0) {
    return none({
      ...candidate,
      title,
      format,
      reason: "invalid_feed",
      message: REASON_MESSAGES.invalid_feed!,
    });
  }

  const domains = resolveSourceArticleDomains({
    websiteUrl: context.websiteUrl,
    providerId: context.providerId ?? null,
    articleDomains: context.articleDomains ? [...context.articleDomains] : null,
  });
  const registryProvider = context.providerId
    ? getMediaRegistryProviderById(context.providerId)
    : undefined;
  const articles = items.filter(
    (item) =>
      isUrlOnApprovedDomains(item.articleUrl, domains) &&
      isSpecificMediaArticleUrl(item.articleUrl, registryProvider) &&
      !Number.isNaN(Date.parse(item.publishedAt)),
  );
  const latest = articles.reduce<number | null>((max, item) => {
    const at = Date.parse(item.publishedAt);
    return max === null || at > max ? at : max;
  }, null);

  return {
    candidate: {
      ...candidate,
      title,
      format,
      valid: articles.length > 0,
      reason: articles.length > 0 ? null : "no_valid_articles",
      message: articles.length > 0 ? null : REASON_MESSAGES.no_valid_articles!,
      sampleArticleCount: articles.length,
      latestPublishedAt: latest === null ? null : new Date(latest).toISOString(),
    },
    articleUrls: articles.map((item) => item.articleUrl),
  };
}

/** Words that name no particular section (and URL noise). */
const SECTION_STOPWORDS = new Set([
  "news",
  "latest",
  "home",
  "index",
  "html",
  "htm",
  "php",
  "aspx",
  "www",
  "section",
  "sections",
  "category",
  "categories",
  "topic",
  "topics",
  "tag",
  "tags",
  "rubric",
  "rubrics",
  "articles",
  "article",
  "page",
  "feed",
  "feeds",
  "rss",
  "atom",
  "xml",
  "the",
  "and",
  "all",
  "eng",
  "online",
  "today",
  "live",
  "top",
  "main",
]);

function sectionTokens(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .normalize("NFKC")
        .split(/[^\p{L}\p{N}]+/u)
        .filter(
          (token) => token.length >= 3 && !/^\d+$/.test(token) && !SECTION_STOPWORDS.has(token),
        ),
    ),
  ];
}

/** The section heading from og:title or <title> ("World news | Publisher" → "World news"). */
export function readSectionPageTitle(html: string): string | null {
  const og = /<meta\b[^>]*property=["']og:title["'][^>]*>/i.exec(html)?.[0];
  const raw =
    (og ? readHtmlAttribute(og, "content") : undefined) ??
    /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  if (!raw) {
    return null;
  }
  const head = decodeHtmlEntities(raw)
    .split(/\s[|–—-]\s|:\s/)[0]
    ?.trim();
  return head ? head.slice(0, 120) : null;
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

export interface SectionMatchInput {
  newsSectionUrl: string;
  sectionPageTitle: string | null;
  feedUrl: string;
  feedTitles: readonly (string | null)[];
  articleUrls: readonly string[];
}

/**
 * Classifies a feed against a news section from independent signals: the section's
 * name in the feed URL, in the feed title, and where its sample articles live. Being
 * advertised on the section page is not evidence by itself. `section_match` needs two
 * agreeing signals and no contradiction from the sample articles.
 */
export function classifyFeedForSection(input: SectionMatchInput): {
  sectionMatch: NewsFeedSectionMatch;
  sectionEvidence: string[];
} {
  let publisherLabels: string[] = [];
  try {
    publisherLabels = new URL(input.newsSectionUrl).hostname.toLowerCase().split(".");
  } catch {
    // No host labels to exclude.
  }
  const sectionPath = pathOf(input.newsSectionUrl);
  // Publisher names are not section names ("kyiv" in kyivindependent.com).
  const isPublisherWord = (token: string) =>
    publisherLabels.some((label) => label.length >= 4 && label.includes(token));
  const tokens = [
    ...new Set([...sectionTokens(sectionPath), ...sectionTokens(input.sectionPageTitle ?? "")]),
  ].filter((token) => !isPublisherWord(token));
  const evidence: string[] = [];

  if (tokens.length === 0 && !sectionPath) {
    return {
      sectionMatch: "uncertain",
      sectionEvidence: ["The section URL has no distinctive path or title to compare against."],
    };
  }

  const feedPath = pathOf(input.feedUrl);
  const feedPathTokens = sectionTokens(feedPath);
  const pathHit = tokens.find((token) => feedPathTokens.includes(token));
  const pathSignal =
    Boolean(pathHit) || (sectionPath !== "" && feedPath.startsWith(`${sectionPath}/`));
  evidence.push(
    pathSignal
      ? `Feed URL path matches the section${pathHit ? ` (“${pathHit}”)` : ""}.`
      : "Feed URL path does not mention the section.",
  );

  const feedTitleText = input.feedTitles.filter(Boolean).join(" ");
  const titleTokens = sectionTokens(feedTitleText);
  const titleHit = tokens.find((token) => titleTokens.includes(token));
  // Section page metadata: the feed title repeats the page's own heading ("UK news"),
  // and that heading names the section path (/uk-news), not just the publisher.
  const words = (text: string) =>
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length >= 2 && !SECTION_STOPWORDS.has(word));
  const headingWords = words(input.sectionPageTitle ?? "");
  const pathWords = words(sectionPath);
  const feedTitleWords = words(feedTitleText);
  const headingHit =
    headingWords.length > 0 &&
    headingWords.some((word) => pathWords.includes(word) && !isPublisherWord(word)) &&
    headingWords.every((word) => feedTitleWords.includes(word));
  evidence.push(
    titleHit
      ? `Feed title mentions the section (“${titleHit}”).`
      : headingHit
        ? `Feed title matches the section page title (“${input.sectionPageTitle}”).`
        : "Feed title does not mention the section.",
  );

  const inSection = input.articleUrls.filter((url) => {
    const path = pathOf(url);
    return (
      (sectionPath !== "" && path.startsWith(`${sectionPath}/`)) ||
      sectionTokens(path).some((token) => tokens.includes(token))
    );
  }).length;
  const total = input.articleUrls.length;
  const share = total > 0 ? inSection / total : 0;
  // Article paths count against a feed only where the site's URLs show sections
  // (e.g. /world/2026/…); /news/<id>/<slug> URLs say nothing about the section.
  const sectioned = input.articleUrls.filter((url) => {
    const first = pathOf(url).split("/").filter(Boolean)[0] ?? "";
    return sectionTokens(first).length > 0;
  }).length;
  const urlsShowSections = total > 0 && sectioned / total >= 0.5;
  const articleSignal = total > 0 && share >= 0.6;
  const contradicted = urlsShowSections && total >= 5 && share < 0.2;
  if (total > 0) {
    evidence.push(
      urlsShowSections || articleSignal
        ? `${inSection} of ${total} sample articles are within the section.`
        : `${inSection} of ${total} sample articles are within the section; this site's article URLs do not show sections, so this is not counted against the feed.`,
    );
  }

  const signals =
    Number(pathSignal) + Number(Boolean(titleHit) || headingHit) + Number(articleSignal);
  const sectionMatch: NewsFeedSectionMatch =
    signals >= 2 && !contradicted ? "section_match" : signals === 0 ? "general_feed" : "uncertain";
  return { sectionMatch, sectionEvidence: evidence };
}

const SECTION_MATCH_RANK: Record<NewsFeedSectionMatch, number> = {
  section_match: 0,
  uncertain: 1,
  general_feed: 2,
};

/**
 * Re-verifies a feed for Admin confirmation, including its section classification when
 * the source has a news section (the section page is read again for its title).
 */
export async function verifyNewsFeedForConfirmation(input: {
  feedUrl: string;
  context: FeedValidationContext;
  newsSectionUrl: string | null;
}): Promise<NewsFeedDiscoveryCandidate> {
  const inspected = await inspectNewsFeedCandidate(input.feedUrl, input.context, null);
  if (!input.newsSectionUrl || !inspected.candidate.valid) {
    return inspected.candidate;
  }
  let sectionPageTitle: string | null = null;
  try {
    sectionPageTitle = readSectionPageTitle(
      await fetchExternalDocument(input.newsSectionUrl, {
        timeoutMs: timeouts.websiteMs,
        maxBytes: WEBSITE_MAX_BYTES,
        truncateAtMaxBytes: true,
      }),
    );
  } catch {
    // Classified from the URL and the feed alone.
  }
  return {
    ...inspected.candidate,
    ...classifyFeedForSection({
      newsSectionUrl: input.newsSectionUrl,
      sectionPageTitle,
      feedUrl: input.feedUrl,
      feedTitles: [inspected.candidate.title],
      articleUrls: inspected.articleUrls,
    }),
  };
}

const STATUS_MESSAGES: Record<NewsFeedDiscoveryResult["status"], string> = {
  found: "Official feed found. Review it and confirm to use it.",
  no_feed_advertised: "The website does not advertise an RSS or Atom feed.",
  no_valid_feed: "The website advertises feeds, but none could be verified.",
  website_unreachable: "The website could not be read for RSS discovery.",
};

const SECTION_STATUS_MESSAGES: Record<NewsFeedDiscoveryResult["status"], string> = {
  found: "Section feed found. Review it and confirm to use it.",
  no_feed_advertised:
    "The news section page does not advertise an RSS or Atom feed. No section-specific feed was found; the main website was not checked.",
  no_valid_feed: "The news section page advertises feeds, but none could be verified.",
  website_unreachable: "The news section page could not be read for RSS discovery.",
};
const SECTION_NOT_CONFIRMED_MESSAGE =
  "Feeds were found on the news section page, but none is confirmed as specific to this section. Unrelated news may appear if you use one.";

/**
 * Valid feeds first; with a news section, closer section matches next; then recently
 * updated feeds; then the site's own order.
 */
function rankCandidates(
  candidates: NewsFeedDiscoveryCandidate[],
  now: number,
): NewsFeedDiscoveryCandidate[] {
  const fresh = (candidate: NewsFeedDiscoveryCandidate) =>
    candidate.latestPublishedAt !== null &&
    now - Date.parse(candidate.latestPublishedAt) <= FRESH_FEED_MS;
  const matchRank = (candidate: NewsFeedDiscoveryCandidate) =>
    candidate.sectionMatch ? SECTION_MATCH_RANK[candidate.sectionMatch] : 0;
  return candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort(
      (left, right) =>
        Number(right.candidate.valid) - Number(left.candidate.valid) ||
        matchRank(left.candidate) - matchRank(right.candidate) ||
        Number(fresh(right.candidate)) - Number(fresh(left.candidate)) ||
        left.index - right.index,
    )
    .map(({ candidate }) => candidate);
}

export async function discoverNewsSourceFeeds(input: {
  websiteUrl: string;
  /** Already validated against the source's domains; replaces the website as the page read. */
  newsSectionUrl?: string | null;
  currentRssUrl?: string | null;
  providerId?: string | null;
  articleDomains?: readonly string[] | null;
  now?: Date;
}): Promise<NewsFeedDiscoveryResult> {
  const startedAt = Date.now();
  const now = input.now ?? new Date();
  const context: FeedValidationContext = {
    websiteUrl: input.websiteUrl,
    providerId: input.providerId ?? null,
    articleDomains: input.articleDomains ?? null,
  };
  const newsSectionUrl = input.newsSectionUrl?.trim() || null;
  // A section page that fails is reported as such; the homepage is never used instead.
  const pageUrl = newsSectionUrl ?? input.websiteUrl;

  let html: string | null = null;
  let finalUrl = pageUrl;
  let websiteError: string | null = null;
  try {
    html = await fetchExternalDocument(pageUrl, {
      timeoutMs: timeouts.websiteMs,
      maxBytes: WEBSITE_MAX_BYTES,
      // Feed links live in <head>; large homepages are read up to the cap only.
      truncateAtMaxBytes: true,
      onFinalUrl: (url) => {
        finalUrl = url;
      },
    });
  } catch (error) {
    websiteError = classifySourceFetchError(error).message.replace(
      /feed/gi,
      newsSectionUrl ? "section page" : "website",
    );
  }

  const sectionPageTitle = newsSectionUrl && html ? readSectionPageTitle(html) : null;
  const advertised = html ? extractAdvertisedFeedLinks(html, finalUrl) : [];
  const toCheck = advertised
    .filter((link) => !isCommentsFeed(link))
    .slice(0, MAX_DISCOVERY_CANDIDATES);
  const skipped = advertised.filter(isCommentsFeed).map((link) => ({
    ...emptyCandidate(link.url, link.title),
    reason: "comments_feed" as const,
    message: REASON_MESSAGES.comments_feed!,
  }));

  const withSection = (inspected: InspectedFeed, advertisedTitle: string | null) =>
    newsSectionUrl && inspected.candidate.valid
      ? {
          ...inspected.candidate,
          ...classifyFeedForSection({
            newsSectionUrl,
            sectionPageTitle,
            feedUrl: inspected.candidate.feedUrl,
            feedTitles: [inspected.candidate.title, advertisedTitle],
            articleUrls: inspected.articleUrls,
          }),
        }
      : inspected.candidate;

  const checked = await mapWithConcurrency(toCheck, CANDIDATE_CONCURRENCY, async (link) => {
    if (Date.now() - startedAt > DISCOVERY_BUDGET_MS) {
      return {
        ...emptyCandidate(link.url, link.title),
        reason: "not_checked" as const,
        message: REASON_MESSAGES.not_checked!,
      };
    }
    return withSection(await inspectNewsFeedCandidate(link.url, context, link.title), link.title);
  });

  const ranked = rankCandidates(checked, now.getTime());
  const recommended = ranked.find((candidate) => candidate.valid) ?? null;
  const candidates = [...ranked, ...skipped].map((candidate) => ({
    ...candidate,
    recommended: candidate === recommended,
  }));

  const currentUrl = input.currentRssUrl?.trim();
  const current = currentUrl
    ? (checked.find((candidate) => candidate.feedUrl === currentUrl) ??
      withSection(await inspectNewsFeedCandidate(currentUrl, context, null), null))
    : null;

  const status: NewsFeedDiscoveryResult["status"] = !html
    ? "website_unreachable"
    : advertised.length === 0
      ? "no_feed_advertised"
      : recommended
        ? "found"
        : "no_valid_feed";
  const messages = newsSectionUrl ? SECTION_STATUS_MESSAGES : STATUS_MESSAGES;
  const message =
    status === "website_unreachable" && websiteError
      ? `${messages.website_unreachable} ${websiteError}`
      : status === "found" && newsSectionUrl && recommended?.sectionMatch !== "section_match"
        ? SECTION_NOT_CONFIRMED_MESSAGE
        : messages[status];

  return {
    status,
    websiteUrl: input.websiteUrl,
    newsSectionUrl,
    discoveryPageUrl: pageUrl,
    message,
    candidates,
    recommendedFeedUrl: recommended?.feedUrl ?? null,
    current: current ? { ...current, recommended: current.feedUrl === recommended?.feedUrl } : null,
    checkedAt: now.toISOString(),
  };
}
