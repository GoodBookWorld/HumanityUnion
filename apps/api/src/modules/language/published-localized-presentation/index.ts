/**
 * TRANSLATION DELIVERY RESET 02 — Published Localized Presentation core.
 *
 * Dormant for public routes until Reset 03+ consumer allowlist enablement.
 */

export {
  PUBLISHED_LOCALIZATION_CONSUMER_ALLOWLIST,
  assertPublishedLocalizationConsumptionAllowed,
  isPublishedLocalizationConsumptionEnabled,
  registerPlpConsumptionChecker,
  resetPlpConsumptionCheckersForTests,
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
export {
  evaluateLocalizationContentIntegrity,
  isTechnicalIdentityPath,
  LOCALIZATION_CONTENT_INTEGRITY_VERSION,
  normalizeLocalizationCompareValue,
  resolveLocalizationContentIntegrityForRead,
} from "./content-integrity.js";
export {
  evaluateLocalizationStructuralIntegrity,
  listRequiredLocalizationSourcePaths,
  LOCALIZATION_STRUCTURAL_INTEGRITY_VERSION,
  resolveLocalizationStructuralIntegrityForRead,
} from "./structural-integrity.js";
export {
  classifyUsableLocalizedPresentation,
  translationValuesPassLocalizationIntegrity,
} from "./usability.js";
export type { UsableLocalizedPresentationClassification } from "./usability.js";
export { resolvePublishedPresentation, readPublishedLocalizationPersistenceProbeMode } from "./resolve-published-presentation.js";
export {
  publishPublishedLocalizedPresentation,
} from "./publish-atomic.js";
export type { PublishPublishedLocalizedPresentationInput } from "./publish-atomic.js";
export {
  findCurrentPublishedPresentation,
  getPublishedLocalizationPersistenceMode,
  getPublishedLocalizationPersistenceProbeMode,
  getPublishedLocalizationPersistenceRuntimeClass,
  publishAtomicPublishedPresentation,
  requirePublishedLocalizationMongoPersistence,
  assertPublishedLocalizationMongoPersistenceActive,
  assertPublishedLocalizationHttpPersistenceSafe,
  bootstrapPublishedLocalizationApiPersistence,
  bindPublishedLocalizationMemoryPersistenceForTests,
  markPublishedLocalizationPersistenceUnavailable,
  forcePublishedLocalizationPersistenceUnboundForTests,
  PublishedLocalizationPersistenceUnavailableError,
  resetPublishedLocalizationPersistenceForTests,
  saveBuildingOrFailedSnapshot,
  setPublishedLocalizationFindFailureForTests,
  setPublishedLocalizationPersistenceModeForTests,
} from "./persistence/repository.js";
export type {
  PublishedLocalizationPersistenceMode,
  PublishedLocalizationPersistenceRuntimeClass,
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
export * from "./universal/index.js";
