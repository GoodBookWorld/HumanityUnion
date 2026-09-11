/**
 * Media PLP materializer — Registry locale identity (script/region preserved).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  normalizeLanguageCode,
  normalizeLanguageRegistryLocaleKey,
} from "@hu/types";

import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
  updateLanguageRegistryRecord,
} from "../../../src/modules/language/index.js";
import {
  loadMediaPlpMaterializerLocale,
  normalizeMediaPlpRegistryLocaleIdentity,
  parseMediaPlpMaterializerArgs,
} from "../../../src/modules/language/media-plp-materializer/index.js";
import { parseMediaPlpCarouselMaterializerArgs } from "../../../src/modules/language/media-plp-carousel-materializer/index.js";

const apiSrc = join(dirname(fileURLToPath(import.meta.url)), "../../../src");

describe("Media PLP materializer Registry locale identity", () => {
  beforeEach(async () => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
  });

  afterEach(() => {
    resetLanguageRegistryStoreForTests();
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("1. zh-Hant remains zh-Hant for Registry eligibility / materialization identity", async () => {
    // LanguageCode helper still collapses — must stay separate from Registry identity.
    assert.equal(normalizeLanguageCode("zh-Hant", "en"), "zh");

    await updateLanguageRegistryRecord("lang-zh-Hant", {
      enabled: true,
      contentTranslationEnabled: true,
    });

    const carousel = parseMediaPlpCarouselMaterializerArgs([
      "node",
      "x",
      "--mongo",
      "--locale",
      "zh-Hant",
    ]);
    assert.equal(carousel.ok, true);
    if (!carousel.ok) return;
    assert.equal(carousel.args.locale, "zh-hant");
    assert.notEqual(carousel.args.locale, "zh");

    const single = parseMediaPlpMaterializerArgs([
      "node",
      "x",
      "--mongo",
      "--entity-type",
      "civic_media_principle",
      "--entity-id",
      "editorial-transparency",
      "--locale",
      "zh-Hant",
    ]);
    assert.equal(single.ok, true);
    if (!single.ok) return;
    assert.equal(single.args.locale, "zh-hant");

    const lookup = await loadMediaPlpMaterializerLocale("zh-Hant");
    assert.equal(lookup.LOCALE_REGISTRY_FOUND, true);
    assert.equal(lookup.LOCALE_ENABLED, true);
    assert.equal(lookup.CONTENT_TRANSLATION_ENABLED, true);
    assert.equal(lookup.CANONICAL_LOCALE, "zh-Hant");

    // Alias resolves to the same canonical Registry locale.
    const viaAlias = await loadMediaPlpMaterializerLocale("zh-TW");
    assert.equal(viaAlias.LOCALE_REGISTRY_FOUND, true);
    assert.equal(viaAlias.CANONICAL_LOCALE, "zh-Hant");
  });

  it("2. future synthetic script/region locale is preserved", async () => {
    await createLanguageRegistryRecord({
      locale: "sr-Latn",
      englishName: "Serbian (Latin)",
      nativeName: "Srpski",
      textDirection: "ltr",
      enabled: true,
      contentTranslationEnabled: true,
    });

    assert.equal(
      normalizeMediaPlpRegistryLocaleIdentity("sr-Latn"),
      "sr-latn",
    );
    assert.equal(
      normalizeMediaPlpRegistryLocaleIdentity("sr-Latn"),
      normalizeLanguageRegistryLocaleKey("sr-Latn"),
    );
    // Must not collapse to base language the way normalizeLanguageCode would for priority bases.
    assert.notEqual(normalizeMediaPlpRegistryLocaleIdentity("sr-Latn"), "sr");

    const parsed = parseMediaPlpCarouselMaterializerArgs([
      "node",
      "x",
      "--mongo",
      "--locale",
      "sr-Latn",
    ]);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.args.locale, "sr-latn");

    const lookup = await loadMediaPlpMaterializerLocale("sr-Latn");
    assert.equal(lookup.LOCALE_REGISTRY_FOUND, true);
    assert.equal(lookup.CONTENT_TRANSLATION_ENABLED, true);
    assert.equal(lookup.CANONICAL_LOCALE, "sr-Latn");
  });

  it("3. default / simple locale behavior remains unchanged", async () => {
    const uk = parseMediaPlpCarouselMaterializerArgs([
      "node",
      "x",
      "--mongo",
      "--locale",
      "uk",
    ]);
    assert.equal(uk.ok, true);
    if (!uk.ok) return;
    assert.equal(uk.args.locale, "uk");

    const en = parseMediaPlpCarouselMaterializerArgs([
      "node",
      "x",
      "--mongo",
      "--locale",
      "en",
    ]);
    assert.equal(en.ok, true);
    if (!en.ok) return;
    assert.equal(en.args.locale, "en");

    const ukLookup = await loadMediaPlpMaterializerLocale("uk");
    assert.equal(ukLookup.LOCALE_REGISTRY_FOUND, true);
    assert.equal(ukLookup.CANONICAL_LOCALE, "uk");
  });

  it("4. locale-lookup stays on Registry repository (no barrel/service/routes)", () => {
    const lookup = readFileSync(
      join(apiSrc, "modules/language/media-plp-materializer/locale-lookup.ts"),
      "utf8",
    );
    assert.match(
      lookup,
      /from\s+["']\.\.\/language-registry\/language-registry\.repository\.js["']/,
    );
    assert.doesNotMatch(
      lookup,
      /from\s+["'][^"']*language-registry\/index[^"']*["']/,
    );
    assert.doesNotMatch(
      lookup,
      /from\s+["'][^"']*language-registry\.service[^"']*["']/,
    );
    assert.doesNotMatch(
      lookup,
      /from\s+["'][^"']*(public-languages\.routes|admin-languages\.routes)[^"']*["']/,
    );
    assert.doesNotMatch(lookup, /from\s+["'][^"']*(global-search|language\/index)[^"']*["']/);
  });
});
