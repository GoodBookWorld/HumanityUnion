/**
 * Public Choice Pack 02C — web presentation contracts (Pack 04 realigned).
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
  it("election page is results-only; candidate intake + Select/Recall live on Overview", () => {
    const page = read(
      "features/public-initiative-experience/components/PublicChoiceElectionPage.tsx",
    );
    const overview = read(
      "features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    const board = read(
      "features/public-choice-candidate/components/PublicChoiceElectionResultsBoard.tsx",
    );
    assert.doesNotMatch(page, /\+ Add candidate|buildPublicChoiceCandidateSubmitHref/);
    assert.doesNotMatch(page, /placeholderCount/);
    assert.match(page, /Vote on Overview|publicChoice\.results\.voteOnOverview|Overview/);
    assert.match(overview, /Add candidate/);
    assert.match(overview, /Select|Recall/);
    assert.match(board, /tally\.percentage/);
  });

  it("progress bars use canonical percentage; abstain separate", () => {
    const board = read(
      "features/public-choice-candidate/components/PublicChoiceElectionResultsBoard.tsx",
    );
    assert.match(board, /tally\.percentage/);
    assert.match(board, /pie-election-results__abstain/);
    assert.match(board, /role="meter"/);
  });

  it("download control and expired state", () => {
    const page = read(
      "features/public-initiative-experience/components/PublicChoiceElectionPage.tsx",
    );
    assert.match(page, /publicChoice\.results\.download|publicChoice\.results\.preparing/);
    assert.match(page, /downloadPublicChoiceResultsPdf/);
    assert.match(page, /publicChoice\.election\.resultsExpiredTitle/);
  });

  it("PUBLIC_CHOICE hides Initiative Support; Candidates widget remains", () => {
    const sidebar = read(
      "features/public-initiative-experience/components/PublicExperienceSidebar.tsx",
    );
    assert.match(sidebar, /PublicInitiativeSupportStatistics/);
    assert.match(sidebar, /PublicChoiceElectionSidebarWidget/);
    // Fix 07B — Support omitted via allowlist (not hideInitiativeSupport flag).
    assert.match(sidebar, /resolvePublicChoiceSidebarAllowlist/);
    const pcBlock = sidebar.slice(
      sidebar.indexOf("if (isPublicChoice)"),
      sidebar.indexOf("return (", sidebar.indexOf("if (isPublicChoice)") + 1),
    );
    assert.doesNotMatch(pcBlock, /PublicInitiativeSupportStatistics/);
  });
});
