/**
 * TRANSLATION DELIVERY RESET 03 — Media PLP entity identities.
 *
 * Stable, route-independent. /media and Country Recommended Media share
 * civic_media_trusted by resource id.
 */

export const MEDIA_PLP_ENTITY_TYPE = {
  PUBLIC_NEWS: "public_news",
  CIVIC_MEDIA_PRINCIPLE: "civic_media_principle",
  CIVIC_MEDIA_TRUSTED: "civic_media_trusted",
} as const;

export type MediaPlpEntityType =
  (typeof MEDIA_PLP_ENTITY_TYPE)[keyof typeof MEDIA_PLP_ENTITY_TYPE];

export const MEDIA_PLP_ENTITY_TYPES: readonly MediaPlpEntityType[] = [
  MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
  MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
  MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
] as const;

/** Stable entityId for a public news article (deterministic news-{hash} id). */
export function mediaPlpPublicNewsEntityId(articleId: string): string {
  return articleId.trim();
}

/** Stable entityId for a selection principle (principle.id, not route/index). */
export function mediaPlpPrincipleEntityId(principleId: string): string {
  return principleId.trim();
}

/** Stable entityId for a trusted media resource — shared by /media and country rails. */
export function mediaPlpTrustedEntityId(resourceId: string): string {
  return resourceId.trim();
}

export function isMediaPlpEntityType(value: string): value is MediaPlpEntityType {
  return (MEDIA_PLP_ENTITY_TYPES as readonly string[]).includes(value);
}
