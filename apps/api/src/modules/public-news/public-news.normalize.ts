import type { NewsArticleRecord } from "@hu/types";

import {
  resolveNewsProviderId,
  validateNewsArticleRecordForInitiativeSource,
} from "./public-news.initiative-source.js";

export interface ExternalNewsArticle {
  externalId?: string;
  provider: string;
  sourceName: string;
  sourceDomain?: string;
  title: string;
  summary?: string;
  articleUrl: string;
  imageUrl?: string;
  publishedAt: string;
  language: string;
  category?: string;
  geographicScope?: string;
  isSponsored?: boolean;
}

const HTML_TAG_PATTERN = /<[^>]+>/g;
const WHITESPACE_PATTERN = /\s+/g;

export function stripHtml(value: string): string {
  return value.replace(HTML_TAG_PATTERN, " ").replace(WHITESPACE_PATTERN, " ").trim();
}

export function normalizePlainText(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} is required.`);
  }

  const normalized = stripHtml(value);

  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized;
}

export function normalizeOptionalPlainText(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = stripHtml(value);
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeArticleUrl(value: unknown): { articleUrl: string; normalizedArticleUrl: string } {
  if (typeof value !== "string") {
    throw new Error("Article URL is required.");
  }

  let parsed: URL;

  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error("Article URL must be a valid http or https URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Article URL must use http or https.");
  }

  parsed.hash = "";

  // Drop common tracking params so refresh cycles reuse one canonical URL identity.
  for (const key of [...parsed.searchParams.keys()]) {
    if (
      /^utm(_|$)/i.test(key) ||
      key === "fbclid" ||
      key === "gclid" ||
      key === "mc_cid" ||
      key === "mc_eid"
    ) {
      parsed.searchParams.delete(key);
    }
  }

  const articleUrl = parsed.toString();
  const normalizedArticleUrl = articleUrl.toLowerCase();

  return { articleUrl, normalizedArticleUrl };
}

export function normalizePublishedAt(value: unknown): string {
  if (typeof value !== "string" && !(value instanceof Date)) {
    throw new Error("Publication date is required.");
  }

  const parsed = Date.parse(String(value));

  if (Number.isNaN(parsed)) {
    throw new Error("Publication date must be a valid ISO date.");
  }

  return new Date(parsed).toISOString();
}

export function buildSummary(title: string, summary: string | undefined, maxLength = 320): string {
  const candidate = normalizeOptionalPlainText(summary) ?? title;
  const trimmed = candidate.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

export function createNewsArticleId(): string {
  return `news-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function calculateExpiresAt(fetchedAt: string, retentionDays: number): string {
  const expiresAt = new Date(fetchedAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + retentionDays);
  return expiresAt.toISOString();
}

export function normalizeExternalNewsArticle(
  article: ExternalNewsArticle,
  retentionDays: number,
  fetchedAt = new Date().toISOString(),
): NewsArticleRecord {
  const title = normalizePlainText(article.title, "Title");
  const sourceName = normalizePlainText(article.sourceName, "Source name");
  const { articleUrl, normalizedArticleUrl } = normalizeArticleUrl(article.articleUrl);
  const publishedAt = normalizePublishedAt(article.publishedAt);
  const summary = buildSummary(title, article.summary);
  const now = fetchedAt;

  return {
    id: createNewsArticleId(),
    externalId: normalizeOptionalPlainText(article.externalId),
    provider: normalizePlainText(article.provider, "Provider"),
    sourceName,
    sourceDomain: normalizeOptionalPlainText(article.sourceDomain),
    title,
    summary,
    articleUrl,
    normalizedArticleUrl,
    imageUrl: normalizeOptionalImageUrl(article.imageUrl),
    publishedAt,
    fetchedAt: now,
    expiresAt: calculateExpiresAt(now, retentionDays),
    language: normalizeOptionalPlainText(article.language) ?? "en",
    category: normalizeOptionalPlainText(article.category),
    geographicScope: normalizeOptionalPlainText(article.geographicScope),
    status: "active",
    verificationStatus: "external-source",
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeOptionalImageUrl(value: unknown): string | undefined {
  const normalized = normalizeOptionalPlainText(value);

  if (!normalized) {
    return undefined;
  }

  try {
    const parsed = new URL(normalized);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }

    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function toPublicNewsArticleItem(record: NewsArticleRecord) {
  return {
    id: record.id,
    sourceName: record.sourceName,
    title: record.title,
    summary: record.summary,
    articleUrl: record.articleUrl,
    imageUrl: record.imageUrl,
    publishedAt: record.publishedAt,
    language: record.language,
    category: record.category,
    geographicScope: record.geographicScope,
    verificationStatus: record.verificationStatus,
  };
}

export function toInitiativeNewsSourceSnapshot(record: NewsArticleRecord) {
  const validationError = validateNewsArticleRecordForInitiativeSource(record);

  if (validationError) {
    throw new Error(validationError);
  }

  return {
    type: "public-news" as const,
    sourceRecordId: record.id,
    providerId: resolveNewsProviderId(record),
    sourceName: record.sourceName,
    title: record.title,
    summary: record.summary,
    articleUrl: record.articleUrl,
    imageUrl: record.imageUrl,
    publishedAt: record.publishedAt,
    category: record.category,
    geographicScope: record.geographicScope,
    capturedAt: new Date().toISOString(),
  };
}
