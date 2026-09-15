/**
 * Lifecycle presentation locale reactivity — PublicTranslatedFields.
 *
 * Pack 1 (stable browser translation): ordinary public reading no longer applies
 * CT post-mount. Retained checks: stable fieldOrder constants from CA/IP callers.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const webSrc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativeFromFeatures: string): string {
  return readFileSync(path.join(webSrc, relativeFromFeatures), "utf8");
}

describe("PublicTranslatedFields lifecycle locale reactivity", () => {
  const fields = read("language/components/PublicTranslatedFields.tsx");

  it("ordinary reading owns stable fallbackFields without CT apply", () => {
    assert.match(fields, /const fields = fallbackFields/);
    assert.doesNotMatch(fields, /resolveTranslatedContent/);
    assert.doesNotMatch(fields, /setFields\s*\(/);
  });

  it("CA and IP public results pass stable module field-order constants", () => {
    const ca = read(
      "initiative-collaborative-analysis/components/InitiativeCollaborativeAnalysisPublicResult.tsx",
    );
    const ip = read(
      "initiative-improvement-proposals-stage/components/InitiativeImprovementProposalsPublicResult.tsx",
    );
    assert.match(ca, /fieldOrder=\{COLLABORATIVE_ANALYSIS_BROWSER_VISIBLE_PROSE_FIELDS\}/);
    assert.doesNotMatch(ca, /fieldOrder=\{\[\.\.\.COLLABORATIVE_ANALYSIS/);
    assert.match(ip, /fieldOrder=\{IMPROVEMENT_PROPOSAL_BROWSER_VISIBLE_PROSE_FIELDS\}/);
    assert.doesNotMatch(ip, /fieldOrder=\{\[\.\.\.IMPROVEMENT_PROPOSAL/);
  });
});
