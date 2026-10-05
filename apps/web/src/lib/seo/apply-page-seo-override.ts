/**
 * SEO Pack 07 — merge sparse Admin page SEO overrides into Pack 01 inputs.
 * Blog continues to use BlogPublicationOptimization (not this store).
 */
import type { SeoPageOverrideFields } from "@hu/types";
import { seoPageOverrideHasCustomFields } from "@hu/types";

import type { BuildPublicPageMetadataInput } from "./build-public-page-metadata";

export interface AutomaticPublicPageSeoValues {
  title: string;
  description?: string | null;
  socialTitle?: string | null;
  socialDescription?: string | null;
  imageUrl?: string | null;
}

export function mergePageSeoOverrideIntoAutomatic(
  automatic: AutomaticPublicPageSeoValues,
  override: SeoPageOverrideFields | null | undefined,
): AutomaticPublicPageSeoValues {
  if (!override || !seoPageOverrideHasCustomFields(override)) {
    return automatic;
  }

  return {
    title: override.seoTitle?.trim() || automatic.title,
    description: override.seoDescription?.trim() || automatic.description,
    socialTitle: override.socialTitle?.trim() || automatic.socialTitle || automatic.title,
    socialDescription:
      override.socialDescription?.trim() ||
      automatic.socialDescription ||
      override.seoDescription?.trim() ||
      automatic.description,
    imageUrl: override.socialImageUrl?.trim() || automatic.imageUrl,
  };
}

export function applyPageSeoOverrideToMetadataInput(
  base: BuildPublicPageMetadataInput,
  override: SeoPageOverrideFields | null | undefined,
): BuildPublicPageMetadataInput {
  const merged = mergePageSeoOverrideIntoAutomatic(
    {
      title: base.title,
      description: base.description,
      socialTitle: base.socialTitle,
      socialDescription: base.socialDescription,
      imageUrl: base.imageUrl,
    },
    override,
  );

  return {
    ...base,
    title: merged.title,
    description: merged.description,
    socialTitle: merged.socialTitle,
    socialDescription: merged.socialDescription,
    imageUrl: merged.imageUrl,
  };
}

export function resolveSeoModeFromOverrideFields(
  fields: SeoPageOverrideFields | null | undefined,
): "automatic" | "customized" {
  return fields && seoPageOverrideHasCustomFields(fields) ? "customized" : "automatic";
}

/**
 * Canonical seo_page_overrides are one document per page, with no locale.
 * Merge that document only for the locale-free SEO document.
 * A locale-prefixed SEO document keeps its automatic metadata.
 */
export function selectCanonicalEnglishSeoOverrideForDocument(
  isLocalePrefixedDocument: boolean,
  override: SeoPageOverrideFields | null | undefined,
): SeoPageOverrideFields | null {
  if (isLocalePrefixedDocument) {
    return null;
  }
  return override ?? null;
}
