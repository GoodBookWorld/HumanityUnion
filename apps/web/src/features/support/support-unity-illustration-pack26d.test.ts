/**
 * Production Completion Pack 01 — Support hero uses globe-hand illustration.
 * Supersedes Pack 26D unity.webp hero requirement for Support page.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { SUPPORT_ILLUSTRATIONS } from "./support.constants.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(here, "../..");
const webRoot = path.resolve(webSrc, "..");

function read(relativeFromWebSrc: string): string {
  return readFileSync(path.join(webSrc, relativeFromWebSrc), "utf8");
}

describe("Production Completion Pack 01 — Support globe-hand hero", () => {
  it("Support Humanity Union hero uses /illustrations/support/globe-hand.webp", () => {
    assert.equal(SUPPORT_ILLUSTRATIONS.hero, "/illustrations/support/globe-hand.webp");
    const absolute = path.join(webRoot, "public", "illustrations/support/globe-hand.webp");
    assert.ok(existsSync(absolute), "globe-hand.webp must exist under public/illustrations/support");

    const content = read("features/support/components/SupportPageContent.tsx");
    assert.match(content, /SUPPORT_ILLUSTRATIONS\.hero/);
    assert.match(content, /className="support-page__hero-image"/);
    assert.doesNotMatch(content, /unity\.webp/);
  });

  it("retains Support hero semantic structure and decorative alt", () => {
    const content = read("features/support/components/SupportPageContent.tsx");
    assert.match(content, /className="support-page__hero"/);
    assert.match(content, /support-page__title/);
    assert.match(content, /t\("title",\s*siteName\)/);
    assert.match(content, /useLocalizedBrand/);
    assert.match(
      content,
      /SUPPORT_ILLUSTRATIONS\.hero[\s\S]{0,120}alt=""[\s\S]{0,80}className="support-page__hero-image"/,
    );
  });

  it("responsive hero sizing remains overflow-safe", () => {
    const css = read("features/support/support-page.css");
    assert.match(css, /\.support-page__hero-image[\s\S]*max-width:\s*var\(--support-hero-media-max/);
    assert.match(css, /--support-hero-media-max:\s*16\.2rem/);
    assert.match(css, /\.support-page__hero-image[\s\S]*width:\s*100%/);
    assert.match(css, /\.support-page__hero-image[\s\S]*height:\s*auto/);
    assert.match(css, /minmax\(6rem,\s*var\(--support-hero-media-max\)\)/);
    assert.match(
      css,
      /@media \(max-width:\s*767px\)[\s\S]*\.support-page__hero[\s\S]*grid-template-columns:\s*1fr/,
    );
  });

  it("Image intrinsic size is 480×360", () => {
    const content = read("features/support/components/SupportPageContent.tsx");
    assert.match(content, /width=\{480\}/);
    assert.match(content, /height=\{360\}/);
  });
});
