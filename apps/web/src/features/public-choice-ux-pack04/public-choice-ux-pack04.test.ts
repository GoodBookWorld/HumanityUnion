/**
 * Public Choice Election Consolidation Pack 04 — presentation contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_PUBLIC_CHOICE_BALLOT_MODE,
  getInitiativeLifecycleProfilePresentation,
  isPublicChoiceCandidateElectionBallot,
  PUBLIC_CHOICE_ELECTION_CREATE_HELPER,
  resolvePublicChoiceElectionVotingStatus,
} from "@hu/types";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(dir, "../..");

function read(relativePath: string): string {
  return readFileSync(path.join(webRoot, relativePath), "utf8");
}

describe("Public Choice Pack 04 — creation + defaults", () => {
  it("defaults to SELECT_ONE_CANDIDATE and exposes election create helper", () => {
    assert.equal(DEFAULT_PUBLIC_CHOICE_BALLOT_MODE, "SELECT_ONE_CANDIDATE");
    assert.match(PUBLIC_CHOICE_ELECTION_CREATE_HELPER, /Create the election first/);
    assert.equal(isPublicChoiceCandidateElectionBallot("SELECT_ONE_CANDIDATE"), true);
    assert.equal(isPublicChoiceCandidateElectionBallot("SUPPORT_OPPOSE"), false);
  });

  it("creation form has no Choose one candidate / ballot selector", () => {
    const form = read("features/initiatives/components/InitiativeFormFields.tsx");
    assert.doesNotMatch(form, /Choose one candidate/);
    assert.doesNotMatch(form, /Ballot type/);
    assert.doesNotMatch(form, /Support \/ Oppose/);
    assert.match(form, /manage\.fields\.electionCreateHelper|PUBLIC_CHOICE_ELECTION_CREATE_HELPER/);
    assert.match(form, /manage\.fields\.startOfVoting|Start of Voting/);
    assert.match(form, /manage\.fields\.endOfVoting|End of Voting/);
  });

  it("PUBLIC_CHOICE presentation hides Discussion ballot", () => {
    const pc = getInitiativeLifecycleProfilePresentation("PUBLIC_CHOICE");
    assert.equal(pc.discussionShowsVoteBallot, false);
    assert.equal(pc.collectiveDecisionIsResultOnly, true);
    const standard = getInitiativeLifecycleProfilePresentation("STANDARD");
    assert.equal(standard.discussionShowsVoteBallot, false);
    assert.equal(standard.discussionShowsStandardParticipationActions, true);
  });
});

describe("Public Choice Pack 04 — Overview Select/Recall", () => {
  it("Overview hosts Select/Recall and auth-only Add candidate", () => {
    const overview = read(
      "features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    const center = read(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    assert.match(center, /PublicChoiceOverviewCandidateIntake/);
    assert.match(center, /!presentation\.isPublicChoice/);
    assert.match(overview, /\bSelect\b/);
    assert.match(overview, /\bRecall\b/);
    assert.match(overview, /authenticated/);
    assert.doesNotMatch(overview, /onSubmittedNavigateToCollectiveDecision/);
    assert.doesNotMatch(overview, /Do not support/);
  });

  it("Public Choice Overview skips pie-overview section/grid", () => {
    const center = read(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    assert.match(center, /!presentation\.isPublicChoice \? \(/);
  });
});

describe("Public Choice Pack 04 — CD results + sidebar + election", () => {
  it("Collective Decision mounts shared results board not voting board", () => {
    const cd = read(
      "features/initiative-collective-decision-lifecycle/components/InitiativeCollectiveDecisionPublicResult.tsx",
    );
    assert.match(cd, /PublicChoiceElectionResultsBoard/);
    assert.doesNotMatch(cd, /PublicChoiceSelectOneVotingBoard/);
    assert.doesNotMatch(cd, /PublicChoiceDiscussionVotePanel/);
  });

  it("sidebar hides Initiative Support for all PUBLIC_CHOICE", () => {
    const sidebar = read(
      "features/public-initiative-experience/components/PublicExperienceSidebar.tsx",
    );
    assert.match(sidebar, /resolvePublicChoiceSidebarAllowlist/);
    assert.match(sidebar, /PUBLIC_CHOICE/);
    assert.match(sidebar, /PublicChoiceElectionSidebarWidget/);
    const pcBlock = sidebar.slice(
      sidebar.indexOf("if (isPublicChoice)"),
      sidebar.indexOf("return (", sidebar.indexOf("if (isPublicChoice)") + 1),
    );
    assert.doesNotMatch(pcBlock, /PublicInitiativeSupportStatistics/);
  });

  it("Election page has 40/60 intro, Download, Share, no Add candidate", () => {
    const page = read(
      "features/public-initiative-experience/components/PublicChoiceElectionPage.tsx",
    );
    assert.match(page, /pie-election-page__intro|40%|minmax\(0, 2fr\).*minmax\(0, 3fr\)/);
    assert.match(page, /publicChoice\.election\.startOfVoting|Start of Voting/);
    assert.match(page, /publicChoice\.election\.endOfVoting|End of Voting/);
    assert.match(page, /publicChoice\.results\.download|Download results/);
    assert.match(page, /CivicShareButton/);
    assert.doesNotMatch(page, /PublicChoiceCandidateSubmitPanel/);
    assert.doesNotMatch(page, /\+ Add candidate/);
  });

  it("status resolver covers NOT_STARTED OPEN CLOSED EXPIRED", () => {
    assert.equal(
      resolvePublicChoiceElectionVotingStatus({ decisionStatus: "draft" }),
      "NOT_STARTED",
    );
    assert.equal(
      resolvePublicChoiceElectionVotingStatus({
        decisionStatus: "opened",
        openedAt: "2020-01-01T00:00:00.000Z",
        closesAt: "2099-01-01T00:00:00.000Z",
      }),
      "OPEN",
    );
    assert.equal(
      resolvePublicChoiceElectionVotingStatus({
        decisionStatus: "closed",
        closedAt: "2020-01-02T00:00:00.000Z",
      }),
      "CLOSED",
    );
    assert.equal(
      resolvePublicChoiceElectionVotingStatus({
        resultsRetentionStatus: "results_expired",
      }),
      "EXPIRED",
    );
  });

  it("Manage offers Close election for PUBLIC_CHOICE", () => {
    const editor = read("features/initiatives/components/InitiativePublishedEditor.tsx");
    assert.match(editor, /manage\.actions\.closeElection|Close election/);
    assert.match(editor, /closePublicChoiceElection/);
    assert.match(editor, /manage\.election\.confirmBody|72 hours/);
  });

  it("recall client uses DELETE vote", () => {
    const api = read("features/initiative-collective-decision/api.ts");
    assert.match(api, /recallInitiativeDecisionVote/);
    assert.match(api, /method: "DELETE"/);
  });
});
