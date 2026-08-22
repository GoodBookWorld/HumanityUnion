export type MediaResourceType =
  | "TRUSTED_MEDIA"
  | "NEWS_SOURCE"
  | "FACT_CHECKING"
  | "PROPAGANDA_ANALYSIS";

export type MediaResourceScopeType = "WORLD" | "COUNTRY";

export interface MediaResource {
  id: string;
  resourceType: MediaResourceType;
  scopeType: MediaResourceScopeType;
  countryCode: string | null; // null iff WORLD
  name: string;
  logoLabel: string;
  logoUrl?: string | null;
  websiteUrl: string;
  rssUrl?: string | null; // NEWS_SOURCE only
  categoryId?: string | null; // TRUSTED_MEDIA TrustedMediaCategoryId
  description?: string | null; // explanation / mission / focus / summary
  secondaryText?: string | null; // coverage (fact) / explanation (propaganda) / country display label
  language?: string | null; // NEWS_SOURCE
  providerId?: string | null; // media-registry id for NEWS_SOURCE
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
