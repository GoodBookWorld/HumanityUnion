/**
 * Language Architecture Pack 01–02 — Language & Translation.
 *
 * Original Content is preserved permanently.
 * Translation is a separate representation.
 * Browser Google Translate is convenience only — not the source of truth.
 */

/** Legacy catalog — seed/migration compatibility only; not for runtime pickers. */
export { PRIORITY_LANGUAGE_CATALOG, listPriorityLanguageCodes, resolveSafeDefaultLanguage } from "./language-catalog.js";
export type { PriorityLanguageDescriptor } from "./language-catalog.js";
export {
  listEnabledSelectableLanguages,
  resolveEnabledCanonicalLocale,
  assertEnabledSelectableLocale,
  assertEnabledPreferenceLocale,
  resolveLocaleWithEnglishFallback,
} from "./language-registry-runtime.js";
export type { SelectableLanguageDescriptor } from "./language-registry-runtime.js";
export {
  expandLocaleLookupCandidates,
  listAcceptLanguageLookupTags,
  parseAcceptLanguageHeader,
} from "./accept-language.js";
export type { AcceptLanguagePreference } from "./accept-language.js";
export {
  HU_LANG_COOKIE_MAX_AGE_SECONDS,
  HU_LANG_COOKIE_NAME,
  buildHuLangCookieOptions,
  clearHuLangCookie,
  getHuLangCookieSecuritySnapshot,
  readHuLangCookie,
  serializeHuLangSetCookieHeader,
  writeHuLangCookie,
} from "./hu-lang-cookie.js";
export {
  loadEnabledRuntimeLocaleCatalog,
  resolveEnabledRegistryRecordForCandidate,
  resolveRuntimeLocale,
} from "./resolve-runtime-locale.js";
export type { ResolveRuntimeLocaleInput } from "./resolve-runtime-locale.js";
export {
  attachRuntimeLocale,
  resolveRuntimeLocaleForRequest,
  runtimeLocaleMiddleware,
  setRuntimeLocalePreferenceLoaderForTests,
} from "./runtime-locale.middleware.js";
export { default as runtimeLocaleRouter } from "./runtime-locale.routes.js";
export type {
  TranslationProvider,
  TranslationProviderRequest,
  TranslationProviderResult,
} from "./translation-provider.js";
export { DeterministicTranslationProvider } from "./providers/deterministic-translation-provider.js";
export {
  GeminiTranslationProvider,
  buildGeminiTranslationSystemInstruction,
  buildGeminiTranslationSystemInstructionForTests,
  resolveTranslationLanguageEnglishName,
} from "./providers/gemini-translation-provider.js";
export {
  assertCivicTitleFieldsTranslatedFromSource,
  assertTranslatedProseChangedFromSource,
  filterTranslatedFieldsToSourceAllowlist,
} from "./content-translation-output-validation.js";
export {
  resolveTranslationProvider,
  setTranslationProviderForTests,
  resetTranslationProviderForTests,
  translationProviderPublicErrorMessage,
} from "./resolve-translation-provider.js";
export {
  resolveTranslatedDisplay,
  resolveStructuredTranslatedDisplay,
  markTranslationStaleIfSourceChanged,
} from "./resolve-translated-display.js";
export type { ResolveTranslatedDisplayInput } from "./resolve-translated-display.js";
export { translateDraft } from "./translate-draft.js";
export {
  buildParticipantLanguageContextFromExperience,
  resolveParticipantLanguageContext,
} from "./participant-language-context.js";
export { buildTranslationCacheKey } from "./translation-cache-key.js";
export { buildContentTranslationSourceVersion } from "./content-translation-version.js";
export {
  buildContentTranslationWorkIdentity,
  buildContentTranslationWorkIdentityKey,
} from "./content-translation-work-identity.js";
export {
  CONTENT_TRANSLATION_CIVIC_TITLE_FIELDS,
  CONTENT_TRANSLATION_FIELD_ALLOWLIST,
  CONTENT_TRANSLATION_PRIVACY_EXCLUSIONS,
  PUBLIC_CONTENT_TRANSLATION_SOURCE_KINDS,
  assertCanonicalSourceEligibleForTranslation,
  assertPublicFieldsAllowlisted,
  isPrivacyExcludedTranslationSurface,
  isPublicContentTranslationSourceKind,
  isRedundantTargetLanguage,
  isSupportedContentTranslationSourceKind,
} from "./content-translation-eligibility.js";
export type { CanonicalTranslatableSourceEligibility } from "./content-translation-eligibility.js";
export {
  isCivicMediaTranslationRecordId,
  loadCivicArchiveTranslationSource,
  loadCivicMediaTranslationSource,
  loadCollectiveDecisionTranslationSource,
  loadDecisionSessionTranslationSource,
  loadImplementationCommitmentTranslationSource,
  loadImplementationTrackingTranslationSource,
  loadImprovementProposalTranslationSource,
  loadInitiativeRevisionTranslationSource,
  loadOfficialResponseTranslationSource,
  loadPublicImpactTranslationSource,
} from "./content-translation-civic-loaders.js";
export {
  joinTranslationLines,
  stableJsonForTranslation,
} from "./content-translation-field-serialize.js";
export {
  ADMIN_MANAGED_LOCALIZATION_DOMAINS,
  CIVIC_CONTENT_MANUAL_OVERRIDE_STATUS,
  DEFAULT_LOCALIZABLE_RULE,
  LOCALIZATION_RESOLUTION_PRIORITY,
  assertAdminDomainNotMachineTranslated,
} from "./localization-ownership.js";
export {
  assertAutomaticContentTranslationTargetLocale,
  listAutomaticContentTranslationTargetLocales,
  resolveAutomaticContentTranslationWarmTargets,
} from "./content-translation-warm-targets.js";
export {
  auditContentTranslationMaterialization,
  runStagingInitiativePathContentTranslationRepair,
  waitForStagingWarmMaterialization,
} from "./content-translation-staging-warm-repair.js";
export type {
  StagingWarmLocaleAuditRow,
  StagingWarmLocaleMaterializationState,
  StagingWarmRepairAction,
  StagingWarmRepairResult,
  StagingWarmWaitProgress,
  StagingWarmWaitTargetIdentity,
} from "./content-translation-staging-warm-repair.js";
export {
  getContentTranslationWorkerInFlightForTests,
  getContentTranslationWorkerPeakConcurrencyForTests,
  resetContentTranslationWorkerConcurrencyForTests,
  resolveContentTranslationWorkerConcurrency,
  withContentTranslationWorkerSlot,
} from "./content-translation-worker-concurrency.js";
export {
  buildContentTranslationWarmTargetDiagnostic,
  contentTranslationWarmRegistryCandidateDiagnosticKeys,
} from "./content-translation-warm-diagnostic.js";
export type {
  ContentTranslationWarmRegistryCandidateDiagnostic,
  ContentTranslationWarmTargetDiagnostic,
} from "./content-translation-warm-diagnostic.js";
export {
  CONTENT_TRANSLATION_RESULT_EVENT_NAMES,
  buildContentTranslationWarmRequestedCommand,
  isContentTranslationResultEventName,
  isContentTranslationWarmRequestCommandName,
} from "./content-translation-warm-request.js";
export {
  CONTENT_TRANSLATION_WARM_AGGREGATE_TYPE,
  buildContentTranslationWarmAggregateId,
  buildContentTranslationWarmEventId,
  enqueueContentTranslationWarmRequested,
  listContentTranslationWarmMemoryPendingForTests,
  markContentTranslationWarmMemoryPublishedForTests,
  resetContentTranslationWarmMemoryForTests,
  scheduleContentTranslationWarmAfterMutation,
  setContentTranslationWarmForceMemoryForTests,
} from "./content-translation-warm-enqueue.js";
export type { ContentTranslationWarmEnqueueResult } from "./content-translation-warm-enqueue.js";
export {
  CONTENT_TRANSLATION_WARM_CONSUMER_ID,
  handleContentTranslationWarmRequestedEvent,
  processContentTranslationWarmMemoryQueueForTests,
  processContentTranslationWarmRequested,
  registerContentTranslationWarmHandlers,
} from "./content-translation-warm-consumer.js";
export type {
  ContentTranslationWarmLocaleOutcome,
  ContentTranslationWarmProcessResult,
} from "./content-translation-warm-consumer.js";
export { classifyContentTranslationWarmFailure } from "./content-translation-warm-failure.js";
export {
  mapWithConcurrency,
  resolveContentTranslationWarmLocaleConcurrency,
} from "./content-translation-warm-concurrency.js";
export { resolveNotificationTemplate } from "./notification-localization.js";
export type {
  LocalizedNotificationTemplate,
  NotificationTemplateKey,
} from "./notification-localization.js";
export {
  getOrCreateContentTranslation,
  loadTranslatableSource,
  resolvePublicTranslatedContent,
} from "./content-translation.service.js";
export {
  resolveTranslationConfig,
  TranslationProviderError,
} from "./translation.config.js";
export { resetContentTranslationMemoryStoreForTests } from "./persistence/content-translation.memory.store.js";
export { clearTranslationRateLimitBucketsForTests } from "./translation-rate-limit.js";
export { default as languageRouter } from "./language.routes.js";
export {
  LANGUAGE_REGISTRY_SEED_DEFINITIONS,
  buildLanguageRegistrySeedRecord,
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  getLanguageRegistryByLocale,
  listLanguageRegistry,
  listAdminLanguages,
  listPublicLanguages,
  createAdminLanguage,
  updateAdminLanguage,
  setLanguageRegistryAdminAssertOverrideForTests,
  resetLanguageRegistryStoreForTests,
  resolveLanguageRegistryLocale,
  setLanguageRegistryForceMemoryForTests,
  updateLanguageRegistryRecord,
  assertLanguageRegistryLocaleIntegrity,
  sortLanguageRegistryRecords,
  LanguageRegistryConflictError,
  LanguageRegistryError,
  LanguageRegistryNotFoundError,
  LanguageRegistryPersistenceError,
  LanguageRegistryValidationError,
} from "./language-registry/index.js";
export type { LanguageRegistrySeedResult } from "./language-registry/index.js";
export {
  publicLanguagesRouter,
  adminLanguagesRouter,
} from "./language-registry/index.js";
export {
  TERMINOLOGY_GLOSSARY_SEED_DEFINITIONS,
  buildEnglishProviderTerminologyContext,
  buildProviderTerminologyContext,
  canonicalizeGlossaryLocaleKeys,
  canonicalizeGlossaryTranslationLocales,
  ensureTerminologyGlossarySeeded,
  formatProviderTerminologyContext,
  getAdminTerminologyConcept,
  getTerminologyConceptById,
  isSeededTerminologyConceptId,
  listAdminTerminologyConcepts,
  listPublishedProviderTerminologyLines,
  listSeededTerminologyConceptIds,
  listTerminologyConcepts,
  normalizeGlossaryAliasList,
  resetTerminologyGlossaryStoreForTests,
  resolveProviderTerminologyContext,
  setTerminologyGlossaryAdminAssertOverrideForTests,
  setTerminologyGlossaryForceMemoryForTests,
  updateAdminTerminologyConcept,
  updateTerminologyConcept,
  TerminologyGlossaryConflictError,
  TerminologyGlossaryError,
  TerminologyGlossaryNotFoundError,
  TerminologyGlossaryPersistenceError,
  TerminologyGlossaryValidationError,
  adminTerminologyGlossaryRouter,
} from "./terminology-glossary/index.js";
export type {
  ProviderTerminologyConceptLine,
  TerminologyGlossarySeedResult,
} from "./terminology-glossary/index.js";
export { HUMANITY_UNION_TRANSLATION_TERMINOLOGY } from "./hu-terminology-glossary.js";
