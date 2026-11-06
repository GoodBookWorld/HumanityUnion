import {
  isApprovedNewsFeedUrl,
  listActiveApprovedNewsSources,
  resolvePublicNewsConfig,
} from "../public-news.config.js";
import { classifySourceFetchError, UNAPPROVED_FEED_ERROR } from "../public-news-source-health.js";
import type { ExternalNewsArticle } from "../public-news.normalize.js";
import { fetchExternalDocumentWithRetry } from "../public-news.fetch.js";
import { parseRssOrAtomFeed } from "../public-news.rss-parser.js";
import type { NewsProvider, NewsProviderFetchInput } from "./news-provider.types.js";

/** Feeds fetched at once; bounds sockets and event-loop pressure during a refresh. */
export const RSS_FETCH_CONCURRENCY = 6;

/** Runs `task` over `items` with at most `limit` in flight; results keep input order. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, worker));
  return results;
}

export class RssNewsProvider implements NewsProvider {
  readonly name = "rss";

  async fetchRecentArticles(input: NewsProviderFetchInput): Promise<ExternalNewsArticle[]> {
    const config = resolvePublicNewsConfig();
    const sources = listActiveApprovedNewsSources(input.language);
    const perSourceLimit = Math.max(3, Math.ceil(input.limit / Math.max(sources.length, 1)));
    const telemetry = input.telemetry;

    const batches = await mapWithConcurrency(
      sources,
      RSS_FETCH_CONCURRENCY,
      async (source): Promise<ExternalNewsArticle[]> => {
        const sourceId = source.mediaResourceId;
        telemetry?.begin(source);

        if (!isApprovedNewsFeedUrl(source.rssFeedUrl)) {
          console.warn(
            `[public-news] Skipping non-registry RSS URL for ${source.sourceName}.`,
          );
          telemetry?.fetchFailed(sourceId, UNAPPROVED_FEED_ERROR, 0);
          return [];
        }

        const startedAt = Date.now();
        let httpStatus: number | null = null;

        try {
          const xml = await fetchExternalDocumentWithRetry(source.rssFeedUrl, {
            timeoutMs: config.fetchTimeoutMs,
            maxBytes: config.maxResponseBytes,
            requireApprovedRssFeed: true,
            onStatus: (status) => {
              httpStatus = status;
            },
          });
          telemetry?.fetchSucceeded(sourceId, httpStatus, Date.now() - startedAt);
          const feedItems = parseRssOrAtomFeed(xml, source.rssFeedUrl);
          telemetry?.parsed(sourceId, feedItems);
          const accepted: ExternalNewsArticle[] = [];

          for (const [index, item] of feedItems.entries()) {
            if (accepted.length >= perSourceLimit) {
              telemetry?.reject(sourceId, "per_source_cap", feedItems.length - index);
              break;
            }

            if (input.from && Date.parse(item.publishedAt) < input.from.getTime()) {
              telemetry?.reject(sourceId, "outside_retention_window");
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
              ...(sourceId ? { mediaResourceId: sourceId } : {}),
            });
          }

          return accepted;
        } catch (error) {
          console.warn(
            `[public-news] RSS provider failed for ${source.sourceName}:`,
            error instanceof Error ? error.message : error,
          );
          telemetry?.fetchFailed(sourceId, classifySourceFetchError(error), Date.now() - startedAt);
          return [];
        }
      },
    );

    const sorted = batches
      .flat()
      .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt));

    for (const dropped of sorted.slice(input.limit)) {
      telemetry?.reject(dropped.mediaResourceId, "global_cap");
    }

    return sorted.slice(0, input.limit);
  }
}
