/**
 * Home Hero signal field — no Earth GIF / no orbital curves.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

import {
  HUMANITY_UNITY_AMBER,
  HUMANITY_UNITY_SIGNAL_COUNT,
} from "./hero-unity-visual.constants.js";
import {
  HERO_SIGNAL_FIELD,
  buildHeroHexField,
  buildHeroSignalPoints,
  heroSignalPointPosition,
} from "./hero-hex-matrix.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function readFeature(relativePath: string): string {
  return readFileSync(path.join(here, relativePath), "utf8");
}

describe("Home hero quote signals (post Earth/orbit removal)", () => {
  it("earth.gif asset may remain on disk but is unused by Home Hero", () => {
    const asset = path.resolve(here, "../../../public/illustrations/earth.gif");
    // Do not delete the file; only assert hero path no longer references it.
    assert.equal(typeof existsSync(asset), "boolean");
    const globe = readFeature("components/HumanityGlobe.tsx");
    const overlay = readFeature("components/HeroQuoteHoneycombVisual.tsx");
    assert.doesNotMatch(globe, /earth\.gif|HUMANITY_UNITY_EARTH/);
    assert.doesNotMatch(overlay, /earth\.gif|HUMANITY_UNITY_EARTH/);
  });

  it("foreground signal points exist without trajectory lines", () => {
    assert.equal(HUMANITY_UNITY_SIGNAL_COUNT, HERO_SIGNAL_FIELD.desktopCount);
    assert.equal(HUMANITY_UNITY_AMBER, "#ffd250");
    const overlay = readFeature("components/HeroQuoteHoneycombVisual.tsx");
    assert.match(overlay, /hero-quote-honeycomb__signals/);
    assert.doesNotMatch(overlay, /<line|<ellipse|hero-unity-globe__comm/);
  });

  it("signals move asynchronously between anchors", () => {
    const field = buildHeroHexField({ width: 500, height: 380, seed: 4 });
    const points = buildHeroSignalPoints({
      width: 500,
      height: 380,
      clusters: field.clusters,
      seed: 8,
    });
    assert.ok(points.length >= 4);
    const durations = new Set(points.map((p) => Math.round(p.durationMs)));
    assert.ok(durations.size >= 2);
    const p0 = heroSignalPointPosition(points[0]!, 500, 500, 380);
    const p1 = heroSignalPointPosition(points[1]!, 500, 500, 380);
    assert.ok(Math.hypot(p0.x - p1.x, p0.y - p1.y) > 0.5);
  });

  it("no WebGL / external animation library", () => {
    const overlay = readFeature("components/HeroQuoteHoneycombVisual.tsx");
    assert.doesNotMatch(overlay, /from ["']three["']/);
    assert.doesNotMatch(overlay, /WebGLRenderer|CanvasTexture|PerspectiveCamera/);
  });

  it("no unity-globe.webp in hero stack", () => {
    for (const file of [
      "components/HumanityUnityVisual.tsx",
      "components/HumanityGlobe.tsx",
      "components/HeroQuoteHoneycombVisual.tsx",
      "components/hero-unity-visual.css",
    ]) {
      const src = readFeature(file);
      assert.doesNotMatch(src, /url\([^)]*unity-globe\.webp/);
      assert.doesNotMatch(src, /["'`]\/illustrations\/unity-globe\.webp["'`]/
      );
    }
  });
});
