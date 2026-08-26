/**
 * Home Hero hex matrix Earth reveal — focused presentation tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  HUMANITY_UNITY_EARTH_SCALE,
  HUMANITY_UNITY_EARTH_SRC,
} from "./hero-unity-visual.constants.js";
import {
  HERO_HEX_BACKDROP,
  HERO_HEX_MATRIX,
  HERO_HEX_TIMING,
  buildHeroHexField,
  createHeroHexSeededRandom,
  heroHexCellOpacity,
} from "./hero-hex-matrix.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function readFeature(relativePath: string): string {
  return readFileSync(path.join(here, relativePath), "utf8");
}

describe("Home Hero hex matrix Earth reveal", () => {
  it("1 — animation mounted inside public-home-v2__hero-visual", () => {
    const hero = readFeature("components/PublicHomeHeroSection.tsx");
    const globe = readFeature("components/HumanityGlobe.tsx");
    assert.match(hero, /public-home-v2__hero-visual/);
    assert.match(hero, /HumanityUnityVisual/);
    assert.match(globe, /HeroHexMatrixReveal|data-hero-hex-matrix/);
  });

  it("2 — earth.gif used", () => {
    assert.equal(HUMANITY_UNITY_EARTH_SRC, "/illustrations/earth.gif");
    assert.match(readFeature("components/HumanityGlobe.tsx"), /HUMANITY_UNITY_EARTH_SRC/);
  });

  it("3 — Earth visual scale approximately 50%", () => {
    assert.equal(HUMANITY_UNITY_EARTH_SCALE, 0.5);
    const css = readFeature("components/hero-unity-visual.css");
    assert.match(css, /\.hero-unity-globe__earth\s*\{[^}]*width:\s*50%/s);
  });

  it("4 — unity-globe.webp not referenced by Home Hero", () => {
    for (const file of [
      "components/HumanityUnityVisual.tsx",
      "components/HumanityGlobe.tsx",
      "components/hero-unity-visual.css",
      "hero-unity-visual.constants.ts",
      "components/HeroHexMatrixReveal.tsx",
      "hero-hex-matrix.ts",
    ]) {
      const src = readFeature(file);
      assert.doesNotMatch(src, /["'`]\/illustrations\/unity-globe\.webp["'`]/);
      assert.doesNotMatch(src, /url\([^)]*unity-globe\.webp/);
    }
  });

  it("5 — orbital layer still present", () => {
    const globe = readFeature("components/HumanityGlobe.tsx");
    assert.match(globe, /hero-unity-globe__layer--rear/);
    assert.match(globe, /hero-unity-globe__layer--front/);
    assert.match(globe, /hero-unity-globe__node/);
  });

  it("6 — hex/honeycomb foreground layer exists", () => {
    const globe = readFeature("components/HumanityGlobe.tsx");
    const css = readFeature("components/hero-unity-visual.css");
    assert.match(globe, /hero-unity-globe__layer--hex/);
    assert.match(globe, /HeroHexMatrixReveal/);
    assert.match(css, /hero-unity-globe__hex-matrix/);
    assert.equal(HERO_HEX_BACKDROP, "#f4f7fa");
  });

  it("7 — hex layer covers Earth + orbit system (z-index above front)", () => {
    const css = readFeature("components/hero-unity-visual.css");
    assert.match(css, /\.hero-unity-globe__layer--rear\s*\{[^}]*z-index:\s*1/s);
    assert.match(css, /\.hero-unity-globe__earth\s*\{[^}]*z-index:\s*2/s);
    assert.match(css, /\.hero-unity-globe__layer--front\s*\{[^}]*z-index:\s*3/s);
    assert.match(css, /\.hero-unity-globe__layer--hex\s*\{[^}]*z-index:\s*4/s);
  });

  it("8 — initial state mostly opaque", () => {
    const field = buildHeroHexField({ width: 320, height: 280, seed: 7 });
    const sample = field.cells.slice(0, 20);
    for (const cell of sample) {
      assert.equal(heroHexCellOpacity(cell, 500), 1);
      assert.equal(heroHexCellOpacity(cell, HERO_HEX_TIMING.holdMs - 1), 1);
    }
  });

  it("9 — reveal delay approximately 2–3 seconds", () => {
    assert.ok(HERO_HEX_TIMING.holdMs >= 2_000);
    assert.ok(HERO_HEX_TIMING.holdMs <= 2_500);
    const reveal = readFeature("components/HeroHexMatrixReveal.tsx");
    assert.match(reveal, /data-hero-hex-hold-ms/);
  });

  it("10 — pseudo-random distributed reveal is deterministic", () => {
    const a = buildHeroHexField({ width: 360, height: 300, seed: 42 });
    const b = buildHeroHexField({ width: 360, height: 300, seed: 42 });
    assert.deepEqual(
      a.cells.map((c) => c.revealAt),
      b.cells.map((c) => c.revealAt),
    );
    const c = buildHeroHexField({ width: 360, height: 300, seed: 99 });
    assert.notDeepEqual(
      a.cells.map((cell) => cell.revealRank),
      c.cells.map((cell) => cell.revealRank),
    );
    const r1 = createHeroHexSeededRandom(3);
    const r2 = createHeroHexSeededRandom(3);
    assert.equal(r1(), r2());
  });

  it("11 — partial-opacity hex state supported", () => {
    const field = buildHeroHexField({ width: 320, height: 280, seed: 11 });
    const mid = field.cells.find((cell) => cell.revealAt > 0.2 && cell.revealAt < 0.5);
    assert.ok(mid);
    const openAt =
      HERO_HEX_TIMING.holdMs +
      mid!.revealAt * (HERO_HEX_TIMING.revealEndMs - HERO_HEX_TIMING.holdMs);
    const opacity = heroHexCellOpacity(mid!, openAt + HERO_HEX_TIMING.cellFadeMs * 0.45);
    assert.ok(opacity > 0.05 && opacity < 0.95);
  });

  it("12 — near-complete reveal after sequence", () => {
    const field = buildHeroHexField({ width: 320, height: 280, seed: 5 });
    const after = field.cells.filter(
      (cell) => heroHexCellOpacity(cell, HERO_HEX_TIMING.revealEndMs + 50) < 0.25,
    );
    assert.ok(after.length / field.cells.length > 0.75);
  });

  it("13 — subtle continuous post-reveal hex activity", () => {
    const field = buildHeroHexField({ width: 320, height: 280, seed: 8 });
    const living = field.cells.filter((cell) => cell.living);
    assert.ok(living.length > 0);
    const o1 = heroHexCellOpacity(living[0]!, 6_000);
    const o2 = heroHexCellOpacity(living[0]!, 6_800);
    assert.ok(o1 > 0 || o2 > 0);
    // Non-living cells stay clear after reveal end.
    const quiet = field.cells.find((cell) => !cell.living);
    assert.ok(quiet);
    assert.equal(heroHexCellOpacity(quiet!, 7_000), 0);
  });

  it("14 — bounded cell density", () => {
    const field = buildHeroHexField({ width: 640, height: 480, seed: 1 });
    assert.ok(field.columns >= HERO_HEX_MATRIX.minColumns);
    assert.ok(field.columns <= HERO_HEX_MATRIX.maxColumns);
    assert.ok(field.cells.length <= HERO_HEX_MATRIX.maxCells);
  });

  it("15 — responsive reduction contracts remain", () => {
    const css = readFeature("components/hero-unity-visual.css");
    assert.match(css, /max-width:\s*1100px\)\s*and\s*\(min-width:\s*769px\)/);
    assert.match(css, /@media \(max-width: 768px\)/);
  });

  it("16 — reduced-motion stops matrix/orbit movement", () => {
    const css = readFeature("components/hero-unity-visual.css");
    const reveal = readFeature("components/HeroHexMatrixReveal.tsx");
    assert.match(css, /prefers-reduced-motion:\s*reduce/);
    assert.match(css, /\.hero-unity-globe__spin,\s*\n\s*\.hero-unity-globe__comm/);
    assert.match(css, /animation:\s*none/);
    assert.match(css, /\.hero-unity-globe__hex-matrix/);
    assert.match(reveal, /prefers-reduced-motion/);
  });

  it("17 — decorative accessibility", () => {
    const globe = readFeature("components/HumanityGlobe.tsx");
    const reveal = readFeature("components/HeroHexMatrixReveal.tsx");
    assert.match(globe, /aria-hidden="true"/);
    assert.match(reveal, /aria-hidden="true"/);
    assert.match(reveal, /focusable="false"|aria-hidden/);
  });

  it("18 — no Three/WebGL/external animation library", () => {
    const globe = readFeature("components/HumanityGlobe.tsx");
    const reveal = readFeature("components/HeroHexMatrixReveal.tsx");
    for (const src of [globe, reveal]) {
      assert.doesNotMatch(src, /from ["']three["']/);
      assert.doesNotMatch(src, /WebGLRenderer|PerspectiveCamera/);
      assert.doesNotMatch(src, /gsap|framer-motion|lottie|anime\.js/i);
    }
  });

  it("19 — cleanup on unmount", () => {
    const reveal = readFeature("components/HeroHexMatrixReveal.tsx");
    assert.match(reveal, /cancelAnimationFrame/);
    assert.match(reveal, /removeEventListener\("resize"/);
    assert.match(reveal, /removeEventListener\("orientationchange"/);
  });

  it("20 — existing Hero layout/CTA regression", () => {
    const hero = readFeature("components/PublicHomeHeroSection.tsx");
    assert.match(hero, /PublicHomeCreateInitiativeCta|Create Initiative|primaryCta/);
    assert.match(hero, /public-home-v2__hero-content/);
    assert.match(hero, /public-home-v2__hero-visual/);
  });
});
