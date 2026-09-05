/**
 * Reset 03 — Media PLP vertical slice exports.
 */

export {
  isMediaPlpConsumptionEnabled,
  isMediaPlpEntityConsumptionEnabled,
  listEnabledMediaPlpEntityTypes,
  setMediaPlpConsumptionEnabledForTests,
} from "./feature-flag.js";
export {
  asMediaPlpPresentationNode,
  buildCanonicalPrinciplePresentation,
  buildCanonicalPublicNewsPresentation,
  buildCanonicalTrustedPresentation,
  fingerprintMediaPlpCanonicalVersion,
} from "./canonical-trees.js";
export {
  buildDeterministicMachineLayer,
  buildMediaPlpCandidate,
} from "./build-adapter.js";
export type { BuildMediaPlpCandidateInput, MediaPlpLayerInput } from "./build-adapter.js";
export { publishMediaPlpEntity } from "./publisher.js";
export type { PublishMediaPlpEntityInput } from "./publisher.js";
export { resolveMediaPlpPresentation } from "./resolve-media-presentation.js";
export type { ResolveMediaPlpPresentationInput } from "./resolve-media-presentation.js";
export {
  MEDIA_LOCALIZATION_BUILD_HOOK_STATUS,
  notifyMediaCanonicalPublishedForLocalizationBuild,
} from "./publication-hook.js";
export type { MediaCanonicalLocalizationBuildHookInput } from "./publication-hook.js";
export {
  formatMediaPlpInstrumentationCounters,
  getMediaPlpInstrumentationCounters,
  markMediaPlpClientSemanticTranslationRequest,
  markMediaPlpContentTranslationRead,
  markMediaPlpContentTranslationWrite,
  markMediaPlpPostHydrationSemanticChange,
  markMediaPlpProviderCall,
  markMediaPlpRead,
  resetMediaPlpInstrumentationForTests,
} from "./instrumentation.js";
export {
  assertMediaPlpReadImportIsolation,
  mediaPlpReadModulesAvoidCorpusToArray,
} from "./import-isolation.js";
