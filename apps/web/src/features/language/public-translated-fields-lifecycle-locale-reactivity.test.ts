/**
 * Lifecycle presentation locale reactivity — PublicTranslatedFields.
 *
 * Guards the shared defect where Preferred Reading Language stays Ukrainian
 * while CA/IP body stays English after lifecycle navigation until an explicit
 * locale toggle re-runs the resolve effect.
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

  it("does not depend on unstable fieldOrder array identity in the resolve effect", () => {
    assert.match(fields, /fieldOrderSignature/);
    assert.match(fields, /fieldOrder\.join/);
    // Effect deps list must use the signature, not the array prop.
    assert.match(
      fields,
      /readingContext\.ready,\s*\n\s*displayLanguage,\s*\n\s*\]/,
    );
    assert.doesNotMatch(
      fields,
      /displayLanguage,\s*\n\s*fieldOrder,\s*\n\s*\]/,
    );
  });

  it("guards in-flight resolve with a generation counter", () => {
    assert.match(fields, /requestGeneration/);
    assert.match(fields, /generation !== requestGeneration\.current/);
    assert.match(fields, /\+\+requestGeneration\.current/);
  });

  it("skips destructive English reset while reading context is not ready", () => {
    // Early return before setFields(fallback) / English wipe when !ready.
    const readyGate = fields.indexOf("if (!readingContext.ready)");
    const firstSetFields = fields.indexOf("setFields(fallback)");
    assert.ok(readyGate > 0 && firstSetFields > readyGate);
    assert.match(
      fields,
      /if \(!readingContext\.ready\) \{\s*\n\s*return;/,
    );
  });

  it("renders fields as the browser-visible bag (IP incomplete WEB_UI fallback wins)", () => {
    assert.match(fields, /const displayBag = fields/);
    assert.doesNotMatch(
      fields,
      /presentationMode === "localized" \? fields : originalFields/,
    );
    assert.match(
      fields,
      /sourceKind === "improvement_proposal" \? fallback : original/,
    );
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
