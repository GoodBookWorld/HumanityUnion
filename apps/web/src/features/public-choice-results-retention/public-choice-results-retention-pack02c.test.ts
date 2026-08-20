/**
 * Public Choice Pack 02C — web presentation contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(dir, "../..");

function read(relativePath: string): string {
  return readFileSync(path.join(webRoot, relativePath), "utf8");
}

describe("Public Choice Pack 02C — web contracts", () => {
  it("placeholder opens candidate submission flow for authenticated Participant", () => {
    const page = read(
      "features/public-initiative-experience/components/PublicChoiceElectionPage.tsx",
    );
    assert.match(page, /buildPublicChoiceCandidatePresentationSlotPlan/);
    assert.match(page, /placeholderCount/);
    assert.match(page, /Add candidate/);
    assert.match(page, /buildPublicChoiceCandidateSubmitHref/);
    assert.match(page, /\/register\?returnTo=/);
  });

  it("progress bars use canonical percentage; abstain separate", () => {
    const page = read(
      "features/public-initiative-experience/components/PublicChoiceElectionPage.tsx",
    );
    assert.match(page, /tally\.percentage/);
    assert.match(page, /pie-election-results__abstain/);
    assert.match(page, /role="meter"/);
  });

  it("download control and expired state", () => {
    const page = read(
      "features/public-initiative-experience/components/PublicChoiceElectionPage.tsx",
    );
    assert.match(page, /Download results/);
    assert.match(page, /downloadPublicChoiceResultsPdf/);
    assert.match(page, /Results no longer available/);
  });

  it("Initiative Support remains first sidebar widget", () => {
    const sidebar = read(
      "features/public-initiative-experience/components/PublicExperienceSidebar.tsx",
    );
    const supportIdx = sidebar.indexOf("PublicInitiativeSupportStatistics");
    const electionIdx = sidebar.indexOf("PublicChoiceElectionSidebarWidget");
    assert.ok(supportIdx >= 0);
    assert.ok(electionIdx > supportIdx);
  });
});
