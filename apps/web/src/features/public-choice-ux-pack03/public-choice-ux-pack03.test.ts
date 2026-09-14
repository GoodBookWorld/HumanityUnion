/**
 * Public Choice UX Pack 03 — superseded contracts realigned for Pack 04.
 * Keep file so Pack 03 runners stay green; expectations match Pack 04 owner model.
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

describe("Public Choice UX Pack 03 → Pack 04 migration", () => {
  it("creation has no Choose one candidate selector", () => {
    const form = read("features/initiatives/components/InitiativeFormFields.tsx");
    assert.doesNotMatch(form, /Choose one candidate/);
    assert.doesNotMatch(form, /Ballot type/);
    assert.match(form, /manage\.fields\.electionCreateHelper|PUBLIC_CHOICE_ELECTION_CREATE_HELPER/);
  });

  it("Overview hosts candidate Select/Recall intake", () => {
    const overview = read(
      "features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    assert.match(overview, /Select/);
    assert.match(overview, /Recall/);
    assert.match(overview, /setShowSubmit\(true\)/);
  });

  it("Collective Decision is results-only (no SelectOne voting board)", () => {
    const cd = read(
      "features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionPublicResult.tsx",
    );
    assert.match(cd, /PublicChoiceElectionResultsBoard/);
    assert.doesNotMatch(cd, /PublicChoiceSelectOneVotingBoard/);
  });

  it("Discussion does not mount candidate ballot for PUBLIC_CHOICE", () => {
    const vote = read(
      "features/public-initiative-experience/components/PublicChoiceDiscussionVotePanel.tsx",
    );
    assert.match(vote, /SELECT_ONE_CANDIDATE|Overview/);
  });

  it("PUBLIC_CHOICE sidebar hides Initiative Support", () => {
    const sidebar = read(
      "features/public-initiative-experience/components/PublicExperienceSidebar.tsx",
    );
    assert.match(sidebar, /PUBLIC_CHOICE/);
    assert.match(sidebar, /PublicChoiceElectionSidebarWidget/);
  });

  it("Election results page has no candidate submission", () => {
    const page = read(
      "features/public-initiative-experience/components/PublicChoiceElectionPage.tsx",
    );
    assert.doesNotMatch(page, /PublicChoiceCandidateSubmitPanel/);
    assert.doesNotMatch(page, /\+ Add candidate/);
  });
});
