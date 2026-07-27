export type NewsArticleStatus = "active" | "hidden" | "expired" | "invalid";

export type NewsVerificationStatus = "external-source" | "reviewed";

export interface NewsArticleRecord {
  id: string;
  externalId?: string;
  provider: string;
  sourceName: string;
  sourceDomain?: string;
  title: string;
  summary: string;
  articleUrl: string;
  normalizedArticleUrl: string;
  imageUrl?: string;
  publishedAt: string;
  fetchedAt: string;
  expiresAt: string;
  language: string;
  category?: string;
  geographicScope?: string;
  status: NewsArticleStatus;
  verificationStatus: NewsVerificationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PublicNewsArticleItem {
  id: string;
  sourceName: string;
  title: string;
  summary: string;
  articleUrl: string;
  imageUrl?: string;
  publishedAt: string;
  language: string;
  category?: string;
  geographicScope?: string;
  verificationStatus: NewsVerificationStatus;
}

export interface PublicNewsListingResponse {
  items: PublicNewsArticleItem[];
  generatedAt: string;
  retentionDays: number;
  /** Distinct source names with active accepted records — drives provider filters. */
  activeProviders: string[];
}

export interface InitiativeNewsSourceReference {
  type: "public-news";
  /** Canonical Public News record id at attachment time. */
  sourceRecordId: string;
  providerId?: string;
  sourceName: string;
  title: string;
  summary?: string;
  articleUrl: string;
  imageUrl?: string;
  publishedAt: string;
  category?: string;
  geographicScope?: string;
  capturedAt: string;
}
