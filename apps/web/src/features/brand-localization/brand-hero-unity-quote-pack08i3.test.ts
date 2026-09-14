/**
 * Pack 08I.3 — Hero unity quote Brand Localization wiring.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  CANONICAL_ENGLISH_BRAND_FALLBACK,
  CANONICAL_ENGLISH_HERO_UNITY_QUOTE,
  accessibleHeroUnityQuote,
  visualHeroUnityQuoteLines,
} from "@hu/types";

import {
  HUMANITY_UNITY_QUOTE,
  HUMANITY_UNITY_QUOTE_LINES,
} from "../public-home-v2/hero-unity-visual.constants";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Pack 08I.3 — Hero unity quote Brand Localization", () => {
  it("canonical English quote owns fallback and fixture re-exports", () => {
    assert.equal(
      accessibleHeroUnityQuote(CANONICAL_ENGLISH_BRAND_FALLBACK.heroUnityQuote),
      CANONICAL_ENGLISH_HERO_UNITY_QUOTE,
    );
    assert.equal(HUMANITY_UNITY_QUOTE, CANONICAL_ENGLISH_HERO_UNITY_QUOTE);
    assert.deepEqual([...HUMANITY_UNITY_QUOTE_LINES], [
      "Over time,",
      "love and responsibility",
      "forge humanity",
    ]);
    assert.deepEqual(
      [...visualHeroUnityQuoteLines(CANONICAL_ENGLISH_BRAND_FALLBACK.heroUnityQuote)],
      [...HUMANITY_UNITY_QUOTE_LINES],
    );
  });

  it("Admin Brand Localization exposes Hero unity quote textarea", () => {
    const admin = readWeb(
      "features/administration/components/AdminBrandLocalizationSection.tsx",
    );
    assert.match(admin, /Hero unity quote/);
    assert.match(admin, /heroUnityQuote/);
    assert.match(admin, /<textarea/);
    assert.match(admin, /Machine\s+translation is not used/i);
    assert.match(admin, /faithful translation|different approved quote/i);
  });

  it("mounted hero quote uses useLocalizedBrand — no hard-coded active UI source", () => {
    const quote = readWeb(
      "features/public-home-v2/components/HumanityTypewriterQuote.tsx",
    );
    assert.match(quote, /useLocalizedBrand/);
    assert.match(quote, /brand\.heroUnityQuote/);
    assert.match(quote, /accessibleHeroUnityQuote/);
    assert.match(quote, /visualHeroUnityQuoteLines/);
    assert.doesNotMatch(quote, /HUMANITY_UNITY_QUOTE_LINES\.map/);
    assert.doesNotMatch(quote, /useTranslations|messages\/en\.json/);
    assert.doesNotMatch(quote, /terminology-glossary|TranslationProvider|gemini/i);
  });

  it("hero quote is not injected into SEO metadata builders", () => {
    const home = readWeb("app/page.tsx");
    const buildMeta = readWeb("lib/seo/build-public-page-metadata.ts");
    assert.doesNotMatch(home, /heroUnityQuote/);
    assert.doesNotMatch(buildMeta, /heroUnityQuote/);
  });

  it("CSS supports wrap + RTL without nowrap clipping", () => {
    const css = readWeb("features/public-home-v2/components/hero-unity-visual.css");
    assert.match(css, /overflow-wrap:\s*anywhere/);
    assert.match(css, /\.hero-unity-quote__line--wrap/);
    assert.match(css, /\[dir="rtl"\]/);
    assert.doesNotMatch(css, /\.hero-unity-quote__line[^{]*\{[^}]*white-space:\s*nowrap/s);
    assert.doesNotMatch(css, /\.hero-unity-quote\s*\{[^}]*height:\s*\d/s);
  });
});
