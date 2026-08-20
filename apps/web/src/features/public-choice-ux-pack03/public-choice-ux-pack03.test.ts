/**
 * Public Choice UX Realignment Pack 03 — presentation contracts.
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

describe("Public Choice UX Pack 03 — creation + Overview intake", () => {
  it("SELECT_ONE helper says create election first; candidates added later", () => {
    const form = read("features/initiatives/components/InitiativeFormFields.tsx");
    assert.match(form, /Create the election first/);
    assert.match(form, /Candidates can be added after the election is published/);
    assert.doesNotMatch(form, /PublicChoiceCandidateManager/);
  });

  it("Overview hosts candidate intake with permanent Add candidate action", () => {
    const overview = read(
      "features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    const center = read(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    assert.match(center, /PublicChoiceOverviewCandidateIntake/);
    assert.match(overview, /Add candidate/);
    assert.match(overview, /openSubmitForm/);
    assert.match(overview, /setShowSubmit\(true\)/);
    assert.doesNotMatch(overview, /location\.reload/);
  });

  it("candidate submit form includes photo input and uses initiative media upload", () => {
    const panel = read(
      "features/public-choice-candidate/components/PublicChoiceCandidateSubmitPanel.tsx",
    );
    assert.match(panel, /type="file"/);
    assert.match(panel, /uploadInitiativeImage/);
    assert.match(panel, /photoUrl/);
    assert.match(panel, /Campaign page/);
  });

  it("successful add navigates to Collective Decision", () => {
    const overview = read(
      "features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    const center = read(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    assert.match(overview, /onSubmittedNavigateToCollectiveDecision/);
    assert.match(center, /collective_decision/);
    assert.match(center, /collective-decision/);
  });

  it("add-candidate href targets Initiative Overview not election results page", () => {
    const routes = read(
      "features/initiative-owner-studio/initiative-experience-routes.ts",
    );
    assert.match(routes, /#add-candidate/);
    assert.doesNotMatch(routes, /\/election#add-candidate/);
  });
});

describe("Public Choice UX Pack 03 — Collective Decision voting", () => {
  it("SELECT_ONE cards use 70/30 layout and Vote / Selected / Change vote", () => {
    const board = read(
      "features/public-choice-candidate/components/PublicChoiceSelectOneVotingBoard.tsx",
    );
    const css = read("features/public-initiative-experience/public-initiative-experience.css");
    assert.match(board, /Change vote/);
    assert.match(board, /Selected/);
    assert.match(board, /"Vote"/);
    assert.match(board, /pc-vote-card--dimmed/);
    assert.match(css, /minmax\(0, 7fr\) minmax\(7rem, 3fr\)/);
    assert.match(css, /--hu-color-accent/);
  });

  it("Collective Decision mounts SELECT_ONE voting board", () => {
    const cd = read(
      "features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionPublicResult.tsx",
    );
    assert.match(cd, /PublicChoiceSelectOneVotingBoard/);
  });

  it("Discussion does not duplicate SELECT_ONE candidate ballot", () => {
    const vote = read(
      "features/public-initiative-experience/components/PublicChoiceDiscussionVotePanel.tsx",
    );
    assert.match(vote, /SELECT_ONE_CANDIDATE/);
    assert.match(vote, /Collective Decision stage/);
  });
});

describe("Public Choice UX Pack 03 — sidebar + election results", () => {
  it("SELECT_ONE PUBLIC_CHOICE hides Initiative Support; Candidates widget first", () => {
    const sidebar = read(
      "features/public-initiative-experience/components/PublicExperienceSidebar.tsx",
    );
    assert.match(sidebar, /hideSupportForSelectOne/);
    assert.match(sidebar, /SELECT_ONE_CANDIDATE/);
    assert.match(sidebar, /PublicChoiceElectionSidebarWidget/);
  });

  it("View election CTA is prominent button treatment", () => {
    const widget = read(
      "features/public-initiative-experience/components/PublicChoiceElectionSidebarWidget.tsx",
    );
    assert.match(widget, /hu-button--primary/);
    assert.match(widget, /View election/);
  });

  it("Election results page has no candidate submission controls", () => {
    const page = read(
      "features/public-initiative-experience/components/PublicChoiceElectionPage.tsx",
    );
    assert.doesNotMatch(page, /PublicChoiceCandidateSubmitPanel/);
    assert.doesNotMatch(page, /\+ Add candidate/);
    assert.doesNotMatch(page, /CandidatePlaceholderRow/);
    assert.doesNotMatch(page, /buildPublicChoiceCandidateSubmitHref/);
    assert.match(page, /Go to Collective Decision to vote|No candidates listed yet/);
  });
});
