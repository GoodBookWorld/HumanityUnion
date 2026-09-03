import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { CanonicalInitiativeExperienceLoader } from "../../../../features/public-initiative-experience/components/CanonicalInitiativeExperienceLoader";
import { loadInitiativeDetailPresentationSeed } from "../../../../features/public-initiative-experience/load-initiative-detail-presentation-seed";
import { resolveBrandForMetadata } from "../../../../features/brand-localization/resolve-brand-for-metadata";
import { getPublicInitiative } from "../../../../features/initiatives/api";
import { resolveDocumentHtmlLocale } from "../../../../features/language/resolve-document-locale";
import { resolveMediaUrl } from "../../../../features/media-upload/media-url";
import { buildPublicPageMetadata } from "../../../../lib/seo/build-public-page-metadata";
import { applyPageSeoOverrideToMetadataInput } from "../../../../lib/seo/apply-page-seo-override";
import { fetchPublicSeoPageOverride } from "../../../../lib/seo/fetch-public-seo-page-override";
import { loadInitiativeMetadataTranslationFields } from "../../../../lib/seo/load-initiative-metadata-translation-fields";
import { resolveLocalizedPublicMetadataCopy } from "../../../../lib/seo/resolve-localized-public-metadata-copy";
import { JsonLdScript, buildWebPageJsonLd } from "../../../../lib/seo/structured-data";

export const dynamic = "force-dynamic";

interface PublicInitiativePageProps {
  params: Promise<{
    initiativeId: string;
  }>;
}

/**
 * Social preview metadata for the canonical public Initiative URL.
 * Petition deep-links (`#petition`) share this page's Open Graph tags.
 *
 * Pack 02I — when a current cached civic translation exists for the document
 * locale, title/description may use that copy. Canonical path stays locale-free.
 * Never calls Gemini / translation generate from metadata.
 * Pack 08I.2 — brand title suffix from Admin Brand Localization.
 */
export async function generateMetadata({
  params,
}: PublicInitiativePageProps): Promise<Metadata> {
  const { initiativeId } = await params;
  const canonicalPath = `/initiatives/public/${encodeURIComponent(initiativeId)}`;
  const requestLocale = await getLocale();
  const brand = await resolveBrandForMetadata(requestLocale);

  try {
    const initiative = await getPublicInitiative(initiativeId);
    const rawImage =
      initiative.metadata.imageUrl ??
      initiative.metadata.coverMedia?.thumbnailUrl ??
      initiative.metadata.coverMedia?.url ??
      undefined;
    const resolvedImage = resolveMediaUrl(rawImage);
    const description =
      initiative.description.trim() || `${initiative.title} on ${brand.seoSiteName}`;

    const documentLocale = await resolveDocumentHtmlLocale();
    const translationFields = await loadInitiativeMetadataTranslationFields({
      initiativeId,
      language: documentLocale.locale,
    });
    const localized = resolveLocalizedPublicMetadataCopy({
      title: initiative.title,
      description,
      locale: documentLocale.locale,
      translatedTitle: translationFields.translatedTitle,
      translatedDescription: translationFields.translatedDescription,
    });

    const override = await fetchPublicSeoPageOverride({
      family: "initiative",
      entityKey: initiativeId,
    });

    return buildPublicPageMetadata(
      applyPageSeoOverrideToMetadataInput(
        {
          title: localized.title,
          description: localized.description,
          canonicalPath,
          socialTitle: localized.title,
          socialDescription: localized.description,
          imageUrl: resolvedImage,
          imageAlt: initiative.metadata.imageAltText || localized.title,
          openGraphType: "website",
          descriptionMaxLength: 200,
          titleBrandSuffix: brand.seoTitleSuffix,
          openGraphSiteName: brand.openGraphBrandName || brand.seoSiteName,
        },
        override?.fields,
      ),
    );
  } catch {
    return buildPublicPageMetadata({
      title: "Initiative",
      description: `Public Initiative on ${brand.seoSiteName}`,
      canonicalPath,
      openGraphType: "website",
      indexable: false,
      titleBrandSuffix: brand.seoTitleSuffix,
      openGraphSiteName: brand.openGraphBrandName || brand.seoSiteName,
    });
  }
}

/**
 * Canonical Initiative experience. Client-loads with credentials so
 * viewerIsSteward / Manage / Author Mode match the authenticated session
 * for both Workspace and Header entry paths.
 */
export default async function PublicInitiativePage({ params }: PublicInitiativePageProps) {
  const { initiativeId } = await params;
  const canonicalPath = `/initiatives/public/${encodeURIComponent(initiativeId)}`;
  const locale = await getLocale();
  const brand = await resolveBrandForMetadata(locale);
  const tNav = await getTranslations("navigation");

  let structuredData = null;
  let initialPresentation:
    | { title: string; description: string }
    | undefined;
  try {
    const initiative = await getPublicInitiative(initiativeId);
    const documentLocale = await resolveDocumentHtmlLocale();
    initialPresentation = await loadInitiativeDetailPresentationSeed({
      initiativeId,
      language: documentLocale.locale,
      canonical: {
        title: initiative.title,
        description: initiative.description,
      },
    });

    const rawImage =
      initiative.metadata.imageUrl ??
      initiative.metadata.coverMedia?.thumbnailUrl ??
      initiative.metadata.coverMedia?.url ??
      undefined;
    const description =
      (initialPresentation?.description || initiative.description).trim() ||
      `${initialPresentation?.title || initiative.title} on ${brand.seoSiteName}`;

    structuredData = buildWebPageJsonLd({
      name: initialPresentation?.title || initiative.title,
      description,
      canonicalPath,
      imageUrl: resolveMediaUrl(rawImage),
      breadcrumbs: [
        { name: tNav("home"), path: "/" },
        { name: tNav("initiatives"), path: "/initiatives" },
        { name: initialPresentation?.title || initiative.title, path: canonicalPath },
      ],
    });
  } catch {
    structuredData = null;
  }

  return (
    <>
      <JsonLdScript data={structuredData} />
      <CanonicalInitiativeExperienceLoader
        initiativeId={initiativeId}
        initialPresentation={initialPresentation}
      />
    </>
  );
}
