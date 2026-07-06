/**
 * TASK-028 — Vote casting foundation verification.
 * Run: npm run verify:vote-casting
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Member } from "@hu/types";

import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";

const steward: RequestIdentity = {
  participantId: "member-bootstrap-001",
  displayName: "Steward A",
};

const verifiedVoter: RequestIdentity = {
  participantId: "member-voter-verified-001",
  displayName: "Verified Voter",
};

const unverifiedVoter: RequestIdentity = {
  participantId: "member-voter-unverified-001",
  displayName: "Unverified Voter",
};

const ineligibleVoter: RequestIdentity = {
  participantId: "member-voter-ineligible-001",
  displayName: "Ineligible Voter",
};

const FORBIDDEN_VOTE_TERMS = [
  "ipAddress",
  "ip_address",
  "vpn",
  "geolocation",
  "geoLocation",
  "latitude",
  "longitude",
  "deviceFingerprint",
  "networkLocation",
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

function createTestMember(id: string, displayName: string): Member {
  return {
    id,
    profile: {
      displayName,
      uniqueName: id.replace("member-", ""),
      languages: ["en"],
    },
    status: "active",
    verificationLevel: "email",
    roles: ["member"],
    fair: { personal: 0, community: 0, regional: 0, global: 0 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function buildOpenedCollectiveDecision(): Promise<string> {
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

  const draft = createInitiativeDraft(steward, {
    title: "Vote Casting E2E Initiative",
    description: "Initiative for vote casting verification.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });
  const projected = publishInitiative(steward, draft.initiativeId);

  const analysisDraft = createInitiativeCollaborativeAnalysisDraft(
    {
      participantId: "member-participant-b-001",
      displayName: "Analyst B",
    },
    {
      initiativeId: projected.initiativeId,
      title: "Vote Casting Analysis",
      summary: "Analysis for vote casting.",
      supportingEvidence: "Evidence.",
      risks: "Risk.",
      suggestedImprovements: "Improve.",
      references: "Ref.",
    },
  );
  const publishedAnalysis = publishInitiativeCollaborativeAnalysis(
    { participantId: "member-participant-b-001", displayName: "Analyst B" },
    analysisDraft.analysisId,
  );

  const proposalDraft = createInitiativeImprovementProposalDraft(
    { participantId: "member-participant-b-001", displayName: "Analyst B" },
    {
      analysisId: publishedAnalysis.analysisId,
      targetSection: "Description",
      currentIssue: "Issue.",
      proposedChange: "Change.",
      rationale: "Rationale.",
      expectedImprovement: "Improvement.",
      references: "References.",
    },
  );
  const submittedProposal = submitInitiativeImprovementProposal(
    { participantId: "member-participant-b-001", displayName: "Analyst B" },
    proposalDraft.proposalId,
  );
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
    title: "Vote Casting E2E Initiative (Revised)",
    description: "Revised for vote casting.",
    revisionSummary: "Revision summary.",
    appliedProposalIds: [decidedProposal.proposalId],
  });
  publishInitiativeRevision(steward, projected.initiativeId);

  const sessionDraft = createDecisionSessionDraft(steward, {
    initiativeId: projected.initiativeId,
    title: "Vote Casting Session",
    purpose: "Prepare for vote casting.",
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

  assert(opened.status === "opened", "Decision must be opened for voting");

  return opened.decisionId;
}

async function seedVoterParticipationAreas(): Promise<void> {
  const { seedMember } = await import("../modules/member/member.store.js");
  const { createParticipationArea } =
    await import("../modules/participation-area/participation-area.store.js");

  seedMember(
    createTestMember(verifiedVoter.participantId, verifiedVoter.displayName ?? "Verified"),
  );
  seedMember(
    createTestMember(unverifiedVoter.participantId, unverifiedVoter.displayName ?? "Unverified"),
  );
  seedMember(
    createTestMember(ineligibleVoter.participantId, ineligibleVoter.displayName ?? "Ineligible"),
  );

  createParticipationArea({
    participantId: verifiedVoter.participantId,
    countrySlug: "canada",
    regionSlug: "british-columbia",
    communitySlug: "nelson-community-garden",
    verificationStatus: "verified",
  });

  createParticipationArea({
    participantId: unverifiedVoter.participantId,
    countrySlug: "canada",
    regionSlug: "british-columbia",
    communitySlug: "nelson-community-garden",
    verificationStatus: "unverified",
  });

  createParticipationArea({
    participantId: ineligibleVoter.participantId,
    countrySlug: "mexico",
    regionSlug: "jalisco",
    communitySlug: "guadalajara-centro",
    verificationStatus: "verified",
  });
}

async function runMainVerification(): Promise<void> {
  const { castOrUpdateInitiativeDecisionVote, getMyInitiativeDecisionVote } =
    await import("../modules/initiative-decision-vote/initiative-decision-vote.service.js");
  const { closeInitiativeCollectiveDecision, cancelInitiativeCollectiveDecision } =
    await import("../modules/initiative-collective-decision/initiative-collective-decision.service.js");
  const { computeInitiativeDecisionVoteAggregates, assertUnweightedVoteCounts } =
    await import("../modules/initiative-decision-vote/initiative-decision-vote-aggregates.js");
  const { countActiveVotesForDecision, listVoteHistoryForParticipant, listVotesForDecision } =
    await import("../modules/initiative-decision-vote/initiative-decision-vote.store.js");
  const voteDomainSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../../../../packages/types/src/domain/initiative-decision-vote.ts",
    ),
    "utf-8",
  );
  const voteServiceSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../modules/initiative-decision-vote/initiative-decision-vote.service.ts",
    ),
    "utf-8",
  );
  const voteStoreSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../modules/initiative-decision-vote/initiative-decision-vote.store.ts",
    ),
    "utf-8",
  );

  await seedVoterParticipationAreas();
  const decisionId = await buildOpenedCollectiveDecision();

  console.log("1. Eligible participant casts support");

  const supportVote = castOrUpdateInitiativeDecisionVote(verifiedVoter, decisionId, {
    choice: "support",
  });
  assert(supportVote.choice === "support", "Initial vote should be support");
  assert(supportVote.version === 1, "Initial vote version should be 1");
  assert(supportVote.transparencyCohort === "verified", "Verified cohort stored");

  console.log("2. Same participant changes to do_not_support");

  const opposeVote = castOrUpdateInitiativeDecisionVote(verifiedVoter, decisionId, {
    choice: "do_not_support",
  });
  assert(opposeVote.voteId === supportVote.voteId, "Vote update should reuse same voteId");
  assert(opposeVote.choice === "do_not_support", "Vote should update to do_not_support");
  assert(opposeVote.version === 2, "Vote version should increment");

  console.log("3. Same participant changes to abstain");

  const abstainVote = castOrUpdateInitiativeDecisionVote(verifiedVoter, decisionId, {
    choice: "abstain",
  });
  assert(abstainVote.choice === "abstain", "Vote should update to abstain");
  assert(abstainVote.version === 3, "Vote version should increment to 3");

  console.log("4. Only one active vote exists");

  assert(
    countActiveVotesForDecision(decisionId) === 1,
    "Only one active vote should exist for participant",
  );
  assert(
    listVotesForDecision(decisionId).length === 1,
    "Decision should contain exactly one vote record",
  );

  console.log("5. Vote history records all changes");

  const history = listVoteHistoryForParticipant(decisionId, verifiedVoter.participantId);
  assert(history.length === 3, "Vote history should contain three entries");
  assert(
    history[0]?.newChoice === "support" && history[0]?.previousChoice === undefined,
    "First history entry should record support cast",
  );
  assert(
    history[1]?.previousChoice === "support" && history[1]?.newChoice === "do_not_support",
    "Second history entry should record support to do_not_support",
  );
  assert(
    history[2]?.previousChoice === "do_not_support" && history[2]?.newChoice === "abstain",
    "Third history entry should record do_not_support to abstain",
  );

  console.log("6. Unverified participant can vote with transparency cohort");

  const unverifiedVote = castOrUpdateInitiativeDecisionVote(unverifiedVoter, decisionId, {
    choice: "support",
  });
  assert(unverifiedVote.transparencyCohort === "unverified", "Unverified cohort stored");
  assert(unverifiedVote.choice === "support", "Unverified participant vote recorded");

  console.log("7. Ineligible participant rejected");

  assertThrows(
    () =>
      castOrUpdateInitiativeDecisionVote(ineligibleVoter, decisionId, {
        choice: "support",
      }),
    "Ineligible participant must be rejected",
  );

  console.log("8. Duplicate active vote not created");

  assert(
    listVotesForDecision(decisionId).length === 2,
    "Decision should contain two distinct participant votes only",
  );

  console.log("9. Aggregate helper returns correct unweighted counts");

  const aggregates = computeInitiativeDecisionVoteAggregates(decisionId);
  assert(aggregates.total.totalVotes === 2, "Total vote count should be 2");
  assert(aggregates.total.support === 1, "One support vote counted");
  assert(aggregates.total.abstain === 1, "One abstain vote counted");
  assert(aggregates.verified.abstain === 1, "Verified abstain counted separately");
  assert(aggregates.unverified.support === 1, "Unverified support counted separately");
  assert(
    assertUnweightedVoteCounts(listVotesForDecision(decisionId), aggregates),
    "Aggregates must match unweighted vote records",
  );

  console.log("10. Closed decision rejects vote changes");

  closeInitiativeCollectiveDecision(steward, decisionId);
  assertThrows(
    () =>
      castOrUpdateInitiativeDecisionVote(unverifiedVoter, decisionId, {
        choice: "do_not_support",
      }),
    "Closed decision must reject vote changes",
  );

  console.log("11. Cancelled decision rejects vote changes");

  const cancelledDecisionId = await buildOpenedCollectiveDecision();
  cancelInitiativeCollectiveDecision(steward, cancelledDecisionId);
  assertThrows(
    () =>
      castOrUpdateInitiativeDecisionVote(verifiedVoter, cancelledDecisionId, {
        choice: "support",
      }),
    "Cancelled decision must reject vote changes",
  );

  console.log("12. getMyInitiativeDecisionVote returns active vote");

  const reopenedDecisionId = await buildOpenedCollectiveDecision();
  castOrUpdateInitiativeDecisionVote(verifiedVoter, reopenedDecisionId, { choice: "support" });
  const myVote = getMyInitiativeDecisionVote(verifiedVoter, reopenedDecisionId);
  assert(myVote?.choice === "support", "My vote endpoint data should match active vote");

  console.log("13. IP/VPN/geolocation absent from vote model");

  for (const source of [voteDomainSource, voteServiceSource, voteStoreSource]) {
    for (const term of FORBIDDEN_VOTE_TERMS) {
      assert(!source.includes(term), `Vote implementation must not include ${term}`);
    }
  }

  const serializedVote = JSON.stringify(abstainVote);
  for (const term of FORBIDDEN_VOTE_TERMS) {
    assert(!serializedVote.includes(term), `Stored vote must not include ${term}`);
  }
}

function assertVoteReloadsFromFile(
  decisionId: string,
  participantId: string,
  expectedChoice: "support" | "do_not_support" | "abstain",
  expectedVersion: number,
  filePath: string,
): void {
  const reloadScriptPath = path.resolve(
    path.dirname(SCRIPT_PATH),
    "verify-initiative-decision-vote-store-reload.ts",
  );
  const result = spawnSync(
    "npx",
    ["tsx", reloadScriptPath, decisionId, participantId, expectedChoice, String(expectedVersion)],
    {
      cwd: path.resolve(path.dirname(SCRIPT_PATH), "../.."),
      env: {
        ...process.env,
        INITIATIVE_DECISION_VOTE_PERSISTENCE: "file",
        INITIATIVE_DECISION_VOTE_PERSISTENCE_PATH: filePath,
      },
      stdio: "pipe",
      encoding: "utf-8",
    },
  );

  assert(result.status === 0, "Vote should reload from file after API restart");
}

async function runPersistenceVerification(): Promise<void> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hu-vote-casting-e2e-"));
  const persistencePath = path.join(tempDir, "initiative-decision-votes.json");

  process.env.INITIATIVE_DECISION_VOTE_PERSISTENCE = "file";
  process.env.INITIATIVE_DECISION_VOTE_PERSISTENCE_PATH = persistencePath;
  process.env.INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE = "memory";
  process.env.PARTICIPATION_AREA_PERSISTENCE = "memory";
  process.env.DECISION_SESSION_PERSISTENCE = "memory";
  process.env.INITIATIVE_PERSISTENCE = "memory";
  process.env.INITIATIVE_ANALYSIS_PERSISTENCE = "memory";
  process.env.INITIATIVE_IMPROVEMENT_PROPOSAL_PERSISTENCE = "memory";
  process.env.INITIATIVE_VERSION_REVISION_PERSISTENCE = "memory";

  const { createFileInitiativeDecisionVotePersistenceAdapter } =
    await import("../modules/initiative-decision-vote/persistence/initiative-decision-vote-file.persistence.js");
  const { castOrUpdateInitiativeDecisionVote } =
    await import("../modules/initiative-decision-vote/initiative-decision-vote.service.js");

  await seedVoterParticipationAreas();
  const decisionId = await buildOpenedCollectiveDecision();
  castOrUpdateInitiativeDecisionVote(verifiedVoter, decisionId, { choice: "support" });

  assert(
    Object.values(createFileInitiativeDecisionVotePersistenceAdapter().load().votes).some(
      (vote) => vote.decisionId === decisionId,
    ),
    "Vote should persist to file",
  );

  assertVoteReloadsFromFile(decisionId, verifiedVoter.participantId, "support", 1, persistencePath);

  fs.rmSync(tempDir, { recursive: true, force: true });

  console.log("14. Persistence — vote survives API restart");
}

async function main(): Promise<void> {
  if (process.env.VERIFY_VOTE_CASTING_PERSISTENCE === "1") {
    await runPersistenceVerification();
    console.log("Vote casting persistence checks passed.");
    return;
  }

  await runMainVerification();

  const persistenceResult = spawnSync("npx", ["tsx", SCRIPT_PATH], {
    env: {
      ...process.env,
      VERIFY_VOTE_CASTING_PERSISTENCE: "1",
      INITIATIVE_DECISION_VOTE_PERSISTENCE: "memory",
      INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE: "memory",
      PARTICIPATION_AREA_PERSISTENCE: "memory",
      DECISION_SESSION_PERSISTENCE: "memory",
      INITIATIVE_PERSISTENCE: "memory",
      INITIATIVE_ANALYSIS_PERSISTENCE: "memory",
      INITIATIVE_IMPROVEMENT_PROPOSAL_PERSISTENCE: "memory",
      INITIATIVE_VERSION_REVISION_PERSISTENCE: "memory",
    },
    stdio: "inherit",
  });

  assert(persistenceResult.status === 0, "Persistence verification subprocess failed");

  console.log("All vote casting checks passed.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Vote casting verification FAILED: ${message}`);
  process.exit(1);
});
