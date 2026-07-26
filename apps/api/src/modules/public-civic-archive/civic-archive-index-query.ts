import type { CivicArchiveOutcomeStatus } from "@hu/types";

export interface CivicArchiveLifecycleIndexQuery {
  search?: string;
  country?: string;
  region?: string;
  community?: string;
  activityArea?: string;
  implementationYear?: number;
  outcomeStatus?: CivicArchiveOutcomeStatus;
  includeVerificationFixtures?: boolean;
  verificationRunId?: string;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function parseArchiveYear(value: unknown): number | undefined {
  const raw = readString(value);

  if (!raw || !/^\d{4}$/.test(raw)) {
    return undefined;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseOutcomeStatus(value: unknown): CivicArchiveOutcomeStatus | undefined {
  const raw = readString(value);

  if (!raw) {
    return undefined;
  }

  const allowed: CivicArchiveOutcomeStatus[] = [
    "completed",
    "partially_implemented",
    "concluded_without_implementation",
    "cancelled",
    "superseded",
  ];

  return allowed.includes(raw as CivicArchiveOutcomeStatus)
    ? (raw as CivicArchiveOutcomeStatus)
    : undefined;
}

export function parseCivicArchiveIndexQuery(
  query: Record<string, unknown>,
): CivicArchiveLifecycleIndexQuery {
  const search = readString(query.q) ?? readString(query.search) ?? readString(query.query);

  return {
    search,
    country: readString(query.countryCode) ?? readString(query.country),
    region: readString(query.regionId) ?? readString(query.region),
    community: readString(query.cityCommunityId) ?? readString(query.community),
    activityArea: readString(query.activityArea),
    implementationYear:
      parseArchiveYear(query.archiveYear) ?? parseArchiveYear(query.implementationYear),
    outcomeStatus: parseOutcomeStatus(query.outcomeStatus),
    includeVerificationFixtures: query.includeVerificationFixtures === "true",
    verificationRunId: readString(query.verificationRunId),
  };
}
