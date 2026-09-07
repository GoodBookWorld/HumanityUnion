/**
 * Authoritative public_news field ownership policy.
 *
 * Single contract for PLP candidate construction, provider eligibility,
 * integrity validation, semantic ownership, and rendered carousel closure.
 *
 * Classification of `category` (Reset 03E.11.1 / publication fix):
 * CONTROLLED_VOCABULARY — curated MediaRegistryCategory labels assigned at
 * RSS ingest from the media registry (not free-text RSS body, not outlet
 * identity). Localized via UI dictionary / controlled terminology; never
 * machine-translated by Gemini.
 */

import type { MediaRegistryCategory } from "./media-registry.js";

export type PublicNewsFieldOwnershipClass =
  | "MACHINE_CONTENT"
  | "CONTROLLED_VOCABULARY"
  | "PROTECTED_SOURCE_VALUE";

/**
 * Participant-facing public_news semantic fields and their ownership class.
 * MACHINE_CONTENT paths are the only Gemini / CLI.1 identity-checked AUTO nodes.
 */
export const PUBLIC_NEWS_FIELD_OWNERSHIP = {
  title: "MACHINE_CONTENT",
  summary: "MACHINE_CONTENT",
  category: "CONTROLLED_VOCABULARY",
  sourceName: "PROTECTED_SOURCE_VALUE",
  id: "PROTECTED_SOURCE_VALUE",
  articleUrl: "PROTECTED_SOURCE_VALUE",
  imageUrl: "PROTECTED_SOURCE_VALUE",
  publishedAt: "PROTECTED_SOURCE_VALUE",
  verificationStatus: "PROTECTED_SOURCE_VALUE",
  geographicScope: "PROTECTED_SOURCE_VALUE",
} as const satisfies Record<string, PublicNewsFieldOwnershipClass>;

/** PLP / Gemini AUTO paths for public_news (excludes controlled + protected). */
export const PUBLIC_NEWS_MACHINE_CONTENT_PATHS = [
  "title",
  "summary",
] as const;

export type PublicNewsMachineContentPath =
  (typeof PUBLIC_NEWS_MACHINE_CONTENT_PATHS)[number];

/** Closed registry labels — same union as MediaRegistryCategory. */
export const MEDIA_REGISTRY_CATEGORY_VALUES = [
  "democracy",
  "public participation",
  "human rights",
  "public health",
  "education",
  "climate resilience",
  "community development",
  "peace and security",
  "emergency response",
  "misinformation and media literacy",
  "social justice",
  "institutional accountability",
] as const satisfies readonly MediaRegistryCategory[];

const MEDIA_REGISTRY_CATEGORY_SET = new Set<string>(MEDIA_REGISTRY_CATEGORY_VALUES);

export function isMediaRegistryCategory(
  value: string,
): value is MediaRegistryCategory {
  return MEDIA_REGISTRY_CATEGORY_SET.has(value);
}

/**
 * Stable next-intl message key segment under `publicNews.categories.*`.
 * Keys are camelCase; storage value remains the registry English label.
 */
export const MEDIA_REGISTRY_CATEGORY_MESSAGE_KEYS = {
  democracy: "democracy",
  "public participation": "publicParticipation",
  "human rights": "humanRights",
  "public health": "publicHealth",
  education: "education",
  "climate resilience": "climateResilience",
  "community development": "communityDevelopment",
  "peace and security": "peaceAndSecurity",
  "emergency response": "emergencyResponse",
  "misinformation and media literacy": "misinformationAndMediaLiteracy",
  "social justice": "socialJustice",
  "institutional accountability": "institutionalAccountability",
} as const satisfies Record<MediaRegistryCategory, string>;

export function mediaRegistryCategoryMessageKey(
  category: MediaRegistryCategory,
): (typeof MEDIA_REGISTRY_CATEGORY_MESSAGE_KEYS)[MediaRegistryCategory] {
  return MEDIA_REGISTRY_CATEGORY_MESSAGE_KEYS[category];
}

export function publicNewsFieldOwnership(
  field: keyof typeof PUBLIC_NEWS_FIELD_OWNERSHIP,
): PublicNewsFieldOwnershipClass {
  return PUBLIC_NEWS_FIELD_OWNERSHIP[field];
}

export function isPublicNewsMachineContentPath(
  path: string,
): path is PublicNewsMachineContentPath {
  return (PUBLIC_NEWS_MACHINE_CONTENT_PATHS as readonly string[]).includes(path);
}
