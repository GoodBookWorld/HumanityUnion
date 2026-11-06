import type { PublicNewsIngestionTelemetry } from "../public-news-source-health.js";
import type { ExternalNewsArticle } from "../public-news.normalize.js";

export interface NewsProviderFetchInput {
  language: string;
  limit: number;
  from?: Date;
  /** Optional per-source health collector; providers must not change behaviour for it. */
  telemetry?: PublicNewsIngestionTelemetry;
}

export interface NewsProvider {
  readonly name: string;
  fetchRecentArticles(input: NewsProviderFetchInput): Promise<ExternalNewsArticle[]>;
}
