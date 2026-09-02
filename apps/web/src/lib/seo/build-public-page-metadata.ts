import type { Metadata } from "next";

import { shouldDisallowSearchIndexing } from "../platform-indexing";
import { formatPublicPageTitle, normalizeMetaDescription } from "./normalize-seo-text";
import {
  normalizeCanonicalPath,
  resolvePublicSiteOrigin,
  toAbsolutePublicUrl,
} from "./public-site-url";

export type PublicPageOpenGraphType = "website" | "article" | "profile";

export interface BuildPublicPageMetadataInput {
  /** Primary page title (entity name / SEO title), without requiring a brand suffix. */
  title: string;
  description?: string | null;
  /** Public path beginning with `/`, e.g. `/blog/my-post`. */
  canonicalPath: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
  socialTitle?: string | null;
  socialDescription?: string | null;
  openGraphType?: PublicPageOpenGraphType;
  /**
   * Brand segment after `|`. Default `Humanity Union`.
   * Blog preserves intentional `Blog | Humanity Union`.
   * Pass `""` when `title` is already a complete document title.
   */
  titleBrandSuffix?: string;
  /**
   * Pack 08I.2 — Open Graph `siteName` (Admin Brand Localization openGraphBrandName /
   * seoSiteName). Omitted when unset so callers without brand stay unchanged.
   */
  openGraphSiteName?: string | null;
  /**
   * Optional further restriction only. Cannot enable indexing when the
   * platform helper already disallows it (staging/dev/other).
   */
  indexable?: boolean;
  descriptionMaxLength?: number;
}

/**
 * Shared public-page Next.js Metadata builder (SEO Pack 01).
 * Entity routes supply content; this helper owns title/canonical/OG/robots shape.
 */
export function buildPublicPageMetadata(input: BuildPublicPageMetadataInput): Metadata {
  const origin = resolvePublicSiteOrigin();
  const canonicalPath = normalizeCanonicalPath(input.canonicalPath);
  const canonicalUrl = toAbsolutePublicUrl(canonicalPath, origin);

  const brandSuffix =
    input.titleBrandSuffix === undefined ? "Humanity Union" : input.titleBrandSuffix;
  const documentTitle = formatPublicPageTitle(input.title, brandSuffix);

  const description = normalizeMetaDescription(
    input.description,
    input.descriptionMaxLength,
  );

  // Social/OG titles prefer the entity title (or override), not the branded document title.
  const resolvedSocialTitle = input.socialTitle?.trim()
    ? stripToSingleLine(input.socialTitle)
    : stripToSingleLine(input.title) || documentTitle;

  const socialDescription =
    normalizeMetaDescription(input.socialDescription, input.descriptionMaxLength) ??
    description;

  const absoluteImage = input.imageUrl?.trim()
    ? toAbsolutePublicUrl(input.imageUrl.trim(), origin)
    : undefined;

  const platformDisallow = shouldDisallowSearchIndexing();
  const disallowIndexing = platformDisallow || input.indexable === false;

  const openGraphType = input.openGraphType ?? "website";
  const canonicalForMetadata = origin ? canonicalUrl : canonicalPath;
  const openGraphSiteName = input.openGraphSiteName?.trim() || undefined;

  return {
    title: documentTitle,
    ...(description ? { description } : {}),
    alternates: {
      canonical: canonicalForMetadata,
    },
    robots: disallowIndexing
      ? { index: false, follow: false, nocache: true }
      : { index: true, follow: true },
    openGraph: {
      title: resolvedSocialTitle,
      ...(socialDescription ? { description: socialDescription } : {}),
      url: canonicalForMetadata,
      type: openGraphType,
      ...(openGraphSiteName ? { siteName: openGraphSiteName } : {}),
      ...(absoluteImage
        ? {
            images: [
              {
                url: absoluteImage,
                ...(input.imageAlt?.trim() ? { alt: input.imageAlt.trim() } : {}),
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: absoluteImage ? "summary_large_image" : "summary",
      title: resolvedSocialTitle,
      ...(socialDescription ? { description: socialDescription } : {}),
      ...(absoluteImage ? { images: [absoluteImage] } : {}),
    },
  };
}

function stripToSingleLine(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
