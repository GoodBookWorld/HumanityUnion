/**
 * Production Completion Pack 02D Task 02 — first real UI translation surface.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  DESKTOP_CAPSULE_NAVIGATION,
  PRIMARY_NAVIGATION,
} from "../public-experience/constants.js";
import {
  PRIMARY_NAV_FOUNDATION_MESSAGE_KEYS,
  resolvePrimaryNavDisplayLabel,
  resolvePrimaryNavDisplayLabelFromMessages,
} from "../public-experience/primary-nav-i18n.js";
import { formatLanguageOptionLabel } from "../language/public-languages-api.js";
import {
  loadUiMessagesForLocale,
  resolveMergedMessage,
} from "./load-ui-messages.js";
import type { UiMessagePackSource } from "./remote-pack-seam.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../../..");
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

const FOUNDATION_NAV_STABLE_LABELS = Object.keys(PRIMARY_NAV_FOUNDATION_MESSAGE_KEYS);

describe("Production Completion Pack 02D Task 02 — first UI translation surface", () => {
  it("English primary nav labels resolve from bundled catalog", async () => {
    const loaded = await loadUiMessagesForLocale("en");
    assert.equal(
      resolvePrimaryNavDisplayLabelFromMessages("Home", loaded.messages),
      "Home",
    );
    assert.equal(
      resolvePrimaryNavDisplayLabelFromMessages("Institutions", loaded.messages),
      "Institutions",
    );
    assert.equal(
      resolvePrimaryNavDisplayLabelFromMessages("Initiatives", loaded.messages),
      "Initiatives",
    );
    assert.equal(resolveMergedMessage(loaded.messages, "navigation", "activism"), "Activism");
    assert.equal(resolveMergedMessage(loaded.messages, "navigation", "support"), "Support");
    assert.equal(resolveMergedMessage(loaded.messages, "navigation", "workspace"), "Workspace");
  });

  it("Ukrainian nav labels resolve for foundation destinations", async () => {
    const loaded = await loadUiMessagesForLocale("uk");
    assert.equal(
      resolvePrimaryNavDisplayLabelFromMessages("Home", loaded.messages),
      "Головна",
    );
    assert.equal(
      resolvePrimaryNavDisplayLabelFromMessages("Institutions", loaded.messages),
      "Інституції",
    );
    assert.equal(
      resolvePrimaryNavDisplayLabelFromMessages("Initiatives", loaded.messages),
      "Ініціативи",
    );
    assert.equal(resolveMergedMessage(loaded.messages, "navigation", "activism"), "Активізм");
    assert.equal(resolveMergedMessage(loaded.messages, "navigation", "support"), "Підтримка");
    assert.equal(
      resolveMergedMessage(loaded.messages, "navigation", "workspace"),
      "Робочий простір",
    );
  });

  it("zh-Hant nav labels remain exact locale + Traditional Chinese", async () => {
    const loaded = await loadUiMessagesForLocale("zh-Hant");
    assert.equal(loaded.locale, "zh-Hant");
    assert.equal(
      resolvePrimaryNavDisplayLabelFromMessages("Home", loaded.messages),
      "首頁",
    );
    assert.equal(
      resolvePrimaryNavDisplayLabelFromMessages("Institutions", loaded.messages),
      "機構",
    );
    assert.equal(
      resolvePrimaryNavDisplayLabelFromMessages("Initiatives", loaded.messages),
      "倡議",
    );
  });

  it("Arabic nav labels resolve under rtl document contract", async () => {
    const loaded = await loadUiMessagesForLocale("ar");
    assert.equal(
      resolvePrimaryNavDisplayLabelFromMessages("Home", loaded.messages),
      "الرئيسية",
    );
    assert.equal(
      resolvePrimaryNavDisplayLabelFromMessages("Institutions", loaded.messages),
      "المؤسسات",
    );
    assert.equal(
      resolvePrimaryNavDisplayLabelFromMessages("Initiatives", loaded.messages),
      "المبادرات",
    );

    const selectorCss = readWeb("features/language/components/language-selector.css");
    assert.match(selectorCss, /\[dir="rtl"\]\s*\.hu-language-selector__select/);
    assert.match(selectorCss, /padding-inline-start/);
    assert.match(selectorCss, /padding-inline-end/);
  });

  it("Language Selector label follows active locale; options stay Registry-driven", async () => {
    const selector = readWeb("features/language/components/LanguageSelector.tsx");
    assert.match(selector, /useTranslations\("common"\)/);
    assert.match(selector, /tCommon\("language"\)/);
    assert.match(selector, /formatLanguageOptionLabel/);
    assert.doesNotMatch(selector, /tCommon\("englishName"|nativeName/);

    for (const locale of ["en", "uk", "zh-Hant", "ar"] as const) {
      const loaded = await loadUiMessagesForLocale(locale);
      const expected = {
        en: "Language",
        uk: "Мова",
        "zh-Hant": "語言",
        ar: "اللغة",
      }[locale];
      assert.equal(resolveMergedMessage(loaded.messages, "common", "language"), expected);
    }

    assert.equal(
      formatLanguageOptionLabel({
        languageId: "lang-uk",
        locale: "uk",
        englishName: "Ukrainian",
        nativeName: "Українська",
        textDirection: "ltr",
      }),
      "Українська (Ukrainian)",
    );
  });

  it("desktop and mobile share the same translated navigation contract", () => {
    const header = readWeb("design-system/components/HumanityHeader.tsx");
    const mobile = readWeb("design-system/components/HumanityHeaderMobileMenu.tsx");
    const helper = readWeb("features/public-experience/primary-nav-i18n.ts");

    assert.match(header, /useTranslations\("navigation"\)/);
    assert.match(header, /resolvePrimaryNavDisplayLabel/);
    assert.match(header, /DESKTOP_CAPSULE_NAVIGATION/);
    assert.match(mobile, /useTranslations\("navigation"\)/);
    assert.match(mobile, /resolvePrimaryNavDisplayLabel/);
    assert.match(mobile, /PRIMARY_NAVIGATION/);
    assert.match(helper, /PRIMARY_NAV_FOUNDATION_MESSAGE_KEYS/);

    // Same stable labels / hrefs — translation is presentation-only.
    for (const label of FOUNDATION_NAV_STABLE_LABELS) {
      assert.ok(PRIMARY_NAVIGATION.some((item) => item.label === label));
      assert.ok(DESKTOP_CAPSULE_NAVIGATION.some((item) => item.label === label));
    }

    const desktopHrefs = DESKTOP_CAPSULE_NAVIGATION.map((item) => item.href);
    const mobileHrefsForCapsule = PRIMARY_NAVIGATION.filter((item) =>
      DESKTOP_CAPSULE_NAVIGATION.some((d) => d.label === item.label),
    ).map((item) => item.href);
    assert.deepEqual(desktopHrefs, mobileHrefsForCapsule);
  });

  it("hrefs and route-matching identities remain English-stable", () => {
    const header = readWeb("design-system/components/HumanityHeader.tsx");
    assert.match(header, /item\.label === activeDestination/);
    assert.match(header, /key=\{item\.label\}/);
    assert.match(header, /href=\{item\.href\}/);

    const mobile = readWeb("design-system/components/HumanityHeaderMobileMenu.tsx");
    assert.match(mobile, /item\.label === activeDestination/);
    assert.match(mobile, /key=\{item\.label\}/);
    assert.match(mobile, /href=\{item\.href\}/);

    assert.deepEqual(
      PRIMARY_NAVIGATION.map((item) => ({ label: item.label, href: item.href })),
      [
        { label: "Home", href: "/" },
        { label: "Institutions", href: "/institutions" },
        { label: "Initiatives", href: "/initiatives" },
        { label: "Civic Media", href: "/media" },
        { label: "Knowledge", href: "/knowledge" },
        { label: "Membership", href: "/membership" },
        { label: "Search", href: "/search" },
      ],
    );

    // Unmapped destinations keep English presentation until Pack 02E.
    assert.equal(
      resolvePrimaryNavDisplayLabel("Knowledge", (key) => `translated:${key}`),
      "Knowledge",
    );
  });

  it("fallback fixture resolves missing nav key from English", async () => {
    const partial: UiMessagePackSource = {
      async load(locale) {
        if (locale !== "uk") {
          return null;
        }
        return {
          locale: "uk",
          source: "bundled",
          messages: {
            navigation: {
              home: "Головна",
              // institutions intentionally omitted for fallback proof
            },
          },
        };
      },
    };

    const loaded = await loadUiMessagesForLocale("uk", [partial]);
    assert.equal(
      resolvePrimaryNavDisplayLabelFromMessages("Home", loaded.messages),
      "Головна",
    );
    assert.equal(
      resolvePrimaryNavDisplayLabelFromMessages("Institutions", loaded.messages),
      "Institutions",
    );
  });

  it("no locale-prefixed routing introduced", () => {
    assert.equal(existsSync(path.join(webSrc, "middleware.ts")), false);
    assert.equal(existsSync(path.join(webRoot, "middleware.ts")), false);
    assert.equal(existsSync(path.join(webSrc, "app", "[locale]")), false);

    const header = readWeb("design-system/components/HumanityHeader.tsx");
    const mobile = readWeb("design-system/components/HumanityHeaderMobileMenu.tsx");
    assert.doesNotMatch(header, /\/\[locale\]|localePrefix|createMiddleware/);
    assert.doesNotMatch(mobile, /\/\[locale\]|localePrefix|createMiddleware/);
    assert.doesNotMatch(header, /document\.documentElement/);
    assert.doesNotMatch(mobile, /document\.documentElement/);
  });
});
