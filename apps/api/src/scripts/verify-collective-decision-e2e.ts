/**
 * TASK-030 — Collective Decision end-to-end verification.
 * Run: npm run verify:collective-decision
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Member, ParticipationScope } from "@hu/types";
import { participationAreaSlugTriple } from "@hu/types";

import type { RequestIdentity } from "../modules/initiatives/identity/request-identity.types.js";

const steward: RequestIdentity = {
  participantId: "member-bootstrap-001",
  displayName: "Steward A",
};

const analyst: RequestIdentity = {
  participantId: "member-participant-b-001",
  displayName: "Analyst B",
};

const verifiedVoter: RequestIdentity = {
  participantId: "member-cd-voter-verified",
  displayName: "Verified Voter",
};

const unverifiedVoter: RequestIdentity = {
  participantId: "member-cd-voter-unverified",
  displayName: "Unverified Voter",
};

const worldVoter: RequestIdentity = {
  participantId: "member-cd-voter-world",
  displayName: "World Voter",
};

const countryMatchVoter: RequestIdentity = {
  participantId: "member-cd-voter-country-match",
  displayName: "Country Match Voter",
};

const countryMismatchVoter: RequestIdentity = {
  participantId: "member-cd-voter-country-mismatch",
  displayName: "Country Mismatch Voter",
};

const regionMatchVoter: RequestIdentity = {
  participantId: "member-cd-voter-region-match",
  displayName: "Region Match Voter",
};

const regionMismatchVoter: RequestIdentity = {
  participantId: "member-cd-voter-region-mismatch",
  displayName: "Region Mismatch Voter",
};

const communityMatchVoter: RequestIdentity = {
  participantId: "member-cd-voter-community-match",
  displayName: "Community Match Voter",
};

const communityMismatchVoter: RequestIdentity = {
  participantId: "member-cd-voter-community-mismatch",
  displayName: "Community Mismatch Voter",
};

const transitionVoter: RequestIdentity = {
  participantId: "member-cd-voter-transition",
  displayName: "Transition Voter",
};

const PRIVATE_FIELD_KEYS = [
  "participantId",
  "voteId",
  "stewardId",
  "memberId",
  "email",
  "voteHistory",
];

const FORBIDDEN_PUBLIC_TERMS = [
  "ipAddress",
  "ip_address",
  "vpn",
  "geolocation",
  "deviceFingerprint",
  "networkLocation",
];

const FORBIDDEN_OUTCOME_TERMS = ["openai", "gpt", "weightVote", "reputationScore", "tallyEngine"];

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

function assertNoPrivateFields(value: unknown, label: string): void {
  const serialized = JSON.stringify(value);

  for (const key of PRIVATE_FIELD_KEYS) {
    assert(!serialized.includes(`"${key}"`), `${label} leaked private field: ${key}`);
  }

  for (const term of FORBIDDEN_PUBLIC_TERMS) {
    assert(!serialized.includes(term), `${label} leaked forbidden term: ${term}`);
  }
}

function futureIsoDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

function pastIsoDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
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

async function seedParticipants(): Promise<void> {
  const { seedMember } = await import("../modules/member/member.store.js");
  const { createParticipationArea, requestParticipationAreaTransition } =
    await import("../modules/participation-area/participation-area.store.js");

  const participants: Array<{
    identity: RequestIdentity;
    area: { countrySlug: string; regionSlug?: string; communitySlug?: string };
    verification: "verified" | "unverified";
  }> = [
    {
      identity: verifiedVoter,
      area: participationAreaSlugTriple("canada", "british-columbia", "nelson-community-garden"),
      verification: "verified",
    },
    {
      identity: unverifiedVoter,
      area: participationAreaSlugTriple("canada", "british-columbia", "nelson-community-garden"),
      verification: "unverified",
    },
    {
      identity: worldVoter,
      area: participationAreaSlugTriple("germany", "bavaria", "munich"),
      verification: "verified",
    },
    {
      identity: countryMatchVoter,
      area: participationAreaSlugTriple("canada"),
      verification: "verified",
    },
    {
      identity: countryMismatchVoter,
      area: participationAreaSlugTriple("mexico"),
      verification: "verified",
    },
    {
      identity: regionMatchVoter,
      area: participationAreaSlugTriple("canada", "british-columbia"),
      verification: "verified",
    },
    {
      identity: regionMismatchVoter,
      area: participationAreaSlugTriple("canada", "ontario"),
      verification: "verified",
    },
    {
      identity: communityMatchVoter,
      area: participationAreaSlugTriple("canada", "british-columbia", "nelson-community-garden"),
      verification: "verified",
    },
    {
      identity: communityMismatchVoter,
      area: participationAreaSlugTriple(
        "canada",
        "british-columbia",
        "kootenay-lake-protection-society",
      ),
      verification: "verified",
    },
    {
      identity: transitionVoter,
      area: participationAreaSlugTriple(
        "canada",
        "british-columbia",
        "kootenay-lake-protection-society",
      ),
      verification: "verified",
    },
  ];

  for (const participant of participants) {
    seedMember(
      createTestMember(
        participant.identity.participantId,
        participant.identity.displayName ?? "Voter",
      ),
    );
    createParticipationArea({
      participantId: participant.identity.participantId,
      countrySlug: participant.area.countrySlug,
      regionSlug: participant.area.regionSlug,
      communitySlug: participant.area.communitySlug,
      verificationStatus: participant.verification,
    });
  }

  requestParticipationAreaTransition({
    participantId: transitionVoter.participantId,
    toArea: participationAreaSlugTriple("canada", "british-columbia", "nelson-community-garden"),
    effectiveAt: futureIsoDate(14),
  });
}

async function buildMatureInitiative(): Promise<string> {
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

  const draft = createInitiativeDraft(steward, {
    title: "Collective Decision E2E Initiative",
    description: "Full constitutional collective decision verification.",
    communitySlug: "nelson-community-garden",
    activityArea: "Environment",
  });
  const projected = publishInitiative(steward, draft.initiativeId);
  assert(projected.lifecyclePhase === "projected", "Initiative should be projected");

  const analysisDraft = createInitiativeCollaborativeAnalysisDraft(analyst, {
    initiativeId: projected.initiativeId,
    title: "Collective Decision Analysis",
    summary: "Analysis for collective decision path.",
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
      decisionNote: "Accepted for revision.",
    },
  );

  createInitiativeRevisionDraft(steward, projected.initiativeId);
  saveInitiativeRevisionDraft(steward, projected.initiativeId, {
    title: "Collective Decision E2E Initiative (Revised)",
    description: "Revised for collective decision.",
    revisionSummary: "Revision summary.",
    appliedProposalIds: [decidedProposal.proposalId],
  });
  publishInitiativeRevision(steward, projected.initiativeId);

  return projected.initiativeId;
}

async function createClosedDecisionSession(
  initiativeId: string,
  decisionQuestion: string,
): Promise<string> {
  const { createDecisionSessionDraft, publishDecisionSession, closeDecisionSession } =
    await import("../modules/decision-session/decision-session.service.js");

  const sessionDraft = createDecisionSessionDraft(steward, {
    initiativeId,
    title: "Collective Decision Session",
    purpose: "Prepare society for collective decision.",
    decisionQuestion,
    opensAt: futureIsoDate(7),
    closesAt: futureIsoDate(21),
  });
  publishDecisionSession(steward, sessionDraft.sessionId);
  closeDecisionSession(steward, sessionDraft.sessionId);

  return sessionDraft.sessionId;
}

async function createCollectiveDecisionDraft(
  initiativeId: string,
  decisionSessionId: string,
  participationScope: ParticipationScope,
): Promise<string> {
  const { createInitiativeCollectiveDecisionDraft } =
    await import("../modules/initiative-collective-decision/initiative-collective-decision.service.js");

  const draft = createInitiativeCollectiveDecisionDraft(steward, {
    initiativeId,
    decisionSessionId,
    participationScope,
    closesAt: futureIsoDate(30),
  });

  assert(draft.status === "draft", "Collective decision should start as draft");

  return draft.decisionId;
}

async function openCollectiveDecision(decisionId: string): Promise<void> {
  const { openInitiativeCollectiveDecision } =
    await import("../modules/initiative-collective-decision/initiative-collective-decision.service.js");

  const opened = openInitiativeCollectiveDecision(steward, decisionId);
  assert(opened.status === "opened", "Collective decision should open");
}

function verifyPublicExperienceUnchanged(): void {
  const publicExperienceScriptPath = path.resolve(
    path.dirname(SCRIPT_PATH),
    "../../../web/src/scripts/verify-decision-session-public-experience.ts",
  );
  const result = spawnSync("npx", ["tsx", publicExperienceScriptPath], {
    cwd: path.resolve(path.dirname(SCRIPT_PATH), "../../.."),
    stdio: "inherit",
    encoding: "utf-8",
  });

  assert(result.status === 0, "Public experience providers should remain unchanged");
}

async function runMainVerification(): Promise<void> {
  const {
    createInitiativeCollectiveDecisionDraft,
    openInitiativeCollectiveDecision,
    closeInitiativeCollectiveDecision,
    cancelInitiativeCollectiveDecision,
    getInitiativeCollectiveDecisionEligibility,
  } =
    await import("../modules/initiative-collective-decision/initiative-collective-decision.service.js");
  const { castOrUpdateInitiativeDecisionVote, getMyInitiativeDecisionVote } =
    await import("../modules/initiative-decision-vote/initiative-decision-vote.service.js");
  const { evaluateStoredDecisionParticipationEligibility } =
    await import("../modules/participation-eligibility/participation-eligibility.service.js");
  const {
    getPublicInitiativeCollectiveDecision,
    listPublicInitiativeCollectiveDecisionsForInitiative,
  } =
    await import("../modules/initiative-collective-decision/public-initiative-collective-decision.projection.js");
  const { countActiveVotesForDecision, listVoteHistoryForParticipant, listVotesForDecision } =
    await import("../modules/initiative-decision-vote/initiative-decision-vote.store.js");
  const resultsSource = fs.readFileSync(
    path.resolve(
      path.dirname(SCRIPT_PATH),
      "../../../../packages/types/src/domain/collective-decision-transparent-results.ts",
    ),
    "utf-8",
  );

  await seedParticipants();

  console.log("1. Full preparation path");

  const initiativeId = await buildMatureInitiative();
  const primarySessionId = await createClosedDecisionSession(
    initiativeId,
    "Should the community proceed with the revised plan?",
  );
  const eligibility = getInitiativeCollectiveDecisionEligibility(initiativeId, primarySessionId);
  assert(eligibility.eligible, "Closed decision session should enable collective decision draft");

  const primaryDecisionId = await createCollectiveDecisionDraft(
    initiativeId,
    primarySessionId,
    "community",
  );

  console.log("2. Collective Decision lifecycle — draft → opened → closed");

  await openCollectiveDecision(primaryDecisionId);

  console.log("3. Steward-only lifecycle control");

  assertThrows(
    () =>
      createInitiativeCollectiveDecisionDraft(analyst, {
        initiativeId,
        decisionSessionId: primarySessionId,
        participationScope: "community",
        closesAt: futureIsoDate(20),
      }),
    "Non-steward cannot create collective decision",
  );
  assertThrows(
    () => openInitiativeCollectiveDecision(analyst, primaryDecisionId),
    "Non-steward cannot open collective decision",
  );
  assertThrows(
    () => closeInitiativeCollectiveDecision(analyst, primaryDecisionId),
    "Non-steward cannot close collective decision",
  );

  const cancelSessionId = await createClosedDecisionSession(initiativeId, "Cancel path question?");
  const cancelDraftId = await createCollectiveDecisionDraft(
    initiativeId,
    cancelSessionId,
    "community",
  );
  assertThrows(
    () => cancelInitiativeCollectiveDecision(analyst, cancelDraftId),
    "Non-steward cannot cancel collective decision",
  );

  console.log("4. Eligibility — scopes and pending transition");

  async function assertEligibility(
    scope: ParticipationScope,
    voter: RequestIdentity,
    expectedEligible: boolean,
    decisionSessionId: string,
  ): Promise<string> {
    const sessionId =
      decisionSessionId ||
      (await createClosedDecisionSession(initiativeId, `${scope} eligibility question?`));
    const decisionId = await createCollectiveDecisionDraft(initiativeId, sessionId, scope);
    await openCollectiveDecision(decisionId);
    const result = evaluateStoredDecisionParticipationEligibility({
      participantId: voter.participantId,
      isRegistered: true,
      participantStatus: "active",
      decisionParticipationScope: scope,
      initiativeCommunitySlug: "nelson-community-garden",
      decisionStatus: "opened",
      openedAt: pastIsoDate(1),
      closesAt: futureIsoDate(20),
      currentTime: new Date().toISOString(),
      priorVoteExists: false,
    });
    assert(
      result.eligible === expectedEligible,
      `${scope} eligibility mismatch for ${voter.participantId}`,
    );
    return decisionId;
  }

  await assertEligibility("world", worldVoter, true, "");
  await assertEligibility("country", countryMatchVoter, true, "");
  await assertEligibility("country", countryMismatchVoter, false, "");
  await assertEligibility("region", regionMatchVoter, true, "");
  await assertEligibility("region", regionMismatchVoter, false, "");
  await assertEligibility("community", communityMatchVoter, true, "");
  await assertEligibility("community", communityMismatchVoter, false, "");

  const transitionSessionId = await createClosedDecisionSession(
    initiativeId,
    "Transition eligibility question?",
  );
  const transitionDecisionId = await createCollectiveDecisionDraft(
    initiativeId,
    transitionSessionId,
    "community",
  );
  await openCollectiveDecision(transitionDecisionId);
  const transitionEligibility = evaluateStoredDecisionParticipationEligibility({
    participantId: transitionVoter.participantId,
    isRegistered: true,
    participantStatus: "active",
    decisionParticipationScope: "community",
    initiativeCommunitySlug: "nelson-community-garden",
    decisionStatus: "opened",
    openedAt: pastIsoDate(1),
    closesAt: futureIsoDate(20),
    currentTime: new Date().toISOString(),
    priorVoteExists: false,
  });
  assert(
    !transitionEligibility.eligible,
    "Pending area transition must not apply before effectiveAt",
  );
  assertThrows(
    () =>
      castOrUpdateInitiativeDecisionVote(transitionVoter, transitionDecisionId, {
        choice: "support",
      }),
    "Pending transition voter must be rejected for target community before effectiveAt",
  );

  console.log("5. Voting — cast, update, history, unverified equality");

  const supportVote = castOrUpdateInitiativeDecisionVote(verifiedVoter, primaryDecisionId, {
    choice: "support",
  });
  assert(supportVote.choice === "support" && supportVote.version === 1, "Initial support vote");

  const opposeVote = castOrUpdateInitiativeDecisionVote(verifiedVoter, primaryDecisionId, {
    choice: "do_not_support",
  });
  assert(
    opposeVote.voteId === supportVote.voteId && opposeVote.version === 2,
    "Vote update reuses record",
  );

  const abstainVote = castOrUpdateInitiativeDecisionVote(verifiedVoter, primaryDecisionId, {
    choice: "abstain",
  });
  assert(abstainVote.choice === "abstain" && abstainVote.version === 3, "Vote update to abstain");

  assert(countActiveVotesForDecision(primaryDecisionId) === 1, "One active vote per participant");
  assert(
    listVoteHistoryForParticipant(primaryDecisionId, verifiedVoter.participantId).length === 3,
    "Vote history records all changes",
  );

  const unverifiedVote = castOrUpdateInitiativeDecisionVote(unverifiedVoter, primaryDecisionId, {
    choice: "support",
  });
  assert(unverifiedVote.transparencyCohort === "unverified", "Unverified cohort stored");

  console.log("6. Transparent results — live aggregates");

  const liveProjection = getPublicInitiativeCollectiveDecision(primaryDecisionId);
  assert(
    liveProjection !== null && liveProjection.outcome !== null,
    "Live public projection required",
  );
  if (!liveProjection?.outcome) {
    throw new Error("Live outcome required");
  }
  assert(liveProjection.statistics.supportCount === 1, "Unverified support counted equally");
  assert(liveProjection.statistics.abstainCount === 1, "Abstain counted in statistics");
  assert(
    ["high", "medium", "low", "insufficient"].includes(liveProjection.participationConfidenceLevel),
    "Participation confidence is informational",
  );
  assert(
    liveProjection.transparencyNote.includes("do not change vote weight"),
    "Transparency note required",
  );

  console.log("7. Outcome scenarios — supported, not_supported, inconclusive, abstain");

  async function verifyOutcomeScenario(input: {
    supportVotes: number;
    opposeVotes: number;
    abstainVotes: number;
    expectedOutcome: "supported" | "not_supported" | "inconclusive";
  }): Promise<void> {
    const sessionId = await createClosedDecisionSession(
      initiativeId,
      `${input.expectedOutcome} outcome question?`,
    );
    const decisionId = await createCollectiveDecisionDraft(initiativeId, sessionId, "world");
    await openCollectiveDecision(decisionId);

    const voters = [
      verifiedVoter,
      unverifiedVoter,
      worldVoter,
      countryMatchVoter,
      regionMatchVoter,
      communityMatchVoter,
      communityMismatchVoter,
      countryMismatchVoter,
      regionMismatchVoter,
    ];
    let voterIndex = 0;

    const castFromNextVoter = (choice: "support" | "do_not_support" | "abstain"): void => {
      const voter = voters[voterIndex];
      voterIndex += 1;

      if (!voter) {
        throw new Error("Not enough seeded voters for outcome scenario.");
      }

      castOrUpdateInitiativeDecisionVote(voter, decisionId, { choice });
    };

    for (let index = 0; index < input.supportVotes; index += 1) {
      castFromNextVoter("support");
    }
    for (let index = 0; index < input.opposeVotes; index += 1) {
      castFromNextVoter("do_not_support");
    }
    for (let index = 0; index < input.abstainVotes; index += 1) {
      castFromNextVoter("abstain");
    }

    closeInitiativeCollectiveDecision(steward, decisionId);
    const projection = getPublicInitiativeCollectiveDecision(decisionId);
    assert(
      projection?.outcome?.outcome === input.expectedOutcome,
      `${input.expectedOutcome} outcome`,
    );
  }

  await verifyOutcomeScenario({
    supportVotes: 3,
    opposeVotes: 1,
    abstainVotes: 2,
    expectedOutcome: "supported",
  });
  await verifyOutcomeScenario({
    supportVotes: 1,
    opposeVotes: 3,
    abstainVotes: 0,
    expectedOutcome: "not_supported",
  });
  await verifyOutcomeScenario({
    supportVotes: 2,
    opposeVotes: 2,
    abstainVotes: 5,
    expectedOutcome: "inconclusive",
  });

  console.log("8. Vote freeze and cancelled outcome");

  castOrUpdateInitiativeDecisionVote(verifiedVoter, primaryDecisionId, { choice: "support" });
  castOrUpdateInitiativeDecisionVote(unverifiedVoter, primaryDecisionId, { choice: "support" });
  closeInitiativeCollectiveDecision(steward, primaryDecisionId);

  const frozenSupport =
    getPublicInitiativeCollectiveDecision(primaryDecisionId)?.statistics.supportCount;
  assertThrows(
    () =>
      castOrUpdateInitiativeDecisionVote(verifiedVoter, primaryDecisionId, { choice: "abstain" }),
    "Closed decision rejects vote changes",
  );
  assertThrows(
    () =>
      castOrUpdateInitiativeDecisionVote(countryMismatchVoter, primaryDecisionId, {
        choice: "support",
      }),
    "Closed decision rejects new votes",
  );
  assert(
    getPublicInitiativeCollectiveDecision(primaryDecisionId)?.statistics.supportCount ===
      frozenSupport,
    "Closed public results remain frozen",
  );

  await openCollectiveDecision(cancelDraftId);
  cancelInitiativeCollectiveDecision(steward, cancelDraftId);
  assert(
    getPublicInitiativeCollectiveDecision(cancelDraftId)?.outcome?.outcome === "cancelled",
    "Cancelled decision outcome",
  );
  assertThrows(
    () => castOrUpdateInitiativeDecisionVote(verifiedVoter, cancelDraftId, { choice: "support" }),
    "Cancelled decision rejects votes",
  );

  console.log("9. Public integration and privacy");

  const publicList = listPublicInitiativeCollectiveDecisionsForInitiative(initiativeId);
  assert(
    publicList.some((item) => item.decisionId === primaryDecisionId),
    "Initiative public list includes decision",
  );
  assertNoPrivateFields(publicList, "Public collective decision list");

  const publicDetail = getPublicInitiativeCollectiveDecision(primaryDecisionId);
  assert(publicDetail !== null, "Public detail projection required");
  assertNoPrivateFields(publicDetail, "Public collective decision detail");
  assert(
    !JSON.stringify(publicDetail).includes("previousChoice"),
    "Vote history must not appear in public payload",
  );

  const myVote = getMyInitiativeDecisionVote(verifiedVoter, primaryDecisionId);
  assert(myVote !== null, "Authenticated my-vote remains available to participant");

  console.log("10. No weighting and no AI outcome logic");

  for (const term of FORBIDDEN_OUTCOME_TERMS) {
    assert(!resultsSource.includes(term), `Outcome logic must not include ${term}`);
  }
  assert(
    listVotesForDecision(primaryDecisionId).every(
      (vote) =>
        vote.choice === "support" || vote.choice === "do_not_support" || vote.choice === "abstain",
    ),
    "Votes remain unweighted choices only",
  );

  console.log("11. Public Experience stability");

  verifyPublicExperienceUnchanged();
}

function spawnReload(scriptName: string, args: string[], env: Record<string, string>): void {
  const reloadScriptPath = path.resolve(path.dirname(SCRIPT_PATH), scriptName);
  const result = spawnSync("npx", ["tsx", reloadScriptPath, ...args], {
    cwd: path.resolve(path.dirname(SCRIPT_PATH), "../.."),
    env: { ...process.env, ...env },
    stdio: "pipe",
    encoding: "utf-8",
  });

  assert(result.status === 0, `Reload verification failed for ${scriptName}`);
}

async function runPersistenceVerification(): Promise<void> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hu-collective-decision-e2e-"));
  const decisionPath = path.join(tempDir, "initiative-collective-decisions.json");
  const votePath = path.join(tempDir, "initiative-decision-votes.json");
  const areaPath = path.join(tempDir, "participation-areas.json");

  process.env.INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE = "file";
  process.env.INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE_PATH = decisionPath;
  process.env.INITIATIVE_DECISION_VOTE_PERSISTENCE = "file";
  process.env.INITIATIVE_DECISION_VOTE_PERSISTENCE_PATH = votePath;
  process.env.PARTICIPATION_AREA_PERSISTENCE = "file";
  process.env.PARTICIPATION_AREA_PERSISTENCE_PATH = areaPath;
  process.env.INITIATIVE_PERSISTENCE = "memory";
  process.env.INITIATIVE_ANALYSIS_PERSISTENCE = "memory";
  process.env.INITIATIVE_IMPROVEMENT_PROPOSAL_PERSISTENCE = "memory";
  process.env.INITIATIVE_VERSION_REVISION_PERSISTENCE = "memory";
  process.env.DECISION_SESSION_PERSISTENCE = "memory";

  const { closeInitiativeCollectiveDecision } =
    await import("../modules/initiative-collective-decision/initiative-collective-decision.service.js");
  const { castOrUpdateInitiativeDecisionVote } =
    await import("../modules/initiative-decision-vote/initiative-decision-vote.service.js");

  await seedParticipants();
  const initiativeId = await buildMatureInitiative();
  const sessionId = await createClosedDecisionSession(initiativeId, "Persistence question?");
  const decisionId = await createCollectiveDecisionDraft(initiativeId, sessionId, "community");
  await openCollectiveDecision(decisionId);
  castOrUpdateInitiativeDecisionVote(verifiedVoter, decisionId, { choice: "support" });
  castOrUpdateInitiativeDecisionVote(unverifiedVoter, decisionId, { choice: "support" });
  closeInitiativeCollectiveDecision(steward, decisionId);

  const reloadEnv = {
    INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE: "file",
    INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE_PATH: decisionPath,
    INITIATIVE_DECISION_VOTE_PERSISTENCE: "file",
    INITIATIVE_DECISION_VOTE_PERSISTENCE_PATH: votePath,
    PARTICIPATION_AREA_PERSISTENCE: "file",
    PARTICIPATION_AREA_PERSISTENCE_PATH: areaPath,
  };

  spawnReload(
    "verify-initiative-collective-decision-store-reload.ts",
    [decisionId, "closed"],
    reloadEnv,
  );
  spawnReload(
    "verify-initiative-decision-vote-store-reload.ts",
    [decisionId, verifiedVoter.participantId, "support", "1"],
    reloadEnv,
  );
  spawnReload(
    "verify-collective-decision-public-results-reload.ts",
    [decisionId, "2", "supported"],
    reloadEnv,
  );

  fs.rmSync(tempDir, { recursive: true, force: true });

  console.log("12. Persistence — votes, decision status, and public results survive restart");
}

async function main(): Promise<void> {
  if (process.env.VERIFY_COLLECTIVE_DECISION_PERSISTENCE === "1") {
    await runPersistenceVerification();
    console.log("Collective Decision persistence checks passed.");
    return;
  }

  await runMainVerification();

  const persistenceResult = spawnSync("npx", ["tsx", SCRIPT_PATH], {
    env: {
      ...process.env,
      VERIFY_COLLECTIVE_DECISION_PERSISTENCE: "1",
      INITIATIVE_PERSISTENCE: "memory",
      INITIATIVE_ANALYSIS_PERSISTENCE: "memory",
      INITIATIVE_IMPROVEMENT_PROPOSAL_PERSISTENCE: "memory",
      INITIATIVE_VERSION_REVISION_PERSISTENCE: "memory",
      DECISION_SESSION_PERSISTENCE: "memory",
      INITIATIVE_COLLECTIVE_DECISION_PERSISTENCE: "memory",
      PARTICIPATION_AREA_PERSISTENCE: "memory",
      INITIATIVE_DECISION_VOTE_PERSISTENCE: "memory",
    },
    stdio: "inherit",
  });

  assert(persistenceResult.status === 0, "Persistence verification subprocess failed");

  console.log("All Collective Decision E2E checks passed.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Collective Decision E2E verification FAILED: ${message}`);
  process.exit(1);
});
