import type { CivicArchiveOutcomeStatus } from "@hu/types";

export interface CivicArchiveDraftFilters {
  q: string;
  countryCode: string;
  regionId: string;
  cityCommunityId: string;
  activityArea: string;
  archiveYear: string;
  outcomeStatus: string;
}

export interface CivicArchiveAppliedFilters {
  q?: string;
  countryCode?: string;
  regionId?: string;
  cityCommunityId?: string;
  activityArea?: string;
  archiveYear?: number;
  outcomeStatus?: CivicArchiveOutcomeStatus;
}

export interface CivicArchiveFilterChip {
  key: keyof CivicArchiveDraftFilters;
  label: string;
}

export const EMPTY_CIVIC_ARCHIVE_DRAFT_FILTERS: CivicArchiveDraftFilters = {
  q: "",
  countryCode: "",
  regionId: "",
  cityCommunityId: "",
  activityArea: "",
  archiveYear: "",
  outcomeStatus: "",
};

function readParam(
  params: URLSearchParams | Readonly<Record<string, string | string[] | undefined>>,
  key: string,
): string {
  if (params instanceof URLSearchParams) {
    return params.get(key)?.trim() ?? "";
  }

  const value = params[key];
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return value?.trim() ?? "";
}

function parseOutcomeStatus(value: string): CivicArchiveOutcomeStatus | undefined {
  if (!value) {
    return undefined;
  }

  const allowed: CivicArchiveOutcomeStatus[] = [
    "completed",
    "partially_implemented",
    "concluded_without_implementation",
    "cancelled",
    "superseded",
  ];

  return allowed.includes(value as CivicArchiveOutcomeStatus)
    ? (value as CivicArchiveOutcomeStatus)
    : undefined;
}

export function parseArchiveYearInput(value: string): number | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  if (!/^\d{4}$/.test(trimmed)) {
    return undefined;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function validateArchiveYearInput(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  return /^\d{4}$/.test(trimmed) ? null : "Enter a valid four-digit year.";
}

export function parseCivicArchiveAppliedFilters(
  params: URLSearchParams | Readonly<Record<string, string | string[] | undefined>>,
): CivicArchiveAppliedFilters {
  const q = readParam(params, "q") || readParam(params, "search");
  const countryCode = readParam(params, "countryCode") || readParam(params, "country");
  const regionId = readParam(params, "regionId") || readParam(params, "region");
  const cityCommunityId = readParam(params, "cityCommunityId") || readParam(params, "community");
  const activityArea = readParam(params, "activityArea");
  const archiveYearRaw =
    readParam(params, "archiveYear") || readParam(params, "implementationYear");
  const outcomeStatus = parseOutcomeStatus(readParam(params, "outcomeStatus"));

  return {
    q: q || undefined,
    countryCode: countryCode || undefined,
    regionId: regionId || undefined,
    cityCommunityId: cityCommunityId || undefined,
    activityArea: activityArea || undefined,
    archiveYear: parseArchiveYearInput(archiveYearRaw),
    outcomeStatus,
  };
}

export function draftFiltersFromApplied(
  applied: CivicArchiveAppliedFilters,
): CivicArchiveDraftFilters {
  return {
    q: applied.q ?? "",
    countryCode: applied.countryCode ?? "",
    regionId: applied.regionId ?? "",
    cityCommunityId: applied.cityCommunityId ?? "",
    activityArea: applied.activityArea ?? "",
    archiveYear: applied.archiveYear ? String(applied.archiveYear) : "",
    outcomeStatus: applied.outcomeStatus ?? "",
  };
}

export type CivicArchiveResultsStatus = "idle" | "loading" | "success" | "empty" | "error";

export const CIVIC_ARCHIVE_IDLE_INSTRUCTION =
  "Enter a keyword or select one or more filters, then select Search to view archived civic initiatives.";

export const CIVIC_ARCHIVE_EMPTY_SEARCH_MESSAGE =
  "Enter a keyword or select at least one filter before searching.";

export const CIVIC_ARCHIVE_NO_MATCH_MESSAGE =
  "No archived civic initiatives match the selected search criteria.";

export function hasDraftSearchCriteria(filters: CivicArchiveDraftFilters): boolean {
  return Boolean(
    filters.q.trim() ||
    filters.countryCode ||
    filters.regionId ||
    filters.cityCommunityId ||
    filters.activityArea ||
    filters.archiveYear.trim() ||
    filters.outcomeStatus,
  );
}

export function deriveCivicArchiveResultsStatus(input: {
  hasSubmittedSearch: boolean;
  loading: boolean;
  apiUnavailable: boolean;
  resultCount: number;
}): CivicArchiveResultsStatus {
  if (!input.hasSubmittedSearch) {
    return "idle";
  }

  if (input.loading) {
    return "loading";
  }

  if (input.apiUnavailable) {
    return "error";
  }

  return input.resultCount > 0 ? "success" : "empty";
}

export function hasAppliedCivicArchiveFilters(applied: CivicArchiveAppliedFilters): boolean {
  return Boolean(
    applied.q ||
    applied.countryCode ||
    applied.regionId ||
    applied.cityCommunityId ||
    applied.activityArea ||
    applied.archiveYear ||
    applied.outcomeStatus,
  );
}

export function buildCivicArchiveSearchParams(
  filters: CivicArchiveDraftFilters | CivicArchiveAppliedFilters,
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.q?.trim()) {
    params.set("q", filters.q.trim());
  }

  if (filters.countryCode?.trim()) {
    params.set("countryCode", filters.countryCode.trim());
  }

  if (filters.regionId?.trim()) {
    params.set("regionId", filters.regionId.trim());
  }

  if (filters.cityCommunityId?.trim()) {
    params.set("cityCommunityId", filters.cityCommunityId.trim());
  }

  if (filters.activityArea?.trim()) {
    params.set("activityArea", filters.activityArea.trim());
  }

  const archiveYear =
    typeof filters.archiveYear === "string"
      ? filters.archiveYear.trim()
      : filters.archiveYear
        ? String(filters.archiveYear)
        : "";

  if (archiveYear) {
    params.set("archiveYear", archiveYear);
  }

  if (filters.outcomeStatus?.trim()) {
    params.set("outcomeStatus", filters.outcomeStatus.trim());
  }

  return params;
}

export const CIVIC_ARCHIVE_QUERY_SCHEMA_VERSION = "107d";

export function buildCivicArchiveQueryKey(applied: CivicArchiveAppliedFilters): string {
  return JSON.stringify([
    CIVIC_ARCHIVE_QUERY_SCHEMA_VERSION,
    applied.q ?? "",
    applied.countryCode ?? "",
    applied.regionId ?? "",
    applied.cityCommunityId ?? "",
    applied.activityArea ?? "",
    applied.archiveYear ?? "",
    applied.outcomeStatus ?? "",
  ]);
}

export function buildCivicArchiveApiQuery(
  applied: CivicArchiveAppliedFilters,
): Record<string, string | number> {
  const query: Record<string, string | number> = {};

  if (applied.q) {
    query.q = applied.q;
  }

  if (applied.countryCode) {
    query.countryCode = applied.countryCode;
  }

  if (applied.regionId) {
    query.regionId = applied.regionId;
  }

  if (applied.cityCommunityId) {
    query.cityCommunityId = applied.cityCommunityId;
  }

  if (applied.activityArea) {
    query.activityArea = applied.activityArea;
  }

  if (applied.archiveYear) {
    query.archiveYear = applied.archiveYear;
  }

  if (applied.outcomeStatus) {
    query.outcomeStatus = applied.outcomeStatus;
  }

  return query;
}
