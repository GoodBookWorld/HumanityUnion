/**
 * Production Completion Pack 02D Task 01 — UI i18n runtime foundation.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { RuntimeLocaleCatalogEntry } from "@hu/types";

import { resolveDocumentHtmlLocale } from "../language/resolve-document-locale.js";
import {
  deepMergeMessages,
  loadUiMessagesForLocale,
  resolveMergedMessage,
  UI_I18N_ENGLISH_FALLBACK_LOCALE,
} from "./load-ui-messages.js";
import type { UiMessagePackSource } from "./remote-pack-seam.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../../..");
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

const VERIFICATION_CATALOG: readonly RuntimeLocaleCatalogEntry[] = [
  {
    languageId: "lang-en",
    locale: "en",
    textDirection: "ltr",
    aliases: [],
  },
  {
    languageId: "lang-uk",
    locale: "uk",
    textDirection: "ltr",
    aliases: [],
  },
  {
    languageId: "lang-zh-Hant",
    locale: "zh-Hant",
    textDirection: "ltr",
    aliases: ["zh-TW", "zh-HK"],
  },
  {
    languageId: "lang-ar",
    locale: "ar",
    textDirection: "rtl",
    aliases: [],
  },
];

describe("Production Completion Pack 02D Task 01 — UI i18n foundation", () => {
  it("en catalog loads complete foundation namespaces", async () => {
    const loaded = await loadUiMessagesForLocale("en");
    assert.equal(loaded.locale, "en");
    assert.equal(loaded.packSource, "bundled");
    assert.equal(resolveMergedMessage(loaded.messages, "common", "language"), "Language");
    assert.equal(resolveMergedMessage(loaded.messages, "common", "save"), "Save");
    assert.equal(resolveMergedMessage(loaded.messages, "common", "cancel"), "Cancel");
    assert.equal(resolveMergedMessage(loaded.messages, "common", "loading"), "Loading…");
    assert.equal(resolveMergedMessage(loaded.messages, "common", "error"), "Something went wrong.");
    assert.equal(resolveMergedMessage(loaded.messages, "navigation", "home"), "Home");
    assert.equal(resolveMergedMessage(loaded.messages, "navigation", "initiatives"), "Initiatives");
    assert.equal(resolveMergedMessage(loaded.messages, "navigation", "institutions"), "Institutions");
    assert.equal(resolveMergedMessage(loaded.messages, "navigation", "activism"), "Activism");
    assert.equal(resolveMergedMessage(loaded.messages, "navigation", "support"), "Support");
    assert.equal(resolveMergedMessage(loaded.messages, "navigation", "workspace"), "Workspace");
  });

  it("partial overlay fixture falls back to English for missing keys", async () => {
    // Task 02: production verification catalogs ship complete Task 02 nav labels.
    // Fallback is proven via a partial loader fixture — not by omitting shipped keys.
    const partialUkFixture: UiMessagePackSource = {
      async load(locale) {
        if (locale !== "uk") {
          return null;
        }
        return {
          locale: "uk",
          source: "bundled",
          messages: {
            common: {
              language: "Мова",
              save: "Зберегти",
            },
            navigation: {
              home: "Головна",
              initiatives: "Ініціативи",
            },
          },
        };
      },
    };

    const loaded = await loadUiMessagesForLocale("uk", [partialUkFixture]);
    assert.equal(loaded.locale, "uk");
    assert.equal(resolveMergedMessage(loaded.messages, "common", "language"), "Мова");
    assert.equal(resolveMergedMessage(loaded.messages, "common", "save"), "Зберегти");
    assert.equal(resolveMergedMessage(loaded.messages, "common", "loading"), "Loading…");
    assert.equal(resolveMergedMessage(loaded.messages, "common", "error"), "Something went wrong.");
    assert.equal(resolveMergedMessage(loaded.messages, "navigation", "institutions"), "Institutions");
    assert.equal(resolveMergedMessage(loaded.messages, "navigation", "activism"), "Activism");
  });

  it("zh-Hant locale tag remains exact (not collapsed to zh)", async () => {
    const loaded = await loadUiMessagesForLocale("zh-Hant");
    assert.equal(loaded.locale, "zh-Hant");
    assert.notEqual(loaded.locale, "zh");
    assert.equal(resolveMergedMessage(loaded.messages, "common", "language"), "語言");
    assert.equal(resolveMergedMessage(loaded.messages, "navigation", "home"), "首頁");

    const documentLocale = await resolveDocumentHtmlLocale({
      catalog: VERIFICATION_CATALOG,
      huLangCookie: null,
      acceptLanguageHeader: "zh-TW,en;q=0.8",
    });
    assert.equal(documentLocale.locale, "zh-Hant");
    const providerMessages = await loadUiMessagesForLocale(documentLocale.locale);
    assert.equal(providerMessages.locale, "zh-Hant");
  });

  it("ar works with rtl document metadata and Arabic overlay", async () => {
    const documentLocale = await resolveDocumentHtmlLocale({
      catalog: VERIFICATION_CATALOG,
      huLangCookie: "ar",
      acceptLanguageHeader: "en",
    });
    assert.equal(documentLocale.locale, "ar");
    assert.equal(documentLocale.textDirection, "rtl");

    const loaded = await loadUiMessagesForLocale(documentLocale.locale);
    assert.equal(loaded.locale, "ar");
    assert.equal(resolveMergedMessage(loaded.messages, "common", "language"), "اللغة");
    assert.equal(resolveMergedMessage(loaded.messages, "common", "loading"), "جارٍ التحميل…");
  });

  it("unsupported/disabled runtime locale falls back through Pack 02C before i18n", async () => {
    const catalogWithoutUk = VERIFICATION_CATALOG.filter((row) => row.locale !== "uk");
    const documentLocale = await resolveDocumentHtmlLocale({
      catalog: catalogWithoutUk,
      huLangCookie: "uk",
      acceptLanguageHeader: "uk,en;q=0.5",
    });
    assert.equal(documentLocale.locale, "en");

    const loaded = await loadUiMessagesForLocale(documentLocale.locale);
    assert.equal(loaded.locale, UI_I18N_ENGLISH_FALLBACK_LOCALE);
    assert.equal(resolveMergedMessage(loaded.messages, "common", "save"), "Save");
  });

  it("provider locale equals document/runtime locale (layout wiring)", async () => {
    const layoutSrc = readWeb("app/layout.tsx");
    assert.match(layoutSrc, /resolveDocumentHtmlLocale/);
    assert.match(layoutSrc, /NextIntlClientProvider/);
    assert.match(layoutSrc, /locale=\{documentLocale\.locale\}/);
    assert.match(layoutSrc, /lang=\{documentLocale\.locale\}/);
    assert.match(layoutSrc, /dir=\{documentLocale\.textDirection\}/);
    assert.match(layoutSrc, /loadUiMessagesForLocale\(documentLocale\.locale\)/);

    const requestSrc = readWeb("i18n/request.ts");
    assert.match(requestSrc, /resolveDocumentHtmlLocale/);
    assert.match(requestSrc, /locale: documentLocale\.locale/);
    assert.doesNotMatch(requestSrc, /createMiddleware|defineRouting|localePrefix/);
  });

  it("missing key does not crash — deep merge + fallback helpers", () => {
    const merged = deepMergeMessages(
      { common: { save: "Save", loading: "Loading…" } },
      { common: { save: "Зберегти" } },
    );
    assert.equal(resolveMergedMessage(merged, "common", "save"), "Зберегти");
    assert.equal(resolveMergedMessage(merged, "common", "loading"), "Loading…");
    assert.equal(resolveMergedMessage(merged, "common", "missing"), undefined);
    assert.equal(resolveMergedMessage(merged, "absent", "key"), undefined);

    const requestSrc = readWeb("i18n/request.ts");
    assert.match(requestSrc, /onError/);
    assert.match(requestSrc, /MISSING_MESSAGE/);
    assert.match(requestSrc, /getMessageFallback/);
  });

  it("no locale-prefixed routing / next-intl middleware introduced", () => {
    assert.equal(existsSync(path.join(webSrc, "middleware.ts")), false);
    assert.equal(existsSync(path.join(webRoot, "middleware.ts")), false);
    assert.equal(existsSync(path.join(webSrc, "app", "[locale]")), false);

    const nextConfig = readFileSync(path.join(webRoot, "next.config.ts"), "utf8");
    assert.match(nextConfig, /createNextIntlPlugin/);
    assert.doesNotMatch(nextConfig, /localePrefix|createMiddleware|defineRouting/);

    const remoteSeam = readWeb("features/i18n/remote-pack-seam.ts");
    assert.match(remoteSeam, /UiMessagePackSource/);
    assert.match(remoteSeam, /remote/);
    assert.match(remoteSeam, /Do NOT add R2 persistence yet/);
  });

  it("remote-pack seam can overlay without redesigning locale authority", async () => {
    const remote: UiMessagePackSource = {
      async load(locale) {
        if (locale !== "uk") {
          return null;
        }
        return {
          locale: "uk",
          source: "remote",
          messages: { common: { language: "REMOTE_LANGUAGE" } },
        };
      },
    };

    const loaded = await loadUiMessagesForLocale("uk", [remote]);
    assert.equal(loaded.packSource, "remote");
    assert.equal(resolveMergedMessage(loaded.messages, "common", "language"), "REMOTE_LANGUAGE");
    assert.equal(resolveMergedMessage(loaded.messages, "common", "save"), "Save");
  });
});
