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
export {
  englishDocumentLocaleFallback,
  resolveDocumentHtmlLocale,
} from "./resolve-document-locale";
export { TranslatedContentView } from "./components/TranslatedContentView";
export type { TranslatedContentViewProps } from "./components/TranslatedContentView";
export { PublicTranslatedFields } from "./components/PublicTranslatedFields";
export type { PublicTranslatedFieldsProps } from "./components/PublicTranslatedFields";
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
  listSelectablePublicLanguages,
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
