/**
 * Home Hero Humanity AI principle line — presentation contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  PUBLIC_HOME_HERO,
  PUBLIC_HOME_HUMANITY_AI_PRINCIPLE,
} from "./constants.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function readFeature(relativePath: string): string {
  return readFileSync(path.join(here, relativePath), "utf8");
}

function readTokens(): string {
  return readFileSync(
    path.resolve(here, "../../design-system/tokens.css"),
    "utf8",
  );
}

function readHeaderTaglineCss(): string {
  return readFileSync(
    path.resolve(here, "../../design-system/layout.css"),
    "utf8",
  );
}

describe("Home Humanity AI principle line", () => {
  it("1 — exact sentence exists", () => {
    assert.equal(
      PUBLIC_HOME_HUMANITY_AI_PRINCIPLE,
      "We put technology and AI in service of humanity—to improve life, deepen cooperation, advance progress, and overcome ignorance.",
    );
    const component = readFeature("components/PublicHomeHumanityAiPrinciple.tsx");
    assert.match(component, /useTranslations\("publicHome"\)/);
    assert.match(component, /t\("humanityAiPrinciple"\)/);
    assert.doesNotMatch(component, /PUBLIC_HOME_HUMANITY_AI_PRINCIPLE/);
    assert.doesNotMatch(component, /canvas|img|background-image/i);
  });

  it("2 — placed after Hero and before divider", () => {
    const page = readFeature("components/PublicHomeV2Page.tsx");
    const heroIdx = page.indexOf("<PublicHomeHeroSection");
    const principleIdx = page.indexOf("<PublicHomeHumanityAiPrinciple");
    const nextIdx = page.indexOf("<HumanityUnionInNumbers");
    assert.ok(heroIdx >= 0 && principleIdx > heroIdx && nextIdx > principleIdx);

    const nextSection = readFeature(
      "../platform-statistics/components/HumanityUnionInNumbers.tsx",
    );
    assert.match(nextSection, /public-home-v2__section/);
    const css = readFeature("public-home-v2.css");
    assert.match(
      css,
      /\.public-home-v2__section:not\(\.public-home-v2__hero\)\s*\{[^}]*border-top:\s*1px solid/s,
    );
  });

  it("3 — slogan typography reused", () => {
    const css = readFeature("public-home-v2.css");
    const tagline = readHeaderTaglineCss();
    assert.match(tagline, /\.humanity-header__tagline\s*\{[^}]*font-weight:\s*400/s);
    assert.match(tagline, /\.humanity-header__tagline\s*\{[^}]*letter-spacing:\s*0\.10em/s);
    assert.match(tagline, /\.humanity-header__tagline\s*\{[^}]*font-size:\s*0\.6875rem/s);

    assert.match(
      css,
      /\.public-home-v2__humanity-ai-principle\s*\{[^}]*font-family:\s*var\(--hu-font-family\)/s,
    );
    assert.match(
      css,
      /\.public-home-v2__humanity-ai-principle\s*\{[^}]*font-weight:\s*var\(--hu-font-weight-regular\)/s,
    );
    assert.match(
      css,
      /\.public-home-v2__humanity-ai-principle\s*\{[^}]*letter-spacing:\s*0\.06em/s,
    );
    assert.match(
      css,
      /\.public-home-v2__humanity-ai-principle\s*\{[^}]*clamp\(0\.6875rem/s,
    );
  });

  it("4 — preferred color/token applied", () => {
    const tokens = readTokens();
    assert.match(tokens, /--hu-color-brand-tagline:\s*#a57979/);
    assert.match(tokens, /--hu-color-brand-principle:\s*#8f6666/);
    const css = readFeature("public-home-v2.css");
    assert.match(
      css,
      /\.public-home-v2__humanity-ai-principle\s*\{[^}]*color:\s*var\(--hu-color-brand-principle\)/s,
    );
    assert.doesNotMatch(
      css,
      /\.public-home-v2__humanity-ai-principle\s*\{[^}]*color:\s*#a57979/s,
    );
  });

  it("5 — horizontally centered", () => {
    const css = readFeature("public-home-v2.css");
    assert.match(
      css,
      /\.public-home-v2__humanity-ai-principle\s*\{[^}]*text-align:\s*center/s,
    );
  });

  it("6 — white-space nowrap", () => {
    const css = readFeature("public-home-v2.css");
    assert.match(
      css,
      /\.public-home-v2__humanity-ai-principle\s*\{[^}]*white-space:\s*nowrap/s,
    );
  });

  it("7 — responsive font scaling", () => {
    const css = readFeature("public-home-v2.css");
    assert.match(
      css,
      /\.public-home-v2__humanity-ai-principle\s*\{[^}]*font-size:\s*clamp\(/s,
    );
  });

  it("8 — no word breaking", () => {
    const css = readFeature("public-home-v2.css");
    const block = css.match(
      /\.public-home-v2__humanity-ai-principle\s*\{[^}]+\}/s,
    )?.[0];
    assert.ok(block);
    assert.doesNotMatch(block, /word-break|overflow-wrap:\s*anywhere|hyphens:/);
    const component = readFeature("components/PublicHomeHumanityAiPrinciple.tsx");
    assert.doesNotMatch(component, /<br\s*\/?>/);
  });

  it("9 — hidden on mobile", () => {
    const css = readFeature("public-home-v2.css");
    assert.match(
      css,
      /\.public-home-v2__humanity-ai-principle\s*\{[^}]*display:\s*none/s,
    );
  });

  it("10 — visible at intended tablet/desktop widths", () => {
    const css = readFeature("public-home-v2.css");
    assert.match(
      css,
      /@media \(min-width:\s*900px\)\s*\{[^}]*\.public-home-v2__humanity-ai-principle\s*\{[^}]*display:\s*block/s,
    );
    // Aligns with Home 2-column Hero start.
    assert.match(css, /@media \(min-width: 900px\)/);
  });

  it("11 — no horizontal overflow contract", () => {
    const css = readFeature("public-home-v2.css");
    assert.match(css, /\.public-home-v2\s*\{[^}]*overflow-x:\s*clip/s);
    assert.match(
      css,
      /\.public-home-v2__humanity-ai-principle\s*\{[^}]*max-width:\s*100%/s,
    );
    assert.match(
      css,
      /\.public-home-v2__humanity-ai-principle\s*\{[^}]*padding-inline:\s*var\(--hu-space-4\)/s,
    );
    assert.match(
      css,
      /\.public-home-v2__humanity-ai-principle\s*\{[^}]*overflow-x:\s*clip/s,
    );
  });

  it("12 — no animation", () => {
    const css = readFeature("public-home-v2.css");
    const block = css.match(
      /\.public-home-v2__humanity-ai-principle\s*\{[^}]+\}/s,
    )?.[0];
    assert.ok(block);
    assert.doesNotMatch(block, /animation|@keyframes|transition:/);
  });

  it("13 — Hero/next-section regression", () => {
    assert.equal(PUBLIC_HOME_HERO.primaryCta.label, "Create Initiative");
    const hero = readFeature("components/PublicHomeHeroSection.tsx");
    assert.match(hero, /public-home-v2__section public-home-v2__hero/);
    assert.match(hero, /public-home-hero-title/);
    assert.match(hero, /PublicHomeCreateInitiativeCta/);
    const page = readFeature("components/PublicHomeV2Page.tsx");
    assert.match(page, /HumanityUnionInNumbers/);
    assert.match(page, /PublicHomeCoreValuesSection/);
  });
});
