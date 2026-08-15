import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { PUBLIC_HOME_HERO } from "./constants.js";
import {
  HUMANITY_GLOBE_INTERACTION,
  HUMANITY_UNITY_ARC_COUNT,
  HUMANITY_UNITY_BACKGROUND_SRC,
  HUMANITY_UNITY_BLUE,
  HUMANITY_UNITY_GLOBE_RADIUS,
  HUMANITY_UNITY_QUOTE,
  HUMANITY_UNITY_QUOTE_LINES,
  HUMANITY_UNITY_TYPEWRITER_CYCLE_SECONDS,
  HUMANITY_UNITY_VISUAL_MIN_WIDTH_PX,
} from "./hero-unity-visual.constants.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function readFeature(relativePath: string): string {
  return readFileSync(path.join(here, relativePath), "utf8");
}

describe("Home Visual Pack 01.1 / Refinement 02 — hero unity visual", () => {
  it("keeps existing Hero content contract", () => {
    assert.ok(PUBLIC_HOME_HERO.headline.length > 0);
    assert.ok(PUBLIC_HOME_HERO.subheadline.length > 0);
    assert.equal(PUBLIC_HOME_HERO.primaryCta.label, "Create Initiative");
    assert.equal(PUBLIC_HOME_HERO.secondaryCta.label, "Explore Knowledge");

    const hero = readFeature("components/PublicHomeHeroSection.tsx");
    assert.match(hero, /public-home-v2__hero-layout/);
    assert.match(hero, /public-home-v2__hero-content/);
    assert.match(hero, /public-home-v2__hero-visual/);
    assert.match(hero, /public-home-hero-title/);
    assert.match(hero, /HumanityUnityVisual/);
    assert.match(hero, /PublicHomeCreateInitiativeCta/);
  });

  it("defines a three-line translation-safe quote composition", () => {
    assert.deepEqual([...HUMANITY_UNITY_QUOTE_LINES], [
      "Over time,",
      "love and responsibility",
      "forge humanity",
    ]);
    assert.equal(
      HUMANITY_UNITY_QUOTE,
      "Over time, love and responsibility forge humanity",
    );
    assert.equal(HUMANITY_UNITY_TYPEWRITER_CYCLE_SECONDS, 12);
    assert.equal(HUMANITY_UNITY_BLUE, "#0174b0");

    const quote = readFeature("components/HumanityTypewriterQuote.tsx");
    assert.match(quote, /hero-unity-quote__sr-only/);
    assert.match(quote, /aria-hidden="true"/);
    assert.match(quote, /HUMANITY_UNITY_QUOTE_LINES\.map/);
    assert.match(quote, /hero-unity-quote__line--/);
  });

  it("pins a larger multiline quote near the panel bottom without nowrap clipping", () => {
    const visualCss = readFeature("components/hero-unity-visual.css");
    assert.match(visualCss, /--hero-unity-quote-gap:\s*5px/);
    assert.match(visualCss, /\.hero-unity-quote\s*\{[^}]*bottom:\s*var\(--hero-unity-quote-gap\)/s);
    assert.match(visualCss, /inset-inline:\s*var\(--hero-unity-quote-inline-pad\)/);
    assert.match(visualCss, /font-size:\s*clamp\(1rem,/);
    assert.match(visualCss, /overflow-wrap:\s*anywhere/);
    assert.match(visualCss, /\.hero-unity-quote__line--1\s*\{[^}]*text-align:\s*start/s);
    assert.match(visualCss, /\.hero-unity-quote__line--2\s*\{[^}]*text-align:\s*center/s);
    assert.match(visualCss, /\.hero-unity-quote__line--3\s*\{[^}]*text-align:\s*end/s);
    assert.doesNotMatch(visualCss, /text-align:\s*right/);
    assert.doesNotMatch(visualCss, /\.hero-unity-quote__line[^{]*\{[^}]*white-space:\s*nowrap/s);
    assert.match(visualCss, /hero-unity-quote-line-1/);
    assert.match(visualCss, /padding-inline-end:\s*0\.15em/);
  });

  it("uses the local unity-globe background at full opacity with no continent layer", () => {
    assert.equal(HUMANITY_UNITY_BACKGROUND_SRC, "/illustrations/unity-globe.webp");
    const visual = readFeature("components/HumanityUnityVisual.tsx");
    const globe = readFeature("components/HumanityGlobe.tsx");
    const visualCss = readFeature("components/hero-unity-visual.css");
    const constants = readFeature("hero-unity-visual.constants.ts");

    assert.match(visual, /HUMANITY_UNITY_BACKGROUND_SRC/);
    assert.doesNotMatch(visualCss, /\.hero-unity-visual__background\s*\{[^}]*opacity\s*:/s);
    assert.doesNotMatch(globe, /raw\.githubusercontent\.com/);
    assert.doesNotMatch(globe, /earth_specular_2048/);
    assert.doesNotMatch(globe, /createContinentTexture/);
    assert.doesNotMatch(globe, /CanvasTexture/);
    assert.match(constants, /Continents removed/);
    assert.match(globe, /no continent map/);
  });

  it("reduces globe radius by ~15% from Pack 01", () => {
    assert.equal(HUMANITY_UNITY_GLOBE_RADIUS, 23.8);
    const globe = readFeature("components/HumanityGlobe.tsx");
    assert.match(globe, /GLOBE_RADIUS = HUMANITY_UNITY_GLOBE_RADIUS/);
  });

  it("keeps communication arcs bounded and seeded client-side", () => {
    assert.ok(HUMANITY_UNITY_ARC_COUNT >= 8);
    assert.ok(HUMANITY_UNITY_ARC_COUNT <= 12);
    const globe = readFeature("components/HumanityGlobe.tsx");
    assert.match(globe, /createSeededRandom/);
    assert.match(globe, /"use client"/);
    assert.match(globe, /wireframe:\s*true/);
  });

  it("does not configure page-scroll interception", () => {
    assert.equal(HUMANITY_GLOBE_INTERACTION.enableZoom, false);
    assert.equal(HUMANITY_GLOBE_INTERACTION.captureWheel, false);
    assert.equal(HUMANITY_GLOBE_INTERACTION.enableOrbitControls, false);
    assert.equal(HUMANITY_GLOBE_INTERACTION.autoRotate, true);

    const globe = readFeature("components/HumanityGlobe.tsx");
    assert.doesNotMatch(globe, /OrbitControls/);
    assert.match(globe, /pointerEvents = "none"/);
    assert.match(globe, /touch-action: pan-y|touchAction = "pan-y"/);
  });

  it("loads the globe only on the client and skips WebGL ≤768px", () => {
    assert.equal(HUMANITY_UNITY_VISUAL_MIN_WIDTH_PX, 769);
    const visual = readFeature("components/HumanityUnityVisual.tsx");
    assert.match(visual, /dynamic\(/);
    assert.match(visual, /ssr:\s*false/);
    assert.match(visual, /HumanityGlobe/);
    assert.match(visual, /min-width:\s*769px/);
    assert.match(visual, /mountGlobe/);
  });

  it("hides the visual panel at max-width 768px and collapses the hero column", () => {
    const css = readFeature("public-home-v2.css");
    const visualCss = readFeature("components/hero-unity-visual.css");
    assert.match(css, /grid-template-columns:\s*minmax\(0,\s*3fr\)\s*minmax\(0,\s*2fr\)/);
    assert.match(css, /@media \(max-width: 768px\)/);
    assert.match(css, /\.public-home-v2__hero-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
    assert.match(css, /\.public-home-v2__hero-visual\s*\{[^}]*display:\s*none/s);
    assert.match(visualCss, /@media \(max-width: 768px\)/);
    assert.match(visualCss, /\.hero-unity-visual\s*\{[^}]*display:\s*none/s);
    assert.match(visualCss, /prefers-reduced-motion:\s*reduce/);
    assert.match(visualCss, /animation:\s*none/);
  });

  it("keeps WebGL optional with atmospheric fallback image", () => {
    const globe = readFeature("components/HumanityGlobe.tsx");
    const visual = readFeature("components/HumanityUnityVisual.tsx");
    assert.match(globe, /supportsWebGl/);
    assert.match(globe, /return null/);
    assert.match(visual, /hero-unity-visual__background/);
    assert.match(visual, /HumanityTypewriterQuote/);
  });
});
