/**
 * Home Hero unity visual — quote honeycomb communication regression suite.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { PUBLIC_HOME_HERO } from "./constants.js";
import {
  HUMANITY_GLOBE_INTERACTION,
  HUMANITY_UNITY_AMBER,
  HUMANITY_UNITY_BLUE,
  HUMANITY_UNITY_QUOTE,
  HUMANITY_UNITY_QUOTE_LINES,
  HUMANITY_UNITY_SIGNAL_COUNT,
  HUMANITY_UNITY_TYPEWRITER_CYCLE_SECONDS,
  HUMANITY_UNITY_VISUAL_MIN_WIDTH_PX,
} from "./hero-unity-visual.constants.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function readFeature(relativePath: string): string {
  return readFileSync(path.join(here, relativePath), "utf8");
}

describe("Home Visual Pack — quote honeycomb communication visual", () => {
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
    assert.equal(HUMANITY_UNITY_AMBER, "#ffd250");

    const quote = readFeature("components/HumanityTypewriterQuote.tsx");
    assert.match(quote, /hero-unity-quote__sr-only/);
    assert.match(quote, /aria-hidden="true"/);
    assert.match(quote, /HUMANITY_UNITY_QUOTE_LINES\.map/);
    assert.match(quote, /hero-unity-quote__line--/);
  });

  it("centers a translation-safe multiline quote without nowrap clipping", () => {
    const visualCss = readFeature("components/hero-unity-visual.css");
    assert.match(visualCss, /--hero-unity-quote-gap:\s*5px/);
    assert.match(visualCss, /\.hero-unity-visual__stage\s*\{[^}]*place-items:\s*center/s);
    assert.match(visualCss, /font-size:\s*clamp\(1rem,/);
    assert.match(visualCss, /overflow-wrap:\s*anywhere/);
    assert.match(visualCss, /\.hero-unity-quote__line--1\s*\{[^}]*text-align:\s*start/s);
    assert.match(visualCss, /\.hero-unity-quote__line--2\s*\{[^}]*text-align:\s*center/s);
    assert.match(visualCss, /\.hero-unity-quote__line--3\s*\{[^}]*text-align:\s*end/s);
    assert.doesNotMatch(visualCss, /text-align:\s*right/);
    assert.doesNotMatch(visualCss, /\.hero-unity-quote__line[^{]*\{[^}]*white-space:\s*nowrap/s);
    assert.doesNotMatch(visualCss, /@keyframes\s+hero-unity-quote-line/);
    assert.match(visualCss, /\.hero-unity-quote__line\s*\{[^}]*opacity:\s*1/s);
    assert.match(visualCss, /padding-inline-end:\s*0\.15em/);
  });

  it("does not use earth.gif or unity-globe.webp in the Home Hero", () => {
    const visual = readFeature("components/HumanityUnityVisual.tsx");
    const globe = readFeature("components/HumanityGlobe.tsx");
    const overlay = readFeature("components/HeroQuoteHoneycombVisual.tsx");
    const visualCss = readFeature("components/hero-unity-visual.css");
    const constants = readFeature("hero-unity-visual.constants.ts");

    for (const src of [visual, globe, overlay, visualCss, constants]) {
      assert.doesNotMatch(src, /earth\.gif|HUMANITY_UNITY_EARTH/);
      assert.doesNotMatch(src, /unity-globe\.webp|\/illustrations\/unity-globe/);
    }
    assert.doesNotMatch(visual, /backgroundImage/);
    assert.match(visualCss, /legacy unity globe background removed/);
  });

  it("quote → honeycomb → signals z-stack contract", () => {
    const unity = readFeature("components/HumanityUnityVisual.tsx");
    const css = readFeature("components/hero-unity-visual.css");
    assert.match(unity, /hero-unity-visual__quote-layer/);
    assert.match(unity, /hero-unity-visual__overlay-slot/);
    assert.match(css, /\.hero-unity-visual__quote-layer\s*\{[^}]*z-index:\s*1/s);
    assert.match(css, /\.hero-unity-visual__overlay-slot\s*\{[^}]*z-index:\s*2/s);
    assert.match(css, /\.hero-quote-honeycomb__layer--mask\s*\{[^}]*z-index:\s*1/s);
    assert.match(css, /\.hero-quote-honeycomb__layer--signals\s*\{[^}]*z-index:\s*2/s);
  });

  it("signal points use amber accent without orbital spin", () => {
    const overlay = readFeature("components/HeroQuoteHoneycombVisual.tsx");
    const css = readFeature("components/hero-unity-visual.css");
    assert.match(overlay, /HUMANITY_UNITY_AMBER|hero-quote-honeycomb__signal/);
    assert.match(overlay, /buildHeroSignalPoints|heroSignalPointPosition/);
    assert.doesNotMatch(overlay, /hero-unity-orbit-spin|ellipse/);
    assert.doesNotMatch(css, /hero-unity-orbit-spin/);
    assert.equal(HUMANITY_UNITY_SIGNAL_COUNT, 6);
    assert.doesNotMatch(overlay, /from ["']three["']|WebGLRenderer|PerspectiveCamera/);
    assert.doesNotMatch(overlay, /gsap|framer-motion|anime\.js|lottie/i);
  });

  it("does not configure page-scroll interception", () => {
    assert.equal(HUMANITY_GLOBE_INTERACTION.enableZoom, false);
    assert.equal(HUMANITY_GLOBE_INTERACTION.captureWheel, false);
    assert.equal(HUMANITY_GLOBE_INTERACTION.enableOrbitControls, false);
    assert.equal(HUMANITY_GLOBE_INTERACTION.autoRotate, true);

    const overlay = readFeature("components/HeroQuoteHoneycombVisual.tsx");
    const css = readFeature("components/hero-unity-visual.css");
    assert.doesNotMatch(overlay, /OrbitControls|addEventListener\(["']wheel/);
    assert.match(overlay, /aria-hidden="true"/);
    assert.match(css, /\.hero-quote-honeycomb\s*\{[^}]*pointer-events:\s*none/s);
  });

  it("loads the overlay only on the client and skips ≤768px", () => {
    assert.equal(HUMANITY_UNITY_VISUAL_MIN_WIDTH_PX, 769);
    const visual = readFeature("components/HumanityUnityVisual.tsx");
    assert.match(visual, /dynamic\(/);
    assert.match(visual, /ssr:\s*false/);
    assert.match(visual, /HumanityGlobe/);
    assert.match(visual, /min-width:\s*769px|HUMANITY_UNITY_VISUAL_MIN_WIDTH_PX/);
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

  it("tablet density reduction and reduced-motion freeze motion", () => {
    const css = readFeature("components/hero-unity-visual.css");
    const overlay = readFeature("components/HeroQuoteHoneycombVisual.tsx");
    assert.match(css, /max-width:\s*1100px\)\s*and\s*\(min-width:\s*769px\)/);
    assert.match(css, /prefers-reduced-motion:\s*reduce/);
    assert.match(overlay, /prefers-reduced-motion/);
    assert.match(overlay, /paintStaticReducedMask|reduced/);
  });

  it("keeps atmospheric panel background without legacy globe image", () => {
    const visual = readFeature("components/HumanityUnityVisual.tsx");
    assert.match(visual, /hero-unity-visual__background/);
    assert.match(visual, /HumanityTypewriterQuote/);
    assert.doesNotMatch(visual, /HUMANITY_UNITY_BACKGROUND_SRC/);
  });
});
