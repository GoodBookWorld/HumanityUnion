/**
 * Public Choice Fix 06 — web runtime contracts for role surfaces + zero-vote CD.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  resolvePublicChoiceElectionVotingStatus,
  getInitiativeLifecycleProfilePresentation,
} from "@hu/types";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(dir, "../..");

function read(relativePath: string): string {
  return readFileSync(path.join(webRoot, relativePath), "utf8");
}

describe("Public Choice Fix 06 — role + zero-vote UI contracts", () => {
  it("Visitor/Participant/Author share Overview Select + CD results board paths", () => {
    const overview = read(
      "features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    const center = read(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    const cd = read(
      "features/public-choice-candidate/components/PublicChoiceCollectiveDecisionStage.tsx",
    );
    assert.match(overview, /electionStatus === "OPEN"/);
    assert.match(overview, /\bSelect\b/);
    assert.match(overview, /\bRecall\b/);
    assert.match(overview, /\/register\?returnTo=/);
    assert.match(center, /PublicChoiceCollectiveDecisionStage/);
    assert.match(cd, /PublicChoiceElectionResultsBoard/);
    assert.doesNotMatch(cd, /Generate Collective Decision Draft/);
  });

  it("results board shows zero-vote candidate rows and empty roster copy", () => {
    const board = read(
      "features/public-choice-candidate/components/PublicChoiceElectionResultsBoard.tsx",
    );
    assert.match(board, /No candidates listed yet/);
    assert.match(board, /unrankedCandidates/);
    assert.match(board, /0 votes|tally\.count/);
  });

  it("Mr.Scorpion-shaped OPEN window resolves OPEN without forcing true", () => {
    assert.equal(
      resolvePublicChoiceElectionVotingStatus({
        decisionStatus: "opened",
        openedAt: "2026-08-19T00:00:00.000Z",
        closesAt: "2026-09-19T00:00:00.000Z",
        nowIso: "2026-08-21T12:00:00.000Z",
      }),
      "OPEN",
    );
    assert.equal(
      getInitiativeLifecycleProfilePresentation("PUBLIC_CHOICE").collectiveDecisionIsResultOnly,
      true,
    );
  });

  it("candidates list uses public initiatives path", () => {
    const api = read("features/public-choice-candidate/api.ts");
    assert.match(api, /\/api\/v1\/public\/initiatives\//);
    assert.match(api, /candidates/);
  });
});
