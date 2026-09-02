import type { CivicEntityType } from "./capability02-integration.js";

export type CivicSearchView = "grouped" | "flat";

export interface CivicSearchQuery {
  q?: string;
  entityTypes?: CivicEntityType[];
  country?: string;
  region?: string;
  community?: string;
  activityArea?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  limit: number;
  offset: number;
  /** Grouped mode paginates initiative lifecycle groups; flat mode paginates individual records. */
  view?: CivicSearchView;
  /**
   * Public Choice Experience Pack 01 — optional Initiative lifecycle profile filter.
   * `STANDARD` | `PUBLIC_CHOICE`. Omit / empty = All.
   */
  lifecycleProfile?: "STANDARD" | "PUBLIC_CHOICE";
  /** Pack 02H — preferred reading/search language (Registry locale or alias, e.g. zh-TW). */
  locale?: string;
}

export interface CivicSearchResult {
  entityType: CivicEntityType;
  entityId: string;
  title: string;
  summary: string;
  publicUrl: string;
  country?: string;
  region?: string;
  community?: string;
  activityArea?: string;
  status: string;
  updatedAt: string;
  matchedFields: string[];
  explanation: string;
  countryLabel?: string;
  regionLabel?: string;
  countryCode?: string;
  regionCode?: string;
  imageUrl?: string;
  initiativeId?: string;
  /** Pack 02H — language of displayed title/summary when localized. */
  displayLanguage?: string;
  /** Pack 02H — preferred_translation when title/summary swapped for query.locale. */
  presentationMode?: "preferred_translation" | "original";
}

export interface InitiativeLifecycleSearchStage {
  stageId: string;
  label: string;
  records: CivicSearchResult[];
  matchedRecordCount: number;
  /** True when one or more records in this stage matched the query or filters. */
  matched: boolean;
}

export interface InitiativeLifecycleSearchGroup {
  kind: "initiative_group";
  initiativeId: string;
  title: string;
  summary: string;
  country?: string;
  region?: string;
  community?: string;
  activityArea?: string;
  status: string;
  latestActivityAt: string;
  imageUrl?: string;
  countryLabel?: string;
  regionLabel?: string;
  countryCode?: string;
  regionCode?: string;
  stages: InitiativeLifecycleSearchStage[];
  totalChildRecordCount: number;
  matchedChildRecordCount: number;
}

export interface StandaloneCivicSearchResult {
  kind: "standalone";
  result: CivicSearchResult;
}

export type CivicSearchDisplayResult = InitiativeLifecycleSearchGroup | StandaloneCivicSearchResult;

export interface CivicSearchFacetBucket {
  value: string;
  count: number;
}

export interface CivicSearchFacets {
  entityTypes: CivicSearchFacetBucket[];
  countries: CivicSearchFacetBucket[];
  regions: CivicSearchFacetBucket[];
  communities: CivicSearchFacetBucket[];
  activityAreas: CivicSearchFacetBucket[];
  statuses: CivicSearchFacetBucket[];
}

export interface CivicSearchResponse {
  query: CivicSearchQuery;
  view: CivicSearchView;
  /** Flat-mode page slice. Empty in grouped mode. */
  results: CivicSearchResult[];
  /** Grouped-mode page slice. Omitted in flat mode. */
  displayResults?: CivicSearchDisplayResult[];
  /** Total flat entity matches (flat mode) or total top-level display units (grouped mode). */
  total: number;
  totalDisplayResults: number;
  initiativeGroupCount?: number;
  standaloneResultCount?: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  facets: CivicSearchFacets;
}
