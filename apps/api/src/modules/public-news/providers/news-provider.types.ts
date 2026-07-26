import type { ExternalNewsArticle } from "../public-news.normalize.js";

export interface NewsProviderFetchInput {
  language: string;
  limit: number;
  from?: Date;
}

export interface NewsProvider {
  readonly name: string;
  fetchRecentArticles(input: NewsProviderFetchInput): Promise<ExternalNewsArticle[]>;
}
