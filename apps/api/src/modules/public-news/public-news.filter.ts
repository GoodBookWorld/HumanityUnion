import {
  isApprovedMediaRegistryDomain,
  isMediaRegistryWebsiteUrl,
  isSpecificMediaArticleUrl,
  resolveMediaRegistryProviderForArticle,
} from "@hu/media-registry";

import { resolvePublicNewsConfig } from "./public-news.config.js";
import type { ExternalNewsArticle } from "./public-news.normalize.js";
import { normalizeArticleUrl, normalizeOptionalPlainText } from "./public-news.normalize.js";
import { validatePublicArticleUrl, isPlaceholderArticleUrl } from "./public-news.fetch.js";

const SPONSORED_PATTERN = /\b(sponsored|advertorial|paid content|partner content)\b/i;

export function isApprovedSourceDomain(sourceDomain: string | undefined): boolean {
  return isApprovedMediaRegistryDomain(sourceDomain);
}

export function resolveApprovedSource(sourceName: string, articleUrl: string) {
  const provider = resolveMediaRegistryProviderForArticle(sourceName, articleUrl);

  if (!provider || provider.rssEnabled === false) {
    return undefined;
  }

  const feed = provider.rssFeeds[0];

  return {
    providerId: provider.id,
    sourceName: provider.name,
    sourceDomain: provider.sourceDomains[0] ?? "",
    rssFeedUrl: feed?.url ?? "",
    language: provider.language,
    category: feed?.defaultCategory ?? provider.categories[0] ?? "democracy",
  };
}

export function filterExternalNewsArticles(
  articles: ExternalNewsArticle[],
  input: { retentionDays: number; now?: Date },
): ExternalNewsArticle[] {
  const now = input.now ?? new Date();
  const oldestAllowed = new Date(now);
  oldestAllowed.setUTCDate(oldestAllowed.getUTCDate() - input.retentionDays);

  const seenUrls = new Set<string>();
  const seenComposite = new Set<string>();

  const filtered: ExternalNewsArticle[] = [];

  for (const article of articles) {
    if (article.isSponsored || isSponsoredText(article.title) || isSponsoredText(article.summary)) {
      continue;
    }

    let normalizedArticleUrl: string;

    try {
      normalizedArticleUrl = normalizeArticleUrl(article.articleUrl).normalizedArticleUrl;
    } catch {
      continue;
    }

    if (seenUrls.has(normalizedArticleUrl)) {
      continue;
    }

    if (isPlaceholderArticleUrl(article.articleUrl)) {
      continue;
    }

    if (isMediaRegistryWebsiteUrl(article.articleUrl)) {
      continue;
    }

    const provisionalSourceName = normalizeOptionalPlainText(article.sourceName) ?? "";
    const registryProvider = resolveMediaRegistryProviderForArticle(
      provisionalSourceName,
      article.articleUrl,
    );

    if (!registryProvider || registryProvider.rssEnabled === false) {
      continue;
    }

    if (!isSpecificMediaArticleUrl(article.articleUrl, registryProvider)) {
      continue;
    }

    const publishedAt = Date.parse(article.publishedAt);

    if (Number.isNaN(publishedAt) || publishedAt < oldestAllowed.getTime()) {
      continue;
    }

    const title = normalizeOptionalPlainText(article.title);
    const sourceName = normalizeOptionalPlainText(article.sourceName);
    const summary = normalizeOptionalPlainText(article.summary);

    if (!title || !sourceName) {
      continue;
    }

    if (!summary && title.length < 12) {
      continue;
    }

    const approved = resolveApprovedSource(sourceName, article.articleUrl);

    if (!approved) {
      continue;
    }

    const compositeKey = `${sourceName.toLowerCase()}::${title.toLowerCase()}::${new Date(publishedAt).toISOString().slice(0, 10)}`;

    if (seenComposite.has(compositeKey)) {
      continue;
    }

    seenUrls.add(normalizedArticleUrl);
    seenComposite.add(compositeKey);

    filtered.push({
      ...article,
      title,
      sourceName: approved.sourceName,
      sourceDomain: approved.sourceDomain,
      category: article.category ?? approved.category,
      language: article.language ?? approved.language,
      summary: summary ?? title,
    });
  }

  return filtered;
}

export async function validateExternalNewsArticleUrls(
  articles: ExternalNewsArticle[],
): Promise<ExternalNewsArticle[]> {
  if (process.env.HU_VERIFICATION_MODE === "true") {
    return articles;
  }

  const config = resolvePublicNewsConfig();
  // Bound concurrency so one refresh does not serialize dozens of publisher GETs
  // (and starve the API event loop for /media).
  const concurrency = 8;
  const validated: ExternalNewsArticle[] = [];

  for (let index = 0; index < articles.length; index += concurrency) {
    const batch = articles.slice(index, index + concurrency);
    const results = await Promise.all(
      batch.map(async (article) => {
        const reachable = await validatePublicArticleUrl(article.articleUrl, {
          timeoutMs: Math.min(config.fetchTimeoutMs, 8_000),
        });
        return reachable ? article : null;
      }),
    );

    for (const article of results) {
      if (article) {
        validated.push(article);
      }
    }
  }

  return validated;
}

function isSponsoredText(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return SPONSORED_PATTERN.test(value);
}
