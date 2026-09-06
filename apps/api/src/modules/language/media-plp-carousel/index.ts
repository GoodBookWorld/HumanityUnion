/**
 * Reset 03E.9 / 03E.10 — Media/Country carousel PLP diagnostic + materialize ceilings.
 */

export {
  MEDIA_PLP_CAROUSEL_MATERIALIZE_DEFAULT_LIMIT,
  MEDIA_PLP_CAROUSEL_MATERIALIZE_PACK,
  MEDIA_PLP_CAROUSEL_MATERIALIZE_PLAN_MAX,
  MEDIA_PLP_CAROUSEL_NEWS_LIMIT,
  MEDIA_PLP_CAROUSEL_PACK,
  MEDIA_PLP_CAROUSEL_TRUSTED_COUNTRY_LIMIT,
  MEDIA_PLP_CAROUSEL_TRUSTED_WORLD_LIMIT,
} from "./constants.js";
export {
  discoverMediaPlpCarouselEntities,
  discoverMediaPlpCarouselStaticEntities,
} from "./discover-entities.js";
export type {
  MediaPlpCarouselEntityRef,
  MediaPlpCarouselSurface,
} from "./discover-entities.js";
export { assertMediaPlpCarouselImportIsolation } from "./import-guards.js";
export { parseMediaPlpCarouselArgs } from "./parse-args.js";
export {
  buildMediaPlpCarouselMaterializePlan,
  classifyMediaPlpCarouselEntity,
  computeMediaPlpCarouselTotals,
  printMediaPlpCarouselReport,
  runMediaPlpCarouselDiagnostic,
} from "./run-carousel.js";
export type {
  MediaPlpCarouselEntityRow,
  MediaPlpCarouselReport,
  MediaPlpCarouselRebuildClass,
  MediaPlpCarouselTotals,
} from "./run-carousel.js";
