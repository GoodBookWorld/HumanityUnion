import type { Metadata } from "next";

import type { CivicMediaCenterPublic } from "@hu/types";

import { fetchCivicMediaCenter } from "../../features/civic-media-center/api";
import { CivicMediaCenterPageContent } from "../../features/civic-media-center/components/CivicMediaCenterPageContent";
import type { CivicMediaResolvedEditorial } from "../../features/civic-media-center/components/CivicMediaTranslatedEditorial";
import { loadCivicMediaEditorialSeed } from "../../features/civic-media-center/load-civic-media-editorial-seed";
import { isMediaPlpWebEnabled } from "../../features/language/media-plp/feature-flag";
import { CivicMediaCenterPlpContent } from "../../features/language/media-plp/CivicMediaCenterPlpContent";
import {
  loadMediaPlpPrinciplePresentations,
  loadMediaPlpTrustedPresentations,
} from "../../features/language/media-plp/load-media-plp-ssr";
import { resolveDocumentHtmlLocale } from "../../features/language/resolve-document-locale";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Civic Media | Humanity Union",
  description:
    "Find trusted media sources, verify claims, and turn verified news into constructive civic initiatives.",
  alternates: {
    canonical: "/media",
  },
};

/**
 * Pack 08I.9 / 08I.12 — SSR-first Media editorial seed (GET resolve only).
 * Reset 03C — when HU_MEDIA_PLP_ENABLED=true, SSR resolves Media PLP via
 * /api/v1/public/media-plp/resolve (PUBLISHED_LOCALIZED or coherent
 * CANONICAL_FALLBACK; no content_translations generate-on-miss). Default remains legacy.
 */
export default async function CivicMediaPage() {
  let initialMedia: CivicMediaCenterPublic | undefined;
  let initialEditorial: CivicMediaResolvedEditorial | undefined;

  try {
    initialMedia = await fetchCivicMediaCenter();
  } catch {
    initialMedia = undefined;
  }

  if (initialMedia && isMediaPlpWebEnabled()) {
    const documentLocale = await resolveDocumentHtmlLocale();
    const trustedById = await loadMediaPlpTrustedPresentations({
      resources: initialMedia.trustedMedia,
      locale: documentLocale.locale,
    });
    const principlesById = await loadMediaPlpPrinciplePresentations({
      principles: initialMedia.selectionPrinciples,
      locale: documentLocale.locale,
    });
    if (trustedById && principlesById) {
      return (
        <CivicMediaCenterPlpContent
          media={initialMedia}
          trustedById={trustedById}
          principlesById={principlesById}
        />
      );
    }
  }

  if (initialMedia) {
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
    />
  );
}
