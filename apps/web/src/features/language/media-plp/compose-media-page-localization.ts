/**
 * Reset 03E.6 — real /media route localization composition (testable).
 * Same branch logic as apps/web/src/app/media/page.tsx — not a fixture-only path.
 */

import type { CivicMediaCenterPublic, PublicNewsArticleItem } from "@hu/types";

import type { CivicMediaResolvedEditorial } from "../../civic-media-center/civic-media-canonical-editorial";
import { loadCivicMediaEditorialSeed } from "../../civic-media-center/load-civic-media-editorial-seed";
import { isMediaPlpWebEnabled } from "./feature-flag";
import {
  buildCanonicalEditorialPresentationNode,
  loadMediaPlpPagePresentations,
} from "./load-media-plp-ssr";
import type { MediaPlpResolvedPresentation } from "./presentation";
import {
  MEDIA_LOCALIZATION_RUNTIME_BRANCH_LEGACY,
  MEDIA_LOCALIZATION_RUNTIME_BRANCH_PLP,
  type MediaLocalizationRuntimeBranch,
} from "./media-localization-runtime-truth";
import {
  beginMediaPlpLiveTruthProbe,
  isMediaPlpLiveTruthProbeEnabled,
  mediaPlpLiveTruthNeedsEditorialRecord,
  recordMediaPlpLiveTruthEditorialResult,
} from "./media-plp-live-truth-probe";
import { PUBLISHED_LOCALIZATION_SCHEMA_VERSION } from "@hu/types";

/** Bound news PLP entities so the single Media batch stays under resolve max items. */
export const MEDIA_PLP_NEWS_BATCH_LIMIT = 12;

export type MediaPageLocalizationComposition = {
  readonly runtimeBranch: MediaLocalizationRuntimeBranch;
  readonly requestedLocale: string | null;
  readonly batchLocale: string | null;
  readonly initialEditorial: CivicMediaResolvedEditorial | undefined;
  readonly plpTrustedById:
    | Readonly<Record<string, MediaPlpResolvedPresentation>>
    | undefined;
  readonly plpPrinciplesById:
    | Readonly<Record<string, MediaPlpResolvedPresentation>>
    | undefined;
  readonly plpEditorialPresentation: MediaPlpResolvedPresentation | undefined;
  readonly plpFactCheckById:
    | Readonly<Record<string, MediaPlpResolvedPresentation>>
    | undefined;
  readonly plpPropagandaById:
    | Readonly<Record<string, MediaPlpResolvedPresentation>>
    | undefined;
  readonly plpNewsById:
    | Readonly<Record<string, MediaPlpResolvedPresentation>>
    | undefined;
  readonly initialNewsArticles: PublicNewsArticleItem[] | undefined;
};

export async function composeMediaPageLocalization(input: {
  readonly media: CivicMediaCenterPublic;
  readonly locale: string;
  readonly fetchNewsArticles?: () => Promise<readonly PublicNewsArticleItem[]>;
  readonly loadPlp?: typeof loadMediaPlpPagePresentations;
  readonly loadLegacyEditorial?: typeof loadCivicMediaEditorialSeed;
  readonly isPlpEnabled?: () => boolean;
}): Promise<MediaPageLocalizationComposition> {
  const isPlpEnabled = input.isPlpEnabled ?? isMediaPlpWebEnabled;
  const loadPlp = input.loadPlp ?? loadMediaPlpPagePresentations;
  const loadLegacy = input.loadLegacyEditorial ?? loadCivicMediaEditorialSeed;

  if (isMediaPlpLiveTruthProbeEnabled()) {
    beginMediaPlpLiveTruthProbe({ REQUESTED_LOCALE: input.locale });
  }

  if (!isPlpEnabled()) {
    let initialEditorial: CivicMediaResolvedEditorial | undefined;
    try {
      initialEditorial = await loadLegacy({
        media: input.media,
        language: input.locale,
      });
    } catch {
      initialEditorial = undefined;
    }
    return {
      runtimeBranch: MEDIA_LOCALIZATION_RUNTIME_BRANCH_LEGACY,
      requestedLocale: input.locale,
      batchLocale: null,
      initialEditorial,
      plpTrustedById: undefined,
      plpPrinciplesById: undefined,
      plpEditorialPresentation: undefined,
      plpFactCheckById: undefined,
      plpPropagandaById: undefined,
      plpNewsById: undefined,
      initialNewsArticles: undefined,
    };
  }

  let initialNewsArticles: PublicNewsArticleItem[] = [];
  if (input.fetchNewsArticles) {
    try {
      initialNewsArticles = [...(await input.fetchNewsArticles())];
    } catch {
      initialNewsArticles = [];
    }
  }

  const plp = await loadPlp({
    resources: input.media.trustedMedia,
    principles: input.media.selectionPrinciples,
    factChecking: input.media.factChecking,
    propagandaAnalysis: input.media.propagandaAnalysis,
    newsArticles: initialNewsArticles,
    media: input.media,
    locale: input.locale,
  });

  // Real loader records first (preserves reasonCode). Injected loadPlp (tests) records here.
  if (
    isMediaPlpLiveTruthProbeEnabled() &&
    plp?.editorial &&
    mediaPlpLiveTruthNeedsEditorialRecord()
  ) {
    recordMediaPlpLiveTruthEditorialResult({
      mode: plp.editorial.mode,
      entityId: plp.editorial.entityId,
      canonicalVersion: plp.editorial.canonicalVersion,
      schema: PUBLISHED_LOCALIZATION_SCHEMA_VERSION,
      presentation: plp.editorial.presentation,
      canonicalPresentation: buildCanonicalEditorialPresentationNode(input.media),
    });
  }

  return {
    runtimeBranch: MEDIA_LOCALIZATION_RUNTIME_BRANCH_PLP,
    requestedLocale: input.locale,
    batchLocale: input.locale,
    initialEditorial: undefined,
    plpTrustedById: plp?.trustedById,
    plpPrinciplesById: plp?.principlesById,
    plpEditorialPresentation: plp?.editorial,
    plpFactCheckById: plp?.factCheckById,
    plpPropagandaById: plp?.propagandaById,
    plpNewsById: plp?.newsById,
    initialNewsArticles,
  };
}
