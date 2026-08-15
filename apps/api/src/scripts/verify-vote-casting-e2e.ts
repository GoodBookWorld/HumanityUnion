/**
 * TASK-028 — Vote casting foundation verification.
 * Run: npm run verify:vote-casting
 *
 * Recovery Task 31: this script no longer spawns a subprocess to exercise a
 * file-mode persistence round-trip — `InitiativeDecisionVote` persistence is
 * now unconditionally MongoDB-backed (see `initiative-decision-vote.store.ts`),
 * so there is no persistence "mode" left to switch. `runVerificationScript`
 * already closes the Mongo connection deterministically on exit (see
 * `verification-script-lifecycle.ts`), which was the other reason the
 * subprocess split previously existed.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Member } from "@hu/types";

import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";
import { runVerificationScript } from "./verification-script-lifecycle.js";

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

// Recovery Task 14: every call site below passes an async arrow function
// (e.g. `async () => await castOrUpdateInitiativeDecisionVote(...)`). A
// synchronous `assertThrows` invokes `fn()` without awaiting it, so it only
// ever observes whether *calling* the async function threw synchronously —
// never whether the returned Promise actually rejects. Since
// `castOrUpdateInitiativeDecisionVote` always returns a Promise (it never
// throws synchronously), the old implementation fell through to
// `throw new Error("Expected failure: ...")` on every call, even though the
// underlying service call rejected exactly as intended. Awaiting `fn()`
// correctly unwraps rejected Promises for async callers while remaining a
// no-op for genuinely synchronous throwers (Promise.resolve/await on a
// non-Promise value is a pass-through), so this fix is safe for both.
async function assertThrows(fn: () => unknown, message: string): Promise<void> {
  try {
    await fn();
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

  const analysisDraft = await createInitiativeCollaborativeAnalysisDraft(
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
  const publishedAnalysis = await publishInitiativeCollaborativeAnalysis(
    { participantId: "member-participant-b-001", displayName: "Analyst B" },
    analysisDraft.analysisId,
  );

  const proposalDraft = await createInitiativeImprovementProposalDraft(
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

  const sessionDraft = await createDecisionSessionDraft(steward, {
    initiativeId: projected.initiativeId,
    title: "Vote Casting Session",
    purpose: "Prepare for vote casting.",
    decisionQuestion: "Should the community proceed?",
    opensAt: futureIsoDate(7),
    closesAt: futureIsoDate(21),
  });
  publishDecisionSession(steward, sessionDraft.sessionId);
  closeDecisionSession(steward, sessionDraft.sessionId);

  const decisionDraft = await createInitiativeCollectiveDecisionDraft(steward, {
    initiativeId: projected.initiativeId,
    decisionSessionId: sessionDraft.sessionId,
    participationScope: "community",
    closesAt: futureIsoDate(30),
  });
  const opened = openInitiativeCollectiveDecision(steward, decisionDraft.decisionId);

  assert(opened.status === "opened", "Decision must be opened for voting");

  return opened.decisionId;
}

/**
 * Recovery Task 13: this script's fixture participants
 * (`member-voter-verified-001`, `member-voter-unverified-001`,
 * `member-voter-ineligible-001`) are fixed IDs re-seeded on every run
 * against the real, file-backed Participation Area store (the default
 * `PARTICIPATION_AREA_PERSISTENCE` mode). Without this cleanup, a second
 * run of this script would find each fixture participant already has an
 * active Participation Area from the previous run and fail at
 * `createParticipationArea` before ever reaching Vote casting or the
 * transitive ancestry path introduced in Recovery Task 12. Cleanup runs
 * before creation and targets only these three explicit participant IDs.
 */
async function cleanupStaleParticipationAreaFixtures(): Promise<void> {
  const { deleteParticipationAreasByParticipantIdForTests } =
    await import("../modules/participation-area/participation-area.store.js");

  for (const participantId of [
    verifiedVoter.participantId,
    unverifiedVoter.participantId,
    ineligibleVoter.participantId,
  ]) {
    deleteParticipationAreasByParticipantIdForTests(participantId);
  }
}

async function seedVoterParticipationAreas(): Promise<void> {
  const { seedMember } = await import("../modules/member/member.store.js");
  const { createParticipationArea } =
    await import("../modules/participation-area/participation-area.store.js");

  await cleanupStaleParticipationAreaFixtures();

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

async function main(): Promise<void> {
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

  const supportVote = await castOrUpdateInitiativeDecisionVote(verifiedVoter, decisionId, {
    choice: "support",
  });
  assert(supportVote.choice === "support", "Initial vote should be support");
  assert(supportVote.version === 1, "Initial vote version should be 1");
  assert(supportVote.transparencyCohort === "verified", "Verified cohort stored");

  console.log("2. Same participant changes to do_not_support");

  const opposeVote = await castOrUpdateInitiativeDecisionVote(verifiedVoter, decisionId, {
    choice: "do_not_support",
  });
  assert(opposeVote.voteId === supportVote.voteId, "Vote update should reuse same voteId");
  assert(opposeVote.choice === "do_not_support", "Vote should update to do_not_support");
  assert(opposeVote.version === 2, "Vote version should increment");

  console.log("3. Same participant changes to abstain");

  const abstainVote = await castOrUpdateInitiativeDecisionVote(verifiedVoter, decisionId, {
    choice: "abstain",
  });
  assert(abstainVote.choice === "abstain", "Vote should update to abstain");
  assert(abstainVote.version === 3, "Vote version should increment to 3");

  console.log("4. Only one active vote exists");

  assert(
    (await countActiveVotesForDecision(decisionId)) === 1,
    "Only one active vote should exist for participant",
  );
  assert(
    (await listVotesForDecision(decisionId)).length === 1,
    "Decision should contain exactly one vote record",
  );

  console.log("5. Vote history records all changes");

  const history = await listVoteHistoryForParticipant(decisionId, verifiedVoter.participantId);
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

  const unverifiedVote = await castOrUpdateInitiativeDecisionVote(unverifiedVoter, decisionId, {
    choice: "support",
  });
  assert(unverifiedVote.transparencyCohort === "unverified", "Unverified cohort stored");
  assert(unverifiedVote.choice === "support", "Unverified participant vote recorded");

  console.log("7. Ineligible participant rejected");

  await assertThrows(
    async () => await castOrUpdateInitiativeDecisionVote(ineligibleVoter, decisionId, {
        choice: "support",
      }),
    "Ineligible participant must be rejected",
  );

  console.log("8. Duplicate active vote not created");

  assert(
    (await listVotesForDecision(decisionId)).length === 2,
    "Decision should contain two distinct participant votes only",
  );

  console.log("9. Aggregate helper returns correct unweighted counts");

  const aggregates = await computeInitiativeDecisionVoteAggregates(decisionId);
  assert(aggregates.total.totalVotes === 2, "Total vote count should be 2");
  assert(aggregates.total.support === 1, "One support vote counted");
  assert(aggregates.total.abstain === 1, "One abstain vote counted");
  assert(aggregates.verified.abstain === 1, "Verified abstain counted separately");
  assert(aggregates.unverified.support === 1, "Unverified support counted separately");
  assert(
    assertUnweightedVoteCounts(await listVotesForDecision(decisionId), aggregates),
    "Aggregates must match unweighted vote records",
  );

  console.log("10. Closed decision rejects vote changes");

  await closeInitiativeCollectiveDecision(steward, decisionId);
  await assertThrows(
    async () => await castOrUpdateInitiativeDecisionVote(unverifiedVoter, decisionId, {
        choice: "do_not_support",
      }),
    "Closed decision must reject vote changes",
  );

  console.log("11. Cancelled decision rejects vote changes");

  const cancelledDecisionId = await buildOpenedCollectiveDecision();
  cancelInitiativeCollectiveDecision(steward, cancelledDecisionId);
  await assertThrows(
    async () => await castOrUpdateInitiativeDecisionVote(verifiedVoter, cancelledDecisionId, {
        choice: "support",
      }),
    "Cancelled decision must reject vote changes",
  );

  console.log("12. getMyInitiativeDecisionVote returns active vote");

  const reopenedDecisionId = await buildOpenedCollectiveDecision();
  await castOrUpdateInitiativeDecisionVote(verifiedVoter, reopenedDecisionId, { choice: "support" });
  const myVote = await getMyInitiativeDecisionVote(verifiedVoter, reopenedDecisionId);
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

  console.log("14. Vote is independently addressable and durable in Mongo");

  const { getVoteById } = await import("../modules/initiative-decision-vote/initiative-decision-vote.store.js");
  const reloadedVote = await getVoteById(abstainVote.voteId);
  assert(reloadedVote !== null, "Vote must be independently readable by voteId from Mongo");
  assert(reloadedVote?.choice === "abstain", "Reloaded vote must reflect the last committed choice");
  assert(reloadedVote?.version === abstainVote.version, "Reloaded vote must reflect the last committed version");

  console.log("All vote casting checks passed.");
}

void runVerificationScript(main);
