/**
 * Production Completion Pack 02D Task 01 — next-intl request config.
 *
 * Locale comes ONLY from Pack 02C `resolveDocumentHtmlLocale` — no second
 * resolver, no locale-prefixed routing, no next-intl middleware.
 */

import { getRequestConfig } from "next-intl/server";

import { loadUiMessagesForLocale } from "../features/i18n/load-ui-messages";
import { resolveDocumentHtmlLocale } from "../features/language/resolve-document-locale";

export default getRequestConfig(async () => {
  const documentLocale = await resolveDocumentHtmlLocale();
  const loaded = await loadUiMessagesForLocale(documentLocale.locale);

  return {
    // Provider locale must equal document/runtime locale (Pack 02C authority).
    locale: documentLocale.locale,
    messages: loaded.messages,
    onError(error) {
      // Missing keys after English merge should be rare; never crash the page.
      if (error.code === "MISSING_MESSAGE") {
        return;
      }
      console.error(error);
    },
    getMessageFallback({ namespace, key }) {
      return namespace ? `${namespace}.${key}` : key;
    },
  };
});
