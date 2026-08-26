/**
 * Home Hero honeycomb geometric cell dissolve — scale-driven reveal tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  HERO_HEX_BACKDROP,
  HERO_HEX_DRAW_OVERLAP,
  HERO_HEX_SCALE_EPSILON,
  HERO_QUOTE_CYCLE_MS,
  HERO_QUOTE_MASK_COVERAGE,
  HERO_QUOTE_MASK_PHASES,
  HERO_QUOTE_READABLE_CLEAR_FRACTION,
  buildHeroHexField,
  heroClusterOpenAmount,
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

describe("Home Hero honeycomb geometric cell dissolve", () => {
  it("1 — quote stays opacity 1", () => {
    const css = readFeature("components/hero-unity-visual.css");
    assert.match(css, /\.hero-unity-quote__line\s*\{[^}]*opacity:\s*1/s);
    assert.doesNotMatch(css, /@keyframes\s+hero-unity-quote-line/);
  });

  it("2 — honeycomb owns quote visibility", () => {
    const visual = readFeature("components/HeroQuoteHoneycombVisual.tsx");
    assert.match(visual, /heroQuoteHexCellScale/);
    assert.match(visual, /drawHeroHexCell/);
    assert.doesNotMatch(visual, /heroQuoteHexCellOpacity/);
  });

  it("3 — cell reveal is driven by scale, not opacity", () => {
    const matrix = readFeature("hero-hex-matrix.ts");
    const visual = readFeature("components/HeroQuoteHoneycombVisual.tsx");
    assert.match(matrix, /export function heroQuoteHexCellScale/);
    assert.doesNotMatch(matrix, /export function heroQuoteHexCellOpacity/);
    assert.match(visual, /HERO_HEX_BACKDROP/);
    assert.doesNotMatch(visual, /rgba\(244,\s*247,\s*250,\s*\$\{/);
  });

  it("4 — full cell uses scale 1", () => {
    const field = buildHeroHexField({ width: 480, height: 360, seed: 2 });
    const early = HERO_QUOTE_CYCLE_MS * 0.05;
    const full = field.cells[0]!;
    const scale = heroQuoteHexCellScale(full, field.clusters[full.clusterId]!, early);
    assert.equal(scale, 1);
  });

  it("5 — hidden cell uses scale 0", () => {
    const field = buildHeroHexField({ width: 480, height: 360, seed: 2 });
    const mid = HERO_QUOTE_CYCLE_MS * 0.5;
    const gone = field.cells[0]!;
    const scale = heroQuoteHexCellScale(gone, field.clusters[gone.clusterId]!, mid);
    assert.equal(scale, 0);
  });

  it("6 — hidden cell is skipped/not drawn", () => {
    const visual = readFeature("components/HeroQuoteHoneycombVisual.tsx");
    const matrix = readFeature("hero-hex-matrix.ts");
    assert.match(visual, /HERO_HEX_SCALE_EPSILON/);
    assert.match(matrix, /scale < HERO_HEX_SCALE_EPSILON/);
    assert.ok(HERO_HEX_SCALE_EPSILON <= 0.02);
  });

  it("7 — shrinking changes polygon radius", () => {
    const field = buildHeroHexField({ width: 520, height: 400, seed: 4 });
    const cell = field.cells.find((c) => c.revealAt > 0.4 && c.revealAt < 0.55)!;
    const cluster = field.clusters[cell.clusterId]!;
    const sBefore = heroQuoteHexCellScale(cell, cluster, HERO_QUOTE_CYCLE_MS * 0.16);
    const sDuring = heroQuoteHexCellScale(cell, cluster, HERO_QUOTE_CYCLE_MS * 0.26);
    const sAfter = heroQuoteHexCellScale(cell, cluster, HERO_QUOTE_CYCLE_MS * 0.5);
    assert.equal(sBefore, 1);
    assert.ok(sDuring < 1);
    assert.ok(sDuring > 0);
    assert.equal(sAfter, 0);
    const matrix = readFeature("hero-hex-matrix.ts");
    assert.match(matrix, /HERO_HEX_DRAW_OVERLAP \* scale/);
  });

  it("8 — growing changes polygon radius", () => {
    const field = buildHeroHexField({ width: 520, height: 400, seed: 4 });
    const cell = field.cells.find((c) => c.growAt > 0.2 && c.growAt < 0.6)!;
    const cluster = field.clusters[cell.clusterId]!;
    const sHold = heroQuoteHexCellScale(cell, cluster, HERO_QUOTE_CYCLE_MS * 0.5);
    const sGrow = heroQuoteHexCellScale(cell, cluster, HERO_QUOTE_CYCLE_MS * 0.75);
    assert.equal(sHold, 0);
    assert.ok(sGrow > 0);
  });

  it("9 — cells shrink toward their own centers", () => {
    const matrix = readFeature("hero-hex-matrix.ts");
    assert.match(matrix, /scaled about its center|cell\.cx|cell\.cy/);
    assert.doesNotMatch(matrix, /translate\(|left:\s*0|top:\s*0/);
  });

  it("10 — pseudo-random reveal ordering", () => {
    const a = buildHeroHexField({ width: 400, height: 300, seed: 1 });
    const b = buildHeroHexField({ width: 400, height: 300, seed: 1 });
    assert.deepEqual(
      a.cells.map((c) => c.revealAt),
      b.cells.map((c) => c.revealAt),
    );
    const c = buildHeroHexField({ width: 400, height: 300, seed: 99 });
    assert.notDeepEqual(
      a.cells.map((x) => x.revealAt),
      c.cells.map((x) => x.revealAt),
    );
  });

  it("11 — local cluster timing", () => {
    const field = buildHeroHexField({ width: 480, height: 360, seed: 7 });
    const opens = field.clusters.map((cl) => heroClusterOpenAmount(cl, 0.25));
    assert.ok(Math.max(...opens) - Math.min(...opens) > 0.04);
  });

  it("12 — readable phase has mostly absent cells", () => {
    const field = buildHeroHexField({ width: 520, height: 400, seed: 11 });
    const mid =
      HERO_QUOTE_CYCLE_MS *
      ((HERO_QUOTE_MASK_PHASES.openEnd + HERO_QUOTE_MASK_PHASES.readableEnd) / 2);
    assert.equal(heroQuoteHexIsFullyOpen(field, mid), true);
    assert.equal(heroQuoteHexClearFraction(field, mid), HERO_QUOTE_READABLE_CLEAR_FRACTION.min);
  });

  it("13 — closing phase grows cells back", () => {
    const field = buildHeroHexField({ width: 520, height: 400, seed: 3 });
    const readable = HERO_QUOTE_CYCLE_MS * 0.5;
    const closing = HERO_QUOTE_CYCLE_MS * 0.75;
    assert.ok(
      heroQuoteHexCoverageFraction(field, closing) >
        heroQuoteHexCoverageFraction(field, readable) + 0.2,
    );
  });

  it("14 — closing order is not exact reveal reverse", () => {
    const field = buildHeroHexField({ width: 480, height: 360, seed: 8 });
    let nearReverse = 0;
    for (const cell of field.cells) {
      if (Math.abs(cell.growAt - (1 - cell.revealAt)) < 0.08) {
        nearReverse += 1;
      }
    }
    assert.ok(nearReverse / field.cells.length < 0.35);
  });

  it("15 — quote swap occurs behind rebuilt mask", () => {
    const field = buildHeroHexField({ width: 520, height: 400, seed: 5 });
    const swapMs = HERO_QUOTE_CYCLE_MS * 0.92;
    assert.equal(heroQuoteIsSwapWindow(swapMs), true);
    assert.equal(heroQuoteHexIsFullyClosed(field, swapMs), true);
    assert.equal(heroQuoteHexCoverageFraction(field, swapMs), HERO_QUOTE_MASK_COVERAGE.swapMin);
  });

  it("16 — signal points remain top layer", () => {
    const css = readFeature("components/hero-unity-visual.css");
    assert.match(
      css,
      /\.hero-quote-honeycomb__layer--signals\s*\{[^}]*z-index:\s*3/s,
    );
  });

  it("17 — reduced-motion has no shrink/grow animation", () => {
    const visual = readFeature("components/HeroQuoteHoneycombVisual.tsx");
    assert.match(visual, /paintStaticReducedMask/);
    assert.match(visual, /prefers-reduced-motion/);
    assert.doesNotMatch(visual, /paintStaticReducedMask[\s\S]*drawHeroHexCell/);
  });

  it("18 — no WebGL/Three/external animation dependency", () => {
    for (const file of [
      "hero-hex-matrix.ts",
      "components/HeroQuoteHoneycombVisual.tsx",
    ]) {
      const src = readFeature(file);
      assert.doesNotMatch(src, /from ["']three["']/);
      assert.doesNotMatch(src, /WebGLRenderer|gsap|framer-motion/i);
    }
  });

  it("19 — cleanup remains correct", () => {
    const visual = readFeature("components/HeroQuoteHoneycombVisual.tsx");
    assert.match(visual, /cancelAnimationFrame/);
    assert.match(visual, /removeEventListener\("resize"/);
  });

  it("20 — Home Hero regressions remain green", () => {
    const hero = readFeature("components/PublicHomeHeroSection.tsx");
    assert.match(hero, /public-home-hero-title/);
    assert.match(hero, /PublicHomeCreateInitiativeCta/);
    assert.equal(HERO_HEX_BACKDROP, "#f4f7fa");
    assert.ok(HERO_HEX_DRAW_OVERLAP >= 1.1);
    const early = buildHeroHexField({ width: 520, height: 400, seed: 11 });
    assert.equal(
      heroQuoteHexIsFullyClosed(early, HERO_QUOTE_CYCLE_MS * 0.08),
      true,
    );
  });
});
