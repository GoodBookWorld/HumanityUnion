/**
 * Production Completion Pack 02B Task 01 — Language Registry foundation tests.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  LANGUAGE_REGISTRY_SEED_DEFINITIONS,
  LanguageRegistryConflictError,
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  getLanguageRegistryByLocale,
  listLanguageRegistry,
  resetLanguageRegistryStoreForTests,
  resolveLanguageRegistryLocale,
  setLanguageRegistryForceMemoryForTests,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";

describe("Production Completion Pack 02B Task 01 — Language Registry", () => {
  beforeEach(() => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
  });

  afterEach(() => {
    resetLanguageRegistryStoreForTests();
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("seeds en, uk, zh-Hant, ar idempotently without overwriting", async () => {
    const first = await ensureLanguageRegistrySeeded();
    assert.equal(first.inserted, 4);
    assert.equal(first.skippedExisting, 0);
    assert.deepEqual([...first.locales].sort(), ["ar", "en", "uk", "zh-Hant"].sort());

    const second = await ensureLanguageRegistrySeeded();
    assert.equal(second.inserted, 0);
    assert.equal(second.skippedExisting, 4);

    const listed = await listLanguageRegistry();
    assert.equal(listed.length, 4);
  });

  it("preserves Admin-modified records across reseed", async () => {
    await ensureLanguageRegistrySeeded();
    await updateLanguageRegistryRecord("lang-uk", {
      enabled: true,
      englishName: "Ukrainian (Admin)",
      contentTranslationEnabled: true,
    });

    const reseed = await ensureLanguageRegistrySeeded();
    assert.equal(reseed.inserted, 0);
    assert.equal(reseed.skippedExisting, 4);

    const uk = await getLanguageRegistryByLocale("uk");
    assert.ok(uk);
    assert.equal(uk.enabled, true);
    assert.equal(uk.englishName, "Ukrainian (Admin)");
    assert.equal(uk.contentTranslationEnabled, true);
  });

  it("rejects duplicate canonical locale on create", async () => {
    await ensureLanguageRegistrySeeded();
    await assert.rejects(
      () =>
        createLanguageRegistryRecord({
          locale: "en",
          englishName: "English Dup",
          nativeName: "English Dup",
          textDirection: "ltr",
        }),
      LanguageRegistryConflictError,
    );
  });

  it("resolves zh-TW and zh-HK aliases to zh-Hant", async () => {
    await ensureLanguageRegistrySeeded();
    const fromTw = await resolveLanguageRegistryLocale("zh-TW");
    const fromHk = await resolveLanguageRegistryLocale("zh-hk");
    const canonical = await getLanguageRegistryByLocale("zh-Hant");

    assert.ok(fromTw);
    assert.ok(fromHk);
    assert.ok(canonical);
    assert.equal(fromTw.locale, "zh-Hant");
    assert.equal(fromHk.locale, "zh-Hant");
    assert.equal(fromTw.languageId, canonical.languageId);
    assert.deepEqual(canonical.aliases, ["zh-TW", "zh-HK"]);
  });

  it("rejects ambiguous aliases that collide with another locale or alias", async () => {
    await ensureLanguageRegistrySeeded();

    await assert.rejects(
      () =>
        createLanguageRegistryRecord({
          locale: "fa",
          englishName: "Persian",
          nativeName: "فارسی",
          textDirection: "rtl",
          aliases: ["ar"],
        }),
      LanguageRegistryConflictError,
    );

    await assert.rejects(
      () =>
        updateLanguageRegistryRecord("lang-uk", {
          aliases: ["zh-TW"],
        }),
      LanguageRegistryConflictError,
    );
  });

  it("marks Arabic as rtl and verification LTR locales as ltr", async () => {
    await ensureLanguageRegistrySeeded();
    const ar = await getLanguageRegistryByLocale("ar");
    const en = await getLanguageRegistryByLocale("en");
    const uk = await getLanguageRegistryByLocale("uk");
    const zh = await getLanguageRegistryByLocale("zh-Hant");

    assert.equal(ar?.textDirection, "rtl");
    assert.equal(en?.textDirection, "ltr");
    assert.equal(uk?.textDirection, "ltr");
    assert.equal(zh?.textDirection, "ltr");
  });

  it("keeps enabling flags as policy data on seeds", async () => {
    await ensureLanguageRegistrySeeded();
    const byLocale = new Map(
      (await listLanguageRegistry()).map((row) => [row.locale, row] as const),
    );

    for (const definition of LANGUAGE_REGISTRY_SEED_DEFINITIONS) {
      const row = byLocale.get(definition.locale);
      assert.ok(row);
      assert.equal(row.enabled, definition.enabled);
      assert.equal(row.seoIndexingEnabled, definition.seoIndexingEnabled);
      assert.equal(row.searchEnabled, definition.searchEnabled);
    }

    assert.equal(byLocale.get("en")?.enabled, true);
    assert.equal(byLocale.get("uk")?.enabled, false);
    assert.equal(byLocale.get("zh-Hant")?.enabled, false);
    assert.equal(byLocale.get("ar")?.enabled, false);
  });
});
