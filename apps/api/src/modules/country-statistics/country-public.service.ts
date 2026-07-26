import { getCountryByCode, normalizeCountryInput } from "@hu/geography";
import type { TrustedMediaResource, WorldInitiativeCardProjection } from "@hu/types";

import { formatPublicGeography } from "../../shared/format-public-geography.js";
import { TRUSTED_MEDIA_RESOURCES } from "../civic-media-center/content/trusted-media.js";
import { resolveInitiativeSearchGeography } from "../initiatives/initiative-geography.js";
import { isInitiativeEligibleForPublicProjection } from "../initiatives/initiative-public-projection.access.js";
import { listInitiatives } from "../initiatives/initiative.store.js";

const COUNTRY_INITIATIVES_LIMIT = 12;
const COUNTRY_INITIATIVES_MAX_LIMIT = 18;
const COUNTRY_MEDIA_LIMIT = 12;

function summarizeText(text: string, maxLength = 140): string {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildPublicInitiativeHref(initiativeId: string): string {
  return `/initiatives/public/${encodeURIComponent(initiativeId)}`;
}

function formatPublicStatus(status: string): string {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function toCountryInitiativeCardProjection(
  initiative: ReturnType<typeof listInitiatives>[number],
): WorldInitiativeCardProjection {
  const activityArea =
    initiative.metadata.activityArea === "Other" && initiative.metadata.activityAreaOther
      ? initiative.metadata.activityAreaOther
      : initiative.metadata.activityArea;

  return {
    initiativeId: initiative.initiativeId,
    title: initiative.title,
    summary: summarizeText(initiative.description),
    activityArea,
    geographyLabel: formatPublicGeography({
      countryCode: initiative.metadata.countrySlug,
      regionCode: initiative.metadata.regionSlug,
      communitySlug: initiative.metadata.communitySlug,
      regionLabel: initiative.metadata.region,
      communityAssociation: initiative.metadata.communityAssociation,
    }),
    imageUrl: initiative.metadata.imageUrl,
    startDate: initiative.metadata.startDate,
    completionDate: initiative.metadata.completionDate,
    publicStatus: formatPublicStatus(initiative.status),
    currentStageLabel: formatPublicStatus(initiative.status),
    publicInitiativeHref: buildPublicInitiativeHref(initiative.initiativeId),
    publishedAt: initiative.updatedAt,
  };
}

export function listCountryInitiativeCardProjections(
  countryCodeInput: string,
  limit = COUNTRY_INITIATIVES_LIMIT,
): WorldInitiativeCardProjection[] {
  const countryCode = normalizeCountryInput(countryCodeInput);

  if (!countryCode) {
    return [];
  }

  const boundedLimit = Math.min(Math.max(limit, 1), COUNTRY_INITIATIVES_MAX_LIMIT);

  return listInitiatives()
    .filter((initiative) => {
      if (!isInitiativeEligibleForPublicProjection(initiative)) {
        return false;
      }

      const geography = resolveInitiativeSearchGeography(initiative);
      return geography.country === countryCode;
    })
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .slice(0, boundedLimit)
    .map(toCountryInitiativeCardProjection);
}

export function listCountryTrustedMediaResources(
  countryCodeInput: string,
  limit = COUNTRY_MEDIA_LIMIT,
): TrustedMediaResource[] {
  const countryCode = normalizeCountryInput(countryCodeInput);

  if (!countryCode) {
    return [];
  }

  const country = getCountryByCode(countryCode);

  if (!country) {
    return [];
  }

  const countryName = country.name.toLowerCase();

  return TRUSTED_MEDIA_RESOURCES.filter((resource) => {
    if (resource.countryCode) {
      return resource.countryCode.toUpperCase() === countryCode;
    }

    const resourceCountry = resource.country.trim().toLowerCase();
    return resourceCountry === countryName || resourceCountry === countryCode.toLowerCase();
  })
    .slice(0, limit)
    .map((resource) => ({ ...resource }));
}
