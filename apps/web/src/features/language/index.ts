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
export { TranslatedContentView } from "./components/TranslatedContentView";
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
