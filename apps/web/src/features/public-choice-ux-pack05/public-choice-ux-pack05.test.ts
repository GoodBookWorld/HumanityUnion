/**
 * Public Choice Fix 05 — role-aware Overview voting + CD result wiring contracts.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  getInitiativeLifecycleProfilePresentation,
  resolvePublicChoiceElectionVotingStatus,
} from "@hu/types";

import { selectLifecycleNavStagesForDisplay } from "../public-initiative-experience/initiative-lifecycle-shell";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(dir, "../..");

function read(relativePath: string): string {
  return readFileSync(path.join(webRoot, relativePath), "utf8");
}

function stage(
  stageId: string,
  state: "not_started" | "in_progress" | "completed" | "not_applicable" = "not_started",
) {
  return {
    stageId,
    label: stageId,
    hash: stageId,
    state,
    stateLabel: state,
    recordCount: 0,
  };
}

describe("Public Choice Fix 05 — Overview Select/Recall gate", () => {
  it("Select/Recall use Pack 04 electionStatus OPEN (not openedAt-only window helper)", () => {
    const overview = read(
      "features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    assert.match(overview, /electionStatus === "OPEN"/);
    assert.doesNotMatch(overview, /isCollectiveDecisionVotingWindowOpen/);
    assert.match(overview, /notifyPublicChoiceElectionRefresh/);
    assert.match(overview, /castOrUpdateInitiativeDecisionVote/);
    assert.match(overview, /recallInitiativeDecisionVote/);
  });

  it("opened status without openedAt still resolves OPEN for Select visibility", () => {
    assert.equal(
      resolvePublicChoiceElectionVotingStatus({
        decisionStatus: "opened",
        openedAt: null,
        closesAt: "2099-01-01T00:00:00.000Z",
      }),
      "OPEN",
    );
  });

  it("Visitor sees Register Add-candidate CTA; authenticated opens form", () => {
    const overview = read(
      "features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    assert.match(overview, /\/register\?returnTo=/);
    assert.match(overview, /#add-candidate/);
    assert.match(overview, /authenticated \? \(/);
    assert.match(overview, /PublicChoiceCandidateSubmitPanel/);
    assert.match(overview, /pie-overview-candidates__add/);
  });
});

describe("Public Choice Fix 05 — Collective Decision role parity", () => {
  it("PUBLIC_CHOICE CD mounts PublicChoiceCollectiveDecisionStage for all roles", () => {
    const center = read(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    const stageSource = read(
      "features/public-choice-candidate/components/PublicChoiceCollectiveDecisionStage.tsx",
    );
    assert.match(center, /PublicChoiceCollectiveDecisionStage/);
    assert.match(center, /showPublicChoiceCollectiveDecision/);
    assert.match(stageSource, /PublicChoiceElectionResultsBoard/);
    assert.match(stageSource, /Election Results/);
    assert.doesNotMatch(stageSource, /Generate Collective Decision Draft/);
    assert.doesNotMatch(stageSource, /Sources Used/);
    assert.doesNotMatch(stageSource, /Published Decision Session/);
    assert.doesNotMatch(stageSource, /Implementation Commitments/);
  });

  it("Author PUBLIC_CHOICE CD does not mount STANDARD Author Workspace", () => {
    const center = read(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    assert.match(
      center,
      /!showPublicChoiceCollectiveDecision &&[\s\S]*collective_decision/,
    );
    assert.match(center, /isPublicChoice && activeStageId === "collective_decision"/);
  });

  it("presentation exposes Election Results label for PUBLIC_CHOICE CD", () => {
    const pc = getInitiativeLifecycleProfilePresentation("PUBLIC_CHOICE");
    assert.equal(pc.collectiveDecisionIsResultOnly, true);
    assert.equal(pc.collectiveDecisionResultLabel, "Election Results");
    const standard = getInitiativeLifecycleProfilePresentation("STANDARD");
    assert.equal(standard.collectiveDecisionResultLabel, null);
  });
});

describe("Public Choice Fix 05 — Civic Archive visibility", () => {
  it("PUBLIC_CHOICE visible lifecycle omits Civic Archive", () => {
    const displayed = selectLifecycleNavStagesForDisplay(
      [
        stage("initiative"),
        stage("discussion"),
        stage("collective_decision"),
        stage("archive"),
      ],
      "PUBLIC_CHOICE",
    );
    assert.deepEqual(
      displayed.map((item) => item.stageId),
      ["initiative", "discussion", "collective_decision"],
    );
  });

  it("STANDARD visible lifecycle still includes Civic Archive", () => {
    const displayed = selectLifecycleNavStagesForDisplay(
      [
        stage("initiative"),
        stage("discussion", "not_applicable"),
        stage("analysis"),
        stage("archive"),
      ],
      "STANDARD",
    );
    assert.equal(displayed.some((item) => item.stageId === "archive"), true);
    assert.equal(displayed.some((item) => item.stageId === "discussion"), false);
  });
});

describe("Public Choice Fix 05 — cross-surface refresh", () => {
  it("sidebar and election page listen for election refresh events", () => {
    const sidebar = read(
      "features/public-initiative-experience/components/PublicChoiceElectionSidebarWidget.tsx",
    );
    const election = read(
      "features/public-initiative-experience/components/PublicChoiceElectionPage.tsx",
    );
    const cd = read(
      "features/public-choice-candidate/components/PublicChoiceCollectiveDecisionStage.tsx",
    );
    assert.match(sidebar, /usePublicChoiceElectionRefresh/);
    assert.match(election, /usePublicChoiceElectionRefresh/);
    assert.match(cd, /usePublicChoiceElectionRefresh/);
  });
});
