import {
  getCountries,
  getCountryByCode,
  getRegionLabel,
  getRegionsByCountry,
  normalizeCountryInput,
} from "@hu/geography";
import type { PublicCivicArchiveRecord } from "@hu/types";

import { resolveArchiveCommunityFilterLabels } from "../participation-area/participation-area-community.loader.js";
import type { CivicArchiveLifecycleIndexQuery } from "./civic-archive-index-query.js";

export function parseFilterValues(value?: string): string[] {
  if (!value?.trim()) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function matchesCountryFilter(recordCountry: string, filter?: string): boolean {
  const filters = parseFilterValues(filter);

  if (filters.length === 0) {
    return true;
  }

  const normalizedRecord = recordCountry.trim().toLowerCase();

  return filters.some((filterValue) => {
    const normalizedFilter = filterValue.trim().toLowerCase();

    if (normalizedRecord === normalizedFilter) {
      return true;
    }

    const country = getCountryByCode(filterValue);

    if (country && normalizedRecord === country.name.trim().toLowerCase()) {
      return true;
    }

    return false;
  });
}

function matchesRegionFilter(
  recordRegion: string,
  countryFilter: string | undefined,
  regionFilter?: string,
): boolean {
  const filters = parseFilterValues(regionFilter);

  if (filters.length === 0) {
    return true;
  }

  const normalizedRecord = normalizeComparableValue(recordRegion);

  return filters.some((filterValue) => {
    if (normalizedRecord === normalizeComparableValue(filterValue)) {
      return true;
    }

    const countryCodes = parseFilterValues(countryFilter)
      .map((country) => normalizeCountryInput(country))
      .filter((country): country is string => Boolean(country));

    const scopedCountries =
      countryCodes.length > 0 ? countryCodes : getCountries().map((country) => country.code);

    for (const countryCode of scopedCountries) {
      const label = getRegionLabel(countryCode, filterValue);

      if (label && normalizedRecord === normalizeComparableValue(label)) {
        return true;
      }

      const region = getRegionsByCountry(countryCode).find(
        (entry) =>
          entry.code === filterValue ||
          normalizeComparableValue(entry.name) === normalizeComparableValue(filterValue) ||
          normalizeComparableValue(entry.localCode ?? "") === normalizeComparableValue(filterValue),
      );

      if (region && normalizedRecord === normalizeComparableValue(region.name)) {
        return true;
      }
    }

    return false;
  });
}

function normalizeComparableValue(value: string): string {
  return value.trim().toLowerCase();
}

function resolveCommunityFilterCandidates(
  filterValue: string,
  countryFilter?: string,
  regionFilter?: string,
): string[] {
  return resolveArchiveCommunityFilterLabels({
    filterValue,
    countryFilter,
    regionFilter,
  });
}

function matchesCommunityFilter(
  recordCommunity: string,
  countryFilter?: string,
  regionFilter?: string,
  communityFilter?: string,
): boolean {
  const filters = parseFilterValues(communityFilter);

  if (filters.length === 0) {
    return true;
  }

  const normalizedRecord = normalizeComparableValue(recordCommunity);
  const slugLikeRecord = normalizedRecord.replace(/\s+/g, "-");

  return filters.some((filterValue) => {
    const candidates = resolveCommunityFilterCandidates(filterValue, countryFilter, regionFilter);

    return candidates.some((candidate) => {
      const normalizedCandidate = normalizeComparableValue(candidate);

      return (
        normalizedRecord === normalizedCandidate ||
        slugLikeRecord === normalizedCandidate.replace(/\s+/g, "-")
      );
    });
  });
}

export function matchesQuery(
  record: PublicCivicArchiveRecord,
  query: CivicArchiveLifecycleIndexQuery,
): boolean {
  const search = query.search?.trim().toLowerCase();

  if (search) {
    const haystack =
      `${record.title} ${record.summary} ${record.community} ${record.region} ${record.country} ${record.activityArea}`.toLowerCase();

    if (!haystack.includes(search)) {
      return false;
    }
  }

  if (!matchesCountryFilter(record.country, query.country)) {
    return false;
  }

  if (!matchesRegionFilter(record.region, query.country, query.region)) {
    return false;
  }

  if (!matchesCommunityFilter(record.community, query.country, query.region, query.community)) {
    return false;
  }

  if (query.activityArea && record.activityArea !== query.activityArea) {
    return false;
  }

  if (query.implementationYear) {
    const year = new Date(record.archivedAt ?? record.updatedAt).getFullYear();

    if (year !== query.implementationYear) {
      return false;
    }
  }

  return true;
}
