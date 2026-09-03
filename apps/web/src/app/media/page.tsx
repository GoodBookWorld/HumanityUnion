import type { Metadata } from "next";

import { fetchCivicMediaCenter } from "../../features/civic-media-center/api";
import { CivicMediaCenterPageContent } from "../../features/civic-media-center/components/CivicMediaCenterPageContent";
import { loadCivicMediaEditorialSeed } from "../../features/civic-media-center/load-civic-media-editorial-seed";
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
 * Pack 08I.9 — SSR-first Media editorial seed (GET resolve only).
 * Cached translation → localized initial HTML; miss → canonical fallback.
 */
export default async function CivicMediaPage() {
  let initialMedia = null;
  let initialEditorial = undefined;

  try {
    initialMedia = await fetchCivicMediaCenter();
    const documentLocale = await resolveDocumentHtmlLocale();
    initialEditorial = await loadCivicMediaEditorialSeed({
      media: initialMedia,
      language: documentLocale.locale,
    });
  } catch {
    initialMedia = null;
    initialEditorial = undefined;
  }

  return (
    <CivicMediaCenterPageContent
      initialMedia={initialMedia}
      initialEditorial={initialEditorial}
    />
  );
}
