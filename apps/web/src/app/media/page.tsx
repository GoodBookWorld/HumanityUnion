import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import type { CivicMediaCenterPublic } from "@hu/types";

import { resolveBrandForMetadata } from "../../features/brand-localization/resolve-brand-for-metadata";
import { fetchCivicMediaCenter } from "../../features/civic-media-center/api";
import { CivicMediaCenterPageContent } from "../../features/civic-media-center/components/CivicMediaCenterPageContent";
import { applyMediaPlpPresentationsToEditorial } from "../../features/language/media-plp/apply-media-plp-editorial";
import {
  composeMediaPageLocalization,
  MEDIA_PLP_NEWS_BATCH_LIMIT,
} from "../../features/language/media-plp/compose-media-page-localization";
import {
  finalizeMediaPlpLiveTruthProbeAttrFromApplied,
  MEDIA_PLP_LIVE_TRUTH_PROBE_STATUS,
  resolveMediaPlpLiveTruthProbeStatus,
} from "../../features/language/media-plp/media-plp-live-truth-probe";
import { markMediaLocaleSwitchPerfPhase } from "../../features/language/media-plp/media-plp-locale-switch-perf";
import { resolveDocumentHtmlLocale } from "../../features/language/resolve-document-locale";
import { fetchPublicNewsArticles } from "../../features/public-news/api";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const brand = await resolveBrandForMetadata(locale);
  const t = await getTranslations("civicMediaPublic");
  const siteName = { siteName: brand.siteName };
  return {
    title: t("metaTitle", siteName),
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
 * Reset 03E.3 — also fact-check + propaganda (+ optional news) PLP maps.
 * Reset 03E.6 — composeMediaPageLocalization is the real route branch authority;
 * runtime branch (PLP|LEGACY) is emitted for live forensics.
 * Reset 03E.7A — always emit live-truth probe status from this server route.
 */
export default async function CivicMediaPage() {
  markMediaLocaleSwitchPerfPhase("T3_WEB_RENDER_BEGIN");

  let initialMedia: CivicMediaCenterPublic | undefined;
  try {
    initialMedia = await fetchCivicMediaCenter();
  } catch {
    initialMedia = undefined;
  }

  const documentLocale = await resolveDocumentHtmlLocale();
  const composition = initialMedia
    ? await (async () => {
        markMediaLocaleSwitchPerfPhase("T4_MEDIA_PLP_LOAD_BEGIN");
        const result = await composeMediaPageLocalization({
          media: initialMedia!,
          locale: documentLocale.locale,
          fetchNewsArticles: async () => {
            const newsListing = await fetchPublicNewsArticles({
              limit: MEDIA_PLP_NEWS_BATCH_LIMIT,
              language: "en",
            });
            return newsListing.items;
          },
        });
        markMediaLocaleSwitchPerfPhase("T9_WEB_RENDER_COMPLETE");
        return result;
      })()
    : null;

  // Reset 03E.7A — status always resolved on the server route (never client env).
  const mediaPlpLiveTruthProbeStatus = resolveMediaPlpLiveTruthProbeStatus();

  // Reset 03E.7 — finalize live-truth fingerprints on the server (not in client hydrate).
  let mediaPlpLiveTruthProbeAttr: string | undefined;
  if (
    mediaPlpLiveTruthProbeStatus === MEDIA_PLP_LIVE_TRUTH_PROBE_STATUS.ENABLED &&
    initialMedia &&
    composition?.runtimeBranch === "PLP"
  ) {
    const applied = applyMediaPlpPresentationsToEditorial({
      media: initialMedia,
      trustedById: composition.plpTrustedById ?? {},
      principlesById: composition.plpPrinciplesById ?? {},
      editorialPresentation: composition.plpEditorialPresentation,
      requestedLocale: documentLocale.locale,
    });
    mediaPlpLiveTruthProbeAttr = finalizeMediaPlpLiveTruthProbeAttrFromApplied({
      overviewSummary: applied.overview.summary,
      faq0Question: applied.faq[0]?.question ?? "",
      faq0Answer: applied.faq[0]?.answer ?? "",
    });
  }

  return (
    <CivicMediaCenterPageContent
      initialMedia={initialMedia}
      initialEditorial={composition?.initialEditorial}
      plpTrustedById={composition?.plpTrustedById}
      plpPrinciplesById={composition?.plpPrinciplesById}
      plpEditorialPresentation={composition?.plpEditorialPresentation}
      plpFactCheckById={composition?.plpFactCheckById}
      plpPropagandaById={composition?.plpPropagandaById}
      plpNewsById={composition?.plpNewsById}
      initialNewsArticles={composition?.initialNewsArticles}
      mediaLocalizationRuntimeBranch={
        composition?.runtimeBranch ?? "LEGACY"
      }
      mediaLocalizationRequestedLocale={documentLocale.locale}
      mediaLocalizationBatchLocale={composition?.batchLocale ?? undefined}
      mediaPlpLiveTruthProbeStatus={mediaPlpLiveTruthProbeStatus}
      mediaPlpLiveTruthProbeAttr={mediaPlpLiveTruthProbeAttr}
    />
  );
}
