import type { CivicSearchQuery, CivicSearchResult } from "@hu/types";
import { resolveInitiativeLifecycleProfile } from "@hu/types";
import { resolveCountrySearchSlug, resolveRegionSearchSlug } from "@hu/geography";

import { getInitiativeById } from "../initiatives/initiative.store.js";
import { resolveLanguageRegistryLocale } from "../language/language-registry/language-registry.repository.js";
import { GLOBAL_SEARCH_ENTITY_TYPE_LABELS } from "./global-search.types.js";
import type { GlobalSearchIndexEntry, GlobalSearchRankedMatch } from "./global-search.types.js";

/** Canonical English / fallback title exact match. */
const SCORE_EXACT_TITLE = 5000;
/** Canonical English / fallback title contains. */
const SCORE_TITLE_CONTAINS = 4000;
const SCORE_SUMMARY_CONTAINS = 3000;
const SCORE_LOCATION_OR_ACTIVITY = 2000;
const SCORE_STATUS_OR_TYPE = 1000;

/**
 * Pack 02H multilingual scores (preferred locale):
 * - SCORE_LOCALE_TITLE_EXACT = 5500 (above English exact 5000)
 * - SCORE_LOCALE_TITLE_CONTAINS = 4500
 * - SCORE_LOCALE_SUMMARY = 3500
 * - SCORE_TERMINOLOGY_ALIAS = 4200
 * - SCORE_FALLBACK_TITLE remains 4000/5000 for canonical
 *
 * When query.locale is omitted, current translations still match at a slightly
 * lower boost than the preferred-locale scores ( −200 ).
 */
const SCORE_LOCALE_TITLE_EXACT = 5500;
const SCORE_LOCALE_TITLE_CONTAINS = 4500;
const SCORE_LOCALE_SUMMARY = 3500;
const SCORE_TERMINOLOGY_ALIAS = 4200;
const SCORE_UNPREFERRED_LOCALE_DELTA = 200;

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

  if (query.lifecycleProfile) {
    const initiativeId =
      entry.entityType === "initiative" ? entry.entityId : entry.initiativeId;
    if (!initiativeId) {
      return false;
    }

    const initiative = getInitiativeById(initiativeId);
    if (!initiative) {
      return false;
    }

    if (resolveInitiativeLifecycleProfile(initiative.lifecycleProfile) !== query.lifecycleProfile) {
      return false;
    }
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

function localeBoost(base: number, preferredLocale: string | undefined, fieldLanguage: string): number {
  if (!preferredLocale) {
    return base - SCORE_UNPREFERRED_LOCALE_DELTA;
  }
  if (preferredLocale === fieldLanguage) {
    return base;
  }
  // Non-preferred current translations are still discoverable at the unpreferred boost.
  return base - SCORE_UNPREFERRED_LOCALE_DELTA;
}

function shouldMatchLanguage(
  preferredLocale: string | undefined,
  fieldLanguage: string,
): boolean {
  // Preferred locale set → only that language. No locale → all current translations.
  return !preferredLocale || preferredLocale === fieldLanguage;
}

function rankMultilingualFields(
  entry: GlobalSearchIndexEntry,
  searchTerm: string,
  preferredLocale: string | undefined,
  matchedFields: string[],
  explanations: string[],
  queryLabel: string | undefined,
): number {
  let score = 0;
  const titles = entry.normalizedTranslatedTitles ?? {};
  const summaries = entry.normalizedTranslatedSummaries ?? {};
  const terminology = entry.normalizedTerminologyAliasesByLanguage ?? {};

  for (const language of Object.keys(titles)) {
    if (!shouldMatchLanguage(preferredLocale, language)) {
      continue;
    }
    const normalizedTitle = titles[language];
    if (!normalizedTitle) {
      continue;
    }
    if (normalizedTitle === searchTerm) {
      score += localeBoost(SCORE_LOCALE_TITLE_EXACT, preferredLocale, language);
      matchedFields.push("translated_title");
      explanations.push(`Exact localized title match for "${queryLabel}".`);
    } else if (normalizedTitle.includes(searchTerm)) {
      score += localeBoost(SCORE_LOCALE_TITLE_CONTAINS, preferredLocale, language);
      matchedFields.push("translated_title");
      explanations.push(`Localized title contains "${queryLabel}".`);
    }
  }

  for (const language of Object.keys(summaries)) {
    if (!shouldMatchLanguage(preferredLocale, language)) {
      continue;
    }
    const normalizedSummary = summaries[language];
    if (!normalizedSummary?.includes(searchTerm)) {
      continue;
    }
    score += localeBoost(SCORE_LOCALE_SUMMARY, preferredLocale, language);
    matchedFields.push("translated_summary");
    explanations.push(`Localized summary contains "${queryLabel}".`);
  }

  for (const language of Object.keys(terminology)) {
    if (!shouldMatchLanguage(preferredLocale, language)) {
      continue;
    }
    const terms = terminology[language] ?? [];
    if (!terms.some((term) => term === searchTerm || term.includes(searchTerm))) {
      continue;
    }
    score += localeBoost(SCORE_TERMINOLOGY_ALIAS, preferredLocale, language);
    matchedFields.push("terminology_alias");
    explanations.push(`Terminology alias matches "${queryLabel}".`);
  }

  return score;
}

function rankEntry(
  query: CivicSearchQuery,
  entry: GlobalSearchIndexEntry,
  preferredLocale: string | undefined,
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

    score += rankMultilingualFields(
      entry,
      searchTerm,
      preferredLocale,
      matchedFields,
      explanations,
      query.q,
    );

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
    matchedFields: [...new Set(matchedFields)],
    explanation: explanations.join(" "),
  };
}

export async function resolvePreferredSearchLocale(
  locale: string | undefined,
): Promise<string | undefined> {
  if (!locale?.trim()) {
    return undefined;
  }

  try {
    const record = await resolveLanguageRegistryLocale(locale);
    if (!record || !record.enabled || !record.searchEnabled) {
      return undefined;
    }
    return record.locale;
  } catch {
    return undefined;
  }
}

export async function matchGlobalSearchIndex(
  query: CivicSearchQuery,
  index: GlobalSearchIndexEntry[],
): Promise<GlobalSearchRankedMatch[]> {
  const preferredLocale = await resolvePreferredSearchLocale(query.locale);
  const ranked: GlobalSearchRankedMatch[] = [];

  for (const entry of index) {
    if (!passesFilters(query, entry)) {
      continue;
    }

    const match = rankEntry(query, entry, preferredLocale);

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

function resolveDisplayTranslation(
  entry: GlobalSearchIndexEntry,
  preferredLocale: string | undefined,
): { title: string; summary: string; displayLanguage?: string; presentationMode: "preferred_translation" | "original" } {
  if (!preferredLocale) {
    return {
      title: entry.title,
      summary: entry.summary,
      presentationMode: "original",
    };
  }

  const field = (entry.translatedFields ?? []).find(
    (candidate) =>
      candidate.freshness === "current" &&
      candidate.language === preferredLocale &&
      (Boolean(candidate.title?.trim()) || Boolean(candidate.summary?.trim())),
  );

  if (!field) {
    return {
      title: entry.title,
      summary: entry.summary,
      presentationMode: "original",
    };
  }

  return {
    title: field.title?.trim() || entry.title,
    summary: field.summary?.trim() || entry.summary,
    displayLanguage: preferredLocale,
    presentationMode: "preferred_translation",
  };
}

export function toSearchResult(
  match: GlobalSearchRankedMatch,
  preferredLocale?: string,
): CivicSearchResult {
  const { entry } = match;
  const display = resolveDisplayTranslation(entry, preferredLocale);

  return {
    entityType: entry.entityType,
    entityId: entry.entityId,
    title: display.title,
    summary: display.summary,
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
    displayLanguage: display.displayLanguage,
    presentationMode: display.presentationMode,
  };
}

export function entityTypeLabel(entityType: CivicSearchResult["entityType"]): string {
  return GLOBAL_SEARCH_ENTITY_TYPE_LABELS[entityType];
}

/** Exported for unit tests — Pack 02H score table documentation. */
export const GLOBAL_SEARCH_MULTILINGUAL_SCORES = {
  SCORE_LOCALE_TITLE_EXACT,
  SCORE_LOCALE_TITLE_CONTAINS,
  SCORE_LOCALE_SUMMARY,
  SCORE_TERMINOLOGY_ALIAS,
  SCORE_EXACT_TITLE,
  SCORE_TITLE_CONTAINS,
  SCORE_SUMMARY_CONTAINS,
  SCORE_UNPREFERRED_LOCALE_DELTA,
} as const;
