import type { ReadonlyURLSearchParams } from "next/navigation";

import type { InitiativeActivityAreaOption, PublicNewsArticleItem } from "@hu/types";
import { getMediaRegistryProviderByName } from "@hu/media-registry";

import { INITIATIVE_ACTIVITY_AREA_OPTIONS } from "./initiative-activity-areas";

const NEWS_CATEGORY_TO_ACTIVITY_AREA: Record<string, InitiativeActivityAreaOption> = {
  democracy: "Democracy and Governance",
  "public participation": "Democracy and Governance",
  "human rights": "Human Rights",
  "public health": "Public Health",
  education: "Education",
  "climate resilience": "Environment and Climate",
  "community development": "Housing and Community Development",
  "peace and security": "Peace and Security",
  "emergency response": "Emergency Preparedness and Response",
  "misinformation and media literacy": "Information Integrity and Media Literacy",
  "social justice": "Equality and Inclusion",
  "institutional accountability": "Justice and Rule of Law",
};

export function resolveInitiativeCreateNewsSourceId(
  searchParams: Pick<ReadonlyURLSearchParams, "get">,
): string | null {
  const source = searchParams.get("source");
  const newsId = searchParams.get("newsId")?.trim();

  if (source === "news" && newsId) {
    return newsId;
  }

  const legacyNewsId = searchParams.get("sourceNewsId")?.trim();

  if (legacyNewsId) {
    return legacyNewsId;
  }

  return null;
}

export function resolveInitiativeCreateNewsSourceIdFromLocation(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const fromSearch = resolveInitiativeCreateNewsSourceId(new URLSearchParams(window.location.search));

  if (fromSearch) {
    return fromSearch;
  }

  const hash = window.location.hash.slice(1);

  if (!hash.startsWith("create")) {
    return null;
  }

  const queryStart = hash.indexOf("?");

  if (queryStart === -1) {
    return null;
  }

  return resolveInitiativeCreateNewsSourceId(new URLSearchParams(hash.slice(queryStart + 1)));
}

export function mapNewsCategoryToActivityArea(
  category: string | undefined,
): InitiativeActivityAreaOption | undefined {
  if (!category) {
    return undefined;
  }

  const mapped = NEWS_CATEGORY_TO_ACTIVITY_AREA[category.trim().toLowerCase()];

  if (mapped) {
    return mapped;
  }

  const normalizedCategory = category.trim();

  if (INITIATIVE_ACTIVITY_AREA_OPTIONS.includes(normalizedCategory as InitiativeActivityAreaOption)) {
    return normalizedCategory as InitiativeActivityAreaOption;
  }

  return undefined;
}

export function resolveNewsArticleCountryCode(article: PublicNewsArticleItem): string | undefined {
  return getMediaRegistryProviderByName(article.sourceName)?.countryCode;
}
