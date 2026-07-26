import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeCountryInput, normalizeRegionInput } from "@hu/geography";

import { getKnownInitiativeCommunity } from "../initiatives/initiative-communities.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");

const COMMUNITIES_ROOT = path.join(REPO_ROOT, "apps/web/public/data/geography/communities");

interface CommunityRecord {
  code: string;
  label: string;
}

const communityCache = new Map<string, readonly CommunityRecord[]>();

const LEGACY_COMMUNITY_SLUG_ALIASES: Record<
  string,
  { countrySlug: string; regionSlug: string; communitySlug: string }
> = {
  "nelson-community-garden": {
    countrySlug: "CA",
    regionSlug: "CA-BC",
    communitySlug: "16735",
  },
};

function cacheKey(countrySlug: string, regionSlug: string): string {
  return `${countrySlug}::${regionSlug}`;
}

export function loadCommunitiesForRegion(
  countrySlug: string,
  regionSlug: string,
): readonly CommunityRecord[] {
  const normalizedCountry = normalizeCountryInput(countrySlug);
  const normalizedRegion = normalizeRegionInput(countrySlug, regionSlug);

  if (!normalizedCountry || !normalizedRegion) {
    return [];
  }

  const key = cacheKey(normalizedCountry, normalizedRegion);
  const cached = communityCache.get(key);

  if (cached) {
    return cached;
  }

  const filePath = path.join(COMMUNITIES_ROOT, normalizedCountry, `${normalizedRegion}.json`);

  if (!fs.existsSync(filePath)) {
    communityCache.set(key, []);
    return [];
  }

  const records = JSON.parse(fs.readFileSync(filePath, "utf-8")) as CommunityRecord[];
  communityCache.set(key, records);
  return records;
}

export function resolveParticipationCommunitySlug(input: {
  countrySlug: string;
  regionSlug?: string;
  communitySlug?: string;
}): string | undefined {
  const raw = input.communitySlug?.trim();

  if (!raw) {
    return undefined;
  }

  const legacyAlias = LEGACY_COMMUNITY_SLUG_ALIASES[raw.toLowerCase()];

  if (legacyAlias) {
    const normalizedCountry = normalizeCountryInput(input.countrySlug);
    const normalizedRegion = input.regionSlug
      ? normalizeRegionInput(input.countrySlug, input.regionSlug)
      : undefined;

    if (
      normalizedCountry === legacyAlias.countrySlug &&
      normalizedRegion === legacyAlias.regionSlug
    ) {
      return legacyAlias.communitySlug;
    }
  }

  if (!input.regionSlug) {
    return undefined;
  }

  const communities = loadCommunitiesForRegion(input.countrySlug, input.regionSlug);
  const lower = raw.toLowerCase();

  const match = communities.find(
    (community) =>
      community.code === raw ||
      community.code.toLowerCase() === lower ||
      community.label.trim().toLowerCase() === lower,
  );

  return match?.code;
}

export function getParticipationCommunityLabel(input: {
  countrySlug: string;
  regionSlug?: string;
  communitySlug?: string;
}): string | undefined {
  const resolvedSlug = resolveParticipationCommunitySlug(input);

  if (!resolvedSlug || !input.regionSlug) {
    return input.communitySlug;
  }

  const communities = loadCommunitiesForRegion(input.countrySlug, input.regionSlug);
  return (
    communities.find((community) => community.code === resolvedSlug)?.label ?? input.communitySlug
  );
}

export function isRecognizedParticipationCommunitySlug(input: {
  countrySlug: string;
  regionSlug?: string;
  communitySlug?: string;
}): boolean {
  if (!input.communitySlug) {
    return true;
  }

  return Boolean(resolveParticipationCommunitySlug(input));
}

export function resolveArchiveCommunityFilterLabels(input: {
  filterValue: string;
  countryFilter?: string;
  regionFilter?: string;
}): string[] {
  const candidates = new Set<string>([input.filterValue.trim()]);
  const filterValue = input.filterValue.trim();

  const knownCommunity = getKnownInitiativeCommunity(filterValue);

  if (knownCommunity) {
    candidates.add(knownCommunity.name);
  }

  for (const [legacySlug, alias] of Object.entries(LEGACY_COMMUNITY_SLUG_ALIASES)) {
    if (alias.communitySlug === filterValue) {
      candidates.add(legacySlug.replace(/-/g, " "));
      const known = getKnownInitiativeCommunity(legacySlug);

      if (known) {
        candidates.add(known.name);
      }
    }
  }

  const countryCodes = (input.countryFilter ?? "")
    .split(",")
    .map((country) => normalizeCountryInput(country.trim()))
    .filter((country): country is string => Boolean(country));

  const regionCodes = (input.regionFilter ?? "")
    .split(",")
    .map((region) => region.trim())
    .filter(Boolean);

  for (const countryCode of countryCodes) {
    for (const regionCode of regionCodes.length > 0 ? regionCodes : [""]) {
      if (!regionCode) {
        continue;
      }

      const resolvedLabel = getParticipationCommunityLabel({
        countrySlug: countryCode,
        regionSlug: regionCode,
        communitySlug: filterValue,
      });

      if (resolvedLabel?.trim()) {
        candidates.add(resolvedLabel.trim());
      }

      for (const community of loadCommunitiesForRegion(countryCode, regionCode)) {
        if (community.code === filterValue) {
          candidates.add(community.label.trim());
        }
      }
    }
  }

  return [...candidates];
}

export function resetParticipationCommunityCacheForTests(): void {
  communityCache.clear();
}
