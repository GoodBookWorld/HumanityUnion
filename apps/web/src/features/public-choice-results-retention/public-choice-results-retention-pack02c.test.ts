/**
 * Public Choice Pack 02C — web presentation contracts (Pack 03 realigned).
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
  it("election page is results-only; candidate intake lives on Overview", () => {
    const page = read(
      "features/public-initiative-experience/components/PublicChoiceElectionPage.tsx",
    );
    const overview = read(
      "features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    assert.doesNotMatch(page, /\+ Add candidate|buildPublicChoiceCandidateSubmitHref/);
    assert.doesNotMatch(page, /placeholderCount/);
    assert.match(page, /Add candidates from the Initiative Overview|Overview/);
    assert.match(overview, /Add candidate/);
    assert.match(overview, /buildPublicChoiceCandidateSubmitHref|openSubmit|setShowSubmit/);
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

  it("PUBLIC_CHOICE SELECT_ONE hides Initiative Support; Candidates widget remains", () => {
    const sidebar = read(
      "features/public-initiative-experience/components/PublicExperienceSidebar.tsx",
    );
    assert.match(sidebar, /PublicInitiativeSupportStatistics/);
    assert.match(sidebar, /PublicChoiceElectionSidebarWidget/);
    assert.match(sidebar, /hideSupportForSelectOne/);
    assert.match(sidebar, /SELECT_ONE_CANDIDATE/);
  });
});
