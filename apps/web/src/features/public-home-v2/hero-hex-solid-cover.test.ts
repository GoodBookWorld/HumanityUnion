/**
 * Home Hero full-close solid cover — seam-safety layer tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { PUBLIC_HOME_HUMANITY_AI_PRINCIPLE } from "./constants.js";
import {
  HERO_HEX_BACKDROP,
  HERO_QUOTE_CYCLE_MS,
  HERO_QUOTE_MASK_PHASES,
  HERO_QUOTE_SOLID_COVER,
  heroQuoteHexIsFullyClosed,
  heroQuoteIsSwapWindow,
  heroQuoteSolidCoverActive,
  buildHeroHexField,
} from "./hero-hex-matrix.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function readFeature(relativePath: string): string {
  return readFileSync(path.join(here, relativePath), "utf8");
}

describe("Home Hero honeycomb full-close solid cover", () => {
  it("1 — solid cover exists", () => {
    const visual = readFeature("components/HeroQuoteHoneycombVisual.tsx");
    const css = readFeature("components/hero-unity-visual.css");
    assert.match(visual, /hero-quote-honeycomb__layer--solid-cover/);
    assert.match(visual, /data-hero-solid-cover="true"/);
    assert.match(css, /\.hero-quote-honeycomb__layer--solid-cover/);
  });

  it("2 — cover color = #f4f7fa", () => {
    assert.equal(HERO_QUOTE_SOLID_COVER.color, "#f4f7fa");
    assert.equal(HERO_QUOTE_SOLID_COVER.color, HERO_HEX_BACKDROP);
    const css = readFeature("components/hero-unity-visual.css");
    assert.match(
      css,
      /\.hero-quote-honeycomb__layer--solid-cover\s*\{[^}]*background:\s*#f4f7fa/s,
    );
  });

  it("3 — cover activates only after honeycomb reaches full close", () => {
    assert.equal(heroQuoteSolidCoverActive(HERO_QUOTE_CYCLE_MS * 0.5), false);
    assert.equal(heroQuoteSolidCoverActive(HERO_QUOTE_CYCLE_MS * 0.7), false);
    assert.equal(
      heroQuoteSolidCoverActive(HERO_QUOTE_CYCLE_MS * HERO_QUOTE_MASK_PHASES.closeEnd),
      true,
    );
    const field = buildHeroHexField({ width: 480, height: 360, seed: 2 });
    const closedMs = HERO_QUOTE_CYCLE_MS * 0.9;
    assert.equal(heroQuoteHexIsFullyClosed(field, closedMs), true);
    assert.equal(heroQuoteSolidCoverActive(closedMs), true);
  });

  it("4 — cover is fully opaque during closed hold", () => {
    const css = readFeature("components/hero-unity-visual.css");
    assert.match(
      css,
      /data-hero-solid-cover-active="true"\]\s*\{[^}]*opacity:\s*1/s,
    );
    assert.match(
      css,
      /\.hero-quote-honeycomb__layer--solid-cover\s*\{[^}]*opacity:\s*0/s,
    );
  });

  it("5 — quote swap occurs while cover is active", () => {
    const swapMs = HERO_QUOTE_CYCLE_MS * 0.92;
    assert.equal(heroQuoteIsSwapWindow(swapMs), true);
    assert.equal(heroQuoteSolidCoverActive(swapMs), true);
  });

  it("6 — no quote leakage during closed hold", () => {
    // Cover + full hex rebuild both active in closed windows.
    assert.equal(heroQuoteSolidCoverActive(HERO_QUOTE_CYCLE_MS * 0.05), true);
    assert.equal(heroQuoteSolidCoverActive(HERO_QUOTE_CYCLE_MS * 0.9), true);
    const visual = readFeature("components/HeroQuoteHoneycombVisual.tsx");
    assert.match(visual, /syncSolidCover/);
  });

  it("7 — cover remains approximately 1–2 seconds", () => {
    assert.ok(HERO_QUOTE_SOLID_COVER.holdMs >= 1_000);
    assert.ok(HERO_QUOTE_SOLID_COVER.holdMs <= 2_000);
    const holdFromPhases =
      (1 - HERO_QUOTE_MASK_PHASES.closeEnd) * HERO_QUOTE_CYCLE_MS;
    assert.equal(HERO_QUOTE_SOLID_COVER.holdMs, Math.round(holdFromPhases));
  });

  it("8 — cover is removed before next reveal", () => {
    assert.equal(
      heroQuoteSolidCoverActive(
        HERO_QUOTE_CYCLE_MS * HERO_QUOTE_MASK_PHASES.closedHoldEnd,
      ),
      false,
    );
    assert.equal(heroQuoteSolidCoverActive(HERO_QUOTE_CYCLE_MS * 0.2), false);
  });

  it("9 — full-open/readability phase is unaffected", () => {
    const mid =
      HERO_QUOTE_CYCLE_MS *
      ((HERO_QUOTE_MASK_PHASES.openEnd + HERO_QUOTE_MASK_PHASES.readableEnd) / 2);
    assert.equal(heroQuoteSolidCoverActive(mid), false);
  });

  it("10 — honeycomb geometric scale model remains unchanged", () => {
    const matrix = readFeature("hero-hex-matrix.ts");
    assert.match(matrix, /export function heroQuoteHexCellScale/);
    assert.match(matrix, /HERO_HEX_DRAW_OVERLAP/);
  });

  it("11 — no per-cell opacity reveal is reintroduced", () => {
    const matrix = readFeature("hero-hex-matrix.ts");
    const visual = readFeature("components/HeroQuoteHoneycombVisual.tsx");
    assert.doesNotMatch(matrix, /export function heroQuoteHexCellOpacity/);
    assert.doesNotMatch(visual, /rgba\(244,\s*247,\s*250,\s*\$\{/);
  });

  it("12 — signal points remain above solid cover", () => {
    const css = readFeature("components/hero-unity-visual.css");
    assert.match(
      css,
      /\.hero-quote-honeycomb__layer--solid-cover\s*\{[^}]*z-index:\s*2/s,
    );
    assert.match(
      css,
      /\.hero-quote-honeycomb__layer--signals\s*\{[^}]*z-index:\s*3/s,
    );
  });

  it("13 — reduced-motion does not leave cover active", () => {
    const visual = readFeature("components/HeroQuoteHoneycombVisual.tsx");
    assert.match(visual, /syncSolidCover\(cover,\s*0,\s*true\)/);
    assert.match(visual, /!reduced && heroQuoteSolidCoverActive/);
  });

  it("14 — Humanity AI principle line unaffected", () => {
    assert.match(
      PUBLIC_HOME_HUMANITY_AI_PRINCIPLE,
      /We put technology and AI in service of humanity/,
    );
    const page = readFeature("components/PublicHomeV2Page.tsx");
    assert.match(page, /PublicHomeHumanityAiPrinciple/);
  });

  it("15 — Home Hero regressions remain green", () => {
    const hero = readFeature("components/PublicHomeHeroSection.tsx");
    assert.match(hero, /public-home-hero-title/);
    assert.match(hero, /PublicHomeCreateInitiativeCta/);
    const css = readFeature("components/hero-unity-visual.css");
    assert.match(css, /\.hero-quote-honeycomb__layer--mask\s*\{[^}]*z-index:\s*1/s);
  });
});
