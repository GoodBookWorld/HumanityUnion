/**
 * TRANSLATION DELIVERY RESET 02 — Published Localized Presentation core.
 *
 * Dormant for public routes until Reset 03+ consumer allowlist enablement.
 */

export {
  PUBLISHED_LOCALIZATION_CONSUMER_ALLOWLIST,
  assertPublishedLocalizationConsumptionAllowed,
  isPublishedLocalizationConsumptionEnabled,
} from "./feature-boundary.js";
export {
  formatPublishedReadImportGuardCounters,
  getPublishedLocalizationReadImportGuards,
  resetPublishedLocalizationReadImportGuardsForTests,
} from "./import-guards.js";
export {
  mergeLocalizedLayersByProvenance,
  validatePublishedBuildResult,
} from "./validate-build-result.js";
export type { ValidatePublishedBuildInput } from "./validate-build-result.js";
export {
  mayOverwriteProvenance,
  provenanceRank,
  selectWinningProvenance,
} from "./provenance-priority.js";
export { collectAutoPaths } from "./presentation-paths.js";
export { resolvePublishedPresentation } from "./resolve-published-presentation.js";
export {
  publishPublishedLocalizedPresentation,
} from "./publish-atomic.js";
export type { PublishPublishedLocalizedPresentationInput } from "./publish-atomic.js";
export {
  findCurrentPublishedPresentation,
  getPublishedLocalizationPersistenceMode,
  publishAtomicPublishedPresentation,
  resetPublishedLocalizationPersistenceForTests,
  saveBuildingOrFailedSnapshot,
  setPublishedLocalizationFindFailureForTests,
  setPublishedLocalizationPersistenceModeForTests,
} from "./persistence/repository.js";
export {
  findCurrentPublishedMemory,
  findPublishedSnapshotByIdMemory,
  getPublishedLocalizationBallastCountForTests,
  getPublishedLocalizationMemoryStoreStatsForTests,
  publishAtomicMemory,
  putPublishedSnapshotMemory,
  resetPublishedLocalizedPresentationMemoryStoreForTests,
  seedPublishedLocalizationBallastCountForTests,
} from "./persistence/memory.store.js";

export * from "./media/index.js";
