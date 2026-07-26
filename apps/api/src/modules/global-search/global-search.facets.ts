import type {
  CivicSearchDisplayResult,
  CivicSearchFacetBucket,
  CivicSearchFacets,
  CivicSearchResult,
} from "@hu/types";

function incrementBucket(buckets: Map<string, number>, value: string): void {
  const normalized = value.trim();

  if (!normalized) {
    return;
  }

  buckets.set(normalized, (buckets.get(normalized) ?? 0) + 1);
}

function toSortedBuckets(buckets: Map<string, number>): CivicSearchFacetBucket[] {
  return [...buckets.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
}

export function buildSearchFacets(results: CivicSearchResult[]): CivicSearchFacets {
  const entityTypes = new Map<string, number>();
  const countries = new Map<string, number>();
  const regions = new Map<string, number>();
  const communities = new Map<string, number>();
  const activityAreas = new Map<string, number>();
  const statuses = new Map<string, number>();

  for (const result of results) {
    incrementBucket(entityTypes, result.entityType);
    incrementBucket(countries, result.country ?? "");
    incrementBucket(regions, result.region ?? "");
    incrementBucket(communities, result.community ?? "");
    incrementBucket(activityAreas, result.activityArea ?? "");
    incrementBucket(statuses, result.status);
  }

  return {
    entityTypes: toSortedBuckets(entityTypes),
    countries: toSortedBuckets(countries),
    regions: toSortedBuckets(regions),
    communities: toSortedBuckets(communities),
    activityAreas: toSortedBuckets(activityAreas),
    statuses: toSortedBuckets(statuses),
  };
}

export function buildGroupedSearchFacets(
  displayResults: CivicSearchDisplayResult[],
): CivicSearchFacets {
  const entityTypes = new Map<string, number>();
  const countries = new Map<string, number>();
  const regions = new Map<string, number>();
  const communities = new Map<string, number>();
  const activityAreas = new Map<string, number>();
  const statuses = new Map<string, number>();

  for (const item of displayResults) {
    if (item.kind === "initiative_group") {
      incrementBucket(entityTypes, "initiative");
      incrementBucket(countries, item.country ?? "");
      incrementBucket(regions, item.region ?? "");
      incrementBucket(communities, item.community ?? "");
      incrementBucket(activityAreas, item.activityArea ?? "");
      incrementBucket(statuses, item.status);

      for (const stage of item.stages) {
        for (const record of stage.records) {
          if (record.entityType !== "initiative") {
            incrementBucket(entityTypes, record.entityType);
          }
        }
      }

      continue;
    }

    const result = item.result;
    incrementBucket(entityTypes, result.entityType);
    incrementBucket(countries, result.country ?? "");
    incrementBucket(regions, result.region ?? "");
    incrementBucket(communities, result.community ?? "");
    incrementBucket(activityAreas, result.activityArea ?? "");
    incrementBucket(statuses, result.status);
  }

  return {
    entityTypes: toSortedBuckets(entityTypes),
    countries: toSortedBuckets(countries),
    regions: toSortedBuckets(regions),
    communities: toSortedBuckets(communities),
    activityAreas: toSortedBuckets(activityAreas),
    statuses: toSortedBuckets(statuses),
  };
}
