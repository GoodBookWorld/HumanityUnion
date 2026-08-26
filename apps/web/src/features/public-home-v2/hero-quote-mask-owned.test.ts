/**
 * Home Hero quote visibility owned by honeycomb mask — correction tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  HUMANITY_UNITY_QUOTE,
  HUMANITY_UNITY_QUOTE_LINES,
  HUMANITY_UNITY_TYPEWRITER_CYCLE_SECONDS,
} from "./hero-unity-visual.constants.js";
import {
  HERO_HEX_BACKDROP,
  HERO_QUOTE_CYCLE_MS,
  HERO_QUOTE_MASK_COVERAGE,
  HERO_QUOTE_MASK_PHASES,
  HERO_QUOTE_READABLE_CLEAR_FRACTION,
  buildHeroHexField,
  heroClusterOpenAmount,
  heroQuoteHexClearFraction,
  heroQuoteHexCoverageFraction,
  heroQuoteIsSwapWindow,
} from "./hero-hex-matrix.js";
import { PUBLIC_HOME_HUMANITY_AI_PRINCIPLE } from "./constants.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function readFeature(relativePath: string): string {
  return readFileSync(path.join(here, relativePath), "utf8");
}

describe("Home Hero quote reveal owned by honeycomb mask", () => {
  it("1 — quote no longer has independent opacity animation", () => {
    const css = readFeature("components/hero-unity-visual.css");
    assert.doesNotMatch(css, /@keyframes\s+hero-unity-quote-line/);
    assert.doesNotMatch(
      css,
      /\.hero-unity-quote__line--[123]\s*\{[^}]*animation:/s,
    );
    assert.match(
      css,
      /\.hero-unity-quote__line\s*\{[^}]*opacity:\s*1/s,
    );
  });

  it("2 — quote no longer has independent fade-in/fade-out keyframes", () => {
    const css = readFeature("components/hero-unity-visual.css");
    assert.doesNotMatch(css, /hero-unity-quote-line-1/);
    assert.doesNotMatch(css, /hero-unity-quote-line-2/);
    assert.doesNotMatch(css, /hero-unity-quote-line-3/);
    const quote = readFeature("components/HumanityTypewriterQuote.tsx");
    assert.doesNotMatch(quote, /--hero-unity-quote-cycle/);
    assert.doesNotMatch(quote, /TYPEWRITER_CYCLE/);
  });

  it("3 — active quote remains rendered behind mask", () => {
    const quote = readFeature("components/HumanityTypewriterQuote.tsx");
    const unity = readFeature("components/HumanityUnityVisual.tsx");
    assert.match(quote, /data-hero-quote-stable="true"/);
    assert.match(unity, /hero-unity-visual__quote-layer/);
    assert.match(unity, /HumanityTypewriterQuote/);
    assert.match(unity, /hero-unity-visual__overlay-slot/);
  });

  it("4 — honeycomb is sole reveal/hide mechanism", () => {
    const visual = readFeature("components/HeroQuoteHoneycombVisual.tsx");
    const css = readFeature("components/hero-unity-visual.css");
    assert.match(visual, /heroQuoteHexCellOpacity|paintMask/);
    assert.match(css, /hero-quote-honeycomb__layer--mask/);
    assert.doesNotMatch(css, /@keyframes\s+hero-unity-quote/);
    assert.equal(HERO_HEX_BACKDROP, "#f4f7fa");
  });

  it("5 — mask starts mostly closed (≈75–90% coverage)", () => {
    const field = buildHeroHexField({ width: 520, height: 400, seed: 11 });
    const early = HERO_QUOTE_CYCLE_MS * 0.08;
    const cover = heroQuoteHexCoverageFraction(field, early);
    assert.ok(
      cover >= HERO_QUOTE_MASK_COVERAGE.initialMin - 0.03,
      `initial cover ${cover}`,
    );
    assert.ok(
      cover <= HERO_QUOTE_MASK_COVERAGE.initialMax + 0.03,
      `initial cover ${cover}`,
    );
  });

  it("6 — mask opens in local pseudo-random clusters", () => {
    const field = buildHeroHexField({ width: 480, height: 360, seed: 7 });
    assert.ok(field.clusters.length >= 3);
    const midOpen = 0.25;
    const opens = field.clusters.map((c) => heroClusterOpenAmount(c, midOpen));
    assert.ok(Math.max(...opens) - Math.min(...opens) > 0.04);
  });

  it("7 — readable phase reaches ~90–95% reveal", () => {
    const field = buildHeroHexField({ width: 520, height: 400, seed: 11 });
    const mid =
      HERO_QUOTE_CYCLE_MS *
      ((HERO_QUOTE_MASK_PHASES.openEnd + HERO_QUOTE_MASK_PHASES.readableEnd) / 2);
    const clear = heroQuoteHexClearFraction(field, mid);
    assert.ok(
      clear >= HERO_QUOTE_READABLE_CLEAR_FRACTION.min - 0.02,
      `readable clear ${clear}`,
    );
    assert.ok(
      clear <= HERO_QUOTE_READABLE_CLEAR_FRACTION.max + 0.03,
      `readable clear ${clear}`,
    );
  });

  it("8 — mask returns before quote swap", () => {
    const field = buildHeroHexField({ width: 520, height: 400, seed: 3 });
    const readable =
      HERO_QUOTE_CYCLE_MS *
      ((HERO_QUOTE_MASK_PHASES.openEnd + HERO_QUOTE_MASK_PHASES.readableEnd) / 2);
    const closing = HERO_QUOTE_CYCLE_MS * 0.82;
    const clearReadable = heroQuoteHexClearFraction(field, readable);
    const clearClosing = heroQuoteHexClearFraction(field, closing);
    assert.ok(clearReadable > clearClosing + 0.2);
    const cover = heroQuoteHexCoverageFraction(field, closing);
    assert.ok(cover >= HERO_QUOTE_MASK_COVERAGE.swapMin - 0.05);
    assert.ok(cover <= HERO_QUOTE_MASK_COVERAGE.swapMax + 0.05);
  });

  it("9 — quote swap occurs while sufficiently masked", () => {
    const field = buildHeroHexField({ width: 520, height: 400, seed: 5 });
    const swapMs = HERO_QUOTE_CYCLE_MS * 0.95;
    assert.equal(heroQuoteIsSwapWindow(swapMs), true);
    assert.equal(heroQuoteIsSwapWindow(HERO_QUOTE_CYCLE_MS * 0.5), false);
    const cover = heroQuoteHexCoverageFraction(field, swapMs);
    assert.ok(
      cover >= HERO_QUOTE_MASK_COVERAGE.swapMin - 0.02,
      `swap cover ${cover}`,
    );
    assert.ok(
      cover <= HERO_QUOTE_MASK_COVERAGE.swapMax + 0.05,
      `swap cover ${cover}`,
    );
  });

  it("10 — no visible quote crossfade", () => {
    const css = readFeature("components/hero-unity-visual.css");
    const quote = readFeature("components/HumanityTypewriterQuote.tsx");
    assert.doesNotMatch(css, /@keyframes\s+hero-unity-quote/);
    assert.doesNotMatch(quote, /crossfade|animation:|style=\{\{[^}]*opacity/i);
    assert.match(quote, /data-hero-quote-stable/);
  });

  it("11 — signal points remain top layer", () => {
    const css = readFeature("components/hero-unity-visual.css");
    assert.match(
      css,
      /\.hero-quote-honeycomb__layer--mask\s*\{[^}]*z-index:\s*1/s,
    );
    assert.match(
      css,
      /\.hero-quote-honeycomb__layer--signals\s*\{[^}]*z-index:\s*2/s,
    );
  });

  it("12 — reduced-motion quote remains readable", () => {
    const css = readFeature("components/hero-unity-visual.css");
    const visual = readFeature("components/HeroQuoteHoneycombVisual.tsx");
    assert.match(css, /prefers-reduced-motion:\s*reduce/);
    assert.match(
      css,
      /\.hero-unity-quote__line\s*\{[^}]*opacity:\s*1/s,
    );
    assert.match(visual, /paintStaticReducedMask|prefers-reduced-motion/);
  });

  it("13 — accessibility preserved", () => {
    const quote = readFeature("components/HumanityTypewriterQuote.tsx");
    assert.match(quote, /hero-unity-quote__sr-only/);
    assert.match(quote, /HUMANITY_UNITY_QUOTE/);
    assert.doesNotMatch(quote, /aria-hidden="true"[^>]*>[\s\S]*HUMANITY_UNITY_QUOTE</);
    assert.equal(
      HUMANITY_UNITY_QUOTE,
      "Over time, love and responsibility forge humanity",
    );
    const visual = readFeature("components/HeroQuoteHoneycombVisual.tsx");
    assert.match(visual, /aria-hidden="true"/);
    assert.doesNotMatch(visual, /fillText|strokeText/);
  });

  it("14 — existing quote content sequence preserved", () => {
    assert.equal(HUMANITY_UNITY_TYPEWRITER_CYCLE_SECONDS, 12);
    assert.equal(HERO_QUOTE_CYCLE_MS, 12_000);
    assert.deepEqual([...HUMANITY_UNITY_QUOTE_LINES], [
      "Over time,",
      "love and responsibility",
      "forge humanity",
    ]);
    assert.equal(HERO_QUOTE_MASK_PHASES.closedHoldEnd, 0.15);
    assert.equal(HERO_QUOTE_MASK_PHASES.openEnd, 0.4);
    assert.equal(HERO_QUOTE_MASK_PHASES.readableEnd, 0.7);
    assert.equal(HERO_QUOTE_MASK_PHASES.closeEnd, 0.9);
  });

  it("15 — Humanity AI principle line unaffected", () => {
    assert.match(
      PUBLIC_HOME_HUMANITY_AI_PRINCIPLE,
      /We put technology and AI in service of humanity/,
    );
    const page = readFeature("components/PublicHomeV2Page.tsx");
    assert.match(page, /PublicHomeHumanityAiPrinciple/);
    const css = readFeature("public-home-v2.css");
    assert.match(css, /public-home-v2__humanity-ai-principle/);
  });

  it("16 — Home Hero regression: heading/CTA/visual container", () => {
    const hero = readFeature("components/PublicHomeHeroSection.tsx");
    assert.match(hero, /public-home-hero-title/);
    assert.match(hero, /PublicHomeCreateInitiativeCta/);
    assert.match(hero, /public-home-v2__hero-visual/);
    assert.match(hero, /HumanityUnityVisual/);
  });
});
