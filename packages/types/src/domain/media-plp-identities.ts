/**
 * TRANSLATION DELIVERY RESET 03 — Media PLP entity identities.
 *
 * Stable, route-independent. /media and Country Recommended Media share
 * civic_media_trusted by resource id.
 *
 * Reset 03E — civic_media_editorial owns overview + FAQ semantics
 * (initiative-flow participant UX remains UI_DICTIONARY / pipeline.*).
 */

export const MEDIA_PLP_ENTITY_TYPE = {
  PUBLIC_NEWS: "public_news",
  CIVIC_MEDIA_PRINCIPLE: "civic_media_principle",
  CIVIC_MEDIA_TRUSTED: "civic_media_trusted",
  /** Page-level overview + FAQ (not chrome; not pipeline UI dictionary). */
  CIVIC_MEDIA_EDITORIAL: "civic_media_editorial",
} as const;

export type MediaPlpEntityType =
  (typeof MEDIA_PLP_ENTITY_TYPE)[keyof typeof MEDIA_PLP_ENTITY_TYPE];

export const MEDIA_PLP_ENTITY_TYPES: readonly MediaPlpEntityType[] = [
  MEDIA_PLP_ENTITY_TYPE.PUBLIC_NEWS,
  MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_PRINCIPLE,
  MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_TRUSTED,
  MEDIA_PLP_ENTITY_TYPE.CIVIC_MEDIA_EDITORIAL,
] as const;

/** Stable singleton entityId for /media overview + FAQ presentation. */
export const MEDIA_PLP_EDITORIAL_ENTITY_ID = "civic-media-center";

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

export function mediaPlpEditorialEntityId(
  editorialId: string = MEDIA_PLP_EDITORIAL_ENTITY_ID,
): string {
  return editorialId.trim() || MEDIA_PLP_EDITORIAL_ENTITY_ID;
}

export function isMediaPlpEntityType(value: string): value is MediaPlpEntityType {
  return (MEDIA_PLP_ENTITY_TYPES as readonly string[]).includes(value);
}
