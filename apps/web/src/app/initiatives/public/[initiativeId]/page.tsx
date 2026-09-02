import type { Metadata } from "next";

import { CanonicalInitiativeExperienceLoader } from "../../../../features/public-initiative-experience/components/CanonicalInitiativeExperienceLoader";
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
 */
export async function generateMetadata({
  params,
}: PublicInitiativePageProps): Promise<Metadata> {
  const { initiativeId } = await params;
  const canonicalPath = `/initiatives/public/${encodeURIComponent(initiativeId)}`;

  try {
    const initiative = await getPublicInitiative(initiativeId);
    const rawImage =
      initiative.metadata.imageUrl ??
      initiative.metadata.coverMedia?.thumbnailUrl ??
      initiative.metadata.coverMedia?.url ??
      undefined;
    const resolvedImage = resolveMediaUrl(rawImage);
    const description =
      initiative.description.trim() || `${initiative.title} on Humanity Union`;

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
        },
        override?.fields,
      ),
    );
  } catch {
    return buildPublicPageMetadata({
      title: "Initiative",
      description: "Public Initiative on Humanity Union",
      canonicalPath,
      openGraphType: "website",
      indexable: false,
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

  let structuredData = null;
  try {
    const initiative = await getPublicInitiative(initiativeId);
    const rawImage =
      initiative.metadata.imageUrl ??
      initiative.metadata.coverMedia?.thumbnailUrl ??
      initiative.metadata.coverMedia?.url ??
      undefined;
    const description =
      initiative.description.trim() || `${initiative.title} on Humanity Union`;

    structuredData = buildWebPageJsonLd({
      name: initiative.title,
      description,
      canonicalPath,
      imageUrl: resolveMediaUrl(rawImage),
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "Initiatives", path: "/initiatives" },
        { name: initiative.title, path: canonicalPath },
      ],
    });
  } catch {
    structuredData = null;
  }

  return (
    <>
      <JsonLdScript data={structuredData} />
      <CanonicalInitiativeExperienceLoader initiativeId={initiativeId} />
    </>
  );
}
