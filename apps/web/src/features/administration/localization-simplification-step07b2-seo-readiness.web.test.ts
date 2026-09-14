/**
 * Step 07B.2 — Admin Languages wording: SEO indexable ≠ Extended Localization.
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

describe("Step 07B.2 — Admin SEO indexable vs Extended Localization wording", () => {
  it("14. Admin distinguishes SEO indexable from Extended Localization", () => {
    const src = readWeb(
      "src/features/administration/components/AdminLanguagesSection.tsx",
    );
    assert.match(src, /SEO indexable=/);
    assert.doesNotMatch(src, /SEO-ready=/);
    assert.match(src, /Extended Localization/);
    assert.match(src, /does not block Search readiness or SEO\s+indexability/);
    assert.match(src, /SEO indexing/);
    assert.doesNotMatch(src, /SEO requires full|full localization is required for SEO/i);
    assert.doesNotMatch(src, /\b(?:ka|he)\b/);
  });
});
