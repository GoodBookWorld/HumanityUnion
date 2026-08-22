/**
 * Public Choice Fix 07D — final runtime certification (web).
 * Role matrix, Select/Recall state machine, sidebar allowlist, lifecycle,
 * CD / Election surfaces — realistic payloads + source contracts.
 * Certification only; no product redesign.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  publicChoiceElectionVotingStatusLabel,
  resolveParticipantFacingCurrentStageId,
  resolvePublicChoiceElectionVotingStatus,
} from "@hu/types";

import {
  publicChoiceSidebarAllows,
  resolvePublicChoiceSidebarAllowlist,
} from "../public-initiative-experience/public-choice-sidebar-allowlist";
import {
  resolveLifecycleShellHash,
  selectLifecycleNavStagesForDisplay,
} from "../public-initiative-experience/initiative-lifecycle-shell";
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

function stage(
  stageId: string,
  state: "not_started" | "in_progress" | "completed" | "not_applicable" = "not_started",
) {
  return {
    stageId,
    label: stageId === "archive" ? "Civic Archive" : stageId,
    hash: stageId,
    state,
    stateLabel: state,
    recordCount: 0,
  };
}

/** Staging-shaped OPEN election payload used across role certifications. */
const STAGING_SHAPED_OPEN = {
  initiativeId: "initiative-1787189571159",
  decisionId: "collective-decision-1787291065634-xytxgu",
  decisionStatus: "opened" as const,
  openedAt: "2026-08-19T00:00:00.000Z",
  closesAt: "2026-09-19T00:00:00.000Z",
  closedAt: undefined as string | undefined,
  candidates: [
    { candidateId: "cand-a", name: "Candidate A" },
    { candidateId: "cand-b", name: "Candidate B" },
    { candidateId: "cand-c", name: "Candidate C" },
  ],
};

describe("Public Choice Fix 07D — Visitor / Participant / Author matrix", () => {
  it("Visitor sidebar is Candidates + Related only", () => {
    const allow = resolvePublicChoiceSidebarAllowlist({ authenticated: false });
    assert.deepEqual([...allow], ["candidates", "related_initiatives"]);
    assert.equal(publicChoiceSidebarAllows(allow, "your_participation"), false);
  });

  it("Participant and Author sidebar is Candidates + Your Participation + Related", () => {
    const allow = resolvePublicChoiceSidebarAllowlist({ authenticated: true });
    assert.deepEqual([...allow], [
      "candidates",
      "your_participation",
      "related_initiatives",
    ]);
  });

  it("PUBLIC_CHOICE sidebar source never mounts Allies / AI / channel widgets", () => {
    const sidebar = readWeb(
      "features/public-initiative-experience/components/PublicExperienceSidebar.tsx",
    );
    const orChannel = readWeb(
      "features/public-initiative-experience/components/PublicExperienceSidebarOrChannel.tsx",
    );
    const pcBlock = sidebar.slice(
      sidebar.indexOf("if (isPublicChoice)"),
      sidebar.indexOf("return (", sidebar.indexOf("if (isPublicChoice)") + 1),
    );
    assert.doesNotMatch(pcBlock, /InitiativeActiveAlliesWidget/);
    assert.doesNotMatch(pcBlock, /AI Assistant|AiAssistant|WorkspaceIntelligence/);
    assert.doesNotMatch(pcBlock, /icw-tabs/);
    assert.match(orChannel, /isPublicChoice/);
    assert.match(orChannel, /PublicExperienceSidebar/);
  });

  it("Visitor Overview: Select/Recall, Register returnTo Add CTA, no form, no Abstain", () => {
    const overview = readWeb(
      "features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    assert.match(overview, /Saving…/);
    assert.match(overview, /Recalling…/);
    assert.match(overview, /\bSelect\b/);
    assert.match(overview, /\bRecall\b/);
    assert.doesNotMatch(overview, />Abstain</);
    assert.match(overview, /authStatus === "unauthenticated"/);
    assert.match(overview, /\/register\?returnTo=/);
    assert.match(overview, /#add-candidate/);
    assert.match(overview, /showSubmit && authenticated/);
    assert.match(overview, /authenticated \? \(/);
  });

  it("Participant/Author Overview opens Add candidate form when authenticated", () => {
    const overview = readWeb(
      "features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    assert.match(overview, /\+ Add candidate/);
    assert.match(overview, /PublicChoiceCandidateSubmitPanel/);
    assert.match(overview, /openSubmitForm/);
  });
});

describe("Public Choice Fix 07D — Select/Recall + blur state machine", () => {
  it("dim/blur lock uses rosterLocked; selected stays unblurred; failure clears pending", () => {
    const overview = readWeb(
      "features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    const css = readWeb("features/public-initiative-experience/public-initiative-experience.css");
    assert.match(overview, /const dimmed = rosterLocked && !selected/);
    assert.match(overview, /pc-overview-vote-row--dimmed/);
    assert.match(overview, /pc-overview-vote-row--selected/);
    assert.match(overview, /hu-button--primary/);
    assert.match(overview, /pc-overview-vote-row__recall/);
    assert.match(overview, /aria-busy=\{pendingId === candidate\.candidateId\}/);
    assert.match(overview, /aria-busy=\{pendingId === "recall"\}/);
    assert.match(overview, /role="alert"/);
    assert.match(overview, /finally \{\s*setBusy\(false\);\s*setPendingId\(null\);/);
    assert.match(css, /\.pc-overview-vote-row--dimmed/);
    assert.match(css, /filter:.*blur/);
    assert.match(css, /\.pc-overview-vote-row--selected[\s\S]*filter:\s*none/);
  });

  it("refresh event fires after Select, Recall, and candidate create", () => {
    const overview = readWeb(
      "features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    assert.match(overview, /notifyPublicChoiceElectionRefresh\(initiativeId\)/);
    const notifyCount = overview.split("notifyPublicChoiceElectionRefresh(initiativeId)").length - 1;
    assert.ok(notifyCount >= 3);
  });
});

describe("Public Choice Fix 07D — lifecycle / Civic Archive", () => {
  it("PUBLIC_CHOICE visible nav is Initiative + Discussion + Collective Decision", () => {
    const stages = [
      stage("initiative", "completed"),
      stage("discussion", "in_progress"),
      stage("collective_decision"),
      stage("archive"),
    ];
    const visible = selectLifecycleNavStagesForDisplay(stages, "PUBLIC_CHOICE");
    assert.deepEqual(
      visible.map((item) => item.stageId),
      ["initiative", "discussion", "collective_decision"],
    );
    assert.ok(!visible.some((item) => item.stageId === "archive"));
  });

  it("archive hash / current-stage remap away from Civic Archive for PUBLIC_CHOICE", () => {
    assert.equal(
      resolveParticipantFacingCurrentStageId("archive", "PUBLIC_CHOICE"),
      "collective_decision",
    );
    assert.equal(resolveParticipantFacingCurrentStageId("archive", "STANDARD"), "archive");

    const stages = [
      stage("initiative", "completed"),
      stage("discussion", "completed"),
      stage("collective_decision", "in_progress"),
      stage("archive"),
    ];
    assert.deepEqual(resolveLifecycleShellHash("#civic-archive", stages, { lifecycleProfile: "PUBLIC_CHOICE" }), {
      kind: "fallback_overview",
      reason: "not_applicable",
    });
  });

  it("STANDARD lifecycle still includes Civic Archive in nav", () => {
    const stages = [
      stage("initiative", "completed"),
      stage("discussion", "completed"),
      stage("collective_decision", "completed"),
      stage("archive", "in_progress"),
    ];
    const visible = selectLifecycleNavStagesForDisplay(stages, "STANDARD");
    assert.ok(visible.some((item) => item.stageId === "archive"));
  });
});

describe("Public Choice Fix 07D — CD / Election surfaces", () => {
  it("OPEN staging-shaped payload resolves CURRENT RESULTS; CLOSED → FINAL", () => {
    const open = resolvePublicChoiceElectionVotingStatus({
      decisionStatus: STAGING_SHAPED_OPEN.decisionStatus,
      openedAt: STAGING_SHAPED_OPEN.openedAt,
      closesAt: STAGING_SHAPED_OPEN.closesAt,
      closedAt: STAGING_SHAPED_OPEN.closedAt,
    });
    assert.equal(open, "OPEN");
    assert.equal(publicChoiceElectionVotingStatusLabel(open), "Open");

    const closed = resolvePublicChoiceElectionVotingStatus({
      decisionStatus: "closed",
      openedAt: STAGING_SHAPED_OPEN.openedAt,
      closesAt: STAGING_SHAPED_OPEN.closesAt,
      closedAt: "2026-09-19T00:00:00.000Z",
      resultsRetentionStatus: "results_available",
    });
    assert.equal(closed, "CLOSED");
  });

  it("zero-vote aggregate payload renders all candidates at 0/0%", () => {
    const ids = STAGING_SHAPED_OPEN.candidates.map((c) => c.candidateId);
    const zero = createZeroSelectOneAggregates(ids);
    assert.equal(zero.totalEffectiveVoters, 0);
    assert.equal(zero.candidates.length, 3);
    assert.ok(zero.candidates.every((row) => row.count === 0 && row.percentage === 0));
    assert.equal(zero.participationBreakdown.visitors, 0);

    const live = resolveSelectOneAggregates(
      {
        ballotMode: "SELECT_ONE_CANDIDATE",
        candidates: [
          { candidateId: "cand-a", count: 2, percentage: 100, rank: 1, isTie: false },
          { candidateId: "cand-b", count: 0, percentage: 0, rank: 2, isTie: false },
          { candidateId: "cand-c", count: 0, percentage: 0, rank: 3, isTie: false },
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
      },
      ids,
    );
    assert.equal(live.candidates[0]?.count, 2);
    assert.equal(live.participationBreakdown.visitors, 1);
  });

  it("PC CD mounts ResultsBoard for all roles; no STANDARD Author Workspace; no generic CD href", () => {
    const center = readWeb(
      "features/public-initiative-experience/components/PublicInitiativeCenterPanel.tsx",
    );
    const cd = readWeb(
      "features/public-choice-candidate/components/PublicChoiceCollectiveDecisionStage.tsx",
    );
    const election = readWeb(
      "features/public-initiative-experience/components/PublicChoiceElectionPage.tsx",
    );
    assert.match(center, /showPublicChoiceCollectiveDecision/);
    assert.match(center, /PublicChoiceCollectiveDecisionStage/);
    assert.match(cd, /PublicChoiceElectionResultsBoard/);
    assert.match(cd, /CURRENT RESULTS/);
    assert.match(cd, /FINAL RESULTS/);
    assert.doesNotMatch(cd, /href=\{`\/collective-decisions\/public\//);
    assert.match(election, /CURRENT RESULTS/);
    assert.match(election, /FINAL RESULTS/);
    assert.match(election, /Results no longer available/);
    assert.match(election, /CivicShareButton/);
    assert.match(election, /loadPublicChoiceElectionResultSurface/);
    assert.match(election, /loadGenerationRef/);

    // PC CD branch skips STANDARD author workspace shell.
    assert.match(center, /!showPublicChoiceCollectiveDecision &&/);
  });

  it("four surfaces share one loader + one refresh event", () => {
    const loader = readWeb(
      "features/public-choice-candidate/public-choice-election-result-surface.ts",
    );
    const refresh = readWeb("features/public-choice-candidate/public-choice-election-refresh.ts");
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
    assert.match(loader, /loadPublicChoiceElectionResultSurface/);
    assert.match(refresh, /hu:public-choice-election-refresh/);
    for (const source of [overview, sidebar, election, cd]) {
      assert.match(source, /usePublicChoiceElectionRefresh|notifyPublicChoiceElectionRefresh/);
      assert.match(source, /loadGenerationRef|loadPublicChoiceElectionResultSurface/);
    }
  });

  it("experience service PUBLIC_CHOICE CD href is election page, not generic CD", () => {
    const experience = readRepo(
      "apps/api/src/modules/initiatives/public-initiative-experience.service.ts",
    );
    assert.match(
      experience,
      /publicHref: isPublicChoiceLifecycle\s*\?\s*`\/initiatives\/public\/\$\{encodeURIComponent\(initiativeId\)\}\/election`/,
    );
  });
});

describe("Public Choice Fix 07D — Fix 07A/07B/07C regression anchors", () => {
  it("Fix 07A Abstain removal and PA skip remain", () => {
    const overview = readWeb(
      "features/public-choice-candidate/components/PublicChoiceOverviewCandidateIntake.tsx",
    );
    const service = readRepo(
      "apps/api/src/modules/initiative-decision-vote/initiative-decision-vote.service.ts",
    );
    assert.doesNotMatch(overview, />Abstain</);
    assert.match(service, /assertPublicChoiceAuthenticatedVoter/);
  });

  it("Fix 07B shared-docs JWT path-scope + allowlist remain", () => {
    const shared = readRepo(
      "apps/api/src/modules/shared-documents/shared-documents.initiatives.routes.ts",
    );
    const allowlist = readWeb(
      "features/public-initiative-experience/public-choice-sidebar-allowlist.ts",
    );
    const loader = readWeb(
      "features/public-choice-candidate/public-choice-election-result-surface.ts",
    );
    assert.match(shared, /collaboration-channel|collaboration-sessions|official-responses/);
    assert.match(allowlist, /resolvePublicChoiceSidebarAllowlist/);
    assert.doesNotMatch(loader, /listPublicChoiceCandidates\(initiativeId\)\.catch\(\(\) => \[\]\)/);
  });
});
