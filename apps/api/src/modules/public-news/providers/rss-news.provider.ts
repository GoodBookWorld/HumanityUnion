import { isApprovedMediaRegistryFeedUrl } from "@hu/media-registry";

import { listActiveApprovedNewsSources, resolvePublicNewsConfig } from "../public-news.config.js";
import type { ExternalNewsArticle } from "../public-news.normalize.js";
import { fetchExternalDocument } from "../public-news.fetch.js";
import { parseRssOrAtomFeed } from "../public-news.rss-parser.js";
import type { NewsProvider, NewsProviderFetchInput } from "./news-provider.types.js";

export class RssNewsProvider implements NewsProvider {
  readonly name = "rss";

  async fetchRecentArticles(input: NewsProviderFetchInput): Promise<ExternalNewsArticle[]> {
    const config = resolvePublicNewsConfig();
    const sources = listActiveApprovedNewsSources(input.language);
    const perSourceLimit = Math.max(3, Math.ceil(input.limit / Math.max(sources.length, 1)));

    const batches = await Promise.all(
      sources.map(async (source): Promise<ExternalNewsArticle[]> => {
        if (!isApprovedMediaRegistryFeedUrl(source.rssFeedUrl)) {
          console.warn(
            `[public-news] Skipping non-registry RSS URL for ${source.sourceName}.`,
          );
          return [];
        }

        try {
          const xml = await fetchExternalDocument(source.rssFeedUrl, {
            timeoutMs: config.fetchTimeoutMs,
            maxBytes: config.maxResponseBytes,
            requireApprovedRssFeed: true,
          });
          const feedItems = parseRssOrAtomFeed(xml, source.rssFeedUrl);
          const accepted: ExternalNewsArticle[] = [];

          for (const item of feedItems) {
            if (accepted.length >= perSourceLimit) {
              break;
            }

            if (input.from && Date.parse(item.publishedAt) < input.from.getTime()) {
              continue;
            }

            accepted.push({
              externalId: item.externalId,
              provider: this.name,
              sourceName: source.sourceName,
              sourceDomain: source.sourceDomain,
              title: item.title,
              summary: item.summary,
              articleUrl: item.articleUrl,
              imageUrl: item.imageUrl,
              publishedAt: item.publishedAt,
              language: source.language,
              category: source.category,
            });
          }

          return accepted;
        } catch (error) {
          console.warn(
            `[public-news] RSS provider failed for ${source.sourceName}:`,
            error instanceof Error ? error.message : error,
          );
          return [];
        }
      }),
    );

    return batches
      .flat()
      .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
      .slice(0, input.limit);
  }
}
