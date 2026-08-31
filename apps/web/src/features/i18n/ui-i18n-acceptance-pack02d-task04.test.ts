/**
 * Production Completion Pack 02D Task 04 — local acceptance close-out.
 *
 * Verifies Tasks 01–03 as one coherent UI i18n foundation.
 * Does not add translation scope.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { RuntimeLocaleCatalogEntry } from "@hu/types";

import { resolveCurrentDestination } from "../../design-system/components/resolve-current-destination.js";
import { resolveDocumentHtmlLocale } from "../language/resolve-document-locale.js";
import { formatLanguageOptionLabel } from "../language/public-languages-api.js";
import {
  DESKTOP_CAPSULE_NAVIGATION,
  PRIMARY_NAVIGATION,
} from "../public-experience/constants.js";
import { FOOTER_PLATFORM_COLUMN_TWO } from "../public-experience/footer-links.js";
import { resolveFooterNavDisplayLabel } from "../public-experience/footer-nav-i18n.js";
import {
  PRIMARY_NAV_FOUNDATION_MESSAGE_KEYS,
  resolvePrimaryNavDisplayLabelFromMessages,
} from "../public-experience/primary-nav-i18n.js";
import {
  loadUiMessagesForLocale,
  resolveMergedMessage,
  verifyBundledVerificationCatalogParity,
} from "./index.js";
import type { UiMessagePackSource } from "./remote-pack-seam.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../../..");
const webSrc = path.resolve(here, "../..");

function readWeb(relative: string): string {
  return readFileSync(path.join(webSrc, relative), "utf8");
}

const VERIFICATION_CATALOG: readonly RuntimeLocaleCatalogEntry[] = [
  { languageId: "lang-en", locale: "en", textDirection: "ltr", aliases: [] },
  { languageId: "lang-uk", locale: "uk", textDirection: "ltr", aliases: [] },
  {
    languageId: "lang-zh-Hant",
    locale: "zh-Hant",
    textDirection: "ltr",
    aliases: ["zh-TW", "zh-HK"],
  },
  { languageId: "lang-ar", locale: "ar", textDirection: "rtl", aliases: [] },
];

describe("Production Completion Pack 02D Task 04 — local acceptance", () => {
  it("A — architecture chain: Pack 02C locale → html → provider → catalogs", async () => {
    const layout = readWeb("app/layout.tsx");
    const request = readWeb("i18n/request.ts");
    const nextConfig = readFileSync(path.join(webRoot, "next.config.ts"), "utf8");
    const barrel = readWeb("features/language/index.ts");
    const selector = readWeb("features/language/components/LanguageSelector.tsx");
    const sync = readWeb("features/language/components/InterfaceLanguageCookieSync.tsx");

    assert.match(layout, /resolveDocumentHtmlLocale/);
    assert.match(layout, /lang=\{documentLocale\.locale\}/);
    assert.match(layout, /dir=\{documentLocale\.textDirection\}/);
    assert.match(layout, /NextIntlClientProvider/);
    assert.match(layout, /locale=\{documentLocale\.locale\}/);
    assert.match(layout, /loadUiMessagesForLocale\(documentLocale\.locale\)/);

    assert.match(request, /resolveDocumentHtmlLocale/);
    assert.match(request, /locale: documentLocale\.locale/);
    assert.doesNotMatch(request, /createMiddleware|defineRouting|localePrefix/);
    assert.match(nextConfig, /createNextIntlPlugin/);
    assert.doesNotMatch(nextConfig, /localePrefix|createMiddleware|defineRouting/);

    assert.equal(existsSync(path.join(webSrc, "middleware.ts")), false);
    assert.equal(existsSync(path.join(webRoot, "middleware.ts")), false);
    assert.equal(existsSync(path.join(webSrc, "app", "[locale]")), false);

    assert.doesNotMatch(barrel, /export \{[^}]*resolveDocumentHtmlLocale/);
    assert.doesNotMatch(barrel, /from ["']\.\/resolve-document-locale["']/);
    assert.match(barrel, /do NOT re-export resolve-document-locale/i);
    assert.doesNotMatch(selector, /document\.documentElement/);
    assert.doesNotMatch(sync, /document\.documentElement\.lang|document\.documentElement\.dir/);

    const zh = await resolveDocumentHtmlLocale({
      catalog: VERIFICATION_CATALOG,
      huLangCookie: null,
      acceptLanguageHeader: "zh-TW,en;q=0.8",
    });
    assert.equal(zh.locale, "zh-Hant");
    assert.notEqual(zh.locale, "zh");

    const ar = await resolveDocumentHtmlLocale({
      catalog: VERIFICATION_CATALOG,
      huLangCookie: "ar",
      acceptLanguageHeader: "en",
    });
    assert.equal(ar.locale, "ar");
    assert.equal(ar.textDirection, "rtl");
  });

  it("B — foundation surfaces only; hrefs and active matching stable", async () => {
    const header = readWeb("design-system/components/HumanityHeader.tsx");
    const mobile = readWeb("design-system/components/HumanityHeaderMobileMenu.tsx");
    const footer = readWeb("features/public-experience/components/PublicExperienceFooter.tsx");
    const selector = readWeb("features/language/components/LanguageSelector.tsx");

    assert.match(selector, /tCommon\("language"\)/);
    assert.match(selector, /tCommon\("loading"\)/);
    assert.match(selector, /tCommon\("error"\)/);
    assert.match(selector, /formatLanguageOptionLabel/);
    assert.match(header, /resolvePrimaryNavDisplayLabel/);
    assert.match(mobile, /resolvePrimaryNavDisplayLabel/);
    assert.match(footer, /resolveFooterNavDisplayLabel/);

    assert.deepEqual(Object.keys(PRIMARY_NAV_FOUNDATION_MESSAGE_KEYS).sort(), [
      "Home",
      "Initiatives",
      "Institutions",
    ]);

    const support = FOOTER_PLATFORM_COLUMN_TWO.find((link) => link.label === "Support");
    assert.ok(support);
    assert.equal(support.href, "/support");

    assert.equal(resolveCurrentDestination("/"), "Home");
    assert.equal(resolveCurrentDestination("/institutions"), "Institutions");
    assert.equal(resolveCurrentDestination("/initiatives"), "Initiatives");
    assert.equal(resolveCurrentDestination("/knowledge"), "Knowledge");
    assert.equal(resolveCurrentDestination("/workspace"), null);

    const desktopHrefs = DESKTOP_CAPSULE_NAVIGATION.map((item) => ({
      label: item.label,
      href: item.href,
    }));
    assert.deepEqual(desktopHrefs, [
      { label: "Home", href: "/" },
      { label: "Institutions", href: "/institutions" },
      { label: "Initiatives", href: "/initiatives" },
      { label: "Knowledge", href: "/knowledge" },
      { label: "Search", href: "/search" },
    ]);

    assert.ok(PRIMARY_NAVIGATION.some((item) => item.label === "Civic Media"));
    assert.ok(PRIMARY_NAVIGATION.some((item) => item.label === "Membership"));

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

    const uk = await loadUiMessagesForLocale("uk");
    assert.equal(
      resolvePrimaryNavDisplayLabelFromMessages("Home", uk.messages),
      "Головна",
    );
    assert.equal(
      resolveFooterNavDisplayLabel(
        "Support",
        (key) => resolveMergedMessage(uk.messages, "navigation", key) ?? key,
      ),
      "Підтримка",
    );
    // Out-of-scope destinations stay English.
    assert.equal(
      resolvePrimaryNavDisplayLabelFromMessages("Knowledge", uk.messages),
      "Knowledge",
    );
    assert.equal(
      resolveFooterNavDisplayLabel("Search", () => "should-not-run"),
      "Search",
    );
  });

  it("C — catalogs, parity, fallback, inactive remote seam", async () => {
    const parity = await verifyBundledVerificationCatalogParity();
    assert.equal(parity.ok, true, JSON.stringify(parity.reports, null, 2));

    const en = await loadUiMessagesForLocale("en");
    assert.equal(resolveMergedMessage(en.messages, "common", "language"), "Language");
    assert.equal(resolveMergedMessage(en.messages, "navigation", "support"), "Support");

    const partial: UiMessagePackSource = {
      async load(locale) {
        if (locale !== "uk") {
          return null;
        }
        return {
          locale: "uk",
          source: "bundled",
          messages: { common: { language: "Мова" } },
        };
      },
    };
    const merged = await loadUiMessagesForLocale("uk", [partial]);
    assert.equal(resolveMergedMessage(merged.messages, "common", "language"), "Мова");
    assert.equal(resolveMergedMessage(merged.messages, "common", "loading"), "Loading…");

    const request = readWeb("i18n/request.ts");
    assert.match(request, /MISSING_MESSAGE/);
    assert.match(request, /getMessageFallback/);

    const remoteSeam = readWeb("features/i18n/remote-pack-seam.ts");
    assert.match(remoteSeam, /Do NOT add R2 persistence yet/);
    assert.match(remoteSeam, /Do NOT upload\/edit Admin UI here/);
    assert.doesNotMatch(remoteSeam, /@aws-sdk|S3Client|R2_/);

    const loader = readWeb("features/i18n/load-ui-messages.ts");
    assert.match(loader, /bundledUiMessagePackSource/);
    assert.match(loader, /sources: readonly UiMessagePackSource\[\] = \[bundledUiMessagePackSource\]/);
  });

  it("D — scope audit: no Pack 02E chrome migration", () => {
    const header = readWeb("design-system/components/HumanityHeader.tsx");
    const mobile = readWeb("design-system/components/HumanityHeaderMobileMenu.tsx");
    const footer = readWeb("features/public-experience/components/PublicExperienceFooter.tsx");

    // Auth/account/workspace chrome remains hardcoded English in mobile menu.
    assert.match(mobile, />\s*Log in\s*</);
    assert.match(mobile, />\s*Workspace\s*</);
    assert.match(mobile, />\s*Profile\s*</);

    // Unmapped destinations are not wired to foundation keys.
    assert.doesNotMatch(header, /tNav\("(civic|knowledge|membership|search)"\)/i);
    assert.doesNotMatch(mobile, /tNav\("(civic|knowledge|membership|search)"\)/i);
    assert.equal(
      resolvePrimaryNavDisplayLabelFromMessages("Civic Media", {
        navigation: { home: "X" },
      }),
      "Civic Media",
    );
    assert.equal(resolveFooterNavDisplayLabel("Civic Media", () => "X"), "Civic Media");
    assert.equal(resolveFooterNavDisplayLabel("Membership", () => "X"), "Membership");

    // Footer only translates Support via foundation helper (not other platform links).
    assert.match(footer, /resolveFooterNavDisplayLabel/);
    const footerI18n = readWeb("features/public-experience/footer-nav-i18n.ts");
    assert.match(footerI18n, /Support: "support"/);
    assert.doesNotMatch(footerI18n, /Civic Media|Knowledge|Membership|Search/);
  });
});
