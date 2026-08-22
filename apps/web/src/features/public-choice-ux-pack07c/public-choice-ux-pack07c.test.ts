/**
 * Public Choice Fix 07C — Collective Decision + live results synchronization (web contracts).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  createZeroSelectOneAggregates,
  resolveSelectOneAggregates,
} from "../public-choice-candidate/public-choice-election-result-surface";

const dir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(dir, "../..");
const repoRoot = path.resolve(dir, "../../../../../");

function readWeb(relativePath: string): string {
  return readFileSync(path.join(webRoot, relativePath), "utf8");
}

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Public Choice Fix 07C — shared aggregate surface", () => {
  it("zero-vote aggregates render all candidates at 0/0%", () => {
    const aggregates = createZeroSelectOneAggregates(["cand-b", "cand-a"]);
    assert.equal(aggregates.totalEffectiveVoters, 0);
    assert.equal(aggregates.candidates.length, 2);
    assert.equal(aggregates.candidates[0]?.candidateId, "cand-a");
    assert.equal(aggregates.candidates[0]?.count, 0);
    assert.equal(aggregates.candidates[0]?.percentage, 0);
    assert.equal(aggregates.participationBreakdown.visitors, 0);
    assert.equal(aggregates.participationBreakdown.participants, 0);
    assert.equal(aggregates.participationBreakdown.members, 0);
  });

  it("resolveSelectOneAggregates prefers server tallies; synthesizes zeros when empty", () => {
    const server = {
      ballotMode: "SELECT_ONE_CANDIDATE" as const,
      candidates: [
        {
          candidateId: "cand-a",
          count: 2,
          percentage: 100,
          rank: 1,
          isTie: false,
        },
      ],
      abstain: 0,
      abstainPercentage: 0,
      totalEffectiveVoters: 2,
      participationBreakdown: {
        visitors: 1,
        participants: 1,
        members: 0,
        totalEffectiveVoters: 2,
        visitorPercentage: 50,
        participantPercentage: 50,
        memberPercentage: 0,
      },
    };
    assert.equal(resolveSelectOneAggregates(server, ["cand-a", "cand-b"]).candidates[0]?.count, 2);

    const synthesized = resolveSelectOneAggregates(
      {
        ballotMode: "SELECT_ONE_CANDIDATE",
        candidates: [],
        abstain: 0,
        abstainPercentage: 0,
        totalEffectiveVoters: 0,
        participationBreakdown: {
          visitors: 0,
          participants: 0,
          members: 0,
          totalEffectiveVoters: 0,
          visitorPercentage: 0,
          participantPercentage: 0,
          memberPercentage: 0,
        },
      },
      ["cand-a", "cand-b"],
    );
    assert.equal(synthesized.candidates.length, 2);
    assert.equal(synthesized.candidates.every((row) => row.count === 0), true);
  });

  it("Overview, sidebar, CD, and Election share one loader + refresh event", () => {
    const loader = readWeb(
      "features/public-choice-candidate/public-choice-election-result-surface.ts",
    );
    const overview = readWeb(
      "features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    const sidebar = readWeb(
      "features/public-initiative-experience/components/PublicChoiceElectionSidebarWidget.tsx",
    );
    const election = readWeb(
      "features/public-initiative-experience/components/PublicChoiceElectionPage.tsx",
    );
    const cd = readWeb(
      "features/public-choice-candidate/components/PublicChoiceCollectiveDecisionStage.tsx",
    );
    const refresh = readWeb("features/public-choice-candidate/public-choice-election-refresh.ts");

    assert.match(loader, /loadPublicChoiceElectionResultSurface/);
    assert.match(loader, /listItemAsProjection/);
    assert.match(overview, /loadPublicChoiceElectionResultSurface/);
    assert.match(sidebar, /loadPublicChoiceElectionResultSurface/);
    assert.match(election, /loadPublicChoiceElectionResultSurface/);
    assert.match(cd, /loadPublicChoiceElectionResultSurface/);
    assert.match(overview, /loadGenerationRef/);
    assert.match(sidebar, /loadGenerationRef/);
    assert.match(election, /loadGenerationRef/);
    assert.match(cd, /loadGenerationRef/);
    assert.match(refresh, /hu:public-choice-election-refresh/);
    assert.doesNotMatch(refresh, /hu:public-choice-election-refresh-v2/);
    assert.match(overview, /notifyPublicChoiceElectionRefresh\(initiativeId\)/);
    assert.match(sidebar, /usePublicChoiceElectionRefresh/);
    assert.match(election, /usePublicChoiceElectionRefresh/);
    assert.match(cd, /usePublicChoiceElectionRefresh/);
  });

  it("PUBLIC_CHOICE CD stage mounts ResultsBoard and does not link generic CD public route", () => {
    const cd = readWeb(
      "features/public-choice-candidate/components/PublicChoiceCollectiveDecisionStage.tsx",
    );
    const center = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    assert.match(cd, /PublicChoiceElectionResultsBoard/);
    assert.doesNotMatch(cd, /href=\{?[`"'].*\/collective-decisions\/public\//);
    assert.doesNotMatch(cd, /href=\{`\/collective-decisions\/public\//);
    assert.match(center, /showPublicChoiceCollectiveDecision/);
    assert.match(center, /PublicChoiceCollectiveDecisionStage/);
  });

  it("zero-candidate empty copy is honest and non-blank", () => {
    const board = readWeb(
      "features/public-choice-candidate/components/PublicChoiceElectionResultsBoard.tsx",
    );
    assert.match(board, /No candidates have been added yet\./);
    assert.match(board, /role="meter"/);
    assert.match(board, /Participation breakdown/);
  });

  it("OPEN shows CURRENT RESULTS; CLOSED shows FINAL RESULTS on Election + CD", () => {
    const election = readWeb(
      "features/public-initiative-experience/components/PublicChoiceElectionPage.tsx",
    );
    const cd = readWeb(
      "features/public-choice-candidate/components/PublicChoiceCollectiveDecisionStage.tsx",
    );
    assert.match(election, /CURRENT RESULTS/);
    assert.match(election, /FINAL RESULTS/);
    assert.match(cd, /CURRENT RESULTS/);
    assert.match(cd, /FINAL RESULTS/);
  });

  it("Fix 07A Select/Recall refresh and Fix 07B allowlist remain", () => {
    const overview = readWeb(
      "features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    const allowlist = readWeb(
      "features/public-initiative-experience/public-choice-sidebar-allowlist.ts",
    );
    assert.match(overview, /Saving…/);
    assert.match(overview, /Recalling…/);
    assert.doesNotMatch(overview, />Abstain</);
    assert.match(allowlist, /candidates/);
    assert.match(allowlist, /related_initiatives/);
  });

  it("experience service PUBLIC_CHOICE CD href points at election page", () => {
    const experience = readRepo(
      "apps/api/src/modules/initiatives/public-initiative-experience.service.ts",
    );
    assert.match(experience, /isPublicChoiceLifecycle/);
    assert.match(
      experience,
      /publicHref: isPublicChoiceLifecycle\s*\?\s*`\/initiatives\/public\/\$\{encodeURIComponent\(initiativeId\)\}\/election`/,
    );
    assert.match(
      experience,
      /: `\/collective-decisions\/public\/\$\{encodeURIComponent\(decision\.decisionId\)\}`/,
    );
  });
});
