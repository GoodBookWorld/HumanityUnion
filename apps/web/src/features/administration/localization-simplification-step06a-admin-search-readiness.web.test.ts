/**
 * Localization Simplification Step 06A — Admin Languages wording for Search vs Extended.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function readWeb(rel: string): string {
  return readFileSync(path.join(webRoot, rel), "utf8");
}

describe("Localization Simplification Step 06A — Admin Search vs Extended wording", () => {
  it("Admin Languages distinguishes Enabled, Search, SEO, and Extended Localization", () => {
    const src = readWeb(
      "src/features/administration/components/AdminLanguagesSection.tsx",
    );
    assert.match(src, /Basic language\s+availability \(Enabled\)/);
    assert.match(src, /Search capability/);
    assert.match(src, /Extended Localization/);
    assert.match(src, /does not block Search readiness or SEO/);
    assert.match(src, /Search-ready=/);
    assert.match(src, /SEO indexable=/);
    assert.doesNotMatch(src, /SEO-ready=/);
    assert.doesNotMatch(src, /\b(?:ka|he)\b/);
  });
});
