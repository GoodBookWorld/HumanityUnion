/**
 * RESET 04 — Universal PLP publication pipeline exports.
 */

export {
  ownershipToProvenance,
  resolveCollectedPathOwnership,
  isTechnicalIdentityPath,
  inventoryPresentationPathAuthority,
  isCollectedPathLocalizationRequired,
  machineEligiblePaths,
  isCollectedPathMachineEligible,
  machineMayOverwriteExisting,
  assertFieldAuthorityOrderDocumented,
} from "./field-authority.js";
export { resolveFieldPolicyForEntityType } from "./resolve-field-policy.js";
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
  listPlpBuildRequestsCompletedForTests,
  resetPlpBuildRequestQueueForTests,
  setPlpBuildRequestProcessor,
  setPlpBuildRequestProcessorForTests,
  getPlpBuildRequestProcessorForTests,
  isPlpBuildStaleAgainstLive,
  kickPlpAutoBuildDrain,
  isExistingPlpUsableForEnqueue,
} from "./build-request-queue.js";
export type { EnqueuePlpBuildRequestResult } from "./build-request-queue.js";
export { processPlpBuildRequest } from "./process-plp-build-request.js";
export type { ProcessPlpBuildRequestDeps } from "./process-plp-build-request.js";
export {
  PLP_STALE_ORIGIN,
  PLP_STALE_ORIGIN_INVENTORY,
  encodePlpStructuredStaleSafeReason,
  encodePlpStructuredStaleReasonCodes,
  parsePlpStructuredStaleFromSafeReason,
  isBareStaleRevisionReason,
} from "./plp-stale-result.js";
export type {
  PlpStaleOriginId,
  PlpStructuredStaleDetail,
} from "./plp-stale-result.js";
export {
  registerPlpAutoBuildProcessor,
  bootstrapPlpAutoBuildRuntime,
  stopPlpAutoBuildRuntimeForTests,
} from "./register-plp-auto-build-processor.js";
export type {
  RegisterPlpAutoBuildProcessorResult,
  BootstrapPlpAutoBuildRuntimeResult,
} from "./register-plp-auto-build-processor.js";
export { enqueueCivicMediaEditorialPlpBuilds } from "./editorial-build-trigger.js";
export {
  getPlpAutoBuildRuntimeSnapshot,
  resetPlpAutoBuildRuntimeForTests,
  resolvePlpAutoBuildQueueBackend,
} from "./plp-auto-build-runtime.js";
export {
  upsertPendingPlpAutoBuildWork,
  claimNextPlpAutoBuildWork,
  countPlpAutoBuildWorkByStatus,
  listFailedPlpAutoBuildWork,
  listPlpAutoBuildWorkForTests,
  findPlpAutoBuildWorkByKey,
  resetPlpAutoBuildWorkStoreForTests,
  setPlpAutoBuildWorkForceMemoryForTests,
  resolvePlpAutoBuildMaxAttempts,
  usePlpAutoBuildWorkMemory,
  sanitizePlpAutoBuildFailureReason,
  normalizePlpAutoBuildFailureClass,
  markPlpAutoBuildWorkFailed,
  markPlpAutoBuildWorkCompleted,
  PLP_AUTO_BUILD_FAILED_DIAGNOSTIC_DEFAULT_LIMIT,
  PLP_AUTO_BUILD_FAILED_DIAGNOSTIC_MAX_LIMIT,
} from "./plp-auto-build-work.repository.js";
export type {
  PlpAutoBuildWorkRecord,
  PlpAutoBuildWorkStatus,
  UpsertPlpAutoBuildWorkResult,
  PlpAutoBuildFailureClass,
} from "./plp-auto-build-work.repository.js";
export {
  structuredFailure,
  mapProviderBoundaryReasonToFailure,
  mapBuildStatusToFailure,
  sanitizePlpAutoBuildFailureReason as sanitizePlpAutoBuildFailureReasonCore,
} from "./plp-auto-build-failure.js";
export type {
  PlpAutoBuildStructuredFailure,
  PlpAutoBuildFailureCode,
  PlpAutoBuildFailureStage,
  ProcessPlpBuildRequestResult,
} from "./plp-auto-build-failure.js";
export {
  inspectPlpAutoBuildFailedWork,
  PLP_AUTO_BUILD_FAILURE_DIAGNOSTIC_PACK,
} from "./plp-auto-build-work-failure-diagnostic.js";
export type {
  PlpAutoBuildFailedWorkReport,
  PlpAutoBuildFailedWorkRow,
} from "./plp-auto-build-work-failure-diagnostic.js";
export { resolvePlpAutoBuildLocales, notifyPlpPublicSourceMutation } from "./public-source-mutation-bridge.js";
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
