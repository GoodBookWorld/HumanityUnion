import type { CommunityOption, GeographyCommunityOption } from "./geography.types.js";
import { normalizeCountryInput, normalizeRegionInput } from "./geography.helpers.js";

export const OTHER_COMMUNITY_CODE = "OTHER-NOT-LISTED";
export const OTHER_COMMUNITY_SLUG = "other-not-listed";

/** Thrown when community JSON cannot be loaded (404 / network / invalid body). */
export class GeographyCommunityDeliveryError extends Error {
  readonly status?: number;

  constructor(message = "City data could not be loaded.", status?: number) {
    super(message);
    this.name = "GeographyCommunityDeliveryError";
    this.status = status;
  }
}

interface CommunityRecord {
  code: string;
  label: string;
}

const communityCache = new Map<string, readonly CommunityOption[]>();

function buildCommunityCacheKey(countryCode: string, regionCode: string): string {
  return `${countryCode}::${regionCode}`;
}

function toCommunityOption(
  countryCode: string,
  regionCode: string,
  record: CommunityRecord,
): CommunityOption {
  return {
    countryCode,
    regionCode,
    code: record.code,
    name: record.label,
  };
}

/** Test / recovery helper — does not clear in-flight requests. */
export function clearCommunityOptionCacheForTests(): void {
  communityCache.clear();
}

export async function fetchCommunitiesByRegion(
  countryCode: string,
  regionCode: string,
): Promise<readonly CommunityOption[]> {
  const normalizedCountry = normalizeCountryInput(countryCode);
  const normalizedRegion = normalizeRegionInput(countryCode, regionCode);

  if (!normalizedCountry || !normalizedRegion || normalizedRegion === "other-not-listed") {
    return [];
  }

  const cacheKey = buildCommunityCacheKey(normalizedCountry, normalizedRegion);
  const cached = communityCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const response = await fetch(
    `/data/geography/communities/${encodeURIComponent(normalizedCountry)}/${encodeURIComponent(normalizedRegion)}.json`,
  );

  // Pack 10F — delivery failure must not be treated as an empty dataset.
  if (response.status === 404 || !response.ok) {
    throw new GeographyCommunityDeliveryError(
      "City data could not be loaded.",
      response.status,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("json")) {
    throw new GeographyCommunityDeliveryError(
      "City data could not be loaded.",
      response.status,
    );
  }

  let records: unknown;
  try {
    records = await response.json();
  } catch {
    throw new GeographyCommunityDeliveryError("City data could not be loaded.", response.status);
  }

  if (!Array.isArray(records)) {
    throw new GeographyCommunityDeliveryError("City data could not be loaded.", response.status);
  }

  const communities = (records as CommunityRecord[])
    .filter(
      (record): record is CommunityRecord =>
        Boolean(record) &&
        typeof record === "object" &&
        typeof record.code === "string" &&
        typeof record.label === "string",
    )
    .map((record) => toCommunityOption(normalizedCountry, normalizedRegion, record));

  communityCache.set(cacheKey, communities);
  return communities;
}

export function toGeographyCommunityOptions(
  countryCode: string,
  regionCode: string,
  communities: readonly CommunityOption[],
  includeOther = true,
): readonly GeographyCommunityOption[] {
  const normalizedCountry = normalizeCountryInput(countryCode);
  const normalizedRegion = normalizeRegionInput(countryCode, regionCode);

  if (!normalizedCountry || !normalizedRegion) {
    return [];
  }

  const options = communities.map((community) => ({
    slug: community.code,
    label: community.name,
    countrySlug: normalizedCountry,
    regionSlug: normalizedRegion,
  }));

  if (!includeOther) {
    return options;
  }

  if (options.length === 0) {
    return [
      {
        slug: OTHER_COMMUNITY_SLUG,
        label: "Other / Not listed",
        countrySlug: normalizedCountry,
        regionSlug: normalizedRegion,
      },
    ];
  }

  return options;
}

export function getCommunityLabel(
  countryCode: string,
  regionCode: string,
  communityCode: string,
): string | undefined {
  const normalizedCommunity = normalizeCommunityInput(countryCode, regionCode, communityCode);

  if (!normalizedCommunity) {
    return undefined;
  }

  if (normalizedCommunity === OTHER_COMMUNITY_SLUG) {
    return "Other / Not listed";
  }

  const cacheKey = buildCommunityCacheKey(
    normalizeCountryInput(countryCode) ?? countryCode,
    normalizeRegionInput(countryCode, regionCode) ?? regionCode,
  );
  const cached = communityCache.get(cacheKey);
  return cached?.find((community) => community.code === normalizedCommunity)?.name;
}

export function normalizeCommunityInput(
  countryCode: string,
  regionCode: string,
  value: string | undefined,
): string | undefined {
  const trimmed = (value ?? "").trim();

  if (!trimmed) {
    return undefined;
  }

  const normalizedCountry = normalizeCountryInput(countryCode);
  const normalizedRegion = normalizeRegionInput(countryCode, regionCode);

  if (!normalizedCountry || !normalizedRegion) {
    return undefined;
  }

  const lower = trimmed.toLowerCase();

  if (lower === OTHER_COMMUNITY_SLUG || lower === "other-not-listed") {
    return OTHER_COMMUNITY_SLUG;
  }

  const cacheKey = buildCommunityCacheKey(normalizedCountry, normalizedRegion);
  const cached = communityCache.get(cacheKey);
  const match = cached?.find(
    (community) =>
      community.code === trimmed ||
      community.name.trim().toLowerCase() === lower ||
      community.code.toLowerCase() === lower,
  );

  return match?.code;
}
