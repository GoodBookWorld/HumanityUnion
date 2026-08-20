import type {
  CivicEntityType,
  CivicSearchQuery,
  CivicSearchResponse,
  CivicSearchView,
} from "@hu/types";
import { normalizeCountryInput } from "@hu/geography";

import { buildSearchFacets, buildGroupedSearchFacets } from "./global-search.facets.js";
import { buildGroupedSearchPage } from "./global-search.grouping.js";
import { getGlobalSearchIndex } from "./global-search.index.js";
import { matchGlobalSearchIndex, toSearchResult } from "./global-search.matching.js";
import {
  GLOBAL_SEARCH_DEFAULT_LIMIT,
  GLOBAL_SEARCH_MAX_LIMIT,
  PRIVATE_SEARCH_RESPONSE_KEYS,
} from "./global-search.types.js";

function parseEntityTypes(value: string | string[] | undefined): CivicEntityType[] | undefined {
  if (!value) {
    return undefined;
  }

  const rawValues = Array.isArray(value) ? value : value.split(",");
  const allowed = new Set<CivicEntityType>([
    "initiative",
    "analysis",
    "improvement_proposal",
    "initiative_revision",
    "decision_session",
    "collective_decision",
    "civic_action_package",
    "official_response",
    "civic_accountability",
    "implementation_commitment",
    "implementation_tracking",
    "public_impact",
    "civic_archive",
    "knowledge_article",
    "knowledge_media",
    "blog_post",
  ]);

  const parsed = rawValues
    .map((entry) => entry.trim())
    .filter((entry): entry is CivicEntityType => allowed.has(entry as CivicEntityType));

  return parsed.length > 0 ? parsed : undefined;
}

function parseLimit(value: string | undefined): number {
  const parsed = value ? Number.parseInt(value, 10) : GLOBAL_SEARCH_DEFAULT_LIMIT;

  if (Number.isNaN(parsed) || parsed <= 0) {
    return GLOBAL_SEARCH_DEFAULT_LIMIT;
  }

  return Math.min(parsed, GLOBAL_SEARCH_MAX_LIMIT);
}

function parseOffset(value: string | undefined): number {
  const parsed = value ? Number.parseInt(value, 10) : 0;

  if (Number.isNaN(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function parseView(value: string | undefined): CivicSearchView | undefined {
  if (value === "flat") {
    return "flat";
  }

  if (value === "grouped") {
    return "grouped";
  }

  return undefined;
}

export function parseCivicSearchQuery(
  input: Record<string, string | string[] | undefined>,
): CivicSearchQuery {
  const lifecycleProfileRaw =
    typeof input.lifecycleProfile === "string" ? input.lifecycleProfile.trim() : "";
  const lifecycleProfile =
    lifecycleProfileRaw === "STANDARD" || lifecycleProfileRaw === "PUBLIC_CHOICE"
      ? lifecycleProfileRaw
      : undefined;

  return {
    q: typeof input.q === "string" ? input.q : undefined,
    entityTypes: parseEntityTypes(input.entityType ?? input.entityTypes ?? input.type),
    country:
      typeof input.country === "string"
        ? (normalizeCountryInput(input.country) ?? input.country.trim())
        : undefined,
    region: typeof input.region === "string" ? input.region : undefined,
    community: typeof input.community === "string" ? input.community : undefined,
    activityArea: typeof input.activityArea === "string" ? input.activityArea : undefined,
    status: typeof input.status === "string" ? input.status : undefined,
    fromDate: typeof input.fromDate === "string" ? input.fromDate : undefined,
    toDate: typeof input.toDate === "string" ? input.toDate : undefined,
    limit: parseLimit(typeof input.limit === "string" ? input.limit : undefined),
    offset: parseOffset(typeof input.offset === "string" ? input.offset : undefined),
    view: parseView(typeof input.view === "string" ? input.view : undefined),
    lifecycleProfile,
  };
}

export function sanitizeCivicSearchResponse(response: CivicSearchResponse): CivicSearchResponse {
  const serialized = JSON.stringify(response).toLowerCase();

  for (const key of PRIVATE_SEARCH_RESPONSE_KEYS) {
    if (serialized.includes(`"${key.toLowerCase()}"`)) {
      throw new Error(`Global search response must not expose ${key}.`);
    }
  }

  return response;
}

export async function searchPublicCivicRecords(
  query: CivicSearchQuery,
): Promise<CivicSearchResponse> {
  const view = query.view ?? "flat";
  const normalizedQuery: CivicSearchQuery = { ...query, view };
  const index = await getGlobalSearchIndex();
  const matched = matchGlobalSearchIndex(normalizedQuery, index);
  const allResults = matched.map(toSearchResult);
  const facets = buildSearchFacets(allResults);

  if (view === "flat") {
    const total = matched.length;
    const page = allResults.slice(
      normalizedQuery.offset,
      normalizedQuery.offset + normalizedQuery.limit,
    );

    return sanitizeCivicSearchResponse({
      query: normalizedQuery,
      view: "flat",
      results: page,
      total,
      totalDisplayResults: total,
      limit: normalizedQuery.limit,
      offset: normalizedQuery.offset,
      hasMore: normalizedQuery.offset + normalizedQuery.limit < total,
      facets,
    });
  }

  const groupedPage = buildGroupedSearchPage(normalizedQuery, matched, index);
  const allGroupedResults = buildGroupedSearchPage(
    { ...normalizedQuery, offset: 0, limit: Number.MAX_SAFE_INTEGER },
    matched,
    index,
  ).displayResults;

  return sanitizeCivicSearchResponse({
    query: normalizedQuery,
    view: "grouped",
    results: [],
    displayResults: groupedPage.displayResults,
    total: groupedPage.totalDisplayResults,
    totalDisplayResults: groupedPage.totalDisplayResults,
    initiativeGroupCount: groupedPage.initiativeGroupCount,
    standaloneResultCount: groupedPage.standaloneResultCount,
    limit: normalizedQuery.limit,
    offset: normalizedQuery.offset,
    hasMore: groupedPage.hasMore,
    facets: buildGroupedSearchFacets(allGroupedResults),
  });
}
