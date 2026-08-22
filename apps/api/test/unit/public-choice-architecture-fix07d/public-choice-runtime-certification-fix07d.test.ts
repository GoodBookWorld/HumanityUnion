/**
 * Public Choice Fix 07D — final runtime certification (API).
 * Certification only: realistic OPEN election (staging-shaped), Select/Recall,
 * four-surface aggregates, close/retention contracts, STANDARD isolation.
 * Isolated hu_test_* Mongo with guaranteed drop.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { Initiative, InitiativeCollectiveDecision, Member } from "@hu/types";
import {
  computePublicChoiceResultsExpireAt,
  percentageOfTotal,
  resolvePublicChoiceElectionVotingStatus,
} from "@hu/types";

import { isMongoAvailableForTests, skipIfMongoUnavailable } from "../../helpers/test-env.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../../../src/infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../../../src/infrastructure/mongodb/mongo-indexes.js";
import { resolveMongoConfig } from "../../../src/infrastructure/mongodb/mongo-config.js";
import {
  dropIsolatedTestDatabase,
  TEST_DATABASE_ENV_VAR,
} from "../../../scripts/test-mongo-isolation.js";
import {
  castOrUpdateInitiativeDecisionVote,
  castOrUpdateVisitorInitiativeDecisionVote,
  computePublicChoiceBallotAggregatesForDecision,
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
import {
  toPublicInitiativeCollectiveDecisionListItem,
  toPublicInitiativeCollectiveDecisionProjection,
} from "../../../src/modules/initiative-collective-decision/public-initiative-collective-decision.projection.js";
import {
  closePublicChoiceElectionForInitiative,
} from "../../../src/modules/initiative-collective-decision/initiative-collective-decision.service.js";
import {
  createDecision,
  getDecisionById,
} from "../../../src/modules/initiative-collective-decision/initiative-collective-decision.store.js";
import { findPublicChoiceResultsSnapshotByDecision } from "../../../src/modules/public-choice-results-retention/public-choice-results-snapshot.repository.js";
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

/** Staging-shaped fixture id prefix (isolated copy; never mutates staging). */
const STAGING_SHAPED_PREFIX = "initiative-1787189571159";

const steward: RequestIdentity = { participantId: `fix07d-author-${testRunId}` };
const participant: RequestIdentity = { participantId: `fix07d-participant-${testRunId}` };
const standardVoter: RequestIdentity = { participantId: `fix07d-standard-${testRunId}` };
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
    title: "Mr.Scorpion",
    description: "Fix 07D certification election (staging-shaped)",
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
      communityAssociation: "Mr.Scorpion",
      participationScope: "country",
      activityArea: "",
      ballotMode: "SELECT_ONE_CANDIDATE",
      startDate: "2026-08-19",
      completionDate: "2026-09-19",
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
    title: "Fix 07D STANDARD",
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
      communitySlug: "fix07d-community",
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
  return createDecision({
    decisionId: input.decisionId,
    initiativeId: input.initiativeId,
    decisionSessionId: null,
    stewardId: steward.participantId,
    sequenceNumber: 1,
    participationScope: "world",
    status: "opened",
    question: "Public Choice election: Mr.Scorpion",
    openedAt: new Date(Date.now() - 60_000).toISOString(),
    closesAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

function tally(
  aggregates: Awaited<ReturnType<typeof computePublicChoiceBallotAggregatesForDecision>>,
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

  const isolatedName = process.env[TEST_DATABASE_ENV_VAR]?.trim();
  const uri = process.env.MONGODB_URI?.trim();
  if (isolatedName?.startsWith("hu_test_") && uri) {
    try {
      await dropIsolatedTestDatabase({ databaseName: isolatedName, uri });
    } catch {
      // best-effort
    }
  }
  await disconnectMongoClient();
});

describe("Public Choice Fix 07D — isolation + profile gates", () => {
  it("runs against isolated hu_test_* database", () => {
    const configured = process.env[TEST_DATABASE_ENV_VAR] ?? resolveMongoConfig().database;
    assert.match(configured, /^hu_test_[a-zA-Z0-9_]+$/);
    assert.notEqual(configured, "humanity_union_staging");
    assert.notEqual(configured, STAGING_SHAPED_PREFIX);
  });

  it("PUBLIC_CHOICE vote authority skips Participation Area; STANDARD keeps it", () => {
    const service = readRepo(
      "apps/api/src/modules/initiative-decision-vote/initiative-decision-vote.service.ts",
    );
    assert.match(service, /assertPublicChoiceAuthenticatedVoter/);
    assert.match(service, /lifecycle === "PUBLIC_CHOICE"/);
    assert.match(service, /evaluateVoteEligibility/);
  });

  it("PUBLIC_CHOICE experience never emits collective-decisions/public href", () => {
    const experience = readRepo(
      "apps/api/src/modules/initiatives/public-initiative-experience.service.ts",
    );
    assert.match(
      experience,
      /publicHref: isPublicChoiceLifecycle\s*\?\s*`\/initiatives\/public\/\$\{encodeURIComponent\(initiativeId\)\}\/election`/,
    );
  });
});

describe("Public Choice Fix 07D — one-effective-vote + four-surface sync", () => {
  it("staging-shaped OPEN election: Visitor A → Participant B → Author A → Recall B", async () => {
    const initiativeId = trackInitiative(`${STAGING_SHAPED_PREFIX}-fix07d-${testRunId}`);
    const decisionId = trackDecision(`collective-decision-fix07d-${testRunId}`);
    const initiative = buildPublicChoiceInitiative(initiativeId);
    createInitiative(initiative);

    const candidateA = await createPublicChoiceCandidateForInitiative(steward, initiativeId, {
      name: "Candidate A",
    });
    const candidateB = await createPublicChoiceCandidateForInitiative(steward, initiativeId, {
      name: "Candidate B",
    });
    const candidateC = await createPublicChoiceCandidateForInitiative(steward, initiativeId, {
      name: "Candidate C",
    });
    const candidateIds = [
      candidateA.candidateId,
      candidateB.candidateId,
      candidateC.candidateId,
    ] as const;

    buildOpenDecision({ decisionId, initiativeId });
    const decision = getDecisionById(decisionId);
    assert.ok(decision);
    assert.equal(decision.status, "opened");

    const deps = {
      getDecision: (id: string) => getDecisionById(id),
      getInitiative: (id: string) => (id === initiativeId ? initiative : null),
    };

    async function fourSurfaces() {
      const votes = await listEffectiveVotesForDecision(decisionId);
      const fromVotes = buildBallotAggregates({
        ballotMode: "SELECT_ONE_CANDIDATE",
        votes,
        candidateIds,
      });
      const fromService = await computePublicChoiceBallotAggregatesForDecision(
        decisionId,
        initiative,
      );
      const liveDecision = getDecisionById(decisionId)!;
      const listItem = await toPublicInitiativeCollectiveDecisionListItem(liveDecision);
      const detail = await toPublicInitiativeCollectiveDecisionProjection(liveDecision);

      assert.deepEqual(fromService, fromVotes);
      assert.deepEqual(listItem.ballotAggregates, fromService);
      assert.deepEqual(detail.ballotAggregates, fromService);

      // Public projections must never leak visitorKey.
      assert.doesNotMatch(JSON.stringify(listItem), /visitorKey/);
      assert.doesNotMatch(JSON.stringify(detail), /visitorKey/);

      return fromService;
    }

    const zero = await fourSurfaces();
    assert.equal(zero.ballotMode, "SELECT_ONE_CANDIDATE");
    assert.equal(zero.totalEffectiveVoters, 0);
    assert.equal(tally(zero, candidateA.candidateId), 0);
    assert.equal(tally(zero, candidateB.candidateId), 0);
    assert.equal(tally(zero, candidateC.candidateId), 0);
    assert.equal(zero.participationBreakdown.visitors, 0);
    assert.equal(zero.participationBreakdown.participants, 0);
    assert.equal(zero.participationBreakdown.members, 0);

    const votingStatus = resolvePublicChoiceElectionVotingStatus({
      decisionStatus: decision.status,
      openedAt: decision.openedAt,
      closesAt: decision.closesAt,
      closedAt: decision.closedAt,
    });
    assert.equal(votingStatus, "OPEN");

    const visitorKey = `visitorfix07d${testRunId}`.slice(0, 32);
    await castOrUpdateVisitorInitiativeDecisionVote(
      visitorKey,
      decisionId,
      { choice: "candidate", candidateId: candidateA.candidateId },
      deps,
    );
    let agg = await fourSurfaces();
    assert.equal(tally(agg, candidateA.candidateId), 1);
    assert.equal(tally(agg, candidateB.candidateId), 0);
    assert.equal(agg.totalEffectiveVoters, 1);
    assert.equal(agg.participationBreakdown.visitors, 1);

    // Duplicate Visitor Select A must not create a second effective vote.
    await castOrUpdateVisitorInitiativeDecisionVote(
      visitorKey,
      decisionId,
      { choice: "candidate", candidateId: candidateA.candidateId },
      deps,
    );
    agg = await fourSurfaces();
    assert.equal(tally(agg, candidateA.candidateId), 1);
    assert.equal((await listEffectiveVotesForDecision(decisionId)).length, 1);

    await castOrUpdateInitiativeDecisionVote(
      participant,
      decisionId,
      { choice: "candidate", candidateId: candidateB.candidateId },
      deps,
    );
    agg = await fourSurfaces();
    assert.equal(tally(agg, candidateA.candidateId), 1);
    assert.equal(tally(agg, candidateB.candidateId), 1);
    assert.equal(agg.totalEffectiveVoters, 2);
    assert.equal(percent(agg, candidateA.candidateId), 50);
    assert.equal(agg.participationBreakdown.visitors, 1);
    assert.equal(agg.participationBreakdown.participants, 1);

    await castOrUpdateInitiativeDecisionVote(
      steward,
      decisionId,
      { choice: "candidate", candidateId: candidateA.candidateId },
      deps,
    );
    agg = await fourSurfaces();
    assert.equal(tally(agg, candidateA.candidateId), 2);
    assert.equal(tally(agg, candidateB.candidateId), 1);
    assert.equal(agg.totalEffectiveVoters, 3);
    assert.equal(percent(agg, candidateA.candidateId), percentageOfTotal(2, 3));
    assert.equal(agg.participationBreakdown.visitors, 1);
    assert.equal(agg.participationBreakdown.participants, 2);
    assert.equal(agg.participationBreakdown.members, 0);
    assert.equal(
      agg.participationBreakdown.visitors +
        agg.participationBreakdown.participants +
        agg.participationBreakdown.members,
      3,
    );

    await recallInitiativeDecisionVote(participant, decisionId, deps);
    agg = await fourSurfaces();
    assert.equal(tally(agg, candidateA.candidateId), 2);
    assert.equal(tally(agg, candidateB.candidateId), 0);
    assert.equal(agg.totalEffectiveVoters, 2);
    assert.equal(percent(agg, candidateA.candidateId), 100);

    const effective = await listEffectiveVotesForDecision(decisionId);
    assert.equal(effective.length, 2);
    assert.ok(!effective.some((vote) => vote.participantId === participant.participantId));

    await recallVisitorInitiativeDecisionVote(visitorKey, decisionId, deps);
    const afterVisitorRecall = await listEffectiveVotesForDecision(decisionId);
    assert.equal(afterVisitorRecall.length, 1);

    const durable = await listVotesForDecision(decisionId);
    assert.ok(durable.length >= 1);
  });
});

describe("Public Choice Fix 07D — close + retention regression", () => {
  it("manual close freezes FINAL RESULTS snapshot and blocks Select/Recall", async () => {
    const initiativeId = trackInitiative(`initiative-fix07d-close-${testRunId}`);
    const decisionId = trackDecision(`collective-decision-fix07d-close-${testRunId}`);
    const initiative = buildPublicChoiceInitiative(initiativeId);
    createInitiative(initiative);

    const candidate = await createPublicChoiceCandidateForInitiative(steward, initiativeId, {
      name: "Close Candidate",
    });
    buildOpenDecision({ decisionId, initiativeId });

    const deps = {
      getDecision: (id: string) => getDecisionById(id),
      getInitiative: (id: string) => (id === initiativeId ? initiative : null),
    };

    await castOrUpdateInitiativeDecisionVote(
      participant,
      decisionId,
      { choice: "candidate", candidateId: candidate.candidateId },
      deps,
    );

    await closePublicChoiceElectionForInitiative(steward, initiativeId);
    const closed = getDecisionById(decisionId);
    assert.ok(closed);
    assert.equal(closed.status, "closed");
    assert.ok(closed.closedAt);

    const status = resolvePublicChoiceElectionVotingStatus({
      decisionStatus: closed.status,
      openedAt: closed.openedAt,
      closesAt: closed.closesAt,
      closedAt: closed.closedAt,
    });
    assert.equal(status, "CLOSED");

    const snapshot = await findPublicChoiceResultsSnapshotByDecision(decisionId);
    assert.ok(snapshot);
    assert.equal(snapshot.ballotAggregates.ballotMode, "SELECT_ONE_CANDIDATE");

    const expireAt = computePublicChoiceResultsExpireAt(closed.closedAt);
    assert.ok(Date.parse(expireAt) - Date.parse(closed.closedAt) === 72 * 60 * 60 * 1000);

    await assert.rejects(
      () =>
        castOrUpdateInitiativeDecisionVote(
          participant,
          decisionId,
          { choice: "candidate", candidateId: candidate.candidateId },
          deps,
        ),
      /closed|not open|voting|accept/i,
    );
    await assert.rejects(
      () => recallInitiativeDecisionVote(participant, decisionId, deps),
      /closed|not open|voting|recall|accept/i,
    );

    const projection = await toPublicInitiativeCollectiveDecisionProjection(closed);
    assert.equal(projection.ballotAggregates?.ballotMode, "SELECT_ONE_CANDIDATE");
    assert.ok(
      projection.resultsRetention?.status === "results_available" ||
        projection.resultsRetention?.downloadAvailable === true ||
        projection.status === "closed",
    );
  });
});

describe("Public Choice Fix 07D — STANDARD regression", () => {
  it("STANDARD Select still requires Participation Area", async () => {
    const initiativeId = trackInitiative(`initiative-fix07d-std-${testRunId}`);
    const decisionId = trackDecision(`collective-decision-fix07d-std-${testRunId}`);
    createInitiative(buildStandardInitiative(initiativeId));
    createDecision({
      decisionId,
      initiativeId,
      decisionSessionId: null,
      stewardId: steward.participantId,
      sequenceNumber: 1,
      participationScope: "world",
      status: "opened",
      question: "Support?",
      openedAt: new Date(Date.now() - 60_000).toISOString(),
      closesAt: new Date(Date.now() + 3_600_000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const deps = {
      getDecision: (id: string) => getDecisionById(id),
      getInitiative: (id: string) =>
        id === initiativeId ? buildStandardInitiative(initiativeId) : null,
    };

    await assert.rejects(
      () =>
        castOrUpdateInitiativeDecisionVote(standardVoter, decisionId, { choice: "support" }, deps),
      /Participation Area/,
    );
  });
});

function percent(
  aggregates: Awaited<ReturnType<typeof computePublicChoiceBallotAggregatesForDecision>>,
  candidateId: string,
): number {
  if (aggregates.ballotMode !== "SELECT_ONE_CANDIDATE") {
    return -1;
  }
  return aggregates.candidates.find((row) => row.candidateId === candidateId)?.percentage ?? -1;
}
