import type { Metadata } from "next";

import type { CivicMediaCenterPublic } from "@hu/types";

import { fetchCivicMediaCenter } from "../../features/civic-media-center/api";
import { CivicMediaCenterPageContent } from "../../features/civic-media-center/components/CivicMediaCenterPageContent";
import type { CivicMediaResolvedEditorial } from "../../features/civic-media-center/components/CivicMediaTranslatedEditorial";
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
 * Pack 08I.9 / 08I.12 — SSR-first Media editorial seed (GET resolve only).
 *
 * CRITICAL (08I.12): localization must never make the canonical Media page
 * unavailable. Media fetch and editorial seed are independent:
 * - Media SSR success → pass payload; seed may overlay translations
 * - Media SSR failure → omit payload so the client recovers via browser fetch
 * - Seed failure → keep media; fall back to canonical editorial client-side
 */
export default async function CivicMediaPage() {
  let initialMedia: CivicMediaCenterPublic | undefined;
  let initialEditorial: CivicMediaResolvedEditorial | undefined;

  try {
    initialMedia = await fetchCivicMediaCenter();
  } catch {
    // Leave undefined — client browser fetch can still succeed when SSR
    // cannot reach the API (common Render/server networking difference).
    initialMedia = undefined;
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
