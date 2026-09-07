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
  ensureInitiativeLifecyclePlpAdapterRegistered,
  ensureRemainingPublicPlpAdaptersRegistered,
  ensureAllDefaultPlpAdaptersRegistered,
  resetMediaPlpAdapterRegistrationForTests,
  resetInitiativePlpAdapterRegistrationForTests,
} from "./register-defaults.js";
export { mediaPlpDomainAdapter } from "./adapters/media-plp-adapter.js";
export {
  initiativeLifecyclePlpDomainAdapter,
  buildCanonicalInitiativeCardPresentation,
  fingerprintInitiativePlpCanonicalVersion,
  seedInitiativePlpLiveCardForTests,
  resetInitiativePlpLiveStoreForTests,
} from "./adapters/initiative-lifecycle-adapter.js";
export {
  blogKnowledgePlpDomainAdapter,
  BLOG_PLP_ENTITY_TYPE,
  seedBlogPlpPostForTests,
  resetBlogPlpStoreForTests,
} from "./adapters/blog-knowledge-adapter.js";
export {
  discussionPlpDomainAdapter,
  DISCUSSION_PLP_ENTITY_TYPE,
  seedDiscussionPlpCommentForTests,
  resetDiscussionPlpStoreForTests,
} from "./adapters/discussion-adapter.js";
export {
  participantPublicPlpDomainAdapter,
  PARTICIPANT_PUBLIC_PLP_ENTITY_TYPE,
  seedParticipantPublicPlpForTests,
  resetParticipantPublicPlpStoreForTests,
} from "./adapters/participant-public-adapter.js";
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
