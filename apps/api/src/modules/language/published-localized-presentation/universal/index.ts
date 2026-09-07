/**
 * RESET 04 — Universal PLP publication pipeline exports.
 */

export {
  ownershipToProvenance,
  machineEligiblePaths,
  machineMayOverwriteExisting,
  assertFieldAuthorityOrderDocumented,
} from "./field-authority.js";
export {
  registerPlpDomainAdapter,
  getPlpDomainAdapter,
  listRegisteredPlpDomainAdapters,
  listRegisteredPlpEntityTypes,
  isPlpEntityTypeRegistered,
  resetPlpDomainAdapterRegistryForTests,
  defaultPlpSchemaVersion,
} from "./domain-adapter-registry.js";
export type {
  PlpDomainAdapter,
  PlpDomainAdapterResolveInput,
} from "./domain-adapter-registry.js";
export {
  enqueuePlpBuildRequest,
  getPlpBuildRequestQueueStats,
  listPlpBuildRequestsPendingForTests,
  resetPlpBuildRequestQueueForTests,
  setPlpBuildRequestProcessorForTests,
  isPlpBuildStaleAgainstLive,
} from "./build-request-queue.js";
export {
  runUniversalPlpBuild,
} from "./build-pipeline.js";
export type {
  PlpLocalizationLayerInput,
  RunUniversalPlpBuildInput,
  RunUniversalPlpBuildResult,
} from "./build-pipeline.js";
export {
  createPlpPublicationTrigger,
  dispatchPlpPublicationTrigger,
  PLP_PUBLICATION_TRIGGER_KINDS,
} from "./publication-triggers.js";
export {
  notifyPlpSearchSeoInvalidation,
  registerPlpSearchSeoInvalidationListener,
  getPlpSearchSeoInvalidationStatsForTests,
  resetPlpSearchSeoInvalidationForTests,
} from "./search-seo-hooks.js";
export {
  PLP_UNIVERSAL_WORKER_SAFETY_DEFAULTS,
  PLP_UNIVERSAL_PROVIDER_TIMEOUT_MS,
  resolvePlpProviderConcurrency,
} from "./safety.js";
export {
  ensureMediaPlpAdapterRegistered,
  resetMediaPlpAdapterRegistrationForTests,
} from "./register-defaults.js";
export { mediaPlpDomainAdapter } from "./adapters/media-plp-adapter.js";
export {
  fixturePlpDomainAdapter,
  FIXTURE_PLP_ENTITY_TYPE,
  seedFixturePlpEntityForTests,
  resetFixturePlpStoreForTests,
} from "./adapters/fixture-plp-adapter.js";
export {
  enqueueConsumerVisibleNewsPlpBuilds,
  enqueuePublicNewsArticlePlpBuild,
} from "./news-consumer-build-trigger.js";
