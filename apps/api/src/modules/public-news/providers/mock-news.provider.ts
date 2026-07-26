import type { ExternalNewsArticle } from "../public-news.normalize.js";
import type { NewsProvider, NewsProviderFetchInput } from "./news-provider.types.js";
import { RssNewsProvider } from "./rss-news.provider.js";

/**
 * Development provider that reuses live RSS ingestion so articleUrl values
 * remain publisher article links — never registry homepages or synthetic paths.
 */
export class MockNewsProvider implements NewsProvider {
  readonly name = "mock";
  private readonly rssProvider = new RssNewsProvider();

  async fetchRecentArticles(input: NewsProviderFetchInput): Promise<ExternalNewsArticle[]> {
    const articles = await this.rssProvider.fetchRecentArticles(input);

    return articles.map((article) => ({
      ...article,
      provider: this.name,
    }));
  }
}
