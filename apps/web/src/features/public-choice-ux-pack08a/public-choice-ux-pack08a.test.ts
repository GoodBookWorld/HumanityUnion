/**
 * Public Choice Fix 08A — web contracts for candidate CRUD + 20 limit.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { PUBLIC_CHOICE_MAX_CANDIDATES } from "@hu/types";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(dir, "../..");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webRoot, relativePath), "utf8");
}

describe("Public Choice Fix 08A — candidate form + Overview", () => {
  it("exports max candidates constant at 20", () => {
    assert.equal(PUBLIC_CHOICE_MAX_CANDIDATES, 20);
  });

  it("Submit panel supports create and edit with 20 helper", () => {
    const form = readWeb(
      "features/public-choice-candidate/components/PublicChoiceCandidateSubmitPanel.tsx",
    );
    assert.match(form, /Up to \{PUBLIC_CHOICE_MAX_CANDIDATES\} candidates can be added/);
    assert.match(form, /candidateCount\} of \{PUBLIC_CHOICE_MAX_CANDIDATES\}/);
    assert.match(form, /isEdit \? "Edit candidate" : "Add a candidate"/);
    assert.match(form, /Save changes/);
    assert.match(form, /Delete candidate\?/);
    assert.match(form, /This candidate will be removed from the election/);
  });

  it("Overview shows Edit for viewerCanManage and hides Add at 20", () => {
    const overview = readWeb(
      "features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    assert.match(overview, /candidate\.viewerCanManage/);
    assert.match(overview, /pc-overview-vote-row__edit/);
    assert.match(overview, /candidates\.length < PUBLIC_CHOICE_MAX_CANDIDATES/);
    assert.match(overview, /reached the maximum of \{PUBLIC_CHOICE_MAX_CANDIDATES\}/);
  });
});
