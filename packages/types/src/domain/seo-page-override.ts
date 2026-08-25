/**
 * SEO Pack 07 — sparse Admin page SEO overrides for non-Blog public pages.
 * Blog continues to use BlogPublicationOptimization.
 */

export const SEO_PAGE_OVERRIDE_FAMILIES = [
  "country",
  "initiative",
  "knowledge",
  "civic-archive",
] as const;

export type SeoPageOverrideFamily = (typeof SEO_PAGE_OVERRIDE_FAMILIES)[number];

export interface SeoPageOverrideFields {
  readonly seoTitle?: string;
  readonly seoDescription?: string;
  readonly socialTitle?: string;
  readonly socialDescription?: string;
  readonly socialImageUrl?: string;
}

export interface SeoPageOverride {
  /** Stable unique id: `${family}:${entityKey}` */
  readonly pageId: string;
  readonly family: SeoPageOverrideFamily;
  readonly entityKey: string;
  readonly canonicalPath: string;
  readonly fields: SeoPageOverrideFields;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly updatedByParticipantId: string;
}

export interface SeoPageOverridePublicView {
  readonly family: SeoPageOverrideFamily;
  readonly entityKey: string;
  readonly canonicalPath: string;
  readonly fields: SeoPageOverrideFields;
  readonly mode: "automatic" | "customized";
}

export interface SeoPageOverrideUpsertInput {
  readonly family: SeoPageOverrideFamily;
  readonly entityKey: string;
  readonly canonicalPath: string;
  readonly fields: SeoPageOverrideFields;
}

export function buildSeoPageOverrideId(
  family: SeoPageOverrideFamily,
  entityKey: string,
): string {
  return `${family}:${entityKey.trim()}`;
}

export function seoPageOverrideHasCustomFields(fields: SeoPageOverrideFields): boolean {
  return Boolean(
    fields.seoTitle?.trim() ||
      fields.seoDescription?.trim() ||
      fields.socialTitle?.trim() ||
      fields.socialDescription?.trim() ||
      fields.socialImageUrl?.trim(),
  );
}
