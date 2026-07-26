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
    const articles: ExternalNewsArticle[] = [];

    for (const source of sources) {
      if (articles.length >= input.limit) {
        break;
      }

      let acceptedForSource = 0;

      try {
        const xml = await fetchExternalDocument(source.rssFeedUrl, {
          timeoutMs: config.fetchTimeoutMs,
          maxBytes: config.maxResponseBytes,
        });
        const feedItems = parseRssOrAtomFeed(xml, source.rssFeedUrl);

        for (const item of feedItems) {
          if (acceptedForSource >= perSourceLimit || articles.length >= input.limit) {
            break;
          }

          if (input.from && Date.parse(item.publishedAt) < input.from.getTime()) {
            continue;
          }

          articles.push({
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
          acceptedForSource += 1;
        }
      } catch (error) {
        console.warn(
          `[public-news] RSS provider failed for ${source.sourceName}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    return articles.slice(0, input.limit);
  }
}
