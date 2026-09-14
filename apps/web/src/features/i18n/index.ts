/**
 * Production Completion Pack 02D Task 01 — UI i18n foundation exports.
 */

export {
  BUNDLED_VERIFICATION_LOCALES,
  collectStringMessagePaths,
  compareCatalogParityToEnglish,
  verifyBundledVerificationCatalogParity,
  type BundledVerificationLocale,
  type CatalogParityIssue,
  type CatalogParityReport,
} from "./catalog-parity";
export {
  BUNDLED_UI_MESSAGE_LOCALES,
  UI_I18N_ENGLISH_FALLBACK_LOCALE,
  bundledUiMessagePackSource,
  deepMergeMessages,
  isBundledUiMessageLocale,
  loadBundledUiMessagePack,
  loadUiMessagesForLocale,
  resolveMergedMessage,
  type BundledUiMessageLocale,
} from "./load-ui-messages";
export {
  loadFirstAvailableMessagePack,
  type UiMessagePack,
  type UiMessagePackSource,
  type UiMessagePackSourceKind,
} from "./remote-pack-seam";
