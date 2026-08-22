/**
 * Public Choice Fix 07A — vote authority: no Participation Area for PUBLIC_CHOICE
 * Select/Recall; STANDARD eligibility unchanged; Select → Recall → revote persistence.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { Initiative, InitiativeCollectiveDecision, Member } from "@hu/types";

import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import {
  castOrUpdateInitiativeDecisionVote,
  castOrUpdateVisitorInitiativeDecisionVote,
  recallInitiativeDecisionVote,
  recallVisitorInitiativeDecisionVote,
} from "../../../src/modules/initiative-decision-vote/initiative-decision-vote.service.js";
import {
  deleteVotesByDecisionIdForTests,
  listVotesForDecision,
} from "../../../src/modules/initiative-decision-vote/initiative-decision-vote.store.js";
import { listEffectiveVotesForDecision } from "../../../src/modules/initiative-decision-vote/list-effective-decision-votes.js";
import { buildBallotAggregates } from "../../../src/modules/initiative-decision-vote/initiative-decision-vote-ballot-aggregates.js";
import { createPublicChoiceCandidateForInitiative } from "../../../src/modules/public-choice-candidate/public-choice-candidate.service.js";
import { deletePublicChoiceCandidatesByInitiativeForTests } from "../../../src/modules/public-choice-candidate/persistence/public-choice-candidate.repository.js";
import { createInitiative, deleteInitiative } from "../../../src/modules/initiatives/initiative.store.js";
import type { RequestIdentity } from "../../../src/modules/initiatives/identity/request-identity.types.js";
import { seedMember } from "../../../src/modules/member/member.store.js";
import { deleteParticipationAreasByParticipantIdForTests } from "../../../src/modules/participation-area/participation-area.store.js";

if (!isMongoAvailableForTests()) {
  skipIfMongoUnavailable();
}

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../../../../../");
const testRunId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

const steward: RequestIdentity = { participantId: `fix07a-author-${testRunId}` };
const participant: RequestIdentity = { participantId: `fix07a-participant-${testRunId}` };
const standardVoter: RequestIdentity = { participantId: `fix07a-standard-${testRunId}` };
const trackedInitiativeIds: string[] = [];
const trackedDecisionIds: string[] = [];

function readRepo(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function trackInitiative(id: string): string {
  trackedInitiativeIds.push(id);
  return id;
}

function trackDecision(id: string): string {
  trackedDecisionIds.push(id);
  return id;
}

function buildMember(id: string): Member {
  return {
    id,
    profile: {
      displayName: id,
      uniqueName: id.replace(/[^a-z0-9]/gi, "-"),
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

function buildPublicChoiceInitiative(initiativeId: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId,
    stewardId: steward.participantId,
    createdAt: now,
    updatedAt: now,
    title: "Fix 07A Election",
    description: "Vote authority",
    status: "discussion",
    lifecyclePhase: "discussion",
    lifecycleProfile: "PUBLIC_CHOICE",
    visibility: { policy: "public" },
    metadata: {
      category: "",
      tags: [],
      region: "",
      language: "en",
      countrySlug: "us",
      communitySlug: "",
      participationScope: "country",
      activityArea: "",
      ballotMode: "SELECT_ONE_CANDIDATE",
    },
    revisions: [],
    contributions: [],
    timeline: [],
  };
}

function buildStandardInitiative(initiativeId: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId,
    stewardId: steward.participantId,
    createdAt: now,
    updatedAt: now,
    title: "Fix 07A STANDARD",
    description: "PA still required",
    status: "poll",
    lifecyclePhase: "projected",
    lifecycleProfile: "STANDARD",
    visibility: { policy: "public" },
    metadata: {
      category: "environment",
      tags: [],
      region: "Global",
      language: "en",
      communitySlug: "fix07a-community",
      activityArea: "Environment",
    },
    revisions: [],
    contributions: [],
    timeline: [],
  };
}

function buildOpenDecision(input: {
  decisionId: string;
  initiativeId: string;
}): InitiativeCollectiveDecision {
  return {
    decisionId: input.decisionId,
    initiativeId: input.initiativeId,
    decisionSessionId: null,
    stewardId: steward.participantId,
    sequenceNumber: 1,
    participationScope: "world",
    status: "opened",
    question: "Who should win?",
    openedAt: new Date(Date.now() - 60_000).toISOString(),
    closesAt: new Date(Date.now() + 3_600_000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function candidateCount(
  aggregates: ReturnType<typeof buildBallotAggregates>,
  candidateId: string,
): number {
  if (aggregates.ballotMode !== "SELECT_ONE_CANDIDATE") {
    return -1;
  }
  return aggregates.candidates.find((row) => row.candidateId === candidateId)?.count ?? 0;
}

before(async () => {
  await connectMongoClient();
  await ensureMongoIndexes();
  seedMember(buildMember(steward.participantId));
  seedMember(buildMember(participant.participantId));
  seedMember(buildMember(standardVoter.participantId));
  deleteParticipationAreasByParticipantIdForTests(steward.participantId);
  deleteParticipationAreasByParticipantIdForTests(participant.participantId);
  deleteParticipationAreasByParticipantIdForTests(standardVoter.participantId);
});

after(async () => {
  for (const decisionId of trackedDecisionIds) {
    await deleteVotesByDecisionIdForTests(decisionId);
  }
  for (const initiativeId of trackedInitiativeIds) {
    await deletePublicChoiceCandidatesByInitiativeForTests(initiativeId);
    try {
      deleteInitiative(initiativeId);
    } catch {
      // already gone
    }
  }
  deleteParticipationAreasByParticipantIdForTests(steward.participantId);
  deleteParticipationAreasByParticipantIdForTests(participant.participantId);
  deleteParticipationAreasByParticipantIdForTests(standardVoter.participantId);
  await disconnectMongoClient();
});

describe("Public Choice Fix 07A — source contracts", () => {
  it("PUBLIC_CHOICE Select skips evaluateVoteEligibility; STANDARD still uses it", () => {
    const service = readRepo(
      "apps/api/src/modules/initiative-decision-vote/initiative-decision-vote.service.ts",
    );
    assert.match(service, /assertPublicChoiceAuthenticatedVoter/);
    assert.match(
      service,
      /PUBLIC_CHOICE candidate Select\/Recall does NOT require Participation Area/,
    );
    assert.match(service, /lifecycle === "PUBLIC_CHOICE"/);
    assert.match(service, /return castPublicChoiceParticipantVote/);
    assert.match(service, /STANDARD ternary voting still uses evaluateVoteEligibility/);
    assert.match(service, /const eligibility = await evaluateVoteEligibility/);
    assert.match(
      service,
      /async function castPublicChoiceParticipantVote[\s\S]*?assertPublicChoiceAuthenticatedVoter[\s\S]*?return castOrChangeInitiativeDecisionVote/,
    );
    assert.doesNotMatch(
      service,
      /async function castPublicChoiceParticipantVote[\s\S]*?evaluateVoteEligibility[\s\S]*?return castOrChangeInitiativeDecisionVote/,
    );
  });

  it("Participation Area rejection message remains for STANDARD eligibility", () => {
    const eligibility = readRepo("packages/types/src/domain/participation-eligibility.ts");
    assert.match(eligibility, /missing_participation_area/);
    assert.match(
      eligibility,
      /Participant must declare a Participation Area before participating/,
    );
  });
});

describe("Public Choice Fix 07A — Select/Recall without Participation Area", () => {
  it("Participant Select → Recall → Select B keeps one effective vote; Author + Visitor work", async () => {
    const initiativeId = trackInitiative(`initiative-fix07a-${testRunId}`);
    const decisionId = trackDecision(`collective-decision-fix07a-${testRunId}`);
    createInitiative(buildPublicChoiceInitiative(initiativeId));

    const candidateA = await createPublicChoiceCandidateForInitiative(steward, initiativeId, {
      name: "Candidate A",
    });
    const candidateB = await createPublicChoiceCandidateForInitiative(steward, initiativeId, {
      name: "Candidate B",
    });

    const decision = buildOpenDecision({ decisionId, initiativeId });
    const deps = {
      getDecision: (id: string) => (id === decisionId ? decision : null),
      getInitiative: (id: string) =>
        id === initiativeId ? buildPublicChoiceInitiative(initiativeId) : null,
    };

    const beforeVotes = await listEffectiveVotesForDecision(decisionId);
    const beforeAgg = buildBallotAggregates({
      ballotMode: "SELECT_ONE_CANDIDATE",
      votes: beforeVotes,
      candidateIds: [candidateA.candidateId, candidateB.candidateId],
    });
    const aBefore = candidateCount(beforeAgg, candidateA.candidateId);
    const bBefore = candidateCount(beforeAgg, candidateB.candidateId);

    const selected = await castOrUpdateInitiativeDecisionVote(
      participant,
      decisionId,
      { choice: "candidate", candidateId: candidateA.candidateId },
      deps,
    );
    assert.equal(selected.choice, "candidate");
    assert.equal(selected.candidateId, candidateA.candidateId);

    const afterSelect = await listEffectiveVotesForDecision(decisionId);
    assert.equal(afterSelect.length, 1);
    const afterSelectAgg = buildBallotAggregates({
      ballotMode: "SELECT_ONE_CANDIDATE",
      votes: afterSelect,
      candidateIds: [candidateA.candidateId, candidateB.candidateId],
    });
    assert.equal(candidateCount(afterSelectAgg, candidateA.candidateId), aBefore + 1);

    await recallInitiativeDecisionVote(participant, decisionId, deps);
    const afterRecall = await listEffectiveVotesForDecision(decisionId);
    assert.equal(afterRecall.length, 0);
    const afterRecallAgg = buildBallotAggregates({
      ballotMode: "SELECT_ONE_CANDIDATE",
      votes: afterRecall,
      candidateIds: [candidateA.candidateId, candidateB.candidateId],
    });
    assert.equal(candidateCount(afterRecallAgg, candidateA.candidateId), aBefore);

    const revote = await castOrUpdateInitiativeDecisionVote(
      participant,
      decisionId,
      { choice: "candidate", candidateId: candidateB.candidateId },
      deps,
    );
    assert.equal(revote.candidateId, candidateB.candidateId);
    const afterRevote = await listEffectiveVotesForDecision(decisionId);
    assert.equal(afterRevote.length, 1);
    assert.equal(afterRevote[0]?.participantId, participant.participantId);
    const afterRevoteAgg = buildBallotAggregates({
      ballotMode: "SELECT_ONE_CANDIDATE",
      votes: afterRevote,
      candidateIds: [candidateA.candidateId, candidateB.candidateId],
    });
    assert.equal(candidateCount(afterRevoteAgg, candidateA.candidateId), aBefore);
    assert.equal(candidateCount(afterRevoteAgg, candidateB.candidateId), bBefore + 1);

    const authorVote = await castOrUpdateInitiativeDecisionVote(
      steward,
      decisionId,
      { choice: "candidate", candidateId: candidateA.candidateId },
      deps,
    );
    assert.equal(authorVote.candidateId, candidateA.candidateId);

    const visitorKey = `visitorfix07a${testRunId}`.slice(0, 32);
    const visitorVote = await castOrUpdateVisitorInitiativeDecisionVote(
      visitorKey,
      decisionId,
      { choice: "candidate", candidateId: candidateB.candidateId },
      deps,
    );
    assert.equal(visitorVote.choice, "candidate");
    assert.equal(visitorVote.candidateId, candidateB.candidateId);

    await recallVisitorInitiativeDecisionVote(visitorKey, decisionId, deps);

    const durable = await listVotesForDecision(decisionId);
    assert.ok(durable.some((vote) => vote.participantId === participant.participantId));
    assert.ok(durable.some((vote) => vote.participantId === steward.participantId));
  });

  it("vote routes omit visitorKey from HTTP payloads", () => {
    const routes = readRepo(
      "apps/api/src/modules/initiative-collective-decision/initiative-collective-decision-vote.routes.ts",
    );
    assert.match(routes, /toClientVoteProjection/);
    assert.match(routes, /never expose visitorKey/);
    assert.match(routes, /createSuccessResponse\(toClientVoteProjection\(vote\)/);
  });

  it("STANDARD cast still rejects missing Participation Area", async () => {
    const initiativeId = trackInitiative(`initiative-fix07a-std-${testRunId}`);
    const decisionId = trackDecision(`collective-decision-fix07a-std-${testRunId}`);
    createInitiative(buildStandardInitiative(initiativeId));

    const decision = buildOpenDecision({ decisionId, initiativeId });
    const deps = {
      getDecision: (id: string) => (id === decisionId ? decision : null),
      getInitiative: (id: string) =>
        id === initiativeId ? buildStandardInitiative(initiativeId) : null,
    };

    await assert.rejects(
      () =>
        castOrUpdateInitiativeDecisionVote(
          standardVoter,
          decisionId,
          { choice: "support" },
          deps,
        ),
      /Participation Area/,
    );
  });
});
