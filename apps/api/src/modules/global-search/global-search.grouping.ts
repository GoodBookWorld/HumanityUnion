import type {
  CivicSearchDisplayResult,
  CivicSearchQuery,
  CivicSearchResult,
  InitiativeLifecycleSearchGroup,
  InitiativeLifecycleSearchStage,
  StandaloneCivicSearchResult,
} from "@hu/types";

import type { GlobalSearchIndexEntry, GlobalSearchRankedMatch } from "./global-search.types.js";
import { toSearchResult } from "./global-search.matching.js";
import {
  INITIATIVE_TIMELINE_STAGES,
  entityKey,
  resolveInitiativeIdFromEntry,
  resolveInitiativeTimelineStage,
} from "./global-search.stages.js";

interface DisplayUnitSortKey {
  score: number;
  latestActivityAt: string;
  stableId: string;
}

interface GroupedSearchPage {
  displayResults: CivicSearchDisplayResult[];
  totalDisplayResults: number;
  initiativeGroupCount: number;
  standaloneResultCount: number;
  hasMore: boolean;
}

function toContextSearchResult(entry: GlobalSearchIndexEntry): CivicSearchResult {
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
    matchedFields: [],
    explanation: "",
    countryLabel: entry.countryLabel || undefined,
    regionLabel: entry.regionLabel || undefined,
    countryCode: entry.countryCode || undefined,
    regionCode: entry.regionCode || undefined,
    imageUrl: entry.imageUrl || undefined,
    initiativeId: entry.initiativeId || undefined,
  };
}

function buildIndexByInitiative(
  index: GlobalSearchIndexEntry[],
): Map<string, GlobalSearchIndexEntry[]> {
  const map = new Map<string, GlobalSearchIndexEntry[]>();

  for (const entry of index) {
    const initiativeId = resolveInitiativeIdFromEntry(entry);

    if (!initiativeId) {
      continue;
    }

    const bucket = map.get(initiativeId);

    if (bucket) {
      bucket.push(entry);
    } else {
      map.set(initiativeId, [entry]);
    }
  }

  return map;
}

function maxUpdatedAt(entries: GlobalSearchIndexEntry[]): string {
  return entries.reduce(
    (latest, entry) => {
      return new Date(entry.updatedAt).getTime() > new Date(latest).getTime()
        ? entry.updatedAt
        : latest;
    },
    entries[0]?.updatedAt ?? new Date(0).toISOString(),
  );
}

function hydrateInitiativeGroup(
  initiativeId: string,
  matchedByEntityKey: Map<string, GlobalSearchRankedMatch>,
  lifecycleEntries: GlobalSearchIndexEntry[],
  sortKey: DisplayUnitSortKey,
): InitiativeLifecycleSearchGroup {
  const stageBuckets = new Map<string, InitiativeLifecycleSearchStage>();
  let totalChildRecordCount = 0;
  let matchedChildRecordCount = 0;
  let initiativeRecord: GlobalSearchIndexEntry | undefined;

  for (const entry of lifecycleEntries) {
    const stage = resolveInitiativeTimelineStage(entry.entityType);

    if (!stage) {
      continue;
    }

    if (entry.entityType === "initiative") {
      initiativeRecord = entry;
    }

    totalChildRecordCount += 1;

    const key = entityKey(entry.entityType, entry.entityId);
    const matched = matchedByEntityKey.get(key);
    const record = matched ? toSearchResult(matched) : toContextSearchResult(entry);

    if (matched) {
      matchedChildRecordCount += 1;
    }

    let stageBucket = stageBuckets.get(stage.stageId);

    if (!stageBucket) {
      stageBucket = {
        stageId: stage.stageId,
        label: stage.label,
        records: [],
        matchedRecordCount: 0,
        matched: false,
      };
      stageBuckets.set(stage.stageId, stageBucket);
    }

    stageBucket.records.push(record);

    if (matched) {
      stageBucket.matchedRecordCount += 1;
      stageBucket.matched = true;
    }
  }

  const stages = INITIATIVE_TIMELINE_STAGES.map((stageDefinition) => {
    const existing = stageBuckets.get(stageDefinition.stageId);

    if (existing) {
      return existing;
    }

    return {
      stageId: stageDefinition.stageId,
      label: stageDefinition.label,
      records: [],
      matchedRecordCount: 0,
      matched: false,
    };
  });

  for (const stage of stages) {
    stage.records.sort((left, right) => {
      const leftTime = new Date(left.updatedAt).getTime();
      const rightTime = new Date(right.updatedAt).getTime();

      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }

      return `${left.entityType}:${left.entityId}`.localeCompare(
        `${right.entityType}:${right.entityId}`,
      );
    });
  }

  const headerSource = initiativeRecord ?? lifecycleEntries[0]!;

  return {
    kind: "initiative_group",
    initiativeId,
    title: headerSource.title,
    summary: headerSource.summary,
    country: headerSource.country || undefined,
    region: headerSource.region || undefined,
    community: headerSource.community || undefined,
    activityArea: headerSource.activityArea || undefined,
    status: headerSource.status,
    latestActivityAt: sortKey.latestActivityAt,
    imageUrl: headerSource.imageUrl || undefined,
    countryLabel: headerSource.countryLabel || undefined,
    regionLabel: headerSource.regionLabel || undefined,
    countryCode: headerSource.countryCode || undefined,
    regionCode: headerSource.regionCode || undefined,
    stages,
    totalChildRecordCount,
    matchedChildRecordCount,
  };
}

function compareDisplayUnits(
  left: { sortKey: DisplayUnitSortKey },
  right: { sortKey: DisplayUnitSortKey },
): number {
  if (right.sortKey.score !== left.sortKey.score) {
    return right.sortKey.score - left.sortKey.score;
  }

  const leftTime = new Date(left.sortKey.latestActivityAt).getTime();
  const rightTime = new Date(right.sortKey.latestActivityAt).getTime();

  if (rightTime !== leftTime) {
    return rightTime - leftTime;
  }

  return left.sortKey.stableId.localeCompare(right.sortKey.stableId);
}

export function buildGroupedSearchPage(
  query: CivicSearchQuery,
  matched: GlobalSearchRankedMatch[],
  index: GlobalSearchIndexEntry[],
): GroupedSearchPage {
  const indexByInitiative = buildIndexByInitiative(index);
  const matchedByEntityKey = new Map<string, GlobalSearchRankedMatch>();
  const initiativeMatchScores = new Map<string, number>();
  const standaloneUnits: Array<{
    display: StandaloneCivicSearchResult;
    sortKey: DisplayUnitSortKey;
  }> = [];

  for (const match of matched) {
    const key = entityKey(match.entry.entityType, match.entry.entityId);
    matchedByEntityKey.set(key, match);

    const initiativeId = resolveInitiativeIdFromEntry(match.entry);
    const stage = resolveInitiativeTimelineStage(match.entry.entityType);

    if (initiativeId && stage) {
      const currentScore = initiativeMatchScores.get(initiativeId) ?? 0;
      initiativeMatchScores.set(initiativeId, Math.max(currentScore, match.score));
      continue;
    }

    standaloneUnits.push({
      display: {
        kind: "standalone",
        result: toSearchResult(match),
      },
      sortKey: {
        score: match.score,
        latestActivityAt: match.entry.updatedAt,
        stableId: key,
      },
    });
  }

  const initiativeUnits: Array<{
    display: InitiativeLifecycleSearchGroup;
    sortKey: DisplayUnitSortKey;
  }> = [];

  for (const initiativeId of initiativeMatchScores.keys()) {
    const lifecycleEntries = indexByInitiative.get(initiativeId) ?? [];
    const sortKey: DisplayUnitSortKey = {
      score: initiativeMatchScores.get(initiativeId) ?? 0,
      latestActivityAt: maxUpdatedAt(lifecycleEntries),
      stableId: initiativeId,
    };

    initiativeUnits.push({
      display: hydrateInitiativeGroup(initiativeId, matchedByEntityKey, lifecycleEntries, sortKey),
      sortKey,
    });
  }

  const allUnits = [...initiativeUnits, ...standaloneUnits].sort(compareDisplayUnits);
  const totalDisplayResults = allUnits.length;
  const pageUnits = allUnits.slice(query.offset, query.offset + query.limit);
  const displayResults: CivicSearchDisplayResult[] = pageUnits.map((unit) => unit.display);

  return {
    displayResults,
    totalDisplayResults,
    initiativeGroupCount: initiativeUnits.length,
    standaloneResultCount: standaloneUnits.length,
    hasMore: query.offset + query.limit < totalDisplayResults,
  };
}
