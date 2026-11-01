/**
 * SEO-10 — WCAG 2.2 AA contrast and Label in Name (source contracts).
 *
 * Browser-rendered checks live in `seo-a11y-contrast-seo10.playwright.e2e.ts`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(rel: string): string {
  return readFileSync(path.join(webSrc, rel), "utf8");
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function token(tokens: string, name: string): string {
  const match = tokens.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  assert.ok(match?.[1], `${name} must be a 6-digit hex token`);
  return match[1].toLowerCase();
}

/** Declarations of every rule whose selector list ends with `selector`. */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const bodies = [...css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "g"))].map(
    (m) => m[1] ?? "",
  );
  assert.ok(bodies.length > 0, `rule ${selector} must exist`);
  return bodies.join("\n");
}

const AA_NORMAL_TEXT = 4.5;
// Rendered backgrounds measured on Home, /initiatives and /media (SEO-08/SEO-10 audit).
const PAGE_BACKGROUND = "#ffffff";
const HEADER_AND_MUTED_BACKGROUND = "#f4f7fa";

describe("SEO-10 — contrast tokens", () => {
  const tokens = read("design-system/tokens.css");

  it("brand tagline meets AA on the header and footer backgrounds", () => {
    const tagline = token(tokens, "--hu-color-brand-tagline");
    assert.ok(contrastRatio(tagline, HEADER_AND_MUTED_BACKGROUND) >= AA_NORMAL_TEXT);
    assert.ok(contrastRatio(tagline, PAGE_BACKGROUND) >= AA_NORMAL_TEXT);
  });

  it("accent text token meets AA on white and muted surfaces; brand accent is unchanged", () => {
    const accentText = token(tokens, "--hu-color-accent-text");
    assert.ok(contrastRatio(accentText, PAGE_BACKGROUND) >= AA_NORMAL_TEXT);
    assert.ok(contrastRatio(accentText, HEADER_AND_MUTED_BACKGROUND) >= AA_NORMAL_TEXT);
    assert.equal(token(tokens, "--hu-color-accent"), "#df9815");
  });
});

describe("SEO-10 — affected text uses the accessible tokens", () => {
  it("A header tagline", () => {
    const body = ruleBody(read("design-system/layout.css"), ".humanity-header__tagline");
    assert.match(body, /color:\s*var\(--hu-color-brand-tagline\)/);
  });

  it("B footer tagline (both stylesheets that style the footer brand row)", () => {
    for (const rel of [
      "features/public-experience/public-experience-footer.css",
      "features/public-experience/public-experience.css",
    ]) {
      const body = ruleBody(
        read(rel),
        ".public-experience-footer__brand-row .public-experience-footer__tagline",
      );
      assert.match(body, /color:\s*var\(--hu-color-brand-tagline\)/, rel);
      assert.doesNotMatch(body, /#a57979/i, rel);
    }
  });

  it("C section eyebrows never render the brand accent as text", () => {
    const shell = read("features/civic-media-center/media-rail/civic-media-section-shell.css");
    const eyebrowRules = [...shell.matchAll(/([^{}]*__eyebrow[^{}]*)\{([^}]*)\}/g)];
    assert.ok(eyebrowRules.length >= 4);
    for (const [, selector, body] of eyebrowRules) {
      assert.doesNotMatch(body ?? "", /color:\s*var\(--hu-color-accent[,)]/, String(selector));
    }
    const hux = ruleBody(
      read("features/horizontal-experience/hux.css"),
      ".hux-section--education .horizontal-section-shell__eyebrow",
    );
    assert.match(hux, /color:\s*var\(--hu-color-accent-text/);
    const mediaPage = ruleBody(
      read("features/civic-media-center/civic-media-center.css"),
      ".civic-media-page__eyebrow",
    );
    assert.match(mediaPage, /color:\s*var\(--hu-color-accent-text/);
  });

  it("D geographic navigator active and hover scope", () => {
    const css = read("features/public-experience/public-experience.css");
    assert.match(
      ruleBody(css, ".geographic-navigator__scope--active"),
      /color:\s*var\(--hu-color-accent-text/,
    );
    assert.match(
      ruleBody(css, ".geographic-navigator__scope--link:hover"),
      /color:\s*var\(--hu-color-accent-text/,
    );
  });
});

describe("SEO-10 — Label in Name (WCAG 2.5.3)", () => {
  it("E language selector name is the hidden label followed by its visible language", () => {
    const selector = read("features/language/components/LanguageSelector.tsx");
    assert.match(selector, /aria-labelledby=\{`\$\{selectId\}-label \$\{selectId\}`\}/);
    const triggerStart = selector.indexOf("id={selectId}");
    const trigger = selector.slice(triggerStart, selector.indexOf("onKeyDown={onTriggerKeyDown}"));
    assert.ok(triggerStart > 0 && trigger.length > 0, "trigger attributes must be found");
    // An aria-label on the trigger would replace its own content in the self-reference.
    assert.doesNotMatch(trigger, /aria-label=/);
  });

  it("F initiative card links are named by their visible content", () => {
    for (const rel of [
      "features/public-initiative-mini-card/PublicInitiativeMiniCard.tsx",
      "features/initiatives/components/WorldInitiativesPageContent.tsx",
    ]) {
      const source = read(rel);
      const link = source.match(
        /<Link\b[^>]*className="[^"]*initiative-(?:mini-)?card__link"[^>]*>/,
      );
      assert.ok(link, `${rel} must render the card link`);
      assert.doesNotMatch(link[0], /aria-label/, rel);
    }
  });
});
