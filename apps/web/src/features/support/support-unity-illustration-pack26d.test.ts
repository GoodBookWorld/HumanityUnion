/**
 * Pack 26D — Support Humanity Union hero uses /illustrations/unity.webp at ~150% size.
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

describe("Pack 26D — Support unity illustration", () => {
  it("Support Humanity Union hero uses /illustrations/unity.webp", () => {
    assert.equal(SUPPORT_ILLUSTRATIONS.hero, "/illustrations/unity.webp");
    const absolute = path.join(webRoot, "public", "illustrations/unity.webp");
    assert.ok(existsSync(absolute), "unity.webp must exist under public/illustrations");

    const content = read("features/support/components/SupportPageContent.tsx");
    assert.match(content, /SUPPORT_ILLUSTRATIONS\.hero/);
    assert.match(content, /className="support-page__hero-image"/);
    assert.doesNotMatch(content, /https?:\/\/.*unity\.webp/);
  });

  it("retains Support hero semantic structure and decorative alt", () => {
    const content = read("features/support/components/SupportPageContent.tsx");
    assert.match(content, /className="support-page__hero"/);
    assert.match(content, /<h1[^>]*>Support Humanity Union<\/h1>/);
    assert.match(
      content,
      /SUPPORT_ILLUSTRATIONS\.hero[\s\S]{0,120}alt=""[\s\S]{0,80}className="support-page__hero-image"/,
    );
  });

  it("responsive hero sizing is ~150% of prior 18rem with overflow-safe constraints", () => {
    const css = read("features/support/support-page.css");
    assert.match(css, /\.support-page__hero-image[\s\S]*max-width:\s*27rem/);
    assert.match(css, /\.support-page__hero-image[\s\S]*width:\s*100%/);
    assert.match(css, /\.support-page__hero-image[\s\S]*height:\s*auto/);
    assert.match(css, /minmax\(10rem,\s*27rem\)/);
    assert.match(css, /@media \(max-width:\s*767px\)[\s\S]*\.support-page__hero[\s\S]*grid-template-columns:\s*1fr/);
  });

  it("Image intrinsic size is 480×360 (1.5× prior 320×240)", () => {
    const content = read("features/support/components/SupportPageContent.tsx");
    assert.match(content, /width=\{480\}/);
    assert.match(content, /height=\{360\}/);
  });
});
