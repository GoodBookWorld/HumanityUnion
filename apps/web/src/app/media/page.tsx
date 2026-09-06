import type { Metadata } from "next";

import type { CivicMediaCenterPublic } from "@hu/types";

import { fetchCivicMediaCenter } from "../../features/civic-media-center/api";
import { CivicMediaCenterPageContent } from "../../features/civic-media-center/components/CivicMediaCenterPageContent";
import type { CivicMediaResolvedEditorial } from "../../features/civic-media-center/components/CivicMediaTranslatedEditorial";
import { loadCivicMediaEditorialSeed } from "../../features/civic-media-center/load-civic-media-editorial-seed";
import { isMediaPlpWebEnabled } from "../../features/language/media-plp/feature-flag";
import {
  loadMediaPlpPrinciplePresentations,
  loadMediaPlpTrustedPresentations,
} from "../../features/language/media-plp/load-media-plp-ssr";
import type { MediaPlpResolvedPresentation } from "../../features/language/media-plp/presentation";
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
 * Reset 03C.1 — when HU_MEDIA_PLP_ENABLED=true, same shared Media structure
 * receives PLP semantic presentations (never a second simplified page).
 * Reset 03C.2 — one bounded parallel PLP resolve per navigation (locale switch).
 */
export default async function CivicMediaPage() {
  let initialMedia: CivicMediaCenterPublic | undefined;
  let initialEditorial: CivicMediaResolvedEditorial | undefined;
  let plpTrustedById: Readonly<Record<string, MediaPlpResolvedPresentation>> | undefined;
  let plpPrinciplesById:
    | Readonly<Record<string, MediaPlpResolvedPresentation>>
    | undefined;

  try {
    initialMedia = await fetchCivicMediaCenter();
  } catch {
    initialMedia = undefined;
  }

  if (initialMedia && isMediaPlpWebEnabled()) {
    const documentLocale = await resolveDocumentHtmlLocale();
    // One navigation → one parallel pair of batch resolves (not sequential fan-out).
    const [trusted, principles] = await Promise.all([
      loadMediaPlpTrustedPresentations({
        resources: initialMedia.trustedMedia,
        locale: documentLocale.locale,
      }),
      loadMediaPlpPrinciplePresentations({
        principles: initialMedia.selectionPrinciples,
        locale: documentLocale.locale,
      }),
    ]);
    plpTrustedById = trusted ?? undefined;
    plpPrinciplesById = principles ?? undefined;
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
    />
  );
}
