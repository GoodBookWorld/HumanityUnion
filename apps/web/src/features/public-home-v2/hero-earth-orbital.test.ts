/**
 * Focused presentation tests — Home hero Earth GIF + orbital communication.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  HUMANITY_UNITY_EARTH_SRC,
  HUMANITY_UNITY_ORBIT_COUNT,
} from "./hero-unity-visual.constants.js";
import { HERO_UNITY_ORBIT_DEFS } from "./components/HumanityGlobe.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function readFeature(relativePath: string): string {
  return readFileSync(path.join(here, relativePath), "utf8");
}

describe("Home hero Earth GIF + orbital communication", () => {
  it("earth.gif path used", () => {
    assert.equal(HUMANITY_UNITY_EARTH_SRC, "/illustrations/earth.gif");
    assert.ok(
      readFileSync(
        path.resolve(here, "../../../public/illustrations/earth.gif"),
      ).byteLength > 0,
    );
    const globe = readFeature("components/HumanityGlobe.tsx");
    assert.match(globe, /HUMANITY_UNITY_EARTH_SRC/);
  });

  it("central Earth layer exists", () => {
    const globe = readFeature("components/HumanityGlobe.tsx");
    const css = readFeature("components/hero-unity-visual.css");
    assert.match(globe, /hero-unity-globe__earth/);
    assert.match(globe, /hero-unity-globe__earth-img/);
    assert.match(css, /object-fit:\s*contain/);
  });

  it("orbital layers exist", () => {
    assert.equal(HUMANITY_UNITY_ORBIT_COUNT, HERO_UNITY_ORBIT_DEFS.length);
    assert.ok(HERO_UNITY_ORBIT_DEFS.length >= 3);
    assert.ok(HERO_UNITY_ORBIT_DEFS.length <= 4);
    const globe = readFeature("components/HumanityGlobe.tsx");
    assert.match(globe, /hero-unity-globe__path/);
    assert.match(globe, /<ellipse/);
  });

  it("front/back layering contract", () => {
    const css = readFeature("components/hero-unity-visual.css");
    assert.match(css, /layer--rear[\s\S]*?z-index:\s*1/);
    assert.match(css, /\.hero-unity-globe__earth\s*\{[^}]*z-index:\s*2/s);
    assert.match(css, /layer--front[\s\S]*?z-index:\s*3/);
  });

  it("signal point animation contract", () => {
    const css = readFeature("components/hero-unity-visual.css");
    assert.match(css, /hero-unity-globe__node/);
    assert.match(css, /hero-unity-orbit-spin/);
    assert.ok(HERO_UNITY_ORBIT_DEFS.every((o) => o.nodes.length >= 1));
    assert.ok(
      new Set(HERO_UNITY_ORBIT_DEFS.map((o) => o.durationSec)).size >= 3,
    );
  });

  it("mobile density — panel hidden ≤768; tablet reduces density", () => {
    const css = readFeature("components/hero-unity-visual.css");
    assert.match(css, /@media \(max-width: 768px\)[\s\S]*\.hero-unity-visual[\s\S]*display:\s*none/);
    assert.match(css, /max-width:\s*1100px\)\s*and\s*\(min-width:\s*769px\)/);
  });

  it("reduced-motion freezes orbits; documents GIF policy", () => {
    const css = readFeature("components/hero-unity-visual.css");
    assert.match(css, /prefers-reduced-motion:\s*reduce/);
    assert.match(css, /animation:\s*none/);
    assert.match(css, /Earth GIF continues native playback/);
  });

  it("no WebGL / external animation library", () => {
    const globe = readFeature("components/HumanityGlobe.tsx");
    assert.doesNotMatch(globe, /from ["']three["']/);
    assert.doesNotMatch(globe, /WebGLRenderer|CanvasTexture|PerspectiveCamera/);
    assert.doesNotMatch(globe, /gsap|framer-motion|@react-spring|lottie|anime\.js/i);
  });

  it("no unity-globe.webp in hero stack", () => {
    const visual = readFeature("components/HumanityUnityVisual.tsx");
    const globe = readFeature("components/HumanityGlobe.tsx");
    const css = readFeature("components/hero-unity-visual.css");
    const constants = readFeature("hero-unity-visual.constants.ts");
    for (const src of [visual, globe, css, constants]) {
      assert.doesNotMatch(src, /url\([^)]*unity-globe\.webp/);
      assert.doesNotMatch(src, /["'`]\/illustrations\/unity-globe\.webp["'`]/);
      assert.doesNotMatch(src, /backgroundImage[\s\S]*unity-globe/);
    }
    assert.match(globe, /earth\.gif|HUMANITY_UNITY_EARTH_SRC/);
  });
});
