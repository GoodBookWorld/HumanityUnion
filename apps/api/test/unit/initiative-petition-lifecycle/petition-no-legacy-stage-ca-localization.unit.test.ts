/**
 * Localization repair F — Petition public projection must not import legacy
 * Stage CA store for human-facing localized prose.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectionPath = path.resolve(
  here,
  "../../../src/modules/petition/public-petition.projection.ts",
);

describe("Petition public projection — Stage CA localization guard", () => {
  it("does not import legacy collaborative-analysis.store for public prose", () => {
    const src = readFileSync(projectionPath, "utf8");
    assert.doesNotMatch(src, /from ["'].*collaborative-analysis\.store/);
    assert.doesNotMatch(src, /getAnalysisByInitiativeId\s*\(/);
    assert.match(src, /analysisContextSummary = null/);
    assert.match(src, /participationTransparencyNote:\s*null/);
  });
});
