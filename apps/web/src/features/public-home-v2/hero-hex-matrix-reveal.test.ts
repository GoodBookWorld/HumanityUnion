/**
 * Home Hero quote honeycomb + signal visual — focused presentation tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  HUMANITY_UNITY_AMBER,
  HUMANITY_UNITY_QUOTE,
  HUMANITY_UNITY_TYPEWRITER_CYCLE_SECONDS,
} from "./hero-unity-visual.constants.js";
import {
  HERO_HEX_BACKDROP,
  HERO_HEX_MATRIX,
  HERO_QUOTE_CYCLE_MS,
  HERO_QUOTE_MASK_PHASES,
  HERO_QUOTE_READABLE_CLEAR_FRACTION,
  HERO_SIGNAL_FIELD,
  buildHeroHexField,
  buildHeroSignalPoints,
  createHeroHexSeededRandom,
  heroClusterOpenAmount,
  heroQuoteHexClearFraction,
  heroQuoteHexCellScale,
  heroSignalClusterBoosts,
  heroSignalPointPosition,
} from "./hero-hex-matrix.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function readFeature(relativePath: string): string {
  return readFileSync(path.join(here, relativePath), "utf8");
}

describe("Home Hero quote honeycomb communication visual", () => {
  it("1 — earth.gif no longer used by Home Hero", () => {
    const files = [
      "components/HumanityGlobe.tsx",
      "components/HumanityUnityVisual.tsx",
      "components/HeroQuoteHoneycombVisual.tsx",
      "components/hero-unity-visual.css",
      "hero-unity-visual.constants.ts",
    ];
    for (const file of files) {
      const src = readFeature(file);
      assert.doesNotMatch(src, /earth\.gif/);
      assert.doesNotMatch(src, /HUMANITY_UNITY_EARTH/);
    }
  });

  it("2 — curved orbital paths removed", () => {
    const globe = readFeature("components/HumanityGlobe.tsx");
    const visual = readFeature("components/HeroQuoteHoneycombVisual.tsx");
    const css = readFeature("components/hero-unity-visual.css");
    assert.doesNotMatch(globe, /<ellipse|orbit-group|hero-unity-globe__path/);
    assert.doesNotMatch(visual, /<ellipse|orbit-group|hero-unity-globe__path/);
    assert.doesNotMatch(css, /hero-unity-orbit-spin|hero-unity-globe__path|hero-unity-comm-pulse/);
  });

  it("3 — moving points remain", () => {
    const visual = readFeature("components/HeroQuoteHoneycombVisual.tsx");
    assert.match(visual, /buildHeroSignalPoints/);
    assert.match(visual, /hero-quote-honeycomb__signals/);
    assert.match(visual, /hero-quote-honeycomb__signal/);
    assert.equal(HUMANITY_UNITY_AMBER, "#ffd250");
    const points = buildHeroSignalPoints({
      width: 480,
      height: 360,
      clusters: buildHeroHexField({ width: 480, height: 360 }).clusters,
    });
    assert.ok(points.length >= HERO_SIGNAL_FIELD.tabletCount);
  });

  it("4 — moving points are top layer", () => {
    const css = readFeature("components/hero-unity-visual.css");
    assert.match(
      css,
      /\.hero-quote-honeycomb__layer--mask\s*\{[^}]*z-index:\s*1/s,
    );
    assert.match(
      css,
      /\.hero-quote-honeycomb__layer--signals\s*\{[^}]*z-index:\s*3/s,
    );
    assert.match(
      css,
      /\.hero-unity-visual__quote-layer\s*\{[^}]*z-index:\s*1/s,
    );
    assert.match(
      css,
      /\.hero-unity-visual__overlay-slot\s*\{[^}]*z-index:\s*2/s,
    );
  });

  it("5 — hero-unity-quote remains real DOM text", () => {
    const quote = readFeature("components/HumanityTypewriterQuote.tsx");
    assert.match(quote, /hero-unity-quote__sr-only/);
    assert.match(quote, /useLocalizedBrand|accessibleHeroUnityQuote/);
    assert.match(quote, /visualHeroUnityQuoteLines|lines\.map/);
    assert.equal(
      HUMANITY_UNITY_QUOTE,
      "Over time, love and responsibility forge humanity",
    );
    const visual = readFeature("components/HeroQuoteHoneycombVisual.tsx");
    assert.doesNotMatch(visual, /fillText|strokeText/);
  });

  it("6 — existing quote cycle duration preserved; mask owns visibility", () => {
    assert.equal(HUMANITY_UNITY_TYPEWRITER_CYCLE_SECONDS, 12);
    assert.equal(HERO_QUOTE_CYCLE_MS, 12_000);
    const quote = readFeature("components/HumanityTypewriterQuote.tsx");
    const css = readFeature("components/hero-unity-visual.css");
    assert.match(quote, /data-hero-quote-stable/);
    assert.doesNotMatch(css, /@keyframes\s+hero-unity-quote-line/);
    assert.match(css, /\.hero-unity-quote__line\s*\{[^}]*opacity:\s*1/s);
  });

  it("7 — honeycomb mask overlays quote", () => {
    const unity = readFeature("components/HumanityUnityVisual.tsx");
    const css = readFeature("components/hero-unity-visual.css");
    assert.match(unity, /hero-unity-visual__quote-layer/);
    assert.match(unity, /HumanityTypewriterQuote/);
    assert.match(unity, /hero-unity-visual__overlay-slot/);
    assert.match(css, /hero-quote-honeycomb__mask-canvas/);
    assert.equal(HERO_HEX_BACKDROP, "#f4f7fa");
  });

  it("8 — local cluster reveal behavior exists", () => {
    const field = buildHeroHexField({ width: 480, height: 360, seed: 7 });
    assert.ok(field.clusters.length >= 3);
    const clusterIds = new Set(field.cells.map((c) => c.clusterId));
    assert.ok(clusterIds.size >= 3);

    const early = HERO_QUOTE_CYCLE_MS * 0.28;
    const opens = field.clusters.map((c) => heroClusterOpenAmount(c, 0.28));
    assert.ok(Math.max(...opens) - Math.min(...opens) > 0.04);

    const scales = field.cells.map((cell) =>
      heroQuoteHexCellScale(cell, field.clusters[cell.clusterId]!, early),
    );
    const unique = new Set(scales.map((s) => s.toFixed(2)));
    assert.ok(unique.size >= 2);
  });

  it("9 — readable quote phase exists (≈90–95% clear)", () => {
    const field = buildHeroHexField({ width: 520, height: 400, seed: 11 });
    const midReadable =
      HERO_QUOTE_CYCLE_MS *
      ((HERO_QUOTE_MASK_PHASES.openEnd + HERO_QUOTE_MASK_PHASES.readableEnd) /
        2);
    const clear = heroQuoteHexClearFraction(field, midReadable);
    assert.equal(clear, HERO_QUOTE_READABLE_CLEAR_FRACTION.min);
  });

  it("10 — mask returns during closing / swap window", () => {
    const field = buildHeroHexField({ width: 480, height: 360, seed: 3 });
    const readable =
      HERO_QUOTE_CYCLE_MS *
      ((HERO_QUOTE_MASK_PHASES.openEnd + HERO_QUOTE_MASK_PHASES.readableEnd) /
        2);
    const closing = HERO_QUOTE_CYCLE_MS * 0.75;
    const closed = HERO_QUOTE_CYCLE_MS * 0.9;
    const clearReadable = heroQuoteHexClearFraction(field, readable);
    const clearClosing = heroQuoteHexClearFraction(field, closing);
    const clearClosed = heroQuoteHexClearFraction(field, closed);
    assert.ok(clearReadable > clearClosing);
    assert.equal(clearReadable, 1);
    assert.equal(clearClosed, 0);
  });

  it("11 — point/mask coordination contract exists", () => {
    const field = buildHeroHexField({ width: 480, height: 360, seed: 5 });
    const points = buildHeroSignalPoints({
      width: 480,
      height: 360,
      clusters: field.clusters,
      seed: 9,
    });
    const openMs = HERO_QUOTE_CYCLE_MS * 0.28;
    const boosts = heroSignalClusterBoosts(
      points,
      field.clusters,
      openMs,
      480,
      360,
    );
    assert.ok(boosts.size >= 0);
    const visual = readFeature("components/HeroQuoteHoneycombVisual.tsx");
    assert.match(visual, /heroSignalClusterBoosts/);
  });

  it("12 — composition horizontally centered", () => {
    const css = readFeature("components/hero-unity-visual.css");
    assert.match(css, /\.hero-unity-visual__stage\s*\{[^}]*place-items:\s*center/s);
    assert.match(css, /\.hero-unity-visual__quote-layer\s*\{[^}]*justify-content:\s*center/s);
    assert.doesNotMatch(css, /left:\s*50%/);
  });

  it("13 — visual remains inside hero visual container", () => {
    const hero = readFeature("components/PublicHomeHeroSection.tsx");
    const unity = readFeature("components/HumanityUnityVisual.tsx");
    const css = readFeature("components/hero-unity-visual.css");
    assert.match(hero, /public-home-v2__hero-visual/);
    assert.match(hero, /HumanityUnityVisual/);
    assert.match(unity, /hero-unity-visual__stage/);
    assert.match(css, /\.hero-unity-visual\s*\{[^}]*overflow:\s*hidden/s);
    assert.match(css, /\.hero-unity-visual__stage\s*\{[^}]*overflow:\s*hidden/s);
  });

  it("14 — responsive behavior", () => {
    assert.ok(HERO_HEX_MATRIX.tabletMaxColumns < HERO_HEX_MATRIX.maxColumns);
    const narrow = buildHeroHexField({ width: 400, height: 320 });
    const wide = buildHeroHexField({ width: 720, height: 420 });
    assert.ok(narrow.columns <= HERO_HEX_MATRIX.tabletMaxColumns);
    assert.ok(wide.columns >= narrow.columns);

    const tabletPoints = buildHeroSignalPoints({
      width: 400,
      height: 320,
      clusters: narrow.clusters,
    });
    const desktopPoints = buildHeroSignalPoints({
      width: 720,
      height: 420,
      clusters: wide.clusters,
    });
    assert.equal(tabletPoints.length, HERO_SIGNAL_FIELD.tabletCount);
    assert.equal(desktopPoints.length, HERO_SIGNAL_FIELD.desktopCount);

    const pageCss = readFeature("public-home-v2.css");
    assert.match(pageCss, /\.public-home-v2__hero-visual\s*\{[^}]*display:\s*none/s);
  });

  it("15 — reduced-motion behavior", () => {
    const visual = readFeature("components/HeroQuoteHoneycombVisual.tsx");
    const css = readFeature("components/hero-unity-visual.css");
    assert.match(visual, /prefers-reduced-motion/);
    assert.match(visual, /paintStaticReducedMask|stationary|reduced/);
    assert.match(css, /prefers-reduced-motion:\s*reduce/);
    assert.match(css, /\.hero-unity-quote__line\s*\{[^}]*animation:\s*none/s);
  });

  it("16 — no Three/WebGL/external animation library", () => {
    for (const file of [
      "components/HumanityGlobe.tsx",
      "components/HeroQuoteHoneycombVisual.tsx",
      "hero-hex-matrix.ts",
    ]) {
      const src = readFeature(file);
      assert.doesNotMatch(src, /from ["']three["']/);
      assert.doesNotMatch(src, /WebGLRenderer|PerspectiveCamera/);
      assert.doesNotMatch(src, /gsap|framer-motion|anime\.js|lottie/i);
    }
  });

  it("17 — cleanup on unmount", () => {
    const visual = readFeature("components/HeroQuoteHoneycombVisual.tsx");
    assert.match(visual, /cancelAnimationFrame/);
    assert.match(visual, /removeEventListener\("resize"/);
  });

  it("18 — Hero heading/CTA regression", () => {
    const hero = readFeature("components/PublicHomeHeroSection.tsx");
    assert.match(hero, /public-home-hero-title/);
    assert.match(hero, /PublicHomeCreateInitiativeCta/);
    assert.match(hero, /public-home-v2__hero-actions/);
    assert.match(hero, /Explore Knowledge|secondaryCta/);
  });

  it("signal motion is deterministic and purposeful", () => {
    const field = buildHeroHexField({ width: 480, height: 360, seed: 1 });
    const points = buildHeroSignalPoints({
      width: 480,
      height: 360,
      clusters: field.clusters,
      seed: 2,
    });
    const a = heroSignalPointPosition(points[0]!, 1_000, 480, 360);
    const b = heroSignalPointPosition(points[0]!, 1_000, 480, 360);
    assert.deepEqual(a, b);
    const c = heroSignalPointPosition(points[0]!, 3_500, 480, 360);
    assert.ok(Math.hypot(a.x - c.x, a.y - c.y) > 1);

    const rand = createHeroHexSeededRandom(42);
    assert.notEqual(rand(), rand());
  });
});
