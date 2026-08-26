/**
 * Home Hero honeycomb full open / full close cycle — focused tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  HERO_HEX_DRAW_OVERLAP,
  HERO_HEX_SCALE_EPSILON,
  HERO_QUOTE_CYCLE_MS,
  HERO_QUOTE_MASK_PHASES,
  buildHeroHexField,
  heroQuoteHexCellScale,
  heroQuoteHexClearFraction,
  heroQuoteHexCoverageFraction,
  heroQuoteHexIsFullyClosed,
  heroQuoteHexIsFullyOpen,
  heroQuoteIsSwapWindow,
} from "./hero-hex-matrix.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function readFeature(relativePath: string): string {
  return readFileSync(path.join(here, relativePath), "utf8");
}

describe("Home Hero honeycomb full open / full close cycle", () => {
  const field = buildHeroHexField({ width: 520, height: 400, seed: 11 });
  const maxBoost = new Map(field.clusters.map((c) => [c.id, 1] as const));

  it("1 — cycle starts fully closed", () => {
    const ms = HERO_QUOTE_CYCLE_MS * 0.05;
    assert.equal(heroQuoteHexIsFullyClosed(field, ms), true);
    assert.equal(heroQuoteHexCoverageFraction(field, ms), 1);
  });

  it("2 — all cells scale 1 in closed state", () => {
    const ms = HERO_QUOTE_CYCLE_MS * 0.1;
    for (const cell of field.cells) {
      assert.equal(
        heroQuoteHexCellScale(cell, field.clusters[cell.clusterId]!, ms),
        1,
      );
    }
  });

  it("3 — reveal progressively decreases cell scale", () => {
    const cell = field.cells.find((c) => c.revealAt > 0.4 && c.revealAt < 0.6)!;
    const cluster = field.clusters[cell.clusterId]!;
    const a = heroQuoteHexCellScale(cell, cluster, HERO_QUOTE_CYCLE_MS * 0.16);
    const b = heroQuoteHexCellScale(cell, cluster, HERO_QUOTE_CYCLE_MS * 0.26);
    assert.ok(a > b);
    assert.ok(b < 1);
  });

  it("4 — all cells reach zero by full-open phase", () => {
    const mid =
      HERO_QUOTE_CYCLE_MS *
      ((HERO_QUOTE_MASK_PHASES.openEnd + HERO_QUOTE_MASK_PHASES.readableEnd) / 2);
    assert.equal(heroQuoteHexIsFullyOpen(field, mid), true);
    assert.equal(heroQuoteHexIsFullyOpen(field, mid, maxBoost), true);
  });

  it("5 — zero-scale cells are not drawn", () => {
    const visual = readFeature("components/HeroQuoteHoneycombVisual.tsx");
    const matrix = readFeature("hero-hex-matrix.ts");
    assert.match(visual, /HERO_HEX_SCALE_EPSILON/);
    assert.match(matrix, /scale < HERO_HEX_SCALE_EPSILON/);
    assert.ok(HERO_HEX_SCALE_EPSILON <= 0.02);
  });

  it("6 — no persistent cells remain during readable hold", () => {
    const matrix = readFeature("hero-hex-matrix.ts");
    assert.doesNotMatch(matrix, /persistent:/);
    assert.doesNotMatch(matrix, /cell\.persistent/);
    const mid =
      HERO_QUOTE_CYCLE_MS *
      ((HERO_QUOTE_MASK_PHASES.openEnd + HERO_QUOTE_MASK_PHASES.readableEnd) / 2);
    assert.equal(heroQuoteHexCoverageFraction(field, mid), 0);
  });

  it("7 — quote is fully unobstructed during readable hold", () => {
    const mid =
      HERO_QUOTE_CYCLE_MS *
      ((HERO_QUOTE_MASK_PHASES.openEnd + HERO_QUOTE_MASK_PHASES.readableEnd) / 2);
    assert.equal(heroQuoteHexClearFraction(field, mid), 1);
  });

  it("8 — readable hold has measurable duration", () => {
    const hold =
      HERO_QUOTE_MASK_PHASES.readableEnd - HERO_QUOTE_MASK_PHASES.openEnd;
    assert.ok(hold >= 0.25);
    assert.ok(hold * HERO_QUOTE_CYCLE_MS >= 3_000);
  });

  it("9 — closing progressively grows cells", () => {
    const cell = field.cells.find((c) => c.growAt > 0.3 && c.growAt < 0.55)!;
    const cluster = field.clusters[cell.clusterId]!;
    const a = heroQuoteHexCellScale(cell, cluster, HERO_QUOTE_CYCLE_MS * 0.66);
    const b = heroQuoteHexCellScale(cell, cluster, HERO_QUOTE_CYCLE_MS * 0.78);
    assert.ok(b > a);
  });

  it("10 — grow order differs from reveal order", () => {
    let nearReverse = 0;
    for (const cell of field.cells) {
      if (Math.abs(cell.growAt - (1 - cell.revealAt)) < 0.08) {
        nearReverse += 1;
      }
    }
    assert.ok(nearReverse / field.cells.length < 0.35);
  });

  it("11 — all cells return to scale 1", () => {
    const ms = HERO_QUOTE_CYCLE_MS * 0.9;
    assert.equal(heroQuoteHexIsFullyClosed(field, ms), true);
    assert.equal(heroQuoteHexIsFullyClosed(field, ms, maxBoost), true);
  });

  it("12 — full close occurs before quote swap", () => {
    assert.equal(HERO_QUOTE_MASK_PHASES.closeEnd, 0.85);
    const justBefore = HERO_QUOTE_CYCLE_MS * (HERO_QUOTE_MASK_PHASES.closeEnd - 0.001);
    const justAfter = HERO_QUOTE_CYCLE_MS * (HERO_QUOTE_MASK_PHASES.closeEnd + 0.001);
    // By closeEnd every cell must already be fully grown.
    assert.equal(heroQuoteHexIsFullyClosed(field, justBefore), true);
    assert.equal(heroQuoteHexIsFullyClosed(field, justAfter), true);
  });

  it("13 — quote swap happens while 100% covered", () => {
    const swapMs = HERO_QUOTE_CYCLE_MS * 0.92;
    assert.equal(heroQuoteIsSwapWindow(swapMs), true);
    assert.equal(heroQuoteHexCoverageFraction(field, swapMs), 1);
  });

  it("14 — next quote begins behind closed mask", () => {
    const wrap = HERO_QUOTE_CYCLE_MS * 0.02;
    assert.equal(heroQuoteHexIsFullyClosed(field, wrap), true);
    assert.equal(heroQuoteIsSwapWindow(HERO_QUOTE_CYCLE_MS * 0.99), true);
  });

  it("15 — no quote opacity/fade animation returns", () => {
    const css = readFeature("components/hero-unity-visual.css");
    assert.doesNotMatch(css, /@keyframes\s+hero-unity-quote-line/);
    assert.match(css, /\.hero-unity-quote__line\s*\{[^}]*opacity:\s*1/s);
  });

  it("16 — signal points remain top layer", () => {
    const css = readFeature("components/hero-unity-visual.css");
    assert.match(
      css,
      /\.hero-quote-honeycomb__layer--signals\s*\{[^}]*z-index:\s*3/s,
    );
  });

  it("17 — signals do not prevent full-open/full-close", () => {
    const openMs =
      HERO_QUOTE_CYCLE_MS *
      ((HERO_QUOTE_MASK_PHASES.openEnd + HERO_QUOTE_MASK_PHASES.readableEnd) / 2);
    const closeMs = HERO_QUOTE_CYCLE_MS * 0.9;
    assert.equal(heroQuoteHexIsFullyOpen(field, openMs, maxBoost), true);
    assert.equal(heroQuoteHexIsFullyClosed(field, closeMs, maxBoost), true);
  });

  it("18 — reduced-motion quote remains fully readable", () => {
    const visual = readFeature("components/HeroQuoteHoneycombVisual.tsx");
    assert.match(visual, /paintStaticReducedMask/);
    assert.match(visual, /clearRect/);
    assert.doesNotMatch(
      visual,
      /paintStaticReducedMask[\s\S]*drawHeroHexCell/,
    );
  });

  it("19 — seam coverage prevents text leaks in closed state", () => {
    assert.ok(HERO_HEX_DRAW_OVERLAP >= 1.1);
    const matrix = readFeature("hero-hex-matrix.ts");
    assert.match(matrix, /HERO_HEX_DRAW_OVERLAP/);
  });

  it("20 — Home Hero regressions remain green", () => {
    const hero = readFeature("components/PublicHomeHeroSection.tsx");
    assert.match(hero, /public-home-hero-title/);
    assert.match(hero, /PublicHomeCreateInitiativeCta/);
    assert.equal(HERO_QUOTE_MASK_PHASES.closedHoldEnd, 0.15);
    assert.equal(HERO_QUOTE_MASK_PHASES.openEnd, 0.35);
    assert.equal(HERO_QUOTE_MASK_PHASES.readableEnd, 0.65);
    assert.equal(HERO_QUOTE_MASK_PHASES.closeEnd, 0.85);
  });
});
