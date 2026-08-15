import { stripHtml } from "./public-news.normalize.js";

export interface ParsedFeedItem {
  externalId?: string;
  title: string;
  summary?: string;
  articleUrl: string;
  imageUrl?: string;
  publishedAt: string;
}

const TRACKING_IMAGE_PATTERN = /(?:pixel|tracking|spacer|beacon|\/1x1|rss-pixel)/i;
const FEED_URL_PATTERN = /\/(?:feed|rss|atom)(?:\/|$|[?#])/i;

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)));
}

function unwrapCdata(value: string): string {
  const trimmed = value.trim();
  // Economist (and others) wrap titles/descriptions in multiline CDATA.
  // stripHtml() would otherwise treat `<![CDATA[...]]>` as a tag and erase the text.
  const cdataMatch = trimmed.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/i);
  return cdataMatch?.[1] ?? trimmed;
}

function readRawTag(block: string, tagNames: string[]): string | undefined {
  for (const tagName of tagNames) {
    const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
    const match = block.match(pattern);

    if (match?.[1]) {
      return decodeXmlEntities(unwrapCdata(match[1])).trim();
    }
  }

  return undefined;
}

function readTag(block: string, tagNames: string[]): string | undefined {
  const raw = readRawTag(block, tagNames);

  if (!raw) {
    return undefined;
  }

  return stripHtml(raw);
}

function readAttribute(tag: string, attributeName: string): string | undefined {
  const pattern = new RegExp(`\\b${attributeName}=["']([^"']+)["']`, "i");
  return tag.match(pattern)?.[1]?.trim();
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function sanitizeHttpUrl(value: string): string | undefined {
  const trimmed = value.trim();

  if (!isHttpUrl(trimmed)) {
    return undefined;
  }

  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function isFeedLikeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.toLowerCase();

    if (path.endsWith(".xml") || path.endsWith(".rss") || path.endsWith(".atom")) {
      return true;
    }

    return FEED_URL_PATTERN.test(`${parsed.pathname}${parsed.search}`);
  } catch {
    return true;
  }
}

function readRssLinkElement(block: string): string | undefined {
  const raw = readRawTag(block, ["link"]);

  if (!raw) {
    return undefined;
  }

  return sanitizeHttpUrl(raw);
}

function readAtomArticleLink(block: string): string | undefined {
  const linkTags = block.match(/<link\b[^>]*\/?>/gi) ?? [];
  let fallback: string | undefined;

  for (const tag of linkTags) {
    const href = readAttribute(tag, "href");

    if (!href || !isHttpUrl(href)) {
      continue;
    }

    const rel = readAttribute(tag, "rel")?.toLowerCase() ?? "alternate";
    const type = readAttribute(tag, "type")?.toLowerCase();

    if (rel === "self" || rel === "hub" || rel === "edit") {
      continue;
    }

    if (type && !type.includes("html") && !type.includes("xhtml") && rel !== "alternate") {
      continue;
    }

    const sanitized = sanitizeHttpUrl(href);

    if (!sanitized || isFeedLikeUrl(sanitized)) {
      continue;
    }

    if (rel === "alternate") {
      return sanitized;
    }

    fallback ??= sanitized;
  }

  return fallback;
}

function readPermalinkGuid(block: string): string | undefined {
  const guidMatch = block.match(/<guid\b([^>]*)>([\s\S]*?)<\/guid>/i);

  if (!guidMatch?.[2]) {
    return undefined;
  }

  const attrs = guidMatch[1] ?? "";
  const value = decodeXmlEntities(stripHtml(guidMatch[2])).trim();

  if (/isPermaLink=["']false["']/i.test(attrs)) {
    return undefined;
  }

  const sanitized = sanitizeHttpUrl(value);

  if (!sanitized || isFeedLikeUrl(sanitized)) {
    return undefined;
  }

  return sanitized;
}

function readArticleUrl(block: string): string | undefined {
  const candidates = [
    readRssLinkElement(block),
    readAtomArticleLink(block),
    readPermalinkGuid(block),
  ];

  for (const candidate of candidates) {
    if (candidate && !isFeedLikeUrl(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function readPublishedAt(block: string): string | undefined {
  return (
    readTag(block, ["pubDate", "published", "updated", "dc:date"]) ??
    block.match(/<published>([^<]+)<\/published>/i)?.[1]?.trim()
  );
}

function readGuid(block: string): string | undefined {
  return readTag(block, ["guid", "id"]);
}

function readTagUrlAttribute(block: string, tagName: string): string | undefined {
  const pattern = new RegExp(`<${tagName}\\b[^>]*\\/?>`, "gi");
  const tags = block.match(pattern) ?? [];

  for (const tag of tags) {
    const url = readAttribute(tag, "url");

    if (url && isHttpUrl(url)) {
      return sanitizeHttpUrl(url);
    }
  }

  return undefined;
}

function isImageMimeType(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return value.toLowerCase().startsWith("image/");
}

function readEnclosureImageUrl(block: string): string | undefined {
  const tags = block.match(/<enclosure\b[^>]*\/?>/gi) ?? [];

  for (const tag of tags) {
    const type = readAttribute(tag, "type");
    const url = readAttribute(tag, "url");

    if (!url || !isImageMimeType(type)) {
      continue;
    }

    const sanitized = sanitizeHttpUrl(url);

    if (sanitized) {
      return sanitized;
    }
  }

  return undefined;
}

function readMediaImageUrl(block: string): string | undefined {
  const thumbnail = readTagUrlAttribute(block, "media:thumbnail");

  if (thumbnail) {
    return thumbnail;
  }

  const tags = block.match(/<media:content\b[^>]*\/?>/gi) ?? [];

  for (const tag of tags) {
    const url = readAttribute(tag, "url");
    const medium = readAttribute(tag, "medium")?.toLowerCase();
    const type = readAttribute(tag, "type");

    if (!url) {
      continue;
    }

    if (medium !== "image" && !isImageMimeType(type)) {
      continue;
    }

    const sanitized = sanitizeHttpUrl(url);

    if (sanitized) {
      return sanitized;
    }
  }

  return undefined;
}

function isTrackingImageUrl(url: string): boolean {
  return TRACKING_IMAGE_PATTERN.test(url);
}

function readHtmlImageUrl(block: string): string | undefined {
  const html = readRawTag(block, ["content:encoded", "description", "content", "summary"]);

  if (!html) {
    return undefined;
  }

  const imgPattern = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;

  for (const match of html.matchAll(imgPattern)) {
    const src = decodeXmlEntities(match[1]?.trim() ?? "");

    if (!src || !isHttpUrl(src) || isTrackingImageUrl(src)) {
      continue;
    }

    const sanitized = sanitizeHttpUrl(src);

    if (sanitized) {
      return sanitized;
    }
  }

  return undefined;
}

function readItunesImageUrl(block: string): string | undefined {
  const tag = block.match(/<itunes:image\b[^>]*\/?>/i)?.[0];

  if (!tag) {
    return undefined;
  }

  const href = readAttribute(tag, "href");

  if (!href || !isHttpUrl(href) || isTrackingImageUrl(href)) {
    return undefined;
  }

  return sanitizeHttpUrl(href);
}

function readImageUrl(block: string): string | undefined {
  return (
    readMediaImageUrl(block) ??
    readItunesImageUrl(block) ??
    readEnclosureImageUrl(block) ??
    readHtmlImageUrl(block)
  );
}

function parseItemBlock(block: string): ParsedFeedItem | null {
  const title = readTag(block, ["title"]);
  const articleUrl = readArticleUrl(block);

  if (!title || !articleUrl) {
    return null;
  }

  const publishedRaw = readPublishedAt(block);
  const publishedAt = publishedRaw ? new Date(publishedRaw).toISOString() : new Date().toISOString();
  const imageUrl = readImageUrl(block);

  // Prefer short syndication fields only — never prefer content:encoded (often full HTML body).
  const summaryRaw =
    readTag(block, ["description", "summary", "content"]) ??
    // Last resort: bound content:encoded text so full articles are not retained.
    (() => {
      const encoded = readTag(block, ["content:encoded"]);
      if (!encoded) {
        return undefined;
      }
      return encoded.length > 320 ? `${encoded.slice(0, 317).trimEnd()}...` : encoded;
    })();

  return {
    externalId: readGuid(block),
    title,
    summary: summaryRaw,
    articleUrl,
    imageUrl,
    publishedAt,
  };
}

export function parseRssOrAtomFeed(xml: string, feedUrl: string): ParsedFeedItem[] {
  const normalizedXml = xml.trim();

  if (!normalizedXml) {
    return [];
  }

  const itemBlocks =
    normalizedXml.match(/<item[\s\S]*?<\/item>/gi) ??
    normalizedXml.match(/<entry[\s\S]*?<\/entry>/gi) ??
    [];

  const parsed = itemBlocks
    .map((block) => parseItemBlock(block))
    .filter((item): item is ParsedFeedItem => item !== null);

  if (parsed.length > 0) {
    return parsed;
  }

  console.warn(`[public-news] No feed items parsed from ${feedUrl}`);
  return [];
}
