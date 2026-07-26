import type { CivicSearchQuery, CivicSearchResult } from "@hu/types";
import { resolveCountrySearchSlug, resolveRegionSearchSlug } from "@hu/geography";

import { GLOBAL_SEARCH_ENTITY_TYPE_LABELS } from "./global-search.types.js";
import type { GlobalSearchIndexEntry, GlobalSearchRankedMatch } from "./global-search.types.js";

const SCORE_EXACT_TITLE = 5000;
const SCORE_TITLE_CONTAINS = 4000;
const SCORE_SUMMARY_CONTAINS = 3000;
const SCORE_LOCATION_OR_ACTIVITY = 2000;
const SCORE_STATUS_OR_TYPE = 1000;

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeCommunityFilter(value: string): string {
  return normalize(value).replace(/\s+/g, "-");
}

function geographyFilterMatches(
  filterValue: string | undefined,
  entry: GlobalSearchIndexEntry,
  kind: "country" | "region" | "community",
  query?: CivicSearchQuery,
): boolean {
  if (!filterValue) {
    return true;
  }

  if (kind === "country") {
    const filterSlug = resolveCountrySearchSlug(filterValue);
    const indexedSlug = resolveCountrySearchSlug(entry.country);
    const indexedCodeSlug = entry.countryCode ? resolveCountrySearchSlug(entry.countryCode) : "";

    if (filterSlug === indexedSlug) {
      return true;
    }

    return indexedCodeSlug !== "" && filterSlug === indexedCodeSlug;
  }

  if (kind === "region") {
    const countrySlug = query?.country
      ? resolveCountrySearchSlug(query.country)
      : queryCountrySlugForRegion(entry, filterValue);
    const filterSlug = resolveRegionSearchSlug(countrySlug, filterValue);
    const indexedSlug = resolveRegionSearchSlug(entry.country, entry.region);
    return filterSlug === indexedSlug;
  }

  const normalizedFilter = normalizeCommunityFilter(filterValue);
  const normalizedIndexed = normalizeCommunityFilter(entry.community);
  return normalizedIndexed === normalizedFilter;
}

function queryCountrySlugForRegion(entry: GlobalSearchIndexEntry, filterValue: string): string {
  const regionCodeMatch = /^([a-z]{2})-/i.exec(filterValue.trim());

  if (regionCodeMatch) {
    return resolveCountrySearchSlug(regionCodeMatch[1] ?? entry.country);
  }

  return entry.country;
}

function withinDateRange(updatedAt: string, fromDate?: string, toDate?: string): boolean {
  const timestamp = new Date(updatedAt).getTime();

  if (fromDate) {
    const from = new Date(fromDate).getTime();

    if (!Number.isNaN(from) && timestamp < from) {
      return false;
    }
  }

  if (toDate) {
    const to = new Date(toDate).getTime();

    if (!Number.isNaN(to) && timestamp > to) {
      return false;
    }
  }

  return true;
}

function passesFilters(query: CivicSearchQuery, entry: GlobalSearchIndexEntry): boolean {
  if (query.entityTypes && !query.entityTypes.includes(entry.entityType)) {
    return false;
  }

  if (!geographyFilterMatches(query.country, entry, "country", query)) {
    return false;
  }

  if (!geographyFilterMatches(query.region, entry, "region", query)) {
    return false;
  }

  if (!geographyFilterMatches(query.community, entry, "community", query)) {
    return false;
  }

  if (query.activityArea && normalize(entry.activityArea) !== normalize(query.activityArea)) {
    return false;
  }

  if (query.status && normalize(entry.status) !== normalize(query.status)) {
    return false;
  }

  if (!withinDateRange(entry.updatedAt, query.fromDate, query.toDate)) {
    return false;
  }

  return true;
}

function locationFieldsMatchSearchTerm(entry: GlobalSearchIndexEntry, searchTerm: string): boolean {
  return (
    entry.normalizedCountry.includes(searchTerm) ||
    entry.normalizedRegion.includes(searchTerm) ||
    entry.normalizedCommunity.includes(searchTerm) ||
    entry.normalizedActivityArea.includes(searchTerm) ||
    entry.normalizedCountryLabel.includes(searchTerm) ||
    entry.normalizedRegionLabel.includes(searchTerm) ||
    entry.normalizedCountryCode.includes(searchTerm) ||
    entry.normalizedRegionCode.includes(searchTerm)
  );
}

function rankEntry(
  query: CivicSearchQuery,
  entry: GlobalSearchIndexEntry,
): GlobalSearchRankedMatch | null {
  const searchTerm = normalize(query.q);
  const matchedFields: string[] = [];
  let score = 0;
  const explanations: string[] = [];

  if (searchTerm) {
    if (entry.normalizedTitle === searchTerm) {
      score += SCORE_EXACT_TITLE;
      matchedFields.push("title");
      explanations.push(`Exact title match for "${query.q}".`);
    } else if (entry.normalizedTitle.includes(searchTerm)) {
      score += SCORE_TITLE_CONTAINS;
      matchedFields.push("title");
      explanations.push(`Title contains "${query.q}".`);
    }

    if (entry.normalizedSummary.includes(searchTerm)) {
      score += SCORE_SUMMARY_CONTAINS;
      matchedFields.push("summary");
      explanations.push(`Summary contains "${query.q}".`);
    }

    if (locationFieldsMatchSearchTerm(entry, searchTerm)) {
      score += SCORE_LOCATION_OR_ACTIVITY;
      matchedFields.push("location");
      explanations.push(`Location or activity area matches "${query.q}".`);
    }

    if (
      entry.normalizedStatus.includes(searchTerm) ||
      entry.normalizedEntityType.includes(searchTerm)
    ) {
      score += SCORE_STATUS_OR_TYPE;
      matchedFields.push("status");
      explanations.push(`Status or record type matches "${query.q}".`);
    }

    if (score === 0) {
      return null;
    }
  }

  if (explanations.length === 0) {
    explanations.push("Record matches the selected civic search filters.");
  }

  return {
    entry,
    score,
    matchedFields,
    explanation: explanations.join(" "),
  };
}

export function matchGlobalSearchIndex(
  query: CivicSearchQuery,
  index: GlobalSearchIndexEntry[],
): GlobalSearchRankedMatch[] {
  const ranked: GlobalSearchRankedMatch[] = [];

  for (const entry of index) {
    if (!passesFilters(query, entry)) {
      continue;
    }

    const match = rankEntry(query, entry);

    if (!match) {
      continue;
    }

    ranked.push(match);
  }

  return ranked.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    const leftTime = new Date(left.entry.updatedAt).getTime();
    const rightTime = new Date(right.entry.updatedAt).getTime();

    if (rightTime !== leftTime) {
      return rightTime - leftTime;
    }

    const leftKey = `${left.entry.entityType}:${left.entry.entityId}`;
    const rightKey = `${right.entry.entityType}:${right.entry.entityId}`;

    return leftKey.localeCompare(rightKey);
  });
}

export function toSearchResult(match: GlobalSearchRankedMatch): CivicSearchResult {
  const { entry } = match;

  return {
    entityType: entry.entityType,
    entityId: entry.entityId,
    title: entry.title,
    summary: entry.summary,
    publicUrl: entry.publicUrl,
    country: entry.country || undefined,
    region: entry.region || undefined,
    community: entry.community || undefined,
    activityArea: entry.activityArea || undefined,
    status: entry.status,
    updatedAt: entry.updatedAt,
    matchedFields: match.matchedFields,
    explanation: match.explanation,
    countryLabel: entry.countryLabel || undefined,
    regionLabel: entry.regionLabel || undefined,
    countryCode: entry.countryCode || undefined,
    regionCode: entry.regionCode || undefined,
    imageUrl: entry.imageUrl || undefined,
    initiativeId: entry.initiativeId || undefined,
  };
}

export function entityTypeLabel(entityType: CivicSearchResult["entityType"]): string {
  return GLOBAL_SEARCH_ENTITY_TYPE_LABELS[entityType];
}
