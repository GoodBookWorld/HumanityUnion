/**
 * Production Completion Pack 02D Task 03 — foundation chrome + catalog parity.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  BUNDLED_VERIFICATION_LOCALES,
  collectStringMessagePaths,
  compareCatalogParityToEnglish,
  loadBundledUiMessagePack,
  loadUiMessagesForLocale,
  resolveMergedMessage,
  verifyBundledVerificationCatalogParity,
} from "./index.js";
import type { UiMessagePackSource } from "./remote-pack-seam.js";
import { formatLanguageOptionLabel } from "../language/public-languages-api.js";
import {
  FOOTER_PLATFORM_COLUMN_TWO,
} from "../public-experience/footer-links.js";
import { resolveFooterNavDisplayLabel } from "../public-experience/footer-nav-i18n.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../../..");
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

describe("Production Completion Pack 02D Task 03 — foundation chrome + parity", () => {
  it("Footer Support follows active locale; href stays /support", async () => {
    const footer = readWeb("features/public-experience/components/PublicExperienceFooter.tsx");
    assert.match(footer, /getTranslations\("navigation"\)/);
    assert.match(footer, /resolveFooterNavDisplayLabel/);
    assert.doesNotMatch(footer, /tNav\("(home|initiatives|institutions|activism|workspace)"\)/);

    const supportLink = FOOTER_PLATFORM_COLUMN_TWO.find((link) => link.label === "Support");
    assert.ok(supportLink);
    assert.equal(supportLink.href, "/support");

    const en = await loadUiMessagesForLocale("en");
    const uk = await loadUiMessagesForLocale("uk");
    const zh = await loadUiMessagesForLocale("zh-Hant");
    const ar = await loadUiMessagesForLocale("ar");

    assert.equal(
      resolveFooterNavDisplayLabel("Support", (key) =>
        resolveMergedMessage(en.messages, "navigation", key) ?? key,
      ),
      "Support",
    );
    assert.equal(
      resolveFooterNavDisplayLabel("Support", (key) =>
        resolveMergedMessage(uk.messages, "navigation", key) ?? key,
      ),
      "Підтримка",
    );
    assert.equal(
      resolveFooterNavDisplayLabel("Support", (key) =>
        resolveMergedMessage(zh.messages, "navigation", key) ?? key,
      ),
      "支持",
    );
    assert.equal(
      resolveFooterNavDisplayLabel("Support", (key) =>
        resolveMergedMessage(ar.messages, "navigation", key) ?? key,
      ),
      "الدعم",
    );

    // Pack 02E Task 02 maps Search; presentation resolves via navigation.search.
    assert.equal(
      resolveFooterNavDisplayLabel("Search", (key) =>
        resolveMergedMessage(uk.messages, "navigation", key) ?? key,
      ),
      "Пошук",
    );
  });

  it("Language Selector loading/error follow active locale; Registry options unchanged", async () => {
    const selector = readWeb("features/language/components/LanguageSelector.tsx");
    assert.match(selector, /tCommon\("loading"\)/);
    assert.match(selector, /tCommon\("error"\)/);
    assert.match(selector, /formatLanguageOptionLabel/);
    assert.doesNotMatch(selector, /Languages unavailable\.|Unable to change language\./);
    assert.doesNotMatch(selector, /aria-hidden="true"/);

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      const expectedLoading = {
        en: "Loading…",
        uk: "Завантаження…",
        "zh-Hant": "載入中…",
        ar: "جارٍ التحميل…",
      }[locale];
      const expectedError = {
        en: "Something went wrong.",
        uk: "Щось пішло не так.",
        "zh-Hant": "發生錯誤。",
        ar: "حدث خطأ ما.",
      }[locale];
      assert.equal(resolveMergedMessage(loaded.messages, "common", "loading"), expectedLoading);
      assert.equal(resolveMergedMessage(loaded.messages, "common", "error"), expectedError);
    }

    assert.equal(
      formatLanguageOptionLabel({
        languageId: "lang-ar",
        locale: "ar",
        englishName: "Arabic",
        nativeName: "العربية",
        textDirection: "rtl",
      }),
      "العربية (Arabic)",
    );
  });

  it("uk / zh-Hant / ar verification catalogs have full English foundation parity", async () => {
    const result = await verifyBundledVerificationCatalogParity();
    assert.deepEqual([...BUNDLED_VERIFICATION_LOCALES], ["uk", "zh-Hant", "ar"]);
    assert.equal(result.ok, true, JSON.stringify(result.reports, null, 2));

    const english = await loadBundledUiMessagePack("en");
    assert.ok(english);
    const required = collectStringMessagePaths(english.messages);
    assert.ok(required.includes("common.language"));
    assert.ok(required.includes("common.loading"));
    assert.ok(required.includes("common.error"));
    assert.ok(required.includes("navigation.support"));
    assert.ok(required.includes("navigation.workspace"));

    for (const locale of BUNDLED_VERIFICATION_LOCALES) {
      const report = result.reports.find((row) => row.locale === locale);
      assert.ok(report);
      assert.equal(report.ok, true);
      assert.equal(report.issues.length, 0);
    }
  });

  it("parity guard fails on a fixture with a missing foundation key", async () => {
    const english = await loadBundledUiMessagePack("en");
    assert.ok(english);

    const incomplete = {
      common: {
        language: "Мова",
        save: "Зберегти",
        cancel: "Скасувати",
        loading: "Завантаження…",
        // error intentionally omitted
      },
      navigation: {
        home: "Головна",
        initiatives: "Ініціативи",
        institutions: "Інституції",
        activism: "Активізм",
        support: "Підтримка",
        workspace: "Робочий простір",
      },
    };

    const report = compareCatalogParityToEnglish(english.messages, incomplete, "uk-fixture");
    assert.equal(report.ok, false);
    assert.ok(report.issues.some((issue) => issue.path === "common.error" && issue.kind === "missing"));

    const invalidShape = compareCatalogParityToEnglish(
      english.messages,
      {
        ...incomplete,
        common: {
          ...incomplete.common,
          error: { nested: "bad" },
        },
      },
      "uk-invalid",
    );
    assert.equal(invalidShape.ok, false);
    assert.ok(
      invalidShape.issues.some(
        (issue) => issue.path === "common.error" && issue.kind === "invalid_shape",
      ),
    );
  });

  it("fallback fixture still deep-merges missing keys from English", async () => {
    const partial: UiMessagePackSource = {
      async load(locale) {
        if (locale !== "uk") {
          return null;
        }
        return {
          locale: "uk",
          source: "bundled",
          messages: {
            common: { language: "Мова" },
            navigation: { support: "Підтримка" },
          },
        };
      },
    };

    const loaded = await loadUiMessagesForLocale("uk", [partial]);
    assert.equal(resolveMergedMessage(loaded.messages, "common", "language"), "Мова");
    assert.equal(resolveMergedMessage(loaded.messages, "common", "loading"), "Loading…");
    assert.equal(resolveMergedMessage(loaded.messages, "common", "error"), "Something went wrong.");
    assert.equal(resolveMergedMessage(loaded.messages, "navigation", "support"), "Підтримка");
    assert.equal(resolveMergedMessage(loaded.messages, "navigation", "home"), "Home");
  });

  it("no locale-prefixed routing / Pack 02E scope creep", () => {
    assert.equal(existsSync(path.join(webSrc, "middleware.ts")), false);
    assert.equal(existsSync(path.join(webRoot, "middleware.ts")), false);
    assert.equal(existsSync(path.join(webSrc, "app", "[locale]")), false);

    const footer = readWeb("features/public-experience/components/PublicExperienceFooter.tsx");
    const selector = readWeb("features/language/components/LanguageSelector.tsx");
    assert.doesNotMatch(footer, /localePrefix|createMiddleware|\/\[locale\]/);
    assert.doesNotMatch(selector, /localePrefix|createMiddleware|\/\[locale\]/);
    assert.doesNotMatch(footer, /document\.documentElement/);
    assert.doesNotMatch(selector, /document\.documentElement/);
  });
});
