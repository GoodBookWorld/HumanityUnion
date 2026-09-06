import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import type { CivicMediaCenterPublic } from "@hu/types";

import { fetchCivicMediaCenter } from "../../features/civic-media-center/api";
import { CivicMediaCenterPageContent } from "../../features/civic-media-center/components/CivicMediaCenterPageContent";
import type { CivicMediaResolvedEditorial } from "../../features/civic-media-center/components/CivicMediaTranslatedEditorial";
import { loadCivicMediaEditorialSeed } from "../../features/civic-media-center/load-civic-media-editorial-seed";
import { isMediaPlpWebEnabled } from "../../features/language/media-plp/feature-flag";
import { loadMediaPlpPagePresentations } from "../../features/language/media-plp/load-media-plp-ssr";
import { markMediaLocaleSwitchPerfPhase } from "../../features/language/media-plp/media-plp-locale-switch-perf";
import type { MediaPlpResolvedPresentation } from "../../features/language/media-plp/presentation";
import { resolveDocumentHtmlLocale } from "../../features/language/resolve-document-locale";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("civicMediaPublic");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: "/media",
    },
  };
}

/**
 * Pack 08I.9 / 08I.12 — SSR-first Media editorial seed (GET resolve only).
 * Reset 03C.1 — shared Media structure with PLP semantic presentations.
 * Reset 03D — one combined Media PLP resolve HTTP post per navigation.
 * Reset 03E — combined batch includes civic_media_editorial (overview + FAQ).
 */
export default async function CivicMediaPage() {
  markMediaLocaleSwitchPerfPhase("T3_WEB_RENDER_BEGIN");

  let initialMedia: CivicMediaCenterPublic | undefined;
  let initialEditorial: CivicMediaResolvedEditorial | undefined;
  let plpTrustedById: Readonly<Record<string, MediaPlpResolvedPresentation>> | undefined;
  let plpPrinciplesById:
    | Readonly<Record<string, MediaPlpResolvedPresentation>>
    | undefined;
  let plpEditorialPresentation: MediaPlpResolvedPresentation | undefined;

  try {
    initialMedia = await fetchCivicMediaCenter();
  } catch {
    initialMedia = undefined;
  }

  if (initialMedia && isMediaPlpWebEnabled()) {
    const documentLocale = await resolveDocumentHtmlLocale();
    markMediaLocaleSwitchPerfPhase("T4_MEDIA_PLP_LOAD_BEGIN");
    const plp = await loadMediaPlpPagePresentations({
      resources: initialMedia.trustedMedia,
      principles: initialMedia.selectionPrinciples,
      media: initialMedia,
      locale: documentLocale.locale,
    });
    plpTrustedById = plp?.trustedById;
    plpPrinciplesById = plp?.principlesById;
    plpEditorialPresentation = plp?.editorial;
    markMediaLocaleSwitchPerfPhase("T9_WEB_RENDER_COMPLETE");
  } else if (initialMedia) {
    try {
      const documentLocale = await resolveDocumentHtmlLocale();
      initialEditorial = await loadCivicMediaEditorialSeed({
        media: initialMedia,
        language: documentLocale.locale,
      });
    } catch {
      initialEditorial = undefined;
    }
  }

  return (
    <CivicMediaCenterPageContent
      initialMedia={initialMedia}
      initialEditorial={initialEditorial}
      plpTrustedById={plpTrustedById}
      plpPrinciplesById={plpPrinciplesById}
      plpEditorialPresentation={plpEditorialPresentation}
    />
  );
}
