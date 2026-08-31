/**
 * Production Completion Pack 02C Task 01 — canonical locale resolution + guest cookie.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  expandLocaleLookupCandidates,
  ensureLanguageRegistrySeeded,
  getHuLangCookieSecuritySnapshot,
  listAcceptLanguageLookupTags,
  parseAcceptLanguageHeader,
  resetLanguageRegistryStoreForTests,
  resolveRuntimeLocale,
  serializeHuLangSetCookieHeader,
  setLanguageRegistryForceMemoryForTests,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";

describe("Production Completion Pack 02C Task 01 — Runtime Locale Resolution", () => {
  beforeEach(() => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
  });

  afterEach(() => {
    resetLanguageRegistryStoreForTests();
    setLanguageRegistryForceMemoryForTests(false);
  });

  async function seedAndEnableVerificationLocales(): Promise<void> {
    await ensureLanguageRegistrySeeded();
    await updateLanguageRegistryRecord("lang-uk", { enabled: true });
    await updateLanguageRegistryRecord("lang-zh-Hant", { enabled: true });
    await updateLanguageRegistryRecord("lang-ar", { enabled: true });
  }

  it("Participant preference wins when authenticated", async () => {
    await seedAndEnableVerificationLocales();
    const resolved = await resolveRuntimeLocale({
      authenticated: true,
      participantInterfaceLanguage: "uk",
      huLangCookie: "ar",
      acceptLanguageHeader: "zh-Hant,en;q=0.8",
    });
    assert.equal(resolved.locale, "uk");
    assert.equal(resolved.source, "participant");
    assert.equal(resolved.textDirection, "ltr");
  });

  it("cookie wins for anonymous visitors", async () => {
    await seedAndEnableVerificationLocales();
    const resolved = await resolveRuntimeLocale({
      authenticated: false,
      participantInterfaceLanguage: "uk",
      huLangCookie: "ar",
      acceptLanguageHeader: "zh-Hant",
    });
    assert.equal(resolved.locale, "ar");
    assert.equal(resolved.source, "cookie");
    assert.equal(resolved.textDirection, "rtl");
  });

  it("authenticated falls back to cookie when Participant preference absent/invalid", async () => {
    await seedAndEnableVerificationLocales();

    const missing = await resolveRuntimeLocale({
      authenticated: true,
      participantInterfaceLanguage: null,
      huLangCookie: "uk",
    });
    assert.equal(missing.locale, "uk");
    assert.equal(missing.source, "cookie");

    const disabled = await resolveRuntimeLocale({
      authenticated: true,
      participantInterfaceLanguage: "xx-INVALID",
      huLangCookie: "ar",
    });
    assert.equal(disabled.locale, "ar");
    assert.equal(disabled.source, "cookie");
  });

  it("browser exact match via Accept-Language", async () => {
    await seedAndEnableVerificationLocales();
    const resolved = await resolveRuntimeLocale({
      acceptLanguageHeader: "uk",
    });
    assert.equal(resolved.locale, "uk");
    assert.equal(resolved.source, "browser");
  });

  it("alias match zh-TW → zh-Hant when enabled", async () => {
    await seedAndEnableVerificationLocales();
    const resolved = await resolveRuntimeLocale({
      acceptLanguageHeader: "zh-TW,en;q=0.5",
    });
    assert.equal(resolved.locale, "zh-Hant");
    assert.equal(resolved.source, "browser");
  });

  it("zh-Hant remains full canonical locale (not collapsed to zh)", async () => {
    await seedAndEnableVerificationLocales();
    const resolved = await resolveRuntimeLocale({
      huLangCookie: "zh-Hant",
    });
    assert.equal(resolved.locale, "zh-Hant");
    assert.notEqual(resolved.locale, "zh");
    assert.deepEqual(expandLocaleLookupCandidates("zh-Hant"), ["zh-Hant", "zh"]);
  });

  it("regional fallback en-US → en when enabled", async () => {
    await ensureLanguageRegistrySeeded();
    const resolved = await resolveRuntimeLocale({
      acceptLanguageHeader: "en-US,fr;q=0.8",
    });
    assert.equal(resolved.locale, "en");
    assert.equal(resolved.source, "browser");
  });

  it("q-value ordering prefers higher quality", async () => {
    await seedAndEnableVerificationLocales();
    const parsed = parseAcceptLanguageHeader("uk;q=0.4,ar;q=0.9,zh-Hant;q=0.7");
    assert.deepEqual(
      parsed.map((p) => p.tag),
      ["ar", "zh-Hant", "uk"],
    );

    const resolved = await resolveRuntimeLocale({
      acceptLanguageHeader: "uk;q=0.4,ar;q=0.9,zh-Hant;q=0.7",
    });
    assert.equal(resolved.locale, "ar");
    assert.equal(resolved.source, "browser");
  });

  it("disabled locale is skipped (seed uk stays off by default)", async () => {
    await ensureLanguageRegistrySeeded();
    const resolved = await resolveRuntimeLocale({
      huLangCookie: "uk",
      acceptLanguageHeader: "uk,en;q=0.5",
    });
    assert.equal(resolved.locale, "en");
    assert.ok(
      resolved.source === "browser" ||
        resolved.source === "platform_default" ||
        resolved.source === "english_fallback",
    );
  });

  it("malformed Accept-Language is ignored safely", async () => {
    await ensureLanguageRegistrySeeded();
    assert.deepEqual(parseAcceptLanguageHeader(";;;, ,q=1,@@"), []);
    assert.deepEqual(listAcceptLanguageLookupTags("not a tag!!!"), []);

    const resolved = await resolveRuntimeLocale({
      acceptLanguageHeader: ";;;bogus,,en-US;q=not-a-number",
    });
    assert.equal(resolved.locale, "en");
    assert.ok(
      resolved.source === "platform_default" || resolved.source === "english_fallback",
    );
  });

  it("wildcard * cannot bypass Registry policy", async () => {
    await seedAndEnableVerificationLocales();
    const tags = listAcceptLanguageLookupTags("*;q=1.0");
    assert.deepEqual(tags, []);

    const resolved = await resolveRuntimeLocale({
      acceptLanguageHeader: "*;q=1.0",
    });
    assert.equal(resolved.locale, "en");
    assert.equal(resolved.source, "platform_default");
  });

  it("ar returns rtl", async () => {
    await seedAndEnableVerificationLocales();
    const resolved = await resolveRuntimeLocale({
      huLangCookie: "ar",
    });
    assert.equal(resolved.locale, "ar");
    assert.equal(resolved.textDirection, "rtl");
    assert.ok(resolved.languageId.length > 0);
  });

  it("final English fallback when nothing else resolves", async () => {
    await ensureLanguageRegistrySeeded();
    const resolved = await resolveRuntimeLocale({
      platformDefaultLocale: "xx-missing",
      acceptLanguageHeader: "fr-FR,de;q=0.8",
      huLangCookie: "zz",
    });
    assert.equal(resolved.locale, "en");
    assert.equal(resolved.source, "english_fallback");
  });

  it("cookie serialization / security attributes", () => {
    const previous = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      const snapshot = getHuLangCookieSecuritySnapshot();
      assert.equal(snapshot.name, "hu_lang");
      assert.equal(snapshot.path, "/");
      assert.equal(snapshot.sameSite, "lax");
      assert.equal(snapshot.httpOnly, false);
      assert.equal(snapshot.secure, true);
      assert.equal(snapshot.maxAgeSeconds, 365 * 24 * 60 * 60);

      const header = serializeHuLangSetCookieHeader("zh-Hant");
      assert.match(header, /^hu_lang=zh-Hant/);
      assert.match(header, /Path=\//);
      assert.match(header, /SameSite=Lax/i);
      assert.match(header, /Max-Age=\d+/);
      assert.match(header, /Secure/);
      assert.doesNotMatch(header, /HttpOnly/i);
    } finally {
      process.env.NODE_ENV = previous;
    }

    process.env.NODE_ENV = "development";
    try {
      const snap = getHuLangCookieSecuritySnapshot();
      assert.equal(snap.secure, false);
      assert.doesNotMatch(serializeHuLangSetCookieHeader("en"), /Secure/);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });

  it("invalid/disabled cookie never becomes active locale", async () => {
    await ensureLanguageRegistrySeeded();
    const resolved = await resolveRuntimeLocale({
      huLangCookie: "uk",
      acceptLanguageHeader: "",
    });
    assert.notEqual(resolved.locale, "uk");
    assert.equal(resolved.locale, "en");
  });
});
