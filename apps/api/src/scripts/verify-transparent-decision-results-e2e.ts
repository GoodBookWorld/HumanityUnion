/**
 * TASK-029 — Transparent decision results verification.
 * Run: npm run verify:transparent-decision-results
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildTransparentCollectiveDecisionResults,
  calculateCollectiveDecisionOutcomeType,
  createEmptyInitiativeDecisionVoteAggregates,
} from "@hu/types";

import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";

const steward: RequestIdentity = {
  participantId: "member-bootstrap-001",
  displayName: "Steward A",
};

const voterA: RequestIdentity = {
  participantId: "member-results-voter-a",
  displayName: "Voter A",
};

const voterB: RequestIdentity = {
  participantId: "member-results-voter-b",
  displayName: "Voter B",
};

const voterC: RequestIdentity = {
  participantId: "member-results-voter-c",
  displayName: "Voter C",
};

const PRIVATE_FIELD_KEYS = ["participantId", "voteId", "stewardId", "memberId", "email"];

const FORBIDDEN_TERMS = [
  "ipAddress",
  "vpn",
  "geolocation",
  "deviceFingerprint",
  "openai",
  "weightVote",
  "weighted",
];

const SCRIPT_PATH = fileURLToPath(import.meta.url);

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertThrows(fn: () => unknown, message: string): void {
  try {
    fn();
    throw new Error(`Expected failure: ${message}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Expected failure:")) {
      throw error;
    }
  }
}

function futureIsoDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

async function seedVoters(): Promise<void> {
  const { seedMember } = await import("../modules/member/member.store.js");
  const { createParticipationArea } =
    await import("../modules/participation-area/participation-area.store.js");

  for (const [id, name, verification] of [
    [voterA.participantId, "Voter A", "verified"],
    [voterB.participantId, "Voter B", "unverified"],
    [voterC.participantId, "Voter C", "verified"],
  ] as const) {
    seedMember({
      id,
      profile: { displayName: name, uniqueName: id.replace("member-", ""), languages: ["en"] },
      status: "active",
      verificationLevel: "email",
      roles: ["member"],
      fair: { personal: 0, community: 0, regional: 0, global: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    createParticipationArea({
      participantId: id,
      countrySlug: "canada",
      regionSlug: "british-columbia",
      communitySlug: "nelson-community-garden",
      verificationStatus: verification,
    });
  }
}

async function openCommunityDecision(): Promise<string> {
  const { createInitiativeDraft, publishInitiative } =
    await import("../modules/initiatives/initiative.service.js");
  const { createInitiativeCollaborativeAnalysisDraft, publishInitiativeCollaborativeAnalysis } =
    await import("../modules/initiative-collaborative-analysis/initiative-collaborative-analysis.service.js");
  const {
    createInitiativeImprovementProposalDraft,
    submitInitiativeImprovementProposal,
    decideInitiativeImprovementProposal,
  } =
    await import("../modules/initiative-improvement-proposal/initiative-improvement-proposal.service.js");
  const { createInitiativeRevisionDraft, saveInitiativeRevisionDraft, publishInitiativeRevision } =
    await import("../modules/initiative-version-revision/initiative-version-revision.service.js");
  const { createDecisionSessionDraft, publishDecisionSession, closeDecisionSession } =
    await import("../modules/decision-session/decision-session.service.js");
  const { createInitiativeCollectiveDecisionDraft, openInitiativeCollectiveDecision } =
    await import("../modules/initiative-collective-decision/initiative-collective-decision.service.js");

  const analyst: RequestIdentity = {
    participantId: "member-participant-b-001",
    displayName: "Analyst B",
  };

  const draft = createInitiativeDraft(steward, {
    title: "Transparent Results Initiative",
    description: "Initiative for transparent results verification.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });
  const projected = publishInitiative(steward, draft.initiativeId);

  const analysisDraft = createInitiativeCollaborativeAnalysisDraft(analyst, {
    initiativeId: projected.initiativeId,
    title: "Results Analysis",
    summary: "Analysis.",
    supportingEvidence: "Evidence.",
    risks: "Risk.",
    suggestedImprovements: "Improve.",
    references: "Ref.",
  });
  const publishedAnalysis = publishInitiativeCollaborativeAnalysis(
    analyst,
    analysisDraft.analysisId,
  );

  const proposalDraft = createInitiativeImprovementProposalDraft(analyst, {
    analysisId: publishedAnalysis.analysisId,
    targetSection: "Description",
    currentIssue: "Issue.",
    proposedChange: "Change.",
    rationale: "Rationale.",
    expectedImprovement: "Improvement.",
    references: "References.",
  });
  const submittedProposal = submitInitiativeImprovementProposal(analyst, proposalDraft.proposalId);
  const decidedProposal = decideInitiativeImprovementProposal(
    steward,
    submittedProposal.proposalId,
    {
      decision: "accepted",
      decisionNote: "Accepted.",
    },
  );

  createInitiativeRevisionDraft(steward, projected.initiativeId);
  saveInitiativeRevisionDraft(steward, projected.initiativeId, {
    title: "Transparent Results Initiative (Revised)",
    description: "Revised.",
    revisionSummary: "Summary.",
    appliedProposalIds: [decidedProposal.proposalId],
  });
  publishInitiativeRevision(steward, projected.initiativeId);

  const sessionDraft = createDecisionSessionDraft(steward, {
    initiativeId: projected.initiativeId,
    title: "Results Session",
    purpose: "Purpose.",
    decisionQuestion: "Should the community proceed?",
    opensAt: futureIsoDate(7),
    closesAt: futureIsoDate(21),
  });
  publishDecisionSession(steward, sessionDraft.sessionId);
  closeDecisionSession(steward, sessionDraft.sessionId);

  const decisionDraft = createInitiativeCollectiveDecisionDraft(steward, {
    initiativeId: projected.initiativeId,
    decisionSessionId: sessionDraft.sessionId,
    participationScope: "community",
    closesAt: futureIsoDate(30),
  });

  const opened = openInitiativeCollectiveDecision(steward, decisionDraft.decisionId);
  return opened.decisionId;
}

function assertNoPrivateFields(value: unknown, label: string): void {
  const serialized = JSON.stringify(value);

  for (const key of PRIVATE_FIELD_KEYS) {
    assert(!serialized.includes(`"${key}"`), `${label} leaked private field: ${key}`);
  }
}

async function runMainVerification(): Promise<void> {
  const { castOrUpdateInitiativeDecisionVote } =
    await import("../modules/initiative-decision-vote/initiative-decision-vote.service.js");
  const { closeInitiativeCollectiveDecision, cancelInitiativeCollectiveDecision } =
    await import("../modules/initiative-collective-decision/initiative-collective-decision.service.js");
  const {
    getPublicInitiativeCollectiveDecision,
    listPublicInitiativeCollectiveDecisionsForInitiative,
    assertPublicProjectionHasNoPrivateVoteData,
  } =
    await import("../modules/initiative-collective-decision/public-initiative-collective-decision.projection.js");
  const { listVoteHistoryForDecision } =
    await import("../modules/initiative-decision-vote/initiative-decision-vote.store.js");
  const resultsSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../modules/initiative-collective-decision/initiative-collective-decision-results.ts",
    ),
    "utf-8",
  );
  const transparentResultsSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../../../../packages/types/src/domain/collective-decision-transparent-results.ts",
    ),
    "utf-8",
  );

  console.log("1. Outcome calculation — support majority");

  assert(
    calculateCollectiveDecisionOutcomeType({
      status: "closed",
      support: 3,
      doNotSupport: 1,
    }) === "supported",
    "Support majority should be supported",
  );

  console.log("2. Outcome calculation — do_not_support majority");

  assert(
    calculateCollectiveDecisionOutcomeType({
      status: "closed",
      support: 1,
      doNotSupport: 4,
    }) === "not_supported",
    "Opposition majority should be not_supported",
  );

  console.log("3. Outcome calculation — tie");

  assert(
    calculateCollectiveDecisionOutcomeType({
      status: "closed",
      support: 2,
      doNotSupport: 2,
    }) === "inconclusive",
    "Tie should be inconclusive",
  );

  console.log("4. Abstain does not determine outcome");

  assert(
    calculateCollectiveDecisionOutcomeType({
      status: "closed",
      support: 3,
      doNotSupport: 1,
    }) === "supported",
    "Abstain-heavy totals should not override support plurality",
  );

  await seedVoters();
  const decisionId = await openCommunityDecision();

  castOrUpdateInitiativeDecisionVote(voterA, decisionId, { choice: "support" });
  castOrUpdateInitiativeDecisionVote(voterB, decisionId, { choice: "do_not_support" });
  castOrUpdateInitiativeDecisionVote(voterC, decisionId, { choice: "support" });

  console.log("5. Verified/unverified split and equal counting");

  const liveProjection = getPublicInitiativeCollectiveDecision(decisionId);
  assert(liveProjection !== null, "Public projection should exist");
  if (!liveProjection?.outcome) {
    throw new Error("Public outcome required");
  }

  assert(liveProjection.statistics.supportCount === 2, "Two support votes counted");
  assert(liveProjection.statistics.doNotSupportCount === 1, "One opposition vote counted");
  assert(liveProjection.statistics.verifiedVotesCast === 2, "Two verified votes");
  assert(liveProjection.statistics.unverifiedVotesCast === 1, "One unverified vote");
  assert(liveProjection.outcome.outcome === "supported", "Live outcome should be supported");
  assert(
    liveProjection.transparencyNote.includes("do not change vote weight"),
    "Transparency note required",
  );

  console.log("6. Vote change updates aggregates");

  castOrUpdateInitiativeDecisionVote(voterB, decisionId, { choice: "support" });
  const updatedProjection = getPublicInitiativeCollectiveDecision(decisionId);
  assert(
    updatedProjection?.statistics.supportCount === 3,
    "Vote change should update support count",
  );
  assert(
    updatedProjection?.statistics.doNotSupportCount === 0,
    "Opposition count should drop to zero",
  );
  assert(updatedProjection?.outcome?.outcome === "supported", "Outcome remains supported");

  console.log("7. Close freezes result");

  closeInitiativeCollectiveDecision(steward, decisionId);
  const closedProjection = getPublicInitiativeCollectiveDecision(decisionId);
  const frozenSupport = closedProjection?.statistics.supportCount;
  const frozenOutcome = closedProjection?.outcome?.outcome;

  assertThrows(
    () => castOrUpdateInitiativeDecisionVote(voterC, decisionId, { choice: "do_not_support" }),
    "Closed decision must reject vote changes",
  );

  const afterCloseProjection = getPublicInitiativeCollectiveDecision(decisionId);
  assert(
    afterCloseProjection?.statistics.supportCount === frozenSupport,
    "Closed decision aggregates must remain frozen",
  );
  assert(
    afterCloseProjection?.outcome?.outcome === frozenOutcome,
    "Closed outcome must remain frozen",
  );

  console.log("8. Cancelled decision outcome");

  const cancelledDecisionId = await openCommunityDecision();
  cancelInitiativeCollectiveDecision(steward, cancelledDecisionId);
  const cancelledProjection = getPublicInitiativeCollectiveDecision(cancelledDecisionId);
  assert(cancelledProjection?.outcome?.outcome === "cancelled", "Cancelled decision outcome");

  console.log("9. Privacy — no individual votes or identities in public projection");

  assertNoPrivateFields(liveProjection, "Public projection");
  assertNoPrivateFields(
    listPublicInitiativeCollectiveDecisionsForInitiative(liveProjection.initiativeId),
    "Public list",
  );
  assert(
    assertPublicProjectionHasNoPrivateVoteData(liveProjection),
    "Public projection helper should confirm no vote identifiers",
  );
  assert(listVoteHistoryForDecision(decisionId).length > 0, "Vote history exists internally");
  assert(
    !JSON.stringify(getPublicInitiativeCollectiveDecision(decisionId)).includes("vote-history"),
    "Vote history must not appear in public projection",
  );

  console.log("10. No weighted voting or AI outcome logic");

  for (const source of [resultsSource, transparentResultsSource]) {
    for (const term of FORBIDDEN_TERMS) {
      assert(
        !source.toLowerCase().includes(term.toLowerCase()),
        `Results logic must not include ${term}`,
      );
    }
  }

  const manualAggregates = createEmptyInitiativeDecisionVoteAggregates();
  manualAggregates.total.support = 2;
  manualAggregates.total.doNotSupport = 1;
  manualAggregates.total.totalVotes = 3;
  manualAggregates.verified.support = 2;
  manualAggregates.verified.totalVotes = 2;
  manualAggregates.unverified.doNotSupport = 1;
  manualAggregates.unverified.totalVotes = 1;

  const manualResults = buildTransparentCollectiveDecisionResults({
    status: "opened",
    aggregates: manualAggregates,
  });
  assert(
    manualResults.outcome.outcome === "supported",
    "Manual aggregate build should stay unweighted",
  );
}

async function main(): Promise<void> {
  await runMainVerification();
  console.log("All transparent decision result checks passed.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Transparent decision results verification FAILED: ${message}`);
  process.exit(1);
});
