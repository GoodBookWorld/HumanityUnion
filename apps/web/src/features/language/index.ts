export {
  DEFAULT_PLATFORM_LANGUAGE,
  RTL_LANGUAGE_CODES,
  LANGUAGE_ROUTING_STRATEGY,
  documentAttributesFromRuntimeLocale,
  documentDirectionForLanguage,
  isRtlLanguageCode,
  normalizeLanguageCode,
} from "./language";
export type { LanguageCode, PriorityLanguageCode } from "./language";
export { TranslatedContentView, TranslatedContentSharedChrome } from "./components/TranslatedContentView";
export type { TranslatedContentViewProps } from "./components/TranslatedContentView";
export { PublicTranslatedFields } from "./components/PublicTranslatedFields";
export type { PublicTranslatedFieldsProps } from "./components/PublicTranslatedFields";
export { CivicPublicTranslatedSection } from "./components/CivicPublicTranslatedSection";
export type { CivicPublicTranslatedSectionProps } from "./components/CivicPublicTranslatedSection";
export {
  CIVIC_TRANSLATION_FIELD_META,
  joinLinesForDisplay,
  stableJsonForDisplay,
} from "./civic-translation-field-meta";
export {
  ADMIN_MANAGED_LOCALIZATION_DOMAINS,
  CIVIC_CONTENT_MANUAL_OVERRIDE_STATUS,
  CIVIC_CONTENT_SOURCE_KINDS,
  DEFAULT_LOCALIZABLE_RULE,
  assertNotMachineTranslatedAdminDomain,
  assertParticipantFacingTextClassified,
  classifyLocalizationOwnership,
  isCivicContentSourceKind,
  isRegisteredNonTranslatableFieldKey,
  NON_TRANSLATABLE_FIELD_KEYS,
} from "./localization-ownership";
export type { CivicContentSourceKind } from "./localization-ownership";
export {
  applyTranslatedPresentationFields,
  isNonTranslatableFieldKey,
} from "./translate-presentation";
export type { PresentationProjectionValue } from "./translate-presentation";
export {
  applyPublicPresentationTranslations,
  collectAutoTranslatableNodes,
  ensureLocalizedPublicPresentation,
  fingerprintPublicPresentation,
  localizePublicPresentation,
} from "./public-localized-presentation";
export type { PublicAutoTranslatableNode } from "./public-localized-presentation";
export { assertPublicLocalizationBoundary } from "./assert-public-localization-boundary";
export { resolveLocalizedPresentation } from "./resolve-localized-presentation";
export type {
  LocalizedPresentationDeps,
  LocalizedPresentationRequest,
  LocalizedPresentationResult,
} from "./resolve-localized-presentation";
export { useCivicInitiativeLocalizedTitle } from "./use-civic-initiative-localized-title";
// Coverage gate (node:fs) is test/tooling only — do not re-export from this barrel.
export { TranslateDraftControl } from "./components/TranslateDraftControl";
export type { TranslateDraftControlProps } from "./components/TranslateDraftControl";
export { DocumentLanguageAttributes } from "./components/DocumentLanguageAttributes";
export { InterfaceLanguageCookieSync } from "./components/InterfaceLanguageCookieSync";
export { LanguageSelector } from "./components/LanguageSelector";
export {
  listPriorityLanguages,
  resolveTranslatedContent,
  generateContentTranslation,
  requestTranslateDraft,
} from "./translation-api";
export {
  formatLanguageOptionLabel,
  invalidatePublicLanguagesClientCache,
  listSelectablePublicLanguages,
  PUBLIC_LANGUAGES_CHANGED_EVENT,
  PUBLIC_LANGUAGES_CLIENT_CACHE_TTL_MS,
} from "./public-languages-api";
export type { SelectablePublicLanguage } from "./public-languages-api";
export { resolvePublicContentDisplayLanguage } from "./resolve-public-content-display-language";
export { canonicalizeEnabledLocale } from "./canonicalize-locale";
export { writeHuLangCookieViaWebRoute } from "./write-hu-lang-cookie";
export {
  HU_LANG_COOKIE_MAX_AGE_SECONDS,
  HU_LANG_COOKIE_NAME,
  buildWebHuLangCookieAttributes,
  readHuLangCookieFromDocument,
} from "./hu-lang-cookie.web";

// Pack 02C Hotfix 01 — do NOT re-export resolve-document-locale from this barrel.
// It imports next/headers (server-only) and must be imported only from server entrypoints
// such as app/layout.tsx.
