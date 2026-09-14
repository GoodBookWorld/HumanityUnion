/**
 * Reset 03E.9 — bounded Media/Country carousel diagnostic ceilings.
 */

/** News entities in the /media PLP batch (mirrors Web MEDIA_PLP_NEWS_BATCH_LIMIT). */
export const MEDIA_PLP_CAROUSEL_NEWS_LIMIT = 12;

/** WORLD trusted media id discovery hard cap (seed catalog ≈ 33). */
export const MEDIA_PLP_CAROUSEL_TRUSTED_WORLD_LIMIT = 40;

/** Country recommended-media hard cap when --country-code is provided. */
export const MEDIA_PLP_CAROUSEL_TRUSTED_COUNTRY_LIMIT = 12;

/** Materialization plan / bounded runner hard max (one-by-one execute list). */
export const MEDIA_PLP_CAROUSEL_MATERIALIZE_PLAN_MAX = 20;

/** Default --limit for materialize:media-plp-carousel. */
export const MEDIA_PLP_CAROUSEL_MATERIALIZE_DEFAULT_LIMIT =
  MEDIA_PLP_CAROUSEL_MATERIALIZE_PLAN_MAX;

export const MEDIA_PLP_CAROUSEL_PACK = "RESET_03E.9" as const;
export const MEDIA_PLP_CAROUSEL_MATERIALIZE_PACK = "RESET_03E.10" as const;
