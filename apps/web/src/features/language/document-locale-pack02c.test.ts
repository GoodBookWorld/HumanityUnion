/**
 * Production Completion Pack 02C Task 02 — Web document html lang/dir resolution.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { RuntimeLocaleCatalogEntry } from "@hu/types";

import { documentAttributesFromRuntimeLocale } from "./language.js";
import { resolveDocumentHtmlLocale } from "./resolve-document-locale.js";

const here = path.dirname(fileURLToPath(import.meta.url));

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

describe("Production Completion Pack 02C Task 02 — document html locale", () => {
  it("anonymous en HTML lang/dir", async () => {
    const resolved = await resolveDocumentHtmlLocale({
      catalog: VERIFICATION_CATALOG,
      huLangCookie: null,
      acceptLanguageHeader: null,
    });
    const attrs = documentAttributesFromRuntimeLocale(resolved);
    assert.equal(attrs.lang, "en");
    assert.equal(attrs.dir, "ltr");
  });

  it("enabled ar -> lang=ar dir=rtl", async () => {
    const resolved = await resolveDocumentHtmlLocale({
      catalog: VERIFICATION_CATALOG,
      huLangCookie: "ar",
      acceptLanguageHeader: "en",
    });
    assert.equal(resolved.locale, "ar");
    assert.equal(resolved.textDirection, "rtl");
    assert.equal(resolved.source, "cookie");
  });

  it("enabled zh-Hant alias request -> canonical lang=zh-Hant", async () => {
    const resolved = await resolveDocumentHtmlLocale({
      catalog: VERIFICATION_CATALOG,
      huLangCookie: null,
      acceptLanguageHeader: "zh-TW,en;q=0.8",
    });
    assert.equal(resolved.locale, "zh-Hant");
    assert.notEqual(resolved.locale, "zh");
    assert.equal(resolved.source, "browser");
  });

  it("disabled locale falls through (catalog omits uk)", async () => {
    const catalogWithoutUk = VERIFICATION_CATALOG.filter((row) => row.locale !== "uk");
    const resolved = await resolveDocumentHtmlLocale({
      catalog: catalogWithoutUk,
      huLangCookie: "uk",
      acceptLanguageHeader: "uk,en;q=0.5",
    });
    assert.equal(resolved.locale, "en");
  });

  it("Participant interfaceLanguage precedence when provided", async () => {
    const resolved = await resolveDocumentHtmlLocale({
      catalog: VERIFICATION_CATALOG,
      authenticated: true,
      participantInterfaceLanguage: "uk",
      huLangCookie: "ar",
      acceptLanguageHeader: "zh-Hant",
    });
    assert.equal(resolved.locale, "uk");
    assert.equal(resolved.source, "participant");
  });

  it("cookie precedence over Accept-Language", async () => {
    const resolved = await resolveDocumentHtmlLocale({
      catalog: VERIFICATION_CATALOG,
      huLangCookie: "ar",
      acceptLanguageHeader: "uk",
    });
    assert.equal(resolved.locale, "ar");
    assert.equal(resolved.source, "cookie");
  });

  it("Accept-Language precedence when no cookie", async () => {
    const resolved = await resolveDocumentHtmlLocale({
      catalog: VERIFICATION_CATALOG,
      huLangCookie: null,
      acceptLanguageHeader: "uk;q=0.9,en;q=0.5",
    });
    assert.equal(resolved.locale, "uk");
    assert.equal(resolved.source, "browser");
  });

  it("no base-tag collapse in document language path", () => {
    const resolveSrc = readFileSync(path.join(here, "resolve-document-locale.ts"), "utf8");
    const layoutSrc = readFileSync(path.join(here, "../../app/layout.tsx"), "utf8");
    const barrelSrc = readFileSync(path.join(here, "index.ts"), "utf8");
    const docAttrsSrc = readFileSync(
      path.join(here, "components/DocumentLanguageAttributes.tsx"),
      "utf8",
    );
    assert.doesNotMatch(resolveSrc, /normalizeLanguageCode/);
    assert.doesNotMatch(layoutSrc, /normalizeLanguageCode/);
    assert.doesNotMatch(docAttrsSrc, /normalizeLanguageCode/);
    assert.doesNotMatch(docAttrsSrc, /useEffect/);
    assert.match(layoutSrc, /lang=\{documentLocale\.locale\}/);
    assert.match(layoutSrc, /dir=\{documentLocale\.textDirection\}/);
    assert.match(layoutSrc, /from \"\.\.\/features\/language\/resolve-document-locale\"/);
    assert.doesNotMatch(barrelSrc, /export \{[^}]*resolveDocumentHtmlLocale/);
    assert.doesNotMatch(barrelSrc, /from \"\.\/resolve-document-locale\"/);
  });
});
