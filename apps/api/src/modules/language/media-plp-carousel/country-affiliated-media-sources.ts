/**
 * RESET 05D.2 — authoritative country-affiliated media sources.
 *
 * Country News relevance Step 1 uses configured country outlets from:
 * 1. Civic Trusted Media catalog (countryCode) — participant-facing SoT
 * 2. Media Registry providers with matching countryCode
 *
 * Does NOT infer relevance from article body text.
 */

import {
  TRUSTED_GLOBAL_MEDIA_REGISTRY,
  type CountryPublicNewsMediaRef,
} from "@hu/media-registry";

import { TRUSTED_MEDIA_RESOURCES } from "../../civic-media-center/content/trusted-media.js";

export type CountryAffiliatedMediaSource = CountryPublicNewsMediaRef & {
  readonly authority: "TRUSTED_MEDIA" | "MEDIA_REGISTRY";
  readonly countryCode: string;
};

/**
 * Stable list of country-affiliated source refs for selector + diagnostic.
 * Names must match public_news.sourceName / registry canonical names where possible.
 */
export function listCountryAffiliatedMediaSources(
  countryCode: string,
): readonly CountryAffiliatedMediaSource[] {
  const code = countryCode.trim().toUpperCase();
  if (!code) {
    return [];
  }

  const byName = new Map<string, CountryAffiliatedMediaSource>();

  for (const resource of TRUSTED_MEDIA_RESOURCES) {
    if (resource.countryCode?.toUpperCase() !== code) {
      continue;
    }
    byName.set(resource.name, {
      id: resource.id,
      name: resource.name,
      authority: "TRUSTED_MEDIA",
      countryCode: code,
    });
  }

  for (const provider of TRUSTED_GLOBAL_MEDIA_REGISTRY) {
    if (provider.countryCode?.toUpperCase() !== code) {
      continue;
    }
    if (!byName.has(provider.name)) {
      byName.set(provider.name, {
        id: provider.id,
        name: provider.name,
        authority: "MEDIA_REGISTRY",
        countryCode: code,
      });
    }
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function countryAffiliatedMediaRefs(
  countryCode: string,
): readonly CountryPublicNewsMediaRef[] {
  return listCountryAffiliatedMediaSources(countryCode).map((source) => ({
    id: source.id,
    name: source.name,
  }));
}
