/**
 * Pack 08I.2 — brand chrome wrap / LAYOUT_STRESS locale documentation.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Locales used for long-brand / RTL wrap stress checks. */
export const LAYOUT_STRESS_LOCALES = ["en", "uk", "zh-Hant", "ar"] as const;

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

function extractRule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "m"));
  assert.ok(match, `Missing CSS rule for ${selector}`);
  return match[1] ?? "";
}

describe("Pack 08I.2 — brand chrome wrap layout", () => {
  it("documents LAYOUT_STRESS locales en/uk/zh-Hant/ar", () => {
    assert.deepEqual([...LAYOUT_STRESS_LOCALES], ["en", "uk", "zh-Hant", "ar"]);
  });

  it("header brand-name/tagline allow wrap (no nowrap+ellipsis concealment)", () => {
    const css = readWeb("design-system/layout.css");
    const name = extractRule(css, ".humanity-header__brand-name");
    const tagline = extractRule(css, ".humanity-header__tagline");

    assert.match(name, /overflow-wrap:\s*anywhere/);
    assert.match(name, /white-space:\s*normal/);
    assert.doesNotMatch(name, /white-space:\s*nowrap/);
    assert.doesNotMatch(name, /text-overflow:\s*ellipsis/);
    assert.doesNotMatch(name, /overflow:\s*hidden/);

    assert.match(tagline, /overflow-wrap:\s*anywhere/);
    assert.match(tagline, /white-space:\s*normal/);
    assert.doesNotMatch(tagline, /white-space:\s*nowrap/);
    assert.doesNotMatch(tagline, /text-overflow:\s*ellipsis/);
    assert.doesNotMatch(tagline, /overflow:\s*hidden/);
  });

  it("footer brand identity/tagline allow wrap", () => {
    const css = readWeb("features/public-experience/public-experience-footer.css");
    assert.match(
      css,
      /\.public-experience-footer__brand-row\s+\.public-experience-footer__identity\s*\{[^}]*overflow-wrap:\s*anywhere[^}]*white-space:\s*normal/s,
    );
    assert.match(
      css,
      /\.public-experience-footer__brand-row\s+\.public-experience-footer__tagline\s*\{[^}]*overflow-wrap:\s*anywhere[^}]*white-space:\s*normal/s,
    );
  });
});
