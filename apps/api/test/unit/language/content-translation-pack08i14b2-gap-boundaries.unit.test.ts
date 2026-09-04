/**
 * Pack 08I.14B.2 — API-side boundary notes for Live warm completion gaps.
 * Diagnosis only: prove enumerator kinds + resolve presentation modes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

function readApi(relative: string): string {
  return readFileSync(path.resolve(here, "../../../", relative), "utf8");
}

describe("Pack 08I.14B.2 — warm discovery kinds cover Live gaps", () => {
  it("staging warm enumerator includes initiative/CA/petition/discussion_comment", () => {
    const mod = readApi(
      "src/modules/language/content-translation-staging-warm-backfill.ts",
    );
    assert.match(mod, /"initiative"/);
    assert.match(mod, /"collaborative_analysis"/);
    assert.match(mod, /"petition"/);
    assert.match(mod, /"discussion_comment"/);
    assert.match(mod, /bootstrapMongoPersistence|SOURCE_RECORDS_DISCOVERED|sourceRecordsDiscovered/);
  });

  it("warm script still bootstraps persistence before enumeration", () => {
    const script = readApi("src/scripts/warm-staging-content-translations.ts");
    assert.match(script, /bootstrapMongoPersistence/);
    assert.match(script, /SOURCE_RECORDS_DISCOVERED/);
    assert.match(script, /WARM_REQUEST_CANDIDATES/);
  });

  it("CA and Petition loaders remain eligible public sourceKinds", () => {
    const eligibility = readApi("src/modules/language/content-translation-eligibility.ts");
    assert.match(eligibility, /collaborative_analysis:/);
    assert.match(eligibility, /petition:/);
    assert.match(eligibility, /discussion_comment:\s*\[\s*"body"\s*\]/);
  });
});
