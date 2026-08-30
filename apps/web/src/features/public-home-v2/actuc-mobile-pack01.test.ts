/**
 * Production Completion Pack 01 — ACTUC mobile identity row.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webSrc = path.resolve(dir, "../..");

function read(relativePath: string): string {
  return readFileSync(path.join(webSrc, relativePath), "utf8");
}

describe("Production Completion Pack 01 — ACTUC mobile layout", () => {
  it("keeps logo + name in a brand row with slogan below on mobile", () => {
    const section = read("features/public-home-v2/components/PublicHomeActucSection.tsx");
    const css = read("features/public-home-v2/components/actuc-home.css");
    assert.match(section, /actuc-home__brand/);
    assert.match(section, /actuc-home__logo/);
    assert.match(section, /actuc-home__name/);
    assert.match(section, /actuc-home__slogan/);
    assert.match(css, /\.actuc-home__brand\s*\{/);
    assert.match(
      css,
      /@media \(max-width:\s*720px\)[\s\S]*\.actuc-home__identity[\s\S]*flex-direction:\s*column/,
    );
    assert.match(
      css,
      /@media \(max-width:\s*720px\)[\s\S]*\.actuc-home__brand[\s\S]*flex-direction:\s*row/,
    );
  });
});
