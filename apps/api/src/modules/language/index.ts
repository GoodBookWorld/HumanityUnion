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
export { GeminiTranslationProvider } from "./providers/gemini-translation-provider.js";
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
